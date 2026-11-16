// SALT-OKUMA — CANLI MOTOR (scoreV461Saf, segment-routing dahil, bugünkü ağırlıklar) Maiden / Şartlı 1 / Şartlı 19 / Şartlı 27 yarışlarında.
// DIŞ ÖRNEK: model 2026-11-09'a kadar olan yarışlarla eğitildi → yalnız 2026-11-10 ve sonrası sonuçlanmış yarışlar kullanılır (modelin hiç görmediği yarışlar).
// Karşılaştırma: tesadüf, ve aynı atların YALNIZ galop girdisiyle (galopKaliteV1 / galopPedigri) sıralaması. AGF kullanmaz.
// Uyarı: pedigri verisi 10–14 Kasım yarışları için canlı tablodan (yarış sonrası alınmış), 16 Kasım için günlük görüntüden gelir → pedigri hafif sızıntıya açık.
import { db } from "./src/lib/db";
import { scoreV461Saf } from "./src/lib/methodology/v546-1-engine";
import { sinifSeviyesi } from "./src/lib/methodology/ham-alan-sinyalleri";
import safW from "./src/lib/methodology/weights/v546-1-saf-weights.json";

const BASLANGIC = process.argv[2] ?? "2026-11-10";
type Satir = { tarih: string; ilk: string; n: number; winnerP: number; winnerRank: number; top1: boolean; top3: boolean; galopRank: number | null; hipodrom: string };
const sinif = (c: string) => (/^MAIDEN/i.test(c) ? "Maiden" : /ŞARTLI 19/i.test(c) ? "Şartlı 19" : /ŞARTLI 27/i.test(c) ? "Şartlı 27" : /ŞARTLI 1/i.test(c) ? "Şartlı 1" : "Diğer");
const pct = (a: number, n: number) => (n ? (a / n * 100).toFixed(1) : "—") + "%";

async function main() {
  const yarislar = (await db.race.findMany({ where: { result: { isNot: null }, raceDay: { date: { gte: new Date(BASLANGIC + "T00:00:00Z") } } }, select: { id: true, classType: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } }, result: { select: { winnerNos: true, actualOrder: true } } }, orderBy: { raceDay: { date: "asc" } } })).filter((r) => sinifSeviyesi(r.classType) === 1);
  console.log(`dış örnek yarış (≥ ${BASLANGIC}, Maiden/Şartlı 1/19/27): ${yarislar.length}`);
  const satirlar: Satir[] = []; let hata = 0;
  for (const r of yarislar) {
    try {
      const s = await scoreV461Saf(r.id, safW as never); if (!s || s.picks.length < 4) continue;
      const wn = (r.result?.winnerNos?.length ? r.result.winnerNos : [((r.result?.actualOrder ?? []) as number[])[0]!]) as number[];
      const winP = s.picks.filter((p) => wn.includes(p.no)).map((p) => ({ p: p.probability, rank: p.rank }));
      if (!winP.length) continue; const w = winP.sort((a, b) => b.p - a.p)[0]!;
      // yalnız galop girdisiyle sıralama (galopPedigri varsa o, yoksa galopKaliteV1)
      const gal = s.picks.map((p) => { const f = p.features.find((x) => x.ad === "galopPedigri" && x.raw != null) ?? p.features.find((x) => x.ad === "galopKaliteV1" && x.raw != null); return { no: p.no, g: f?.raw ?? null }; }).filter((x): x is { no: number; g: number } => x.g != null).sort((a, b) => b.g - a.g);
      const gi = gal.findIndex((x) => wn.includes(x.no));
      satirlar.push({ tarih: r.raceDay.date.toISOString().slice(0, 10), ilk: sinif(r.classType), n: s.picks.length, winnerP: w.p, winnerRank: w.rank, top1: w.rank === 1, top3: w.rank <= 3, galopRank: gi >= 0 ? gi + 1 : null, hipodrom: r.raceDay.hippodrome.name });
    } catch (e) { hata++; }
  }
  console.log(`değerlendirilen: ${satirlar.length} | hata: ${hata}`);
  const rapor = (b: string, rs: Satir[]) => {
    if (!rs.length) { console.log(`\n── ${b}: 0 yarış`); return; }
    const t1 = rs.reduce((p, r) => p + 1 / r.n, 0) / rs.length, t3 = rs.reduce((p, r) => p + Math.min(3, r.n) / r.n, 0) / rs.length;
    const ll = rs.reduce((p, r) => p - Math.log(Math.max(r.winnerP, 1e-9)), 0) / rs.length, llTes = rs.reduce((p, r) => p + Math.log(r.n), 0) / rs.length;
    const g = rs.filter((r) => r.galopRank != null);
    console.log(`\n── ${b}: ${rs.length} yarış ── tesadüf Top1 ${(t1 * 100).toFixed(1)}% Top3 ${(t3 * 100).toFixed(1)}% LL ${llTes.toFixed(3)}`);
    console.log(`  MODEL (canlı)         Top1 ${pct(rs.filter((r) => r.top1).length, rs.length)} | Top3 ${pct(rs.filter((r) => r.top3).length, rs.length)} | LL ${ll.toFixed(3)} | kazananın ort. olasılığı %${(rs.reduce((p, r) => p + r.winnerP, 0) / rs.length * 100).toFixed(1)} | ort. sırası ${(rs.reduce((p, r) => p + r.winnerRank, 0) / rs.length).toFixed(2)}`);
    console.log(`  yalnız GALOP girdisi  Top1 ${pct(g.filter((r) => r.galopRank === 1).length, g.length)} | Top3 ${pct(g.filter((r) => r.galopRank! <= 3).length, g.length)} (galop verisi olan ${g.length} yarış)`);
  };
  rapor("TÜM Maiden/Şartlı 1/19/27", satirlar);
  for (const s of ["Maiden", "Şartlı 19", "Şartlı 1", "Şartlı 27"]) rapor(s, satirlar.filter((r) => r.ilk === s));
  const gunler = [...new Set(satirlar.map((r) => r.tarih))].sort(); console.log("\ngünlere göre yarış sayısı:", gunler.map((g) => `${g.slice(5)}=${satirlar.filter((r) => r.tarih === g).length}`).join(" "));
  await db.$disconnect(); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
