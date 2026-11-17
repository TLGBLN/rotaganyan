// KALICI ARAÇ — BANKO SİNYAL YÖNLERİ (kararlılık testli). SALT-OKUMA girdi (.sinyal-veri/golgeleme-matris.json); yazar: src/lib/methodology/weights/banko-sinyal-yonleri.json
// Yön = sinyalin TEK BAŞINA (diğer sinyaller olmadan) koşullu-logit işareti; sıralama katsayısından ALINMAZ (gölgelenmeden etkilenir).
// Sıfıra yakın katsayının işareti tesadüf olabilir → yön KARARLI sayılır ancak: (a) yarış-bazlı bootstrap (B) %95 GA sıfırı DIŞLIYORSA VE (b) 5 ardışık zaman bloğunun ≥4'ünde aynı işaret.
// Aksi halde yon=null ("belirsiz"): o sinyal için etkin banko desteği VERİLMEZ. Çözücü: Newton (tek parametre, dışbükey; motorun ridge'i 0.02 ile aynı hedef).
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-banko-yon-uret.mts [--boot 1000]
import fs from "node:fs";
type Cell = [number, number, number?] | null;
const M = JSON.parse(fs.readFileSync(".sinyal-veri/golgeleme-matris.json", "utf8")) as { ozellik: string[]; yarislar: { raceId: string; tarih: string; runners: { k: number; f: Cell[] }[] }[] };
const races = [...M.yarislar].sort((a, b) => a.tarih.localeCompare(b.tarih)).filter((r) => r.runners.some((x) => x.k === 1));
const bi = process.argv.indexOf("--boot"); const B = bi >= 0 ? Number(process.argv[bi + 1]) : 1000;
type R = { w: number; raw: Float64Array; rel: Float64Array; ok: Uint8Array };
const kur = (i: number): R[] => races.map((r) => ({ w: r.runners.findIndex((x) => x.k === 1), raw: Float64Array.from(r.runners, (x) => x.f[i]?.[0] ?? 0), rel: Float64Array.from(r.runners, (x) => x.f[i]?.[1] ?? 0), ok: Uint8Array.from(r.runners, (x) => (x.f[i] ? 1 : 0)) }));
function beta(rs: R[]): number {
  let s = 0, n = 0; for (const r of rs) for (let j = 0; j < r.raw.length; j++) if (r.ok[j]) { s += r.raw[j]!; n++; } const mu = n ? s / n : 0; let s2 = 0; for (const r of rs) for (let j = 0; j < r.raw.length; j++) if (r.ok[j]) s2 += (r.raw[j]! - mu) ** 2; const sd = n ? Math.sqrt(s2 / n) || 1 : 1;
  const X = rs.map((r) => Float64Array.from(r.raw, (v, j) => (r.ok[j] ? r.rel[j]! * (v - mu) / sd : 0)));
  let w = 0;
  for (let it = 0; it < 30; it++) {
    let g = 0, h = 0;
    for (let k = 0; k < rs.length; k++) { const x = X[k]!, m = x.length; let mx = -1e9; for (let j = 0; j < m; j++) mx = Math.max(mx, w * x[j]!); let z = 0, e1 = 0, e2 = 0; for (let j = 0; j < m; j++) { const e = Math.exp(w * x[j]! - mx); z += e; e1 += e * x[j]!; e2 += e * x[j]! * x[j]!; } const m1 = e1 / z; g += x[rs[k]!.w]! - m1; h += e2 / z - m1 * m1; }
    const n2 = rs.length; const grad = -g / n2 + 0.02 * w, hess = h / n2 + 0.02; const st = grad / hess; w -= st; if (Math.abs(st) < 1e-10) break;
  }
  return w;
}
let sd = 11; const rn = () => (sd = (sd * 1664525 + 1013904223) % 4294967296) / 4294967296;
const blokN = Math.floor(races.length / 5); const yon: Record<string, unknown> = {}; let kararli = 0;
console.log("Yarış " + races.length + " | bootstrap B=" + B);
for (let i = 0; i < M.ozellik.length; i++) {
  const n = M.ozellik[i]!, rs = kur(i), b0 = beta(rs); const bs: number[] = [];
  for (let t = 0; t < B; t++) bs.push(beta(rs.map(() => rs[Math.floor(rn() * rs.length)]!))); bs.sort((p, q) => p - q);
  const lo = bs[Math.floor(0.025 * B)]!, hi = bs[Math.min(B - 1, Math.floor(0.975 * B))]!;
  const blok = [0, 1, 2, 3, 4].map((k) => { const bk = beta(rs.slice(k * blokN, k === 4 ? rs.length : (k + 1) * blokN)); return Math.abs(bk) < 1e-9 ? 0 : bk > 0 ? 1 : -1; });
  const isaret = b0 >= 0 ? 1 : -1, uyum = blok.filter((x) => x === isaret).length, ok = (lo > 0 || hi < 0) && uyum >= 4; if (ok) kararli++;
  yon[n] = { yon: ok ? isaret : null, durum: ok ? "kararli" : "belirsiz", soloBeta: +b0.toFixed(4), ci95: [+lo.toFixed(4), +hi.toFixed(4)], blokIsaretleri: blok, blokUyum: uyum };
  console.log(n.padEnd(20) + (ok ? "KARARLI " : "belirsiz") + " β=" + b0.toFixed(4).padStart(8) + " GA [" + lo.toFixed(3) + ", " + hi.toFixed(3) + "] bloklar " + blok.map((x) => (x > 0 ? "+" : x < 0 ? "−" : "0")).join("") + " uyum " + uyum + "/5");
}
console.log("KARARLI: " + kararli + " / " + M.ozellik.length);
fs.writeFileSync("src/lib/methodology/weights/banko-sinyal-yonleri.json", JSON.stringify({ uretim: new Date().toISOString(), bootstrapB: B, not: "Yön = sinyalin TEK BAŞINA eğitim işareti; sıralama katsayısından alınmaz. KARARLILIK: yarış-bazlı bootstrap %95 GA sıfırı dışlamalı VE 5 zaman bloğunun ≥4'ünde aynı işaret. yon=null → 'belirsiz': etkin banko desteği VERİLMEZ (pozitiflik kaydı yalnız bilgi). Pozitiflik: yon·z > 0.", yonler: yon }, null, 2));
console.log("YAZILDI: banko-sinyal-yonleri.json");
