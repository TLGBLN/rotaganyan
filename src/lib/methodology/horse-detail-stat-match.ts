/**
 * HorseStatsCache.detailedStatsJson (TJK "Detaylı İstatistikler": Zaman/Hipodrom/Jokey/Pist/
 * Mesafe kırılımı, bkz. tjk-at-profil.adapter.ts) içinden BUGÜNKÜ koşu bağlamına (hipodrom,
 * pist, mesafe, jokey) uyan satırları bulup tek satırlık, Claude'a okunabilir bir özet üretir.
 * Kullanıcı talebi 2026-07-30: bu veri bugüne kadar yalnız at profili modalinde gösteriliyordu,
 * Faz1/analiz motoru hiç faydalanmıyordu — artık buradan besleniyor.
 */
import { surfaceToPist } from "@/lib/sire-stat-match";

export type HorseDetailStatSection = { title: string; headers: string[]; rows: string[][] };

const TR_FOLD: Record<string, string> = {
  İ: "I", I: "I", ı: "I", i: "I",
  Ş: "S", ş: "S", Ğ: "G", ğ: "G",
  Ü: "U", ü: "U", Ö: "O", ö: "O",
  Ç: "C", ç: "C",
};
function normTr(s: string): string {
  return s.split("").map((ch) => TR_FOLD[ch] ?? ch.toUpperCase()).join("").replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}
function surname(s: string): string {
  const n = normTr(s);
  return n.split(" ").filter(Boolean).at(-1) ?? n;
}

// v6.85 — kullanıcı bulgusu 2026-08-10: hücreler "1 (%50)" gibi sayı+yüzde birleşik
// geliyor; eski kod TÜM rakamları (yüzdeninkiler dahil) birleştirip parseInt ediyordu
// ("1 (%50)" → "150" → 150!), yalnız 0 değerlerinde ("0 (%0)" → "00" → 0) tesadüfen
// doğru sonuç veriyordu. Artık yalnız İLK sayı alınıyor (gerçek sayım, yüzde değil).
function parseIntSafe(s: string | undefined): number {
  const m = (s ?? "").match(/-?\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function findSection(sections: HorseDetailStatSection[], titlePrefix: string): HorseDetailStatSection | undefined {
  return sections.find((s) => normTr(s.title).startsWith(normTr(titlePrefix)));
}

export function formatHorseDetailStatOzet(
  sections: HorseDetailStatSection[],
  ctx: { hippodromeName: string; surface: string; distance: number; jockeyName: string | null }
): string | null {
  if (!sections || sections.length === 0) return null;
  const parts: string[] = [];
  const pistLabel = surfaceToPist(ctx.surface); // "Çim" | "Kum" | "Sentetik"

  // Hipodrom
  const hipoSection = findSection(sections, "Hipodrom");
  const hipoRow = hipoSection?.rows.find((r) => {
    const a = normTr(r[0] ?? ""), b = normTr(ctx.hippodromeName);
    return a && b && (a.includes(b) || b.includes(a));
  });
  if (hipoRow) {
    const k = parseIntSafe(hipoRow[1]);
    if (k > 0) parts.push(`bu hipodromda ${k} start ${parseIntSafe(hipoRow[2])}G`);
  }

  // Pist (bugünkü pist türü)
  const pistSection = findSection(sections, "Pist");
  const pistRows = pistSection?.rows.filter((r) => normTr(r[0] ?? "") === normTr(pistLabel)) ?? [];
  if (pistRows.length > 0) {
    const k = pistRows.reduce((sum, r) => sum + parseIntSafe(r[2]), 0);
    const w = pistRows.reduce((sum, r) => sum + parseIntSafe(r[3]), 0);
    if (k > 0) parts.push(`bu pistte (${pistLabel}) ${k} start ${w}G`);
  }

  // Mesafe - {Pist} (±200m tolerans, kod genelindeki aynı pist/mesafe karşılaştırma toleransıyla tutarlı)
  const mesafeSection = findSection(sections, `Mesafe - ${pistLabel}`);
  if (mesafeSection) {
    const matching = mesafeSection.rows.filter((r) => {
      const d = parseIntSafe(r[0]);
      return d > 0 && Math.abs(d - ctx.distance) <= 200;
    });
    if (matching.length > 0) {
      const k = matching.reduce((sum, r) => sum + parseIntSafe(r[1]), 0);
      const w = matching.reduce((sum, r) => sum + parseIntSafe(r[2]), 0);
      if (k > 0) parts.push(`bu mesafede(±200m) ${k} start ${w}G`);
    }
  }

  // Jokey (bugünkü jokeyle daha önce kaç kez koşmuş, ne sonuçla)
  if (ctx.jockeyName) {
    const jokeySection = findSection(sections, "Jokey");
    const jokeyRow = jokeySection?.rows.find((r) => surname(r[0] ?? "") === surname(ctx.jockeyName!));
    if (jokeyRow) {
      const k = parseIntSafe(jokeyRow[1]);
      if (k > 0) parts.push(`bu jokeyle ${k} start ${parseIntSafe(jokeyRow[2])}G`);
    }
  }

  // Zaman (Yıl-Ay kırılımı) — son yakın dönemdeki form trendi. Diğer bölümlerin aksine
  // bugünkü koşuyla eşleşen bir filtre yok, en güncel satırlar (TJK zaten en yeniden
  // eskiye sıralı veriyor) doğrudan alınıyor. "Toplam" satırı (varsa) hariç tutulur.
  const zamanSection = findSection(sections, "Zaman");
  if (zamanSection) {
    const sonAylar = zamanSection.rows.filter((r) => normTr(r[0] ?? "") !== "TOPLAM").slice(0, 3);
    if (sonAylar.length > 0) {
      const k = sonAylar.reduce((sum, r) => sum + parseIntSafe(r[1]), 0);
      const w = sonAylar.reduce((sum, r) => sum + parseIntSafe(r[2]), 0);
      if (k > 0) parts.push(`son ${sonAylar.length} ayda ${k} start ${w}G`);
    }
  }

  if (parts.length === 0) return null;
  return `TJK detaylı geçmiş: ${parts.join(" · ")}`;
}
