import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { parseFullReport } from "@/lib/md-report-parser";
import { reconstructFlattenedMarkdown } from "@/lib/ai-paste-fix";

export async function POST(req: NextRequest) {
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

  for (const r of parsed.runners) {
    const data = {
      name: r.name,
      weight: r.weight ?? undefined,
      jockey: r.jockey ?? undefined,
      agf: r.agf ?? undefined,
      sire: r.sire ?? undefined,
      damSire: r.damSire ?? undefined,
      pedigreeNote: r.pedigreeNote ?? undefined,
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
      published: true,
      publishedAt: new Date(),
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
      published: true,
      publishedAt: new Date(),
    },
  });

  // Delete + recreate must be atomic — otherwise an overlapping submit (e.g. a
  // double-click) can interleave with this loop and leave stale picks mixed in
  // with the new ones.
  await db.$transaction(
    [
      db.pick.deleteMany({ where: { predictionId: prediction.id } }),
      ...parsed.picks.map((p) =>
        db.pick.create({
          data: {
            predictionId: prediction.id,
            rank: p.rank,
            runnerId: runnerIdByNo[p.no] ?? null,
            runnerLabel: `${p.no} ${p.name}`,
            score: p.score,
            details: p.details,
            pedigreeRating: p.pedigreeRating,
          },
        })
      ),
    ],
    { timeout: 30000 }
  );

  return NextResponse.json({
    ok: true,
    predictionId: prediction.id,
    picks: parsed.picks.length,
    runners: parsed.runners.length,
    aiFixed,
    coupon: {
      narrow: parsed.couponNarrow,
      normal: parsed.couponNormal,
      wide: parsed.couponWide,
      isBanko: parsed.isBanko,
    },
  });
}
