// 2026-09-05 kullanıcı bulgusu (İstanbul K4, BALDER/TERCAN HAN) — AYNI bug ("gösterim
// sırası puana göre değil kayıtlı rank'e göre") ProgramView.tsx, PuanTablosu.tsx ve
// InlineAnalysisPanel.tsx'te BAĞIMSIZ olarak ÜÇ KEZ yazılmıştı, biri düzeltilirken
// diğer ikisi unutulabiliyordu. Kayıtlı Sıra (Pick.rank), terfi/garanti mekanizmalarının
// (bkz. v5-engine.ts, terfiPenceresiV5) kasıtlı olarak ham olasılıktan sapabildiği
// GÖSTERİM sırası — herkese açık tablolarda kullanıcı her zaman yüzdeye (Toplam/Puan)
// göre yüksekten azalana bir sıralama bekliyor. Bu iki fonksiyon TEK, test edilen kaynak:
// yeni bir pick tablosu eklenirken bu bug'ı YENİDEN YAZMAK yerine buradan import edilir.

/** Düz bir pick listesini puana (score) göre yüksekten azalana sıralar. null score en düşük sayılır. */
export function siraliPickler<T extends { score: number | null }>(picks: T[]): T[] {
  return [...picks].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/**
 * Eküri ortaklarının aynı satırda birleştirildiği pick tablolarında (ProgramView.tsx/
 * PuanTablosu.tsx), her satır kendi üyelerinin EN YÜKSEK puanına göre sıralanır — bir
 * satırdaki iki eküri ortağının puanları farklı olabilir, satırın "başı" hangisiyse o
 * temsil eder.
 */
export function siraliPickSatirlari<T extends { score: number | null }>(rows: T[][]): T[][] {
  return [...rows].sort((a, b) => enYuksekSkor(b) - enYuksekSkor(a));
}

function enYuksekSkor<T extends { score: number | null }>(row: T[]): number {
  return Math.max(...row.map((p) => p.score ?? 0));
}

// 2026-09-17 — Race Context Invalidation (bkz. proje hafızası project_race_context_invalidation).
// AYNI dersin (bu dosyanın üstteki 2026-09-05 notu) bir tekrarı: "bu analiz gerçekten
// canlıya güvenle gösterilebilir mi" sorusunun cevabı TEK yerde olmalı — published=true
// TEK BAŞINA yeterli değil, status="STALE" (ingest sonradan pist/mesafe/sınıf/at listesi
// gibi analiz-etkileyici bir alanı değiştirdiyse) ihracını da kontrol etmeli. Yeni bir
// public/kupon gösterim noktası eklenirken bu fonksiyon kullanılmalı, `prediction.published`
// doğrudan KONTROL EDİLMEMELİ.
export function analizCanliMi(p: { published: boolean; status?: string | null } | null | undefined): boolean {
  return !!p?.published && (p.status ?? "FRESH") === "FRESH";
}
