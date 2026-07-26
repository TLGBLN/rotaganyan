import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { parseFullReport } from "@/lib/md-report-parser";
import { reconstructFlattenedMarkdown } from "@/lib/ai-paste-fix";
import { completeFullField, assertPublishSafe, type PickInput } from "@/server/actions/prediction.actions";

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[parse-report]", e);
    return NextResponse.json({ error: "Beklenmedik bir sunucu hatası oluştu. Tekrar deneyin." }, { status: 500 });
  }
}

async function handlePost(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { raceId, markdown } = await req.json();
  if (!raceId || !markdown) {
    return NextResponse.json({ error: "raceId ve markdown gerekli" }, { status: 400 });
  }

  const race = await db.race.findUnique({
    where: { id: raceId },
    include: {
      runners: { select: { id: true, no: true, name: true } },
      raceDay: { include: { hippodrome: true } },
    },
  });
  if (!race) {
    return NextResponse.json({ error: "Koşu bulunamadı" }, { status: 404 });
  }

  let parsed = parseFullReport(markdown);
  let aiFixed = false;

  // Sohbet arayüzünden render edilmiş tablo kopyalanınca | işaretleri ve satır
  // araları kaybolur ("Sıra No At ... 1 19 UPAMECANO ..." tek bir bitişik metne
  // dönüşür) — bu durumda Claude'a aynı veriyi gerçek markdown tabloya geri
  // çevirtip tekrar deniyoruz.
  if (!parsed.picks.length) {
    const reconstructed = await reconstructFlattenedMarkdown(markdown);
    if (reconstructed) {
      const retry = parseFullReport(reconstructed);
      if (retry.picks.length) {
        parsed = retry;
        aiFixed = true;
      }
    }
  }

  if (!parsed.picks.length) {
    return NextResponse.json(
      { error: "Nihai sıralama bulunamadı. 'NİHAİ SIRALAMA' tablosunu içeren tam rapor formatını kullanın." },
      { status: 422 }
    );
  }

  // Güvenlik kontrolü: rapor metninin kendi başlığı (Hipodrom/Koşu No) hedef koşuyla
  // uyuşmuyor mu? Uyuşmazsa yanlış koşuya yapıştırılmış olabilir — yazma işlemini durdur.
  const targetHippodrome = race.raceDay.hippodrome.name.trim().toUpperCase();
  const parsedHippodrome = parsed.hippodrome?.trim().toUpperCase();
  const hippodromeMismatch = parsedHippodrome && parsedHippodrome !== targetHippodrome;
  const raceNoMismatch = parsed.raceNo != null && parsed.raceNo !== race.raceNo;

  if (hippodromeMismatch || raceNoMismatch) {
    return NextResponse.json(
      {
        error:
          `Rapor başlığı (${parsed.hippodrome ?? "?"} — ${parsed.raceNo ?? "?"}. Koşu) ile seçili koşu ` +
          `(${race.raceDay.hippodrome.name} — ${race.raceNo}. Koşu) uyuşmuyor. Yanlış koşuya mı yapıştırdınız?`,
        mismatch: true,
      },
      { status: 409 }
    );
  }

  if (parsed.classType || parsed.breed || parsed.surface || parsed.distance) {
    await db.race.update({
      where: { id: raceId },
      data: {
        classType: parsed.classType ?? undefined,
        breed: parsed.breed ?? undefined,
        surface: parsed.surface ?? undefined,
        distance: parsed.distance ?? undefined,
        time: parsed.raceTime ?? undefined,
      },
    });
  }

  const runnerIdByNo: Record<number, string> = {};
  const runnerNameByNo: Record<number, string> = {};
  for (const r of race.runners) {
    runnerIdByNo[r.no] = r.id;
    runnerNameByNo[r.no] = r.name;
  }

  // Sütunlar kayarsa "Jokey" alanına bu yarıştaki bir at ismi düşebiliyor —
  // bunu tespit edip geçersiz sayıyoruz, sessizce yazmıyoruz.
  const horseNamesInRace = new Set([
    ...race.runners.map((r) => r.name.toUpperCase().trim()),
    ...parsed.runners.map((r) => r.name.toUpperCase().trim()),
  ]);

  for (const r of parsed.runners) {
    if (r.jockey && horseNamesInRace.has(r.jockey.toUpperCase().trim())) {
      r.jockey = undefined;
    }
    const data = {
      name: r.name,
      weight: r.weight ?? undefined,
      jockey: r.jockey ?? undefined,
      agf: r.agf ?? undefined,
      sire: r.sire ?? undefined,
      damSire: r.damSire ?? undefined,
      equipmentAdded: r.equipmentAdded ?? undefined,
      equipmentRemoved: r.equipmentRemoved ?? undefined,
      weightChange: r.weightChange ?? undefined,
      sameJockey: r.sameJockey ?? undefined,
    };

    const existingId = runnerIdByNo[r.no];
    if (existingId) {
      await db.runner.update({ where: { id: existingId }, data });
    } else {
      const created = await db.runner.create({ data: { raceId, no: r.no, ...data } });
      runnerIdByNo[r.no] = created.id;
    }
  }

  for (const g of parsed.gallops) {
    const runnerId = runnerIdByNo[g.runnerNo];
    if (!runnerId) continue;
    await db.gallop.create({
      data: {
        runnerId,
        date: g.date ?? new Date(),
        track: g.track,
        form: g.form,
        splits: g.splits,
      },
    });
  }

  // Picks may reference runners not present in the GENEL PROGRAM table; ensure they exist too.
  // Also update name if the existing runner has an empty or placeholder name (e.g. TJK ingest without names).
  for (const p of parsed.picks) {
    if (!runnerIdByNo[p.no]) {
      const created = await db.runner.create({ data: { raceId, no: p.no, name: p.name } });
      runnerIdByNo[p.no] = created.id;
    } else if (p.name) {
      const existingName = runnerNameByNo[p.no] ?? "";
      const isPlaceholder = !existingName.trim() || /^\d+$/.test(existingName.trim());
      if (isPlaceholder) {
        await db.runner.update({ where: { id: runnerIdByNo[p.no] }, data: { name: p.name } });
      }
    }
  }

  // 2026-07-24 kod denetimi: bu route eskiden picks'i doğrudan yazıp published:true
  // veriyordu — ne sahayı tamamlama (completeFullField) ne de yayın öncesi sert
  // kurallar (assertPublishSafe: boş pick / gerekçesiz AGF favorisi) hiç çalışmıyordu.
  // "NİHAİ SIRALAMA" şablonu yalnız ilk 6 atı içerdiği için, 7+ atlı her yapıştırmada
  // saha eksik yayınlanabiliyordu — tam olarak 2026-07-20'de elle giriş için bulunup
  // düzeltilen hatanın aynısı, farklı bir kapıdan. Artık iki fonksiyon da burada da çalışıyor.
  const pickInputs: PickInput[] = parsed.picks.map((p) => ({
    rank: p.rank,
    runnerId: runnerIdByNo[p.no],
    runnerLabel: `${p.no} ${p.name}`,
    score: p.score ?? undefined,
    details: p.details,
    pedigreeRating: p.pedigreeRating,
    isTarget: false,
  }));
  const completedPicks = await completeFullField(raceId, pickInputs);

  const prediction = await db.prediction.upsert({
    where: { raceId },
    create: {
      raceId,
      authorId: session.user.id,
      confidence: parsed.confidence,
      notes: parsed.notes ?? "",
      tempo: parsed.tempo,
      couponNarrow: parsed.couponNarrow,
      couponNormal: parsed.couponNormal,
      couponWide: parsed.couponWide,
      isBanko: parsed.isBanko,
      bankoNote: parsed.bankoNote,
      published: false,
    },
    update: {
      confidence: parsed.confidence,
      notes: parsed.notes ?? "",
      tempo: parsed.tempo,
      couponNarrow: parsed.couponNarrow,
      couponNormal: parsed.couponNormal,
      couponWide: parsed.couponWide,
      isBanko: parsed.isBanko,
      bankoNote: parsed.bankoNote,
    },
  });

  // Delete + recreate must be atomic — otherwise an overlapping submit (e.g. a
  // double-click) can interleave with this loop and leave stale picks mixed in
  // with the new ones.
  await db.$transaction(
    [
      db.pick.deleteMany({ where: { predictionId: prediction.id } }),
      ...completedPicks.map((p) =>
        db.pick.create({
          data: {
            predictionId: prediction.id,
            rank: p.rank,
            runnerId: p.runnerId ?? null,
            runnerLabel: p.runnerLabel,
            score: p.score ?? null,
            details: p.details,
            pedigreeRating: p.pedigreeRating,
          },
        })
      ),
    ],
    { timeout: 30000 }
  );

  // Yalnız sert kurallar geçerse otomatik yayınla — geçmezse taslak (published:false)
  // olarak bırak ve admin'e nedenini bildir (mevcut bir yayının üstüne yapıştırıldıysa
  // da, yeni veri kuralı geçmiyorsa yayından İNDİRİLİR — eski published:true'ya güvenilmez).
  let publishWarning: string | null = null;
  try {
    await assertPublishSafe(prediction.id);
    await db.prediction.update({ where: { id: prediction.id }, data: { published: true, publishedAt: new Date() } });
  } catch (e) {
    publishWarning = e instanceof Error ? e.message : "Yayınlanamadı, taslak olarak kaydedildi.";
    await db.prediction.update({ where: { id: prediction.id }, data: { published: false } });
  }

  return NextResponse.json({
    ok: true,
    predictionId: prediction.id,
    picks: completedPicks.length,
    runners: parsed.runners.length,
    aiFixed,
    publishWarning,
    coupon: {
      narrow: parsed.couponNarrow,
      normal: parsed.couponNormal,
      wide: parsed.couponWide,
      isBanko: parsed.isBanko,
    },
  });
}
