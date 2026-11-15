// 2026-11-13 — Runner program alanlarından türetilen 3 sinyal (fMean, kgsLog, sexE). Eğitim
// (arac-ham-alan-final.mts) ve canlı (v546-1-engine.ts gatherV461RawSinyaller) AYNI tanımı kullanır —
// train/serve tutarlılığı için tanım TEK yerde, saf fonksiyon olarak durur.
//
// Gerekçe (piyasa ne görüyor testi): kitle atın son 6 yarıştaki derecesini (recentForm, ör. "229810")
// fiyatlıyor; modelde bunun karşılığı yoktu (yalnız lastWon). KGS (koşmadığı gün) ve cins ayrıca
// kazanç getirdi. Alan seçimi yalnız DEV katlarında yapıldı, son 2 katta (CONFIRM) sınandı.

/** recentForm'un İLK 6 hanesindeki derecelerin ortalaması. '1'-'9' = o derece, '0' = 10. veya daha
 *  kötü (10 sayılır), diğer karakterler (D/-, vb.) atlanır. Hiç derece yoksa null (gözlemsiz). */
export function formOrtalamasi(recentForm: string | null | undefined): number | null {
  const rf = recentForm ?? "";
  const dereceler: number[] = [];
  for (let i = 0; i < Math.min(6, rf.length); i++) {
    const c = rf[i];
    if (c >= "1" && c <= "9") dereceler.push(Number(c));
    else if (c === "0") dereceler.push(10);
  }
  return dereceler.length ? dereceler.reduce((p, q) => p + q, 0) / dereceler.length : null;
}

/** log(1 + KGS) — KGS (koşmadığı gün sayısı) TJK program sütunu (Runner.tjkKgs). */
export function kgsLog(kgs: number | null | undefined): number | null {
  return kgs != null && Number.isFinite(kgs) && kgs >= 0 ? Math.log1p(kgs) : null;
}

/** Runner.age ("4y d a" biçimi: yaş, renk, cins) alanının 3. kelimesi 'e' ise 1, başka bir değerse 0;
 *  3. kelime yoksa null. */
export function cinsE(age: string | null | undefined): number | null {
  const tk = (age ?? "").trim().split(/\s+/);
  return tk[2] ? (tk[2] === "e" ? 1 : 0) : null;
}

// ── 2026-11-15 KULLANICI KARARI — SINIF DÜŞÜŞÜ (dususDelta) ─────────────────────────────────────────────────────────
// TJK koşu sınıfı hiyerarşisi (kullanıcı tanımı, zirveden tabana): G1 13 · G2 12 · G3 11 · KV-9/Handikap 24 10 · KV-8 9 ·
// KV-7/Handikap 22 8 · KV-6/Handikap 21 7 · Şartlı 5/Handikap 17 6 · Şartlı 4/Handikap 16 5 · Şartlı 3/Handikap 15 4 ·
// Şartlı 2/Handikap 14-13 3 · Satış 2 · Maiden/Şartlı 1(19,27) 1. Tanınmayan sınıf (Amatör, A 3, vb.) = null.
// dususDelta = ÖNCEKİ yarışın seviyesi − BUGÜNKÜ seviye (+ = sınıf düşüşü, − = yükseliş). Bugünkü sınıf seviye 1 ise
// (Maiden / Şartlı 1 / 19 / 27) sinyal UYGULANMAZ (kullanıcı kararı: "bunlar için gerek yok") → null = sıfır katkı.
// Eğitim (arac-sinif-dususu-egit.mts) ile AYNI tanım. Bkz. arac-sinif-dusus-cv.mts (CV), arac-sinif-dusus-arsiv.mts (arşiv).
export function sinifSeviyesi(classType: string | null | undefined): number | null {
  const u = String(classType ?? "").split("/")[0].toUpperCase().replace(/\s+/g, " ").trim();
  let m: RegExpMatchArray | null;
  if ((m = u.match(/^G ?([123])$/))) return 14 - +m[1];
  if ((m = u.match(/^(?:KV|KISA VADE HAND[İI]KAP)[- ]?(\d+)$/))) { const n = +m[1]; return n === 9 || n === 24 ? 10 : n === 8 ? 9 : n === 7 || n === 22 ? 8 : n === 6 || n === 18 || n === 21 ? 7 : null; }
  if ((m = u.match(/^HAND[İI]KAP (\d+)$/))) { const n = +m[1]; return n === 13 || n === 14 ? 3 : n === 15 ? 4 : n === 16 ? 5 : n === 17 ? 6 : n === 21 ? 7 : n === 22 ? 8 : n === 24 ? 10 : null; }
  if ((m = u.match(/^(?:ŞARTLI|SARTLI) (\d+)$/))) { const n = +m[1]; return n === 1 || n === 19 || n === 27 ? 1 : n === 2 ? 3 : n === 3 ? 4 : n === 4 ? 5 : n === 5 ? 6 : null; }
  if (/^SATI[ŞS] \d$/.test(u)) return 2;
  if (u === "MAIDEN") return 1;
  return null;
}

