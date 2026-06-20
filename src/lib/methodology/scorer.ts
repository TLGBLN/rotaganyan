/**
 * Otomatik puanlama motoru — v1.6 metodolojisi
 * Her topic için runner başına -1..3 aralığında puan üretir.
 * Veri yetersizse 0 döner (kullanıcı manuel override yapabilir).
 */

export type RaceStyleTag = "KACAK" | "ON_GRUP" | "BEKLEME" | "EN_GERI";

export type ScorerRunner = {
  id: string;
  no: number;
  name: string;
  weight?: number | null;
  weightChange?: number | null;
  agf?: number | null;
  sameJockey: boolean;
  equipmentAdded?: string | null;
  equipmentRemoved?: string | null;
  startNo?: number | null;
  sire?: string | null;
  damSire?: string | null;
  raceStyle?: { style?: RaceStyleTag } | null;
  gallops: Array<{
    form?: string | null;
    track?: string | null;
    date: Date | string;
    splits: unknown;
  }>;
};

export type RaceCtx = {
  classType: string;
  distance: number;
  surface: string; // CIM | KUM | SENTETIK
  breed: string;   // INGILIZ | ARAP
  runnerCount: number;
};

type Scores = Record<number, number>; // runnerNo → score

function zeros(runners: ScorerRunner[]): Scores {
  return Object.fromEntries(runners.map((r) => [r.no, 0]));
}

function clamp(v: number): number {
  return Math.max(-1, Math.min(3, Math.round(v)));
}

// ── AGF ──────────────────────────────────────────────────────────────────────
// runner.agf = piyasadaki AGF yüzdesi (yüksek = daha favori)
export function scoreAgf(runners: ScorerRunner[]): Scores {
  const out = zeros(runners);
  const valid = runners.filter((r) => r.agf != null && r.agf > 0);
  if (valid.length === 0) return out;

  const sorted = [...valid].sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0));
  const top = sorted[0];
  const sec = sorted[1];

  // Ezici favori: %40+
  if ((top.agf ?? 0) >= 40) {
    out[top.no] = 3;
  } else if ((top.agf ?? 0) >= 25) {
    out[top.no] = 2;
  } else {
    out[top.no] = 1;
  }

  if (sec) out[sec.no] = clamp(out[sec.no] + 1);

  return out;
}

// ── GALOP ─────────────────────────────────────────────────────────────────────
// Form: ÇR=2, R=1, HÇ=-1, Ç=-1, yoksa=0
// İç pist (track içeren "i" veya "ic") → form -1'den aşağı düşmez
function gallopFormScore(form: string | null | undefined): number {
  if (!form) return 0;
  const f = form.trim().toUpperCase();
  if (f.startsWith("ÇR") || f.startsWith("CR")) return 2;
  if (f === "R") return 1;
  if (f.startsWith("HÇ") || f.startsWith("HC")) return -1;
  if (f === "Ç" || f === "C") return -1;
  return 0;
}

function isInnerTrack(track: string | null | undefined): boolean {
  if (!track) return false;
  const t = track.toLowerCase();
  return t.includes("iç") || t.includes("ic") || t.includes("inner");
}

export function scoreGalop(runners: ScorerRunner[]): Scores {
  const out = zeros(runners);
  for (const r of runners) {
    if (r.gallops.length === 0) continue;
    const last = r.gallops[0]; // En son galop (desc sıralamasıyla geliyor)
    let base = gallopFormScore(last.form);
    // İç pist avansı: zayıf formu kurtarmaz ama -1'i 0'a çeker
    if (isInnerTrack(last.track) && base === -1) base = 0;
    // Eski güçlü galop kontrolü: son iş sönük ama önceki ÇR/R varsa 0 yerine 0 bırak (iptal etme)
    if (base <= 0 && r.gallops.length > 1) {
      const older = r.gallops.slice(1, 4);
      const bestOld = Math.max(...older.map((g) => gallopFormScore(g.form)));
      if (bestOld >= 2) base = Math.max(base, 1); // Eski güçlü iş varsa en az 1
    }
    out[r.no] = clamp(base);
  }
  return out;
}

// ── JOKEY ─────────────────────────────────────────────────────────────────────
// sameJockey (sarı üçgen) = niyet sinyali +1
export function scoreJokey(runners: ScorerRunner[]): Scores {
  const out = zeros(runners);
  for (const r of runners) {
    if (r.sameJockey) out[r.no] = 1;
  }
  return out;
}

// ── TAKI ──────────────────────────────────────────────────────────────────────
// İlk kez takılan: +1. Çıkarılan: nötr (0). Takısız koşan: +0 (sakinlik ama ayrı kural).
export function scoreTaki(runners: ScorerRunner[]): Scores {
  const out = zeros(runners);
  for (const r of runners) {
    if (r.equipmentAdded && r.equipmentAdded.trim()) {
      out[r.no] = clamp(1);
    }
    // equipmentRemoved: nötr/pozitif ama puan 0 bırak, guidance'da açıklanır
  }
  return out;
}

