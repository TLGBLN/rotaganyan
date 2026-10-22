// ROTAGANYAN ANALİZ MOTORU v1.0 — YÖNETİCİYE ÖZEL TAHMİN API'Sİ (kullanıcı talimatı,
// 2026-10-20: "predict-v1.ts'i çağıran, yalnız yetkili yöneticinin kullanabileceği bir API").
// Bu uç nokta YALNIZ predict-v1.ts'in ÖNCEDEN eğitilmiş modelini skora uygular — yeni
// fitModel() ÇAĞRISI YOK, AGF/ganyan hiçbir aşamada okunmaz (predictRaceV1 zaten
// EXCLUDED_FROM_SCORING ile PIST_DURUM_01/DAV_START_RISK/TMP_DAV_KULVAR_01'i yapısal olarak
// dışarıda bırakıyor — burada AYRICA bir filtre eklenmedi, tek kaynak).
import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { predictRaceV1 } from "@/lib/motor-v1/engine/predict-v1";
import { loadTrainedV1Model, trainedModelVersion, trainedModelMeta } from "@/lib/motor-v1/engine/load-trained-model";
import { computeAgfTrendForRace, siniflandirV1AgfDurumu } from "@/lib/motor-v1/features/agf-trend-watch";

type Body = { raceId: string };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { raceId } = (await req.json()) as Body;
  if (!raceId) return NextResponse.json({ error: "raceId gerekli" }, { status: 400 });

  const model = loadTrainedV1Model();
  const result = await predictRaceV1(raceId, model);
  if (!result) {
    return NextResponse.json({ error: "Bu yarış için analiz üretilemedi (saha boş veya veri eksik)" }, { status: 404 });
  }

  // 2026-10-21 — kullanıcı talebi: "yarışın pist, mesafe ve sınıf bilgileri gösterilsin".
  // Salt-okunur, TEK ek sorgu — skorlamaya/predictRaceV1'e hiçbir etkisi yok.
  const raceMeta = await db.race.findUnique({
    where: { id: raceId },
    select: {
      raceNo: true, time: true, breed: true, surface: true, distance: true, classType: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
    },
  });

  const ranked = [...result.scored].sort((a, b) => b.probability - a.probability);

  // 2026-10-21 — kullanıcı talebi: "AGF Trend ayrı bir piyasa izleme katmanı olsun, V1.0'ın
  // 38 özellikli modeli aynen kalsın". Bu KESİNLİKLE predictRaceV1/scoreRace'e BAĞLANMAZ —
  // ayrı bir sorgu, ayrı bir alan, yalnız gösterim. cutoff = race.raceDay.date (motorun
  // kendi PIT sınırıyla AYNI, agf-trend-watch.ts'in kendi notuna bakınız).
  const agfTrendByNo = raceMeta ? await computeAgfTrendForRace(raceId, raceMeta.raceDay.date) : new Map();
  const fieldSize = ranked.length;

  const runners = ranked.map((s) => {
    const explain = result.explain.get(s.no);
    const rows = explain?.rows ?? [];
    const familyTotals = new Map<string, number>();
    for (const row of rows) {
      const fam = row.family ?? "DIGER";
      const contrib = row.scoreContribution + row.missingIndicatorContribution;
      familyTotals.set(fam, (familyTotals.get(fam) ?? 0) + contrib);
    }
    const observedCount = rows.filter((r) => r.observed).length;
    const agfTrend = agfTrendByNo.get(s.no) ?? null;
    const v1AgfDurum = agfTrend ? siniflandirV1AgfDurumu(s.probability, fieldSize, agfTrend.yon) : "BELIRSIZ";
    return {
      no: s.no,
      name: s.name,
      score: s.score,
      probability: s.probability,
      familyContributions: [...familyTotals.entries()].map(([family, contribution]) => ({ family, contribution })),
      signalRows: rows,
      observedCount,
      totalCodeCount: rows.length,
      agfTrend,
      v1AgfDurum,
    };
  });

  return NextResponse.json({
    raceId,
    race: raceMeta ? {
      raceNo: raceMeta.raceNo, time: raceMeta.time, breed: raceMeta.breed, surface: raceMeta.surface,
      distance: raceMeta.distance, classType: raceMeta.classType,
      date: raceMeta.raceDay.date.toISOString(), hippodromeName: raceMeta.raceDay.hippodrome.name,
    } : null,
    analyzedAt: new Date().toISOString(),
    // 2026-10-21 düzeltme — kullanıcı bulgusu: result.contract.modelVersion, training.ts'in
    // SABİT MODEL_VERSION'ından (her zaman "preliminary-smallsample-2026-10-17") geliyordu,
    // hangi artefakt yüklenirse yüklensin DEĞİŞMİYORDU — yanıltıcı. trainedModelVersion()
    // GERÇEKTEN yüklenen artefaktın (v1-trained-model.json) KENDİ modelVersion alanını okur.
    modelVersion: trainedModelVersion(),
    modelMeta: trainedModelMeta(),
    modelCodeCount: result.contract.modelCodeCount,
    fullyPendingFamilies: result.contract.fullyPendingFamilies,
    partiallyScoredFamilies: result.contract.partiallyScoredFamilies,
    families: result.contract.families,
    interactions: result.contract.interactions,
    runners,
  });
}