export function sinifDususu(oncekiSinif: string | null | undefined, bugunkuSinif: string | null | undefined): number | null {
  if (oncekiSinif == null) return null;
  const cur = sinifSeviyesi(bugunkuSinif), onc = sinifSeviyesi(oncekiSinif);
  // ±5 ile sınırlı (winsorize): uç sıçramalarda (örn. Şartlı 1 → G2 = −11) doğrusal sinyal orantısız büyür; eğitimde AYNI sınır.
  return cur != null && onc != null && cur !== 1 ? Math.max(-5, Math.min(5, onc - cur)) : null;
}

/** HorseRaceHistoryCache.rowsJson satırlarından (tarih "gg.aa.yyyy"), yarış gününden (UTC gece yarısı, ms) ÖNCEKİ son satırın
 *  sınıfı. Eğitimle aynı: tarihe göre artan sıralı, kararlı sıra; sınıfı bilinmeyen son satır bile "son" sayılır. */
export function oncekiYarisSinifi(rows: { date?: string; classType?: string }[] | null | undefined, yarisGunuUtcMs: number): string | null {
  if (!rows?.length) return null;
  let en: { t: number; c: string } | null = null;
  for (const q of rows) {
    if (!q.date) continue;
    const [g, a, y] = q.date.split(".");
    const t = Date.UTC(+y, +a - 1, +g);
    if (!Number.isFinite(t) || t >= yarisGunuUtcMs) continue;
    if (en == null || t >= en.t) en = { t, c: String(q.classType ?? "") };
  }
  return en ? en.c : null;
}

/** Son yarışların SINIF BAĞLAMLI özeti (admin kartında "Son 6 derece ort." yanında gösterilir): derece tek başına yanıltıcıdır —
 *  Maiden/Şartlı 1'de 1. olmak, G2'de 1. olmakla aynı şey değildir (kullanıcı bulgusu 2026-11-15). En yeni → en eski. */
export type SonYarisOzeti = { tarih: string; sinif: string; seviye: number | null; derece: number | null; fark: number | null };
export function sonYarislarOzeti(
  rows: { date?: string; classType?: string; finishPos?: string }[] | null | undefined,
  yarisGunuUtcMs: number,
  bugunkuSinif: string | null | undefined,
  n = 6,
): SonYarisOzeti[] {
  const cur = sinifSeviyesi(bugunkuSinif);
  const liste: { t: number; o: SonYarisOzeti }[] = [];
  for (const q of rows ?? []) {
    if (!q.date) continue;
    const [g, a, y] = q.date.split(".");
    const t = Date.UTC(+y, +a - 1, +g);
    if (!Number.isFinite(t) || t >= yarisGunuUtcMs) continue;
    const sinif = String(q.classType ?? "").split("/")[0].replace(/\s+/g, " ").trim();
    const sev = sinifSeviyesi(sinif);
    const m = String(q.finishPos ?? "").replace(",", ".").match(/\d+/);
    liste.push({ t, o: { tarih: `${g}.${a}`, sinif, seviye: sev, derece: m ? +m[0] : null, fark: cur != null && sev != null ? cur - sev : null } });
  }
  return liste.sort((a, b) => b.t - a.t).slice(0, n).map((x) => x.o);
}
