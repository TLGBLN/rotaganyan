import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { buildUnifiedFeatureVectorsForRace } from "@/lib/rotaganyan-analiz-motoru/feature-calculators/unified-feature-vector";
import { loadTrainedModel } from "@/lib/rotaganyan-analiz-motoru/load-trained-model";
import { getCurrentRanEngineVersion } from "@/lib/rotaganyan-analiz-motoru/engine-versions";
import {
  computeWeightsFingerprint,
  type RanPredictionSnapshot,
  type RanSignalSnapshotEntry,
} from "@/lib/rotaganyan-analiz-motoru/snapshot-integrity";
import { scoreRace, explainRunner } from "@/lib/motor-v1/engine/training";

// ROTAGANYAN ANALİZ MOTORU — İZOLE TEST ROUTE'U (kullanıcı talimatı madde 2, PR#12).
//
// Bu route /api/admin/test-v5-engine'in yetkilendirme+"salt-okuma deneme" DESENİNİ taklit
// eder ama TAMAMEN AYRI bir path'tedir ve tamamen AYRI bir motoru (production V5.46.1
// DEĞİL — yeni, henüz hiçbir yere bağlı olmayan "Rotaganyan Analiz Motoru") çağırır:
//
//  1) auth()+hasRole(EDITOR) — test-v5-engine ile AYNI yetkilendirme deseni.
//  2) buildUnifiedFeatureVectorsForRace(raceId) — eğitimde VE (parite kanıtlı) canlı-tarzı
//     çağrıda kullanılan AYNI tek fonksiyon (bkz. unified-feature-vector.ts).
//  3) loadTrainedModel() — repodaki TEK doğrulanmış artifact (artifacts/ran-trained-model.json).
//     Başka HİÇBİR yoldan ağırlık okunmaz. Bu fonksiyon engineVersion/codes/fingerprint
//     uyuşmazlığında KENDİSİ throw eder (sessiz fallback YOK) — aşağıda o throw YAKALANIR
//     ve 500 + açık Türkçe mesajla döner (madde 4), yutulmaz/200 dönülmez.
//  4) scoreRace/explainRunner (motor-v1/engine/training.ts, generic/codes-agnostic) — AYNI
//     paylaşılan skorlama makinesi, kabul testi script'inin (arac-ran-bagimsiz-kabul-
//     testi.mts) kullandığıyla BİREBİR.
//
// NE YAPMAZ (madde 5+kesin sınırlar): Prediction/Pick tablosuna HİÇBİR YAZMA yapmaz, scoreV461/
// v546-1-engine.ts/prediction.actions.ts/admin-analiz.actions.ts/V5AnalysisPanel.tsx'e hiç
// dokunmaz/çağırmaz — production motorunun davranışı bu route'un var olmasından TAMAMEN
// bağımsızdır. AGF hiçbir koddan skora girmediği için (UNIFIED_MODEL_CODES, yapısal garanti)
// ve bu route salt-okuma/snapshot-üretme dışında hiçbir şey yapmadığı için, canlı AGF
// değişimleri bu route'un ürettiği (henüz hiçbir yere YAZILMAYAN) snapshot'ları YAPISAL
// OLARAK etkileyemez — otomatik "yayımlanmış tahmin değişti" riski burada YOK.
//
// Yanıt şekli snapshot-integrity.ts::RanPredictionSnapshot ile TUTARLI (madde 6): her pick
// engineVersion+weightsFingerprint+generatedAt+originalRank+publishedRank+signals taşır.
// originalRank === publishedRank — bu route HİÇBİR manuel override uygulamaz (madde 7).
//
// İDEMPOTENT: aynı raceId ile iki kez çağrılması hiçbir yan etki üretmez (DB'ye yazma YOK,
// `loadTrainedModel()` idempotent/cache'li, `generatedAt` dışında tüm alanlar deterministik)
// — bkz. route.test.ts + arac-ran-route-parite-testi.mts.
//
// NEDEN runRanEngineForRace AYRI EXPORT EDİLİR: asıl iş mantığı (feature build + model yükle
// + skorla + snapshot-şekilli yanıt üret) NextRequest/NextResponse/auth'tan TAMAMEN bağımsız
// — hem route.test.ts (mock auth + mock feature-vector) hem arac-ran-route-parite-testi.mts
// (gerçek DB, gerçek yarış) bu fonksiyonu DOĞRUDAN çağırıp kabul testi script'inin ürettiği
// skorla birebir karşılaştırabilir, auth/HTTP katmanını taklit etmeye gerek KALMAZ.

export type RanEngineRunResult = {
  ok: true;
  raceId: string;
  engineVersion: string;
  weightsFingerprint: string;
  generatedAt: string;
  modelMeta: { nRacesUsed: number; nRacesSkipped: number; opts: unknown };
  atlar: (RanPredictionSnapshot & {
    name: string;
    probability: number;
    score: number;
    explainTotalScore: number;
  })[];
  diagnostics: { no: number; source: "D" | "V1"; code: string; reason: string }[];
};

