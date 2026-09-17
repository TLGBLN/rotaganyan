// 2026-09-17 — Race Context Invalidation (kullanıcı talebi, ekran görüntüsü: TJK'nın
// "KOMİSERLER KURULU KARARI İLE ÇİM PİST KOŞULARI 3. KOŞUDAN İTİBAREN SENTETİK PİSTE
// ALINMIŞTIR" duyurusu, 15:53). Anormal Pist Modu'nun (anormal-pist-risk.ts) ALTINDA,
// daha temel bir katman: o dosya "aynı pist türünün koşulu kötüleşti" durumunu yönetir,
// bu dosya "yarışın bağlamının KENDİSİ değişti" (Çim→Sentetik, at çekildi, mesafe/sınıf
// değişti) durumunu yakalar — ikisi FARKLI risk sınıfı, karıştırılmamalı.
//
// V5.46'nın kendi skoruna/sıralamasına HİÇ girmez — yalnız bir Prediction'ın hâlâ GEÇERLİ
// bir yarış bağlamı için mi üretildiğini denetler. Geçersizse status="STALE" (published
// DOKUNULMAZ, geçmiş kaydı bozulmasın) — canlı gösterim/kupon kararı bu yüzden doğrudan
// `published` değil, pick-display-order.ts'teki `analizCanliMi` kapısına bakmalı.
import { db } from "@/lib/db";

export type AnalizGirdiOzeti = {
  surface: string;
  distance: number;
  classType: string;
  /** Sıralı, virgülle ayrılmış KOŞACAK (scratched=false) at no'ları — "1,2,3,5,7". */
  runnerSignature: string;
};

const TURKCE_SURFACE: Record<string, string> = { CIM: "Çim", KUM: "Kum", SENTETIK: "Sentetik" };

function alanEtiketi(field: string): string {
  if (field === "surface") return "Pist türü";
  if (field === "distance") return "Mesafe";
  if (field === "classType") return "Koşu sınıfı";
  if (field === "runners") return "Sahadaki atlar";
  return field;
}

function staleMesajUret(degisenAlanlar: string[], eski: string, yeni: string): string {
  if (degisenAlanlar.includes("surface")) {
    return `Pist değiştirildi (${TURKCE_SURFACE[eski] ?? eski} → ${TURKCE_SURFACE[yeni] ?? yeni}) — analiz yeniden hesaplanmalı.`;
  }
  if (degisenAlanlar.includes("runners")) {
    return "Sahadaki atlarda değişiklik oldu (çekilme/ekleme) — analiz yeniden hesaplanmalı.";
  }
  return "Yarış koşullarında değişiklik oldu — analiz yeniden hesaplanmalı.";
}

/**
 * Bir koşunun (ingest'in bu turda getirdiği) GÜNCEL bağlamını, o koşunun YAYINLANMIŞ/
 * kaydedilmiş analizinin dondurduğu bağlamla karşılaştırır. Farklılık varsa Prediction'ı
 * "STALE" işaretler ve her farkı RaceContextChange'e (audit) yazar. Prediction yoksa veya
 * zaten daha önce analiz edilmemişse (analyzedSurface null) hiçbir şey yapmaz — henüz
 * ortada geçersiz kılınacak bir analiz yok demektir.
 */
export async function raceContextGecerliligKontrolEt(raceId: string, guncel: AnalizGirdiOzeti): Promise<void> {
  const prediction = await db.prediction.findUnique({
    where: { raceId },
    select: {
      id: true,
      status: true,
      analyzedSurface: true,
      analyzedDistance: true,
      analyzedClassType: true,
      analyzedRunnerSignature: true,
    },
  });
  // Hiç analiz yok, zaten STALE, veya bu analiz hiçbir zaman bir bağlam dondurmamış
  // (eski/legacy kayıt) — kontrol edilecek bir şey yok.
  if (!prediction || prediction.status === "STALE" || prediction.analyzedSurface == null) return;

  const degisenAlanlar: string[] = [];
  const degerler: { field: string; oldValue: string; newValue: string }[] = [];

  if (prediction.analyzedSurface !== guncel.surface) {
    degisenAlanlar.push("surface");
    degerler.push({ field: "surface", oldValue: prediction.analyzedSurface, newValue: guncel.surface });
  }
  if (prediction.analyzedDistance != null && prediction.analyzedDistance !== guncel.distance) {
    degisenAlanlar.push("distance");
    degerler.push({ field: "distance", oldValue: String(prediction.analyzedDistance), newValue: String(guncel.distance) });
  }
  if (prediction.analyzedClassType != null && prediction.analyzedClassType !== guncel.classType) {
    degisenAlanlar.push("classType");
    degerler.push({ field: "classType", oldValue: prediction.analyzedClassType, newValue: guncel.classType });
  }
  if (prediction.analyzedRunnerSignature != null && prediction.analyzedRunnerSignature !== guncel.runnerSignature) {
    degisenAlanlar.push("runners");
    degerler.push({ field: "runners", oldValue: prediction.analyzedRunnerSignature, newValue: guncel.runnerSignature });
  }

  if (degisenAlanlar.length === 0) return;

  const ilkFark = degerler[0];
  const staleReason = staleMesajUret(degisenAlanlar, ilkFark.oldValue, ilkFark.newValue);

  await db.$transaction([
    db.prediction.update({
      where: { id: prediction.id },
      data: { status: "STALE", staleReason, staleAt: new Date() },
    }),
    db.raceContextChange.createMany({
      data: degerler.map((d) => ({ raceId, field: d.field, oldValue: d.oldValue, newValue: d.newValue, source: "TJK_PROGRAM" })),
    }),
  ]);

  // Sessiz bir DB güncellemesi olarak kalmasın — cron loglarında görünür olsun (admin
  // "bugün neden bir koşu birden STALE oldu" diye sorduğunda ilk bakılacak yer).
  console.log(
    `[race-context-invalidation] ${raceId}: ${degisenAlanlar.map(alanEtiketi).join(", ")} değişti — Prediction STALE işaretlendi.`
  );
}
