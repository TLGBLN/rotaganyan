// ROTAGANYAN ANALİZ MOTORU v1.0 — YÖNETİCİYE ÖZEL TAHMİN API'Sİ (kullanıcı talimatı,
// 2026-10-20: "predict-v1.ts'i çağıran, yalnız yetkili yöneticinin kullanabileceği bir API").
// Bu uç nokta YALNIZ predict-v1.ts'in ÖNCEDEN eğitilmiş modelini skora uygular — yeni
// fitModel() ÇAĞRISI YOK, AGF/ganyan hiçbir aşamada okunmaz (predictRaceV1 zaten
// EXCLUDED_FROM_SCORING ile PIST_DURUM_01/DAV_START_RISK/TMP_DAV_KULVAR_01'i yapısal olarak
// dışarıda bırakıyor — burada AYRICA bir filtre eklenmedi, tek kaynak).
import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { predictRaceV1 } from "@/lib/motor-v1/engine/predict-v1";
import { loadTrainedV1Model, trainedModelVersion } from "@/lib/motor-v1/engine/load-trained-model";

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

  const ranked = [...result.scored].sort((a, b) => b.probability - a.probability);

  const runners = ranked.map((s) => {
    const explain = result.explain.get(s.no);
    const familyTotals = new Map<string, number>();
    for (const row of explain?.rows ?? []) {
      const fam = row.family ?? "DIGER";
      const contrib = row.scoreContribution + row.missingIndicatorContribution;
      familyTotals.set(fam, (familyTotals.get(fam) ?? 0) + contrib);
    }
    return {
      no: s.no,
      name: s.name,
      score: s.score,
      probability: s.probability,
      familyContributions: [...familyTotals.entries()].map(([family, contribution]) => ({ family, contribution })),
      signalRows: explain?.rows ?? [],
    };
  });

  return NextResponse.json({
    raceId,
    // 2026-10-21 düzeltme — kullanıcı bulgusu: result.contract.modelVersion, training.ts'in
    // SABİT MODEL_VERSION'ından (her zaman "preliminary-smallsample-2026-10-17") geliyordu,
    // hangi artefakt yüklenirse yüklensin DEĞİŞMİYORDU — yanıltıcı. trainedModelVersion()
    // GERÇEKTEN yüklenen artefaktın (v1-trained-model.json) KENDİ modelVersion alanını okur.
    modelVersion: trainedModelVersion(),
    modelCodeCount: result.contract.modelCodeCount,
    fullyPendingFamilies: result.contract.fullyPendingFamilies,
    partiallyScoredFamilies: result.contract.partiallyScoredFamilies,
    families: result.contract.families,
    interactions: result.contract.interactions,
    runners,
  });
}