// ── SİCİL > KİLO ─────────────────────────────────────────────────────────────
// Kilo tarafı: -3kg+ = +1 (listeye sokar), -5kg+ = +1 ama sicil olmadan 1. sıraya yazma
// Sicil tarafı: DB'de yok → 0 (manual)
export function scoreSicil(runners: ScorerRunner[]): Scores {
  const out = zeros(runners);
  for (const r of runners) {
    const change = r.weightChange ?? 0;
    if (change <= -3) out[r.no] = 1;      // Kilo düşüşü = listeye sokar
    if (change <= -5) out[r.no] = 1;      // Büyük düşüş = aynı (sicil yoksa 1. sıraya yazma)
    if (change >= 3) out[r.no] = clamp(out[r.no] - 1); // Kilo artışı = eksi
  }
  return out;
}

// ── PEDİGRİ ───────────────────────────────────────────────────────────────────
// Sire/damSire admin-maintained SireTier tablosuna karşı eşleştirilir (en güçlü taraf kazanır).
const PEDIGREE_TIER_SCORE: Record<string, number> = {
  COK_YUKSEK: 2, YUKSEK: 1, GUCLU: 1, ORTA: 0, DUSUK: -1, ZAYIF: -1, SORU: 0, BILINMIYOR: 0,
};

function normalizeSireName(s: string): string {
  return s.trim().toUpperCase();
}

export function scorePedigree(runners: ScorerRunner[], sireTiers: Map<string, string>): Scores {
  const out = zeros(runners);
  for (const r of runners) {
    const sireTier = r.sire ? sireTiers.get(normalizeSireName(r.sire)) : undefined;
    const damSireTier = r.damSire ? sireTiers.get(normalizeSireName(r.damSire)) : undefined;
    const candidates = [sireTier, damSireTier].filter((t): t is string => !!t);
    if (candidates.length === 0) continue;
    const best = candidates.reduce((a, b) => (PEDIGREE_TIER_SCORE[b] > PEDIGREE_TIER_SCORE[a] ? b : a));
    out[r.no] = clamp(PEDIGREE_TIER_SCORE[best]);
  }
  return out;
}

// ── TEMPO ─────────────────────────────────────────────────────────────────────
// raceStyle.style admin tarafından manuel işaretlenir (otomatik çekilemiyor).
// Dorukbatur kuralı: 2+ kaçak = sert tempo → kaçaklar düşer, bekleyenler yükselir.
export type TempoVerdict = {
  kacakCount: number;
  level: "DUSUK" | "ORTA" | "SERT" | "COK_SERT";
  label: string;
};

export function computeTempoVerdict(runners: ScorerRunner[]): TempoVerdict {
  const kacakCount = runners.filter((r) => r.raceStyle?.style === "KACAK").length;
  if (kacakCount >= 4) return { kacakCount, level: "COK_SERT", label: "4+ kaçak — çok sert tempo / intihar" };
  if (kacakCount >= 2) return { kacakCount, level: "SERT", label: `${kacakCount} kaçak — sert tempo` };
  if (kacakCount === 1) return { kacakCount, level: "ORTA", label: "1 kaçak — düşük/orta tempo" };
  return { kacakCount, level: "DUSUK", label: "Kaçak yok — avare/yavaş tempo" };
}

export function scoreTempo(runners: ScorerRunner[]): Scores {
  const out = zeros(runners);
  const verdict = computeTempoVerdict(runners);
  if (verdict.level !== "SERT" && verdict.level !== "COK_SERT") return out;

  for (const r of runners) {
    const style = r.raceStyle?.style;
    if (style === "KACAK") out[r.no] = -1; // sert tempoda kaçak = 0 puan (yıpranır)
    else if (style === "BEKLEME") out[r.no] = clamp((out[r.no] ?? 0) + 1); // bekleme yukarı çıkar
  }
  return out;
}

// ── DERECE ────────────────────────────────────────────────────────────────────
// Tarihsel exact-sicil eşleştirmesi DB sorgusu gerektirir → bkz. methodology/derece.ts
// (computeAutoScores senkron kalır; sayfa derece skorlarını ayrıca await edip birleştirir)
export function scoreDerece(runners: ScorerRunner[]): Scores {
  return zeros(runners);
}

