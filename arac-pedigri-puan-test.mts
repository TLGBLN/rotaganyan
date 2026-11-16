// SALT-OKUMA — YENİ PEDİGRİ PUANLAMASI (PED_KALITE; baba 2yaş+pist, anne diğer yavrular, kısrak babası 2yaş) TEK BAŞINA:
// Maiden / Şartlı 1 / Şartlı 19 / Şartlı 27 TÜM sonuçlanmış yarışlarda atları puana göre sıralayıp kazananı bulma oranı (tesadüfle kıyas).
// Geriye dönük sızıntı önlemi: atın KENDİ tüm koşuları (yarış sonrası dahil) ata istatistiğinden çıkarılır. KALAN sızıntı: kardeşlerin sonradan koşuları (TJK anlık görüntü 15 Kasım).
// Çıktı ayrıca C:/tmp/pedk.json (raceId|no → bileşen puanları) — CV aracı kullanır. Başka sinyal/AGF YOK.
import fs from "node:fs";
import { db } from "./src/lib/db";
import { sinifSeviyesi } from "./src/lib/methodology/ham-alan-sinyalleri";
import { pedigriPanelKosu } from "./src/server/services/pedigri-panel.service";

type At = { no: number; pos: number; kalite: number | null; baba: number | null; anne: number | null; kb: number | null; guven: number; eksik: number };
type Y = { raceId: string; tarih: string; sinif: string; ilk: string; atlar: At[]; winners: number[]; ganyan: number | null };
const pct = (a: number, n: number) => (n ? (a / n * 100).toFixed(1) : "—") + "%";
async function main() {
  const idler = (await db.race.findMany({ where: { result: { isNot: null } }, select: { id: true, classType: true } })).filter((r) => sinifSeviyesi(r.classType) === 1).map((r) => r.id);
  console.log("düşük sınıf sonuçlanmış yarış:", idler.length);
  const ys: Y[] = []; const kayit: Record<string, { k: number | null; b: number | null; a: number | null; kb: number | null; g: number }> = {};
  for (let i = 0; i < idler.length; i++) {
    const rc = await db.race.findUnique({ where: { id: idler[i]! }, select: { id: true, classType: true, raceDay: { select: { date: true } }, result: { select: { actualOrder: true, winnerNos: true, ganyan: true } } } }); if (!rc?.result) continue;
    const s = await pedigriPanelKosu(rc.id, { tumKendiKayit: true }); if (!s) continue;
    const order = (rc.result.actualOrder ?? []) as number[]; const atlar: At[] = [];
    for (const a of s.atlar) { const pos = order.indexOf(a.no) + 1; if (pos <= 0) continue; atlar.push({ no: a.no, pos, kalite: a.pedigriKalite, baba: a.baba.kalite, anne: a.anne.kalite, kb: a.kisrakBabasi.kalite, guven: a.pedigriGuven, eksik: a.eksik.length }); kayit[rc.id + "|" + a.no] = { k: a.pedigriKalite, b: a.baba.kalite, a: a.anne.kalite, kb: a.kisrakBabasi.kalite, g: a.pedigriGuven }; }
    if (atlar.length < 4) continue;
    ys.push({ raceId: rc.id, tarih: rc.raceDay.date.toISOString().slice(0, 10), sinif: rc.classType, ilk: /^MAIDEN/i.test(rc.classType) ? "Maiden" : /ŞARTLI 19/i.test(rc.classType) ? "Şartlı 19" : /ŞARTLI 27/i.test(rc.classType) ? "Şartlı 27" : /ŞARTLI 1/i.test(rc.classType) ? "Şartlı 1" : "Diğer", atlar, winners: (rc.result.winnerNos?.length ? rc.result.winnerNos : [order[0]!]) as number[], ganyan: rc.result.ganyan ?? null });
    if ((i + 1) % 200 === 0) console.log("  işlenen:", i + 1);
  }
  fs.writeFileSync("C:/tmp/pedk.json", JSON.stringify(kayit));
  ys.sort((a, b) => a.tarih.localeCompare(b.tarih));
  const nAt = ys.reduce((p, y) => p + y.atlar.length, 0), nK = ys.reduce((p, y) => p + y.atlar.filter((a) => a.kalite != null).length, 0);
  console.log(`yarış: ${ys.length} (${ys[0]?.tarih} → ${ys.at(-1)?.tarih}) | at: ${nAt} | PED_KALITE hesaplanan at: ${nK} (%${(nK / nAt * 100).toFixed(0)}) | üç hattı da dolu at: ${ys.reduce((p, y) => p + y.atlar.filter((a) => a.eksik === 0).length, 0)}`);
  type M = { ad: string; sk: (a: At) => number | null };
  const MOD: M[] = [{ ad: "PEDİGRİ KALİTESİ (3 hat ortalaması)", sk: (a) => a.kalite }, { ad: "yalnız BABA (2 yaş+pist)", sk: (a) => a.baba }, { ad: "yalnız ANNE (diğer yavrular)", sk: (a) => a.anne }, { ad: "yalnız KISRAK BABASI (2 yaş)", sk: (a) => a.kb }, { ad: "yalnız üç hattı da DOLU atlar: ortalama", sk: (a) => (a.eksik === 0 ? a.kalite : null) }];
  const tes1 = (rs: Y[]) => rs.reduce((p, r) => p + 1 / r.atlar.length, 0) / Math.max(1, rs.length), tes3 = (rs: Y[]) => rs.reduce((p, r) => p + Math.min(3, r.atlar.length) / r.atlar.length, 0) / Math.max(1, rs.length);
  const dgr = (rs: Y[], m: M) => { let t1 = 0, t3 = 0, n = 0, roi = 0, ort = 0; for (const r of rs) { const sk = r.atlar.map((a) => ({ a, s: m.sk(a) })).filter((q) => q.s != null).sort((p, q) => q.s! - p.s!); if (sk.length < 2) continue; n++; const top = sk[0]!; if (r.winners.includes(top.a.no)) { t1++; roi += r.ganyan ?? 0; } if (sk.slice(0, 3).some((q) => r.winners.includes(q.a.no))) t3++; const wi = sk.findIndex((q) => r.winners.includes(q.a.no)); ort += (wi >= 0 ? wi + 1 : sk.length + 1) / (sk.length + 1); } return { n, t1, t3, roi: n ? roi / n - 1 : 0, ort: n ? ort / n : 0 }; };
  const rapor = (b: string, rs: Y[]) => { if (!rs.length) return; const ev = rs.filter((r) => r.atlar.filter((a) => a.kalite != null).length >= 2); console.log(`\n── ${b}: ${rs.length} yarış (sıralanabilen ${ev.length}) ── tesadüf (sıralanan yarışlarda): Top1 ${(tes1(ev) * 100).toFixed(1)}% Top3 ${(tes3(ev) * 100).toFixed(1)}%`); for (const m of MOD) { const d = dgr(rs, m); console.log(`  ${m.ad.padEnd(44)} n=${String(d.n).padStart(4)} | Top1 ${pct(d.t1, d.n).padStart(6)} | Top3 ${pct(d.t3, d.n).padStart(6)} | kazananın göreli sırası ${d.ort.toFixed(3)} (0.5 tesadüf) | düz Top1 getirisi ${(d.roi * 100).toFixed(0)}%`); } };
  rapor("TÜM Maiden/Şartlı 1/19/27", ys);
  for (const s of ["Maiden", "Şartlı 1", "Şartlı 19", "Şartlı 27"]) rapor("Sınıf: " + s, ys.filter((y) => y.ilk === s));
  const h = Math.floor(ys.length / 2); rapor("Kronolojik 1. yarı", ys.slice(0, h)); rapor("Kronolojik 2. yarı", ys.slice(h));
  console.log("\nAT DÜZEYİNDE PEDİGRİ KALİTESİ dilimine göre kazanma / ilk3 (tüm yarışlar):");
  const sat = ys.flatMap((y) => y.atlar.filter((a) => a.kalite != null).map((a) => ({ k: a.kalite!, w: y.winners.includes(a.no) ? 1 : 0, t3: a.pos <= 3 ? 1 : 0 }))).sort((p, q) => p.k - q.k);
  for (let i = 0; i < 5; i++) { const d = sat.slice(Math.floor(i * sat.length / 5), Math.floor((i + 1) * sat.length / 5)); console.log(`  Q${i + 1} (${d[0]!.k.toFixed(0)}–${d.at(-1)!.k.toFixed(0)}): n=${d.length} kazanma ${pct(d.reduce((p, q) => p + q.w, 0), d.length)} ilk3 ${pct(d.reduce((p, q) => p + q.t3, 0), d.length)}`); }
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
