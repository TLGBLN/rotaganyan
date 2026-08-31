"use server";

// KALICI ARAÇ (V5.32, 2026-08-31) — SİLİNMİYOR. Kullanıcı talebi: bugün Elazığ 2.Altılı
// için elle yapılan süreç (gerçek olasılıklara bak, bütçe optimizasyonu yap, gizli-değer
// atlarını bul) admin panelinde bir "Kupon Oluştur" butonuna dönüştürülsün. BU FONKSİYON
// yalnız FORMU ÖN-DOLDURMAK için veri döner — asla `publishHomeKupon` ÇAĞIRMAZ, admin
// gözden geçirip mevcut "Yayınla" akışıyla yayınlar.
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { gatherFaz1V5, faz2V5Sirala, bagimsizGucluSinyalBul, tumOzellikleriListele } from "@/lib/methodology/v5-engine";
import { getAnalystStats, getClassTypeAdvice, isSiniftipiSikintili } from "@/server/services/admin.service";
import { optimizeKuponAllocation, type LegProbability } from "@/lib/methodology/kupon-optimizer";
import { ALTILI_STAKE_PER_COMBINATION } from "@/server/services/race.service";

export type KuponOnerisiInput = {
  hippodromeSlug: string;
  date: string; // YYYY-MM-DD
  raceNos: number[];
  /** LIMITS[width] — KuponForm.tsx'teki AYNI sabitler, tekrar tanımlanmasın diye çağıran taraftan geçiriliyor. */
  butceler: { narrow: number; normal: number; wide: number };
};

export type KuponOnerisiLeg = {
  raceNo: number;
  narrow: number[];
  normal: number[];
  wide: number[];
};

export type KuponOnerisiResult = { legs: KuponOnerisiLeg[]; notes: string[] };

const TOLERANCE = 1.10; // KuponForm.tsx ile AYNI %10 esneme payı

function maksKombinasyon(butceTL: number): number {
  return Math.floor((butceTL * TOLERANCE) / ALTILI_STAKE_PER_COMBINATION);
}

export async function generateKuponOnerisi(input: KuponOnerisiInput): Promise<KuponOnerisiResult> {
  await requireRole("EDITOR");

  const date = new Date(input.date + "T00:00:00.000Z");
  const dayEnd = new Date(date.getTime() + 86_400_000);

  const races = await db.race.findMany({
    where: {
      raceNo: { in: input.raceNos },
      raceDay: { date: { gte: date, lt: dayEnd }, hippodrome: { slug: input.hippodromeSlug } },
    },
    select: { id: true, raceNo: true, classType: true, runners: { where: { scratched: false }, select: { no: true, ekuriGroup: true } } },
    orderBy: { raceNo: "asc" },
  });

  const stats = await getAnalystStats(undefined, true);
  const notes: string[] = [];
  const legProbabilities: LegProbability[] = [];
  // raceNo -> gizli-deger atlarinin no listesi (henuz secimde yoksa Genis'e eklemeyi dene)
  const gizliDegerByRaceNo = new Map<number, number[]>();

  for (const raceNo of input.raceNos) {
    const race = races.find((r) => r.raceNo === raceNo);
    if (!race) {
      notes.push(`K${raceNo}: koşu bulunamadı, elle doldurun.`);
      continue;
    }
    const faz1 = await gatherFaz1V5(race.id);
    if (!faz1 || faz1.runners.length === 0) {
      notes.push(`K${raceNo}: analiz verisi yok (muhtemelen Karma aynası), elle doldurun.`);
      continue;
    }
    const sirali = faz2V5Sirala(faz1);
    // 2026-08-31 kullanıcı bulgusu (Elazığ K1): Faz1RunnerV5Sirali eküri grubunu dışa
    // aktarmıyor (yalnız AGF birleştirme için içeride kullanılıyor) — kupon-optimizer.ts'in
    // eküri-tekilleştirmesi için burada AYRI, hafif bir sorgudan (race.runners) okunuyor.
    const ekuriByNo = new Map(race.runners.map((r) => [r.no, r.ekuriGroup]));
    legProbabilities.push({
      raceNo,
      runners: sirali.map((r) => ({ no: r.no, olasilik: r.olasilik, ekuriGroup: ekuriByNo.get(r.no) ?? null })),
    });

    const advice = getClassTypeAdvice(stats, race.classType, faz1.runners.length);
    if (isSiniftipiSikintili(advice)) {
      notes.push(`K${raceNo}: 🚩 sınıf riski — bu tipte model favorisi tarihte yalnız %${advice.top1Rate!.rate.toFixed(0)} kazanmış, temkinli olun.`);
    }

    const gizliNos: number[] = [];
    for (const r of sirali) {
      if (r.teknikSira <= 3) continue;
      const sinyal = bagimsizGucluSinyalBul(tumOzellikleriListele(r));
      if (sinyal) {
        gizliNos.push(r.no);
        notes.push(`K${raceNo}: 💡 #${r.no} ${r.ad} (${r.teknikSira}. sırada) bağımsız güçlü sinyal taşıyor: ${sinyal.etiket}.`);
      }
    }
    if (gizliNos.length > 0) gizliDegerByRaceNo.set(raceNo, gizliNos);
  }

  const legs: KuponOnerisiLeg[] = legProbabilities.map((l) => ({ raceNo: l.raceNo, narrow: [], normal: [], wide: [] }));
  const widthKeys: (keyof KuponOnerisiInput["butceler"])[] = ["narrow", "normal", "wide"];
  const legKeyMap: Record<string, "narrow" | "normal" | "wide"> = { narrow: "narrow", normal: "normal", wide: "wide" };

  for (const width of widthKeys) {
    const sonuc = optimizeKuponAllocation(legProbabilities, maksKombinasyon(input.butceler[width]));
    if (!sonuc) {
      notes.push(`${width === "narrow" ? "Ekonomik" : width === "normal" ? "Normal" : "Geniş"}: bu bütçeyle uygun bir kombinasyon bulunamadı, elle doldurun.`);
      continue;
    }
    for (const alloc of sonuc.allocations) {
      const leg = legs.find((l) => l.raceNo === alloc.raceNo)!;
      leg[legKeyMap[width]] = [...alloc.picks];
    }
    // Geniş kademede: gizli-değer atı seçilmemişse VE eklemek bütçeye sığıyorsa ekle
    // (bugünkü ELİFNAZ HANIM kararının otomatik hali — ZORLAMAZ, yalnız sığdığında ekler).
    if (width === "wide") {
      for (const [raceNo, gizliNos] of gizliDegerByRaceNo) {
        const leg = legs.find((l) => l.raceNo === raceNo);
        if (!leg) continue;
        for (const no of gizliNos) {
          if (leg.wide.includes(no)) continue;
          const denemeLegs = legs.map((l) => (l.raceNo === raceNo ? { ...l, wide: [...l.wide, no] } : l));
          const toplamKombinasyon = denemeLegs.reduce((acc, l) => acc * Math.max(l.wide.length, 1), 1);
          if (toplamKombinasyon * ALTILI_STAKE_PER_COMBINATION <= input.butceler.wide * TOLERANCE) {
            leg.wide = [...leg.wide, no].sort((a, b) => a - b);
            notes.push(`K${raceNo}: 💡 gizli-değer atı #${no} Geniş kupona sığdığı için eklendi.`);
          } else {
            notes.push(`K${raceNo}: 💡 gizli-değer atı #${no} Geniş bütçesine sığmadı, elle eklemeyi düşünün.`);
          }
        }
      }
    }
  }

  return { legs, notes };
}
