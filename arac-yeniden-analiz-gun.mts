// SALT-OKUMA — belirli gün/hipodromlardaki TÜM koşuları CANLI MOTORLA (scoreV461Saf, bugünkü sinyaller/ağırlıklar) yeniden puanlar;
// o gün YAYINLANAN tahminle (varsa) ve gerçek sonuçla karşılaştırır. Kullanım: --gun "istanbul:2026-11-15,adana:2026-11-15,bursa:2026-11-16"
// Not: bugünkü sinyaller bugünkü verilerle hesaplanır (ör. pedigri günlük görüntüden); geçmiş koşularda "yarış öncesi" kısıtlar motorun kendi as-of mantığına bağlıdır.
import { db } from "./src/lib/db";
import { scoreV461Saf } from "./src/lib/methodology/v546-1-engine";
import safW from "./src/lib/methodology/weights/v546-1-saf-weights.json";

const arg = process.argv.indexOf("--gun"); const istek = (arg >= 0 ? process.argv[arg + 1]! : "istanbul:2026-11-15,adana:2026-11-15,bursa:2026-11-16").split(",").map((x) => { const [h, g] = x.split(":"); return { h: h!, g: g! }; });
type Satir = { yer: string; no: number; sinif: string; mesafe: number; n: number; yeni: number[]; eski: number[] | null; kazanan: number[]; ilk3: number[]; yeniKazananSira: number; eskiKazananSira: number | null };
async function main() {
  const satirlar: Satir[] = [];
  for (const { h, g } of istek) {
    const rs = await db.race.findMany({ where: { raceDay: { date: new Date(g + "T00:00:00Z"), hippodrome: { slug: h } }, result: { isNot: null } }, orderBy: { raceNo: "asc" }, select: { id: true, raceNo: true, classType: true, distance: true, surface: true, result: { select: { winnerNos: true, actualOrder: true } }, prediction: { select: { published: true, picks: { select: { rank: true, runner: { select: { no: true } } }, orderBy: { rank: "asc" } } } } } });
    for (const r of rs) {
      const s = await scoreV461Saf(r.id, safW as never); if (!s) continue;
      const order = (r.result?.actualOrder ?? []) as number[]; const wn = (r.result?.winnerNos?.length ? r.result.winnerNos : [order[0]!]) as number[];
      const yeni = [...s.picks].sort((a, b) => a.rank - b.rank).map((p) => p.no);
      const eski = r.prediction?.picks?.length ? r.prediction.picks.filter((p) => p.runner).map((p) => p.runner!.no) : null;
      const sira = (list: number[] | null) => { if (!list) return null; const i = list.findIndex((x) => wn.includes(x)); return i >= 0 ? i + 1 : list.length + 1; };
      satirlar.push({ yer: `${h} ${g.slice(5)}`, no: r.raceNo, sinif: r.classType, mesafe: r.distance, n: s.picks.length, yeni, eski, kazanan: wn, ilk3: order.slice(0, 3), yeniKazananSira: sira(yeni)!, eskiKazananSira: sira(eski) });
      const pr = (no: number) => { const p = s.picks.find((x) => x.no === no); return p ? `${no}(%${(p.probability * 100).toFixed(0)})` : String(no); };
      console.log(`${h} ${g.slice(5)} K${r.raceNo} ${r.classType} ${r.distance}m ${r.surface} (${s.picks.length} at) | YENİ ilk4: ${yeni.slice(0, 4).map(pr).join(" ")} | ESKİ yayın: ${eski ? eski.slice(0, 4).join(" ") : "—"} | GERÇEK ilk3: ${order.slice(0, 3).join("-")} | kazananın sırası: yeni ${sira(yeni)}${eski ? " / eski " + sira(eski) : ""}`);
    }
  }
  const oz = (b: string, f: (x: Satir) => number | null, rs: Satir[]) => { const v = rs.map(f).filter((x): x is number => x != null); return `${b}: Top1 ${v.filter((x) => x === 1).length}/${v.length} (%${(v.filter((x) => x === 1).length / v.length * 100).toFixed(0)}) | İlk3 ${v.filter((x) => x <= 3).length} (%${(v.filter((x) => x <= 3).length / v.length * 100).toFixed(0)}) | İlk6 ${v.filter((x) => x <= 6).length} (%${(v.filter((x) => x <= 6).length / v.length * 100).toFixed(0)}) | kazananın ort. sırası ${(v.reduce((p, q) => p + q, 0) / v.length).toFixed(2)}`; };
  console.log("\n=== ÖZET (" + satirlar.length + " koşu) ===");
  console.log(oz("YENİ model (bugünkü sinyaller)", (x) => x.yeniKazananSira, satirlar));
  const ikisi = satirlar.filter((x) => x.eskiKazananSira != null); console.log(oz("ESKİ (o gün yayınlanan, " + ikisi.length + " koşuda kayıtlı)", (x) => x.eskiKazananSira, ikisi)); console.log(oz("YENİ — aynı " + ikisi.length + " koşuda", (x) => x.yeniKazananSira, ikisi));
  for (const yer of [...new Set(satirlar.map((x) => x.yer))]) console.log(oz("  " + yer.padEnd(14) + " YENİ", (x) => x.yeniKazananSira, satirlar.filter((x) => x.yer === yer)));
  const tesadufTop1 = satirlar.reduce((p, x) => p + 1 / x.n, 0) / satirlar.length, tesadufTop3 = satirlar.reduce((p, x) => p + Math.min(3, x.n) / x.n, 0) / satirlar.length; console.log(`tesadüf: Top1 %${(tesadufTop1 * 100).toFixed(1)} İlk3 %${(tesadufTop3 * 100).toFixed(1)}`);
  await db.$disconnect(); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
