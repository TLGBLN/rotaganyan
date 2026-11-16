// SALT-OKUMA — GALOP KALİTESİ (Galop Analiz Motoru v1.0) + PEDİGRİ KALİTESİ birleşik, TEK BAŞINA sıralama testi:
// Maiden / Şartlı 1 / Şartlı 19 / Şartlı 27 TÜM sonuçlanmış yarışlarda atları puana göre sıralayıp kazananı bulma oranı (tesadüfle kıyas).
// Başka sinyal/AGF/canlı model YOK. Galop: yalnız yarış gününden ÖNCEKİ galoplar. Pedigri: C:/tmp/pedk.json (arac-pedigri-puan-test.mts; atın tüm kendi koşusu çıkarılmış; kardeşlerin sonradan koşuları içeride = pedigri lehine yanlı).
// Birleştirme ÖNCEDEN SABİT (denenip seçilmedi): her iki puan zaten 0–100. B50 = (galop + pedigri)/2 ; B70 = 0.7·galop + 0.3·pedigri. Biri eksikse yalnız mevcut olan kullanılır (eksik SIFIR sayılmaz).
import fs from "node:fs";
import { db } from "./src/lib/db";
import { sinifSeviyesi } from "./src/lib/methodology/ham-alan-sinyalleri";
import { galopKalitesiV1 } from "./src/lib/methodology/galop-motor";