// ── KALABALIK GRUP (atlar topic desteği) ─────────────────────────────────────
// 15+ at: iç start (startNo ≤7) + hafif kilo + yeni takı kombinasyonu → sürpriz alarm
export function scoreTumAtlar(runners: ScorerRunner[], ctx: RaceCtx): Scores {
  const out = zeros(runners);
  if (ctx.runnerCount >= 15) {
    for (const r of runners) {
      const innerStart = (r.startNo ?? 99) <= 7;
      const lightWeight = (r.weight ?? 99) <= 52;
      const newEquip = !!(r.equipmentAdded?.trim());
      if (innerStart && lightWeight && newEquip) {
        out[r.no] = 1; // Prenses Seda uyarısı: sürpriz alarm, listeye dahil et
      }
    }
  }
  return out;
}

// ── ANA FONKSİYON: tüm topic'leri otomatik hesapla ───────────────────────────
export type AutoScores = Record<string, Scores>;

export function computeAutoScores(
  runners: ScorerRunner[],
  ctx: RaceCtx,
  sireTiers: Map<string, string> = new Map()
): AutoScores {
  return {
    derece:   scoreDerece(runners),
    sicil:    scoreSicil(runners),
    agf:      scoreAgf(runners),
    tempo:    scoreTempo(runners),
    atlar:    scoreTumAtlar(runners, ctx),
    banko:    zeros(runners), // rule check, not scored
    galop:    scoreGalop(runners),
    jokey:    scoreJokey(runners),
    taki:     scoreTaki(runners),
    pedigri:  scorePedigree(runners, sireTiers),
  };
}

// ── BANKO KARARI ──────────────────────────────────────────────────────────────
// v1.6 kuralı: Handikap/Grup/Şartlı-1 → kombinasyon zorunlu. AGF#1 ≠ sistem#1 → banko yok.
// KV/Şartlı: fark≥3 + 1.puan≥6. Maiden: fark≥4 + 1.puan≥7. Fark<2 → kombinasyon zorunlu.
export type BankoVerdict = { allowed: boolean; reason: string };

function isKombinasyonZorunlu(classType: string): boolean {
  const c = classType.toUpperCase();
  return c.includes("HANDIKAP") || c.includes("GRUP") || /\bG[1-3]\b/.test(c) || c.includes("ŞARTLI 1") || c.includes("SARTLI 1");
}

export function computeBankoVerdict(
  ctx: RaceCtx,
  ranked: Array<{ no: number; agf?: number | null; total: number }>
): BankoVerdict {
  if (ranked.length < 2) return { allowed: false, reason: "Yetersiz at sayısı" };

  if (isKombinasyonZorunlu(ctx.classType)) {
    return { allowed: false, reason: `${ctx.classType} — kombinasyon zorunlu, banko verilmez` };
  }

  const agfSorted = [...ranked].filter((r) => (r.agf ?? 0) > 0).sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0));
  const systemTop = ranked[0];
  const agfTop = agfSorted[0];

  if (agfTop && agfTop.no !== systemTop.no) {
    return { allowed: false, reason: "AGF#1 ≠ sistem#1 — ayrışma var, banko yok" };
  }

  const fark = ranked[0].total - (ranked[1]?.total ?? 0);
  const isMaiden = ctx.classType.toUpperCase().includes("MAIDEN");
  const minFark = isMaiden ? 4 : 3;
  const minPuan = isMaiden ? 7 : 6;

  if (fark < 2) return { allowed: false, reason: `Fark ${fark} puan (<2) — kombinasyon zorunlu` };
  if (fark >= minFark && ranked[0].total >= minPuan) {
    return { allowed: true, reason: `Fark ${fark} puan, 1. at ${ranked[0].total} puan — banko şartları sağlanıyor` };
  }
  return { allowed: false, reason: `Fark ${fark} puan veya 1. at puanı (${ranked[0].total}) eşik altında` };
}

// Hangi topic'ler otomatik doldu (veri var), hangileri manual gerekli
export const AUTO_TOPIC_NOTES: Record<string, string> = {
  derece:  "Yarı otomatik — aynı at adıyla geçmiş koşular aranır (bkz. derece.ts); doğrulanmamışsa not düşülür",
  sicil:   "Kısmen otomatik (kilo değişimi). Pist/mesafe sicili manuel girilmeli.",
  agf:     "Otomatik — AGF yüzdesi baz alındı",
  tempo:   "Yarı otomatik — kaçak/bekleme etiketini sayfadan işaretle, sert tempo otomatik hesaplanır",
  atlar:   "Otomatik kontrol — 15+ atlı grupta sürpriz alarm işaretlendi",
  banko:   "Otomatik kural — sınıf tipi + AGF#1/sistem#1 + puan farkı eşikleri kontrol edilir",
  galop:   "Otomatik — son galop formu (ÇR/R/HÇ/Ç) baz alındı",
  jokey:   "Otomatik — idman jokeyi = yarış jokeyi (sarı üçgen) baz alındı",
  taki:    "Otomatik — yeni takılan ekipman baz alındı",
  pedigri: "Otomatik — sire/damSire admin tarafından yönetilen SireTier tablosuna eşleştirilir",
};