export class RanEngineRaceNotFoundError extends Error {}
export class RanEngineModelLoadError extends Error {}

/** Bir yarış için ROTAGANYAN ANALİZ MOTORU'nü ucuna kadar çalıştırır — DB okuma (feature
 *  build) + loadTrainedModel() + scoreRace/explainRunner. HİÇBİR DB YAZMA yapmaz, HİÇBİR
 *  auth/HTTP bağımlılığı YOK — route handler'ı VE testler/scriptler bunu DOĞRUDAN çağırır. */
export async function runRanEngineForRace(raceId: string): Promise<RanEngineRunResult> {
  const { vectors, diagnostics } = await buildUnifiedFeatureVectorsForRace(raceId);
  if (vectors.length === 0) {
    throw new RanEngineRaceNotFoundError(
      "Koşu verisi bulunamadı veya sahada koşacak at yok (ROTAGANYAN ANALİZ MOTORU)."
    );
  }

  // madde 3-4: ağırlıklar YALNIZ loadTrainedModel() üzerinden okunur; yanlış sürüm/hash
  // uyuşmazlığı/bozuk dosyada bu fonksiyon THROW eder — çağıran (route handler) bunu
  // YAKALAR, yutmaz.
  let model: ReturnType<typeof loadTrainedModel>;
  try {
    model = loadTrainedModel();
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new RanEngineModelLoadError(
      "ROTAGANYAN ANALİZ MOTORU: eğitilmiş model yüklenemedi (yanlış sürüm/hash uyuşmazlığı/eksik veri) — " +
        detail
    );
  }

  const engineVersion = getCurrentRanEngineVersion().surum;
  const weightsFingerprint = computeWeightsFingerprint(model);
  const generatedAt = new Date().toISOString();

  const vectorByNo = new Map(vectors.map((v) => [v.no, v]));
  const scored = scoreRace(vectors, model);
  const ranked = [...scored].sort((a, b) => b.probability - a.probability);

  const atlar = ranked.map((r, idx) => {
    const rank = idx + 1;
    const vec = vectorByNo.get(r.no)!;
    const explained = explainRunner(vec, model);

    // NOT (reliability alanı): SignalEntry (eğitimle paylaşılan, codes-agnostic generic tip)
    // sürekli bir reliability DEĞERİ taşımıyor — yalnız `observed` boolean'ı var
    // (signal-integration.ts'teki UnifiedSignal.reliability, buildUnifiedFeatureVectorsForRace
    // içinde RunnerFeatureVector'a ÇEVRİLİRKEN kasıtlı olarak taşınmıyor, çünkü training.ts'in
    // paylaşılan SignalEntry tipi bunu beklemiyor). Burada 1/0 eşlemesi UYDURULMUŞ bir ara
    // değer DEĞİL — eldeki TEK gerçek veri (gözlem durumu) doğrudan yansıtılıyor.
    const signals: RanSignalSnapshotEntry[] = explained.rows.map((row) => ({
      code: row.code,
      raw: row.rawValue,
      observed: row.observed,
      reliability: row.observed ? 1 : 0,
    }));

    const snapshot: RanPredictionSnapshot = {
      raceId,
      no: r.no,
      engineVersion,
      weightsFingerprint,
      generatedAt,
      // madde 7: BURADA henüz hiçbir manuel override YOK — originalRank === publishedRank,
      // applyManualOverride'ın GİRDİ ŞEKLİYLE uyumlu (snapshot-integrity.ts).
      originalRank: rank,
      publishedRank: rank,
      signals,
    };

    return {
      ...snapshot,
      name: r.name,
      probability: r.probability,
      score: r.score,
      explainTotalScore: explained.totalScore,
    };
  });

  return {
    ok: true,
    raceId,
    engineVersion,
    weightsFingerprint,
    generatedAt,
    modelMeta: {
      nRacesUsed: model.nRacesUsed,
      nRacesSkipped: model.nRacesSkipped,
      opts: model.opts,
    },
    atlar,
    diagnostics,
  };
}

type Body = { raceId: string };

async function handlePost(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { raceId } = (await req.json()) as Body;
  if (!raceId) return NextResponse.json({ error: "raceId gerekli" }, { status: 400 });

  try {
    const result = await runRanEngineForRace(raceId);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof RanEngineRaceNotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    if (e instanceof RanEngineModelLoadError) {
      console.error("[test-ran-engine] loadTrainedModel başarısız:", e.message);
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    throw e; // dıştaki POST handler'ı yakalar — madde 4: yutma/sessizce 200 dönme YOK
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[test-ran-engine]", e);
    return NextResponse.json(
      { error: "ROTAGANYAN ANALİZ MOTORU: beklenmeyen hata: " + String(e) },
      { status: 500 }
    );
  }
}