type At = { no: number; pos: number; g: number | null; p: number | null };
type Y = { tarih: string; ilk: string; atlar: At[]; winners: number[]; ganyan: number | null };
const pct = (a: number, n: number) => (n ? (a / n * 100).toFixed(1) : "—") + "%";
async function main() {
  const pedk = JSON.parse(fs.readFileSync("C:/tmp/pedk.json", "utf8")) as Record<string, { k: number | null }>;
  const idler = (await db.race.findMany({ where: { result: { isNot: null } }, select: { id: true, classType: true } })).filter((r) => sinifSeviyesi(r.classType) === 1).map((r) => r.id);
  const ys: Y[] = [];
  for (let i = 0; i < idler.length; i += 120) {
    await new Promise((q) => setTimeout(q, 400));
    const rs = await db.race.findMany({ where: { id: { in: idler.slice(i, i + 120) } }, select: { id: true, classType: true, breed: true, raceDay: { select: { date: true } }, result: { select: { actualOrder: true, winnerNos: true, ganyan: true } }, runners: { select: { no: true, scratched: true, gallops: { select: { date: true, track: true, form: true, splits: true } } } } } });
    for (const r of rs) {
      const order = (r.result?.actualOrder ?? []) as number[]; if (!order.length) continue; const gun = r.raceDay.date.getTime();
      const atlar: At[] = [];
      for (const x of r.runners) { if (x.scratched) continue; const pos = order.indexOf(x.no) + 1; if (pos <= 0) continue;
        const gl = x.gallops.filter((g) => g.date.getTime() < gun).map((g) => ({ date: g.date, track: g.track, form: g.form, splits: (g.splits ?? {}) as Record<string, string | null> }));
        atlar.push({ no: x.no, pos, g: galopKalitesiV1(gl, r.breed).kalite, p: pedk[r.id + "|" + x.no]?.k ?? null }); }
      if (atlar.length < 4) continue;
      ys.push({ tarih: r.raceDay.date.toISOString().slice(0, 10), ilk: /^MAIDEN/i.test(r.classType) ? "Maiden" : /ŞARTLI 19/i.test(r.classType) ? "Şartlı 19" : /ŞARTLI 27/i.test(r.classType) ? "Şartlı 27" : /ŞARTLI 1/i.test(r.classType) ? "Şartlı 1" : "Diğer", atlar, winners: (r.result?.winnerNos?.length ? r.result.winnerNos : [order[0]!]) as number[], ganyan: r.result?.ganyan ?? null });
    }
  }
  ys.sort((a, b) => a.tarih.localeCompare(b.tarih));
  const comb = (a: At, wg: number) => (a.g != null && a.p != null ? wg * a.g + (1 - wg) * a.p : a.g ?? a.p);
  type M = { ad: string; sk: (a: At) => number | null };
  const MOD: M[] = [{ ad: "GALOP KALİTESİ tek başına", sk: (a) => a.g }, { ad: "PEDİGRİ KALİTESİ tek başına", sk: (a) => a.p }, { ad: "B50: (galop + pedigri) / 2", sk: (a) => comb(a, 0.5) }, { ad: "B70: 0.7·galop + 0.3·pedigri", sk: (a) => comb(a, 0.7) }, { ad: "B80: 0.8·galop + 0.2·pedigri", sk: (a) => comb(a, 0.8) }, { ad: "B90: 0.9·galop + 0.1·pedigri", sk: (a) => comb(a, 0.9) }, { ad: "B50, yalnız İKİSİ de dolu atlar", sk: (a) => (a.g != null && a.p != null ? comb(a, 0.5) : null) }];
  const tes1 = (rs: Y[]) => rs.reduce((p, r) => p + 1 / r.atlar.length, 0) / Math.max(1, rs.length), tes3 = (rs: Y[]) => rs.reduce((p, r) => p + Math.min(3, r.atlar.length) / r.atlar.length, 0) / Math.max(1, rs.length);
  const dgr = (rs: Y[], m: M) => { let t1 = 0, t3 = 0, n = 0, roi = 0, ort = 0, bN = 0, bH = 0; for (const r of rs) { const sk = r.atlar.map((a) => ({ a, s: m.sk(a) })).filter((q) => q.s != null).sort((p, q) => q.s! - p.s!); if (sk.length < 2) continue; n++; const top = sk[0]!; const ok = r.winners.includes(top.a.no); if (ok) { t1++; roi += r.ganyan ?? 0; } if (sk.slice(0, 3).some((q) => r.winners.includes(q.a.no))) t3++; const wi = sk.findIndex((q) => r.winners.includes(q.a.no)); ort += (wi >= 0 ? wi + 1 : sk.length + 1) / (sk.length + 1); if (top.s! - sk[1]!.s! >= 10) { bN++; if (ok) bH++; } } return { n, t1, t3, roi: n ? roi / n - 1 : 0, ort: n ? ort / n : 0, bN, bH }; };
  const rapor = (b: string, rs: Y[]) => { if (!rs.length) return; const ev = rs.filter((r) => r.atlar.filter((a) => a.g != null || a.p != null).length >= 2); console.log(`\n── ${b}: ${rs.length} yarış ── tesadüf: Top1 ${(tes1(rs) * 100).toFixed(1)}% Top3 ${(tes3(rs) * 100).toFixed(1)}%`); void ev; for (const m of MOD) { const d = dgr(rs, m); console.log(`  ${m.ad.padEnd(34)} n=${String(d.n).padStart(4)} | Top1 ${pct(d.t1, d.n).padStart(6)} | Top3 ${pct(d.t3, d.n).padStart(6)} | kazananın göreli sırası ${d.ort.toFixed(3)} | düz Top1 getirisi ${(d.roi * 100).toFixed(0)}% | "banko"(fark≥10) ${d.bN} yarış isabet ${pct(d.bH, d.bN)}`); } };
  const galopluYarislar = ys.filter((y) => y.atlar.some((a) => a.g != null)); // galop kayıtları yalnız Ağustos 2026'dan itibaren
  console.log(`yarış: ${ys.length} | galop puanı olan yarış: ${galopluYarislar.length} (${galopluYarislar[0]?.tarih} → ${galopluYarislar.at(-1)?.tarih})`);
  rapor("TÜM yarışlar (galopsuz dönem dahil: orada yalnız pedigri)", ys);
  rapor("GALOP VERİSİ OLAN dönem — TÜM sınıflar", galopluYarislar);
  for (const s of ["Maiden", "Şartlı 1", "Şartlı 19", "Şartlı 27"]) rapor("GALOP VERİSİ OLAN dönem — " + s, galopluYarislar.filter((y) => y.ilk === s));
  const h = Math.floor(galopluYarislar.length / 2); rapor("Galoplu dönem 1. yarı", galopluYarislar.slice(0, h)); rapor("Galoplu dönem 2. yarı", galopluYarislar.slice(h));
  console.log("\nAT DÜZEYİNDE B50 dilimine göre kazanma / ilk3 (galoplu dönem):");
  const sat = galopluYarislar.flatMap((y) => y.atlar.map((a) => ({ s: comb(a, 0.5), w: y.winners.includes(a.no) ? 1 : 0, t3: a.pos <= 3 ? 1 : 0 })).filter((q): q is { s: number; w: number; t3: number } => q.s != null)).sort((p, q) => p.s - q.s);
  for (let i = 0; i < 5; i++) { const d = sat.slice(Math.floor(i * sat.length / 5), Math.floor((i + 1) * sat.length / 5)); console.log(`  Q${i + 1} (${d[0]!.s.toFixed(0)}–${d.at(-1)!.s.toFixed(0)}): n=${d.length} kazanma ${pct(d.reduce((p, q) => p + q.w, 0), d.length)} ilk3 ${pct(d.reduce((p, q) => p + q.t3, 0), d.length)}`); }
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
