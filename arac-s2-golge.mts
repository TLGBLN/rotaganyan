// KALICI ARAÇ — S2 GÖLGE KIYAS (canlıyı DEĞİŞTİRMEZ). Kayıtlı yarış-öncesi sinyal anlık görüntülerinden (.sinyal-veri/anlik.ndjson, `npm run sinyal-veri` ile gelir; sonuçlanmış koşular)
// iki modeli AYNI snapshot üzerinde yeniden puanlar: CANLI varsayılan (24) ve S2 (17, v546-1-saf-weights-s2-golge.json).
// Kapsam: yalnız VARSAYILAN modele giden koşular (Handikap ve ŞARTLI 1/27 segmentleri S2'ye dahil DEĞİL — canlıda kendi ağırlıklarıyla çalışıyor; burada atlanır).
// Önce DOĞRULAMA: çevrimdışı tekrar oynatma canlı kayıtlı olasılığı üretiyor mu (aksi halde kıyas geçersiz).
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-s2-golge.mts [--from 2026-11-17]  → .sinyal-veri/s2-golge-rapor.md (her çalıştırmada TÜM kayıtlardan yeniden üretilir; idempotent)
import fs from "node:fs";
type W = { featureNames: string[]; weights: number[]; means: number[]; stds: number[]; bilesik?: { accBitis: { mu: number[]; sd: number[] } } };
const CANLI = JSON.parse(fs.readFileSync("src/lib/methodology/weights/v546-1-saf-weights.json", "utf8")) as W;
const S2 = JSON.parse(fs.readFileSync("src/lib/methodology/weights/v546-1-saf-weights-s2-golge.json", "utf8")) as W;
const get = (b: string) => { const i = process.argv.indexOf(b); return i >= 0 ? process.argv[i + 1] : undefined; };
const from = get("--from") ?? "2026-11-17";
type Sig = [string, number | null, boolean, number?];
type Kosu = { raceId: string; tarih: string; hip: string; kosu: number; tip: string; kazananlar: number[]; atlar: { no: number; rank: number; p: number; sig: Sig[] }[] };
const lines = fs.readFileSync(".sinyal-veri/anlik.ndjson", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Kosu);
const softmax = (s: number[]) => { const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const avg = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
const segment = (tip: string) => { const c = tip.toUpperCase(); if (c.includes("MAIDEN") || c.includes("ŞARTLI 19")) return "varsayilan"; if (c.includes("ŞARTLI 1") || c.includes("ŞARTLI 27")) return "sartli1-27"; if (c.includes("HANDIKAP")) return "handikap"; return "varsayilan"; };
const ix = (w: W, n: string) => w.featureNames.indexOf(n);
const mC = { mu: CANLI.means[ix(CANLI, "ACC_CLOSE_RES")]!, sd: CANLI.stds[ix(CANLI, "ACC_CLOSE_RES")]! }, mL = { mu: CANLI.means[ix(CANLI, "ACC_LATE")]!, sd: CANLI.stds[ix(CANLI, "ACC_LATE")]! };
// Motorla AYNI: gözlemsiz → 0; katkı = güvenirlik × (ham − μ)/σ × β
function skor(w: W, sig: Map<string, Sig>): number | null {
  let s = 0;
  for (let i = 0; i < w.featureNames.length; i++) {
    const n = w.featureNames[i]!; let ham: number | null = null, rel = 1, obs = false;
    if (n === "accBitis") {
      const c = sig.get("ACC_CLOSE_RES"), l = sig.get("ACC_LATE");
      const a = c && c[2] && c[1] != null ? (c[3] ?? 1) * (c[1] - mC.mu) / mC.sd : null, b = l && l[2] && l[1] != null ? (l[3] ?? 1) * (l[1] - mL.mu) / mL.sd : null;
      const v = a != null && b != null ? (a + b) / 2 : (a ?? b); if (v != null) { ham = v; obs = true; rel = 1; }
    } else { const q = sig.get(n); if (!q) return null; ham = q[1]; obs = q[2]; rel = q[3] ?? 1; }
    if (!obs || ham == null) continue;
    s += rel * ((ham - w.means[i]!) / w.stds[i]!) * w.weights[i]!;
  }
  return s;
}
const satir: { yer: string; n: number; kz: number; liveRank: number; s2Rank: number; liveP: number; s2P: number; liveTop3: boolean; s2Top3: boolean; liveTop1: boolean; s2Top1: boolean }[] = [];
let atla = { eskiFormat: 0, segment: 0 }; const farklar: number[] = [];
for (const r of lines) {
  if (r.tarih < from) continue;
  if (segment(r.tip) !== "varsayilan") { atla.segment++; continue; }
  const maps = r.atlar.map((a) => new Map(a.sig.map((s) => [s[0], s] as [string, Sig])));
  if (!maps.every((m) => CANLI.featureNames.every((n) => m.has(n)))) { atla.eskiFormat++; continue; } // eski sinyal adlı kayıt (v2 öncesi)
  const sl = maps.map((m) => skor(CANLI, m)), s2 = maps.map((m) => skor(S2, m)); if (sl.some((v) => v == null) || s2.some((v) => v == null)) continue;
  const pl = softmax(sl as number[]), p2 = softmax(s2 as number[]);
  const kz = r.kazananlar[0]; const ki = r.atlar.findIndex((a) => a.no === kz); if (ki < 0) continue;
  const rk = (p: number[]) => 1 + p.filter((v) => v > p[ki]!).length;
  // doğrulama: canlı kayıtlı en yüksek p ile tekrar oynatılan arasındaki fark (yüzde puan)
  const top = r.atlar.map((a, i) => ({ a, i })).sort((x, y) => y.a.p - x.a.p)[0]!; farklar.push(Math.abs(top.a.p - pl[top.i]! * 100));
  satir.push({ yer: r.hip + " " + r.tarih.slice(5) + " K" + r.kosu, n: r.atlar.length, kz: kz!, liveRank: rk(pl), s2Rank: rk(p2), liveP: pl[ki]!, s2P: p2[ki]!, liveTop1: rk(pl) === 1, s2Top1: rk(p2) === 1, liveTop3: rk(pl) <= 3, s2Top3: rk(p2) <= 3 });
}
const out: string[] = []; const P = (s = "") => { console.log(s); out.push(s); };
P("# S2 GÖLGE KIYAS — " + new Date().toISOString().slice(0, 10) + " (başlangıç " + from + ")");
P("Kapsam: varsayılan modele giden koşular. Atlanan: " + atla.segment + " segment (Handikap/ŞARTLI 1/27), " + atla.eskiFormat + " v2-öncesi kayıt.");
P("Çevrimdışı tekrar oynatma doğrulaması: en yüksek olasılıklı atın kayıtlı canlı olasılığı ile yeniden hesaplanan arasındaki ort. mutlak fark = " + (farklar.length ? avg(farklar).toFixed(2) : "—") + " yüzde puan (n=" + farklar.length + "; 0'a yakın olmalı; >1 ise kıyas GÜVENİLİR DEĞİL).");
if (satir.length) {
  const n = satir.length;
  const ll = (k: "liveP" | "s2P") => avg(satir.map((x) => -Math.log(Math.max(x[k], 1e-15))));
  const say = (f: (x: (typeof satir)[number]) => boolean) => satir.filter(f).length;
  P("\n| Ölçüt | CANLI (24) | S2 (17) | Fark (S2 − canlı) |"); P("|---|---|---|---|");
  P("| Yarış sayısı | " + n + " | " + n + " | |");
  P("| Top1 | " + say((x) => x.liveTop1) + " (%" + (say((x) => x.liveTop1) / n * 100).toFixed(1) + ") | " + say((x) => x.s2Top1) + " (%" + (say((x) => x.s2Top1) / n * 100).toFixed(1) + ") | " + (say((x) => x.s2Top1) - say((x) => x.liveTop1)) + " |");
  P("| Top3 | " + say((x) => x.liveTop3) + " (%" + (say((x) => x.liveTop3) / n * 100).toFixed(1) + ") | " + say((x) => x.s2Top3) + " (%" + (say((x) => x.s2Top3) / n * 100).toFixed(1) + ") | " + (say((x) => x.s2Top3) - say((x) => x.liveTop3)) + " |");
  P("| Log-loss (kazananın olasılığı) | " + ll("liveP").toFixed(4) + " | " + ll("s2P").toFixed(4) + " | " + (ll("s2P") - ll("liveP")).toFixed(4) + " |");
  P("| Kazananın ort. sırası | " + avg(satir.map((x) => x.liveRank)).toFixed(2) + " | " + avg(satir.map((x) => x.s2Rank)).toFixed(2) + " | |");
  P("| Kurtarılan kazanan (S2 Top3'te, canlı değil) | | " + say((x) => x.s2Top3 && !x.liveTop3) + " | |");
  P("| Yeni kaçırılan kazanan (canlı Top3'te, S2 değil) | | " + say((x) => !x.s2Top3 && x.liveTop3) + " | |");
  const dif = satir.map((x) => -Math.log(x.s2P) + Math.log(x.liveP)); P("\nYarış bazlı log-loss farkı (S2 − canlı): ort. " + avg(dif).toFixed(4) + " | yarış sayısı " + n + (n < 100 ? " → ÖRNEKLEM ÇOK KÜÇÜK: yalnız teknik/büyük sorun tespiti için; %0,5'lik Top3 farkı bu sayıyla ayırt edilemez." : ""));
  P("\n| Koşu | At sayısı | Kazanan | canlı sıra | S2 sıra | p canlı | p S2 |"); P("|---|---|---|---|---|---|---|");
  for (const x of satir) P("| " + x.yer + " | " + x.n + " | " + x.kz + " | " + x.liveRank + " | " + x.s2Rank + " | " + (x.liveP * 100).toFixed(1) + " | " + (x.s2P * 100).toFixed(1) + " |");
} else P("\nKıyaslanacak v2-sonrası (24 sinyal adlı), varsayılan segmentli sonuçlanmış koşu henüz yok. Yarışlar bitince `npm run sinyal-veri` ve bu aracı tekrar çalıştırın.");
fs.writeFileSync(".sinyal-veri/s2-golge-rapor.md", out.join("\n"));
