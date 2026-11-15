// SALT-OKUMA — bir koşunun pedigri analizi (SEVİYE + BAĞLAM). Kullanım: --hipodrom adana --tarih 2026-11-15 --kosu 6
import { db } from "./src/lib/db";
import { pedigriAnaliziKosu, type AtaAnalizi } from "./src/server/services/pedigri-analiz.service";
const arg = (a: string, d: string) => { const i = process.argv.indexOf("--" + a); return i >= 0 ? process.argv[i + 1] : d; };
const f = (x: number, d = 1) => `${x >= 0 ? "+" : ""}${x.toFixed(d)}`;
function satir(a: AtaAnalizi): string[] {
  const out: string[] = [];
  if (a.eslesme !== "var") { out.push(`    ${a.ad ?? "—"}: TJK'da ${a.eslesme === "belirsiz" ? "BELİRSİZ (aynı ad, birden çok kayıt)" : "kayıt yok"}`); return out; }
  const s = a.seviye!;
  out.push(`    ${a.ad} SEVİYE: ${s.win}/${s.start} (%${(s.k * 100).toFixed(1)}) · Pop %${(s.refK * 100).toFixed(1)} · Δ ${f(s.delta * 100)} pp · Güven %${Math.round(s.guven * 100)} · Etkin ${f(s.etkinPp, 2)} · ${s.durum}`);
  for (const b of a.baglamlar) {
    if (!b.ctx) out.push(`      └ ${b.etiket}: bu bağlamda koşu yok`);
    else if (!b.sonuc) out.push(`      └ ${b.etiket}: ${b.ctx.wins}/${b.ctx.starts} (%${(b.ctx.wins / b.ctx.starts * 100).toFixed(1)}) — referans (bağlam dışı) örneği yetersiz`);
    else { const r = b.sonuc; out.push(`      └ ${b.etiket}: ${r.ctxWin}/${r.ctxStart} (%${(r.ctxK * 100).toFixed(1)}) · Ref %${(r.refK * 100).toFixed(1)} (${r.refWin}/${r.refStart}) · Δ ${f(r.delta * 100)} pp · Güven %${Math.round(r.guven * 100)} · Etkin ${f(r.etkinPp, 2)} · ${r.durum}`); }
  }
  return out;
}
async function main() {
  const tarih = arg("tarih", "2026-11-15"), kosu = Number(arg("kosu", "6")), hip = arg("hipodrom", "adana");
  const race = await db.race.findFirst({ where: { raceNo: kosu, raceDay: { date: { gte: new Date(tarih + "T00:00:00Z"), lte: new Date(tarih + "T23:59:59Z") }, hippodrome: { slug: hip } } }, select: { raceNo: true, time: true, breed: true, surface: true, distance: true, classType: true, runners: { where: { scratched: false }, orderBy: { no: "asc" }, select: { no: true, name: true, sire: true, dam: true, damSire: true, age: true, tjkAtId: true } } } });
  if (!race) { console.log("koşu bulunamadı"); return; }
  console.log(`${hip} ${tarih} ${race.raceNo}. koşu ${race.time} | ${race.breed} ${race.surface} ${race.distance}m ${race.classType}\n`);
  const sonuc = await pedigriAnaliziKosu({ breed: race.breed as "INGILIZ" | "ARAP", surface: race.surface, classType: race.classType, distance: race.distance, tarih, runners: race.runners });
  console.log(`devreye girecek at: ${sonuc.filter((r) => r.devreye.kullan).length}/${sonuc.length} (yarış tipi düşük sınıf: ${sonuc[0]?.devreye.dusukSinifYarisi ? "EVET" : "hayır"})
`);
  for (const r of sonuc) {
    console.log(`${r.no}. ${r.name} (yaş ${r.yas}, TJK grup ${r.grupId}, pist ${r.pistId})`);
    // 1) ÖNCE atın geçmiş yarışları — "ilk defa" kararı bunlara dayanır
    console.log(`  GEÇMİŞ (${r.devreye.gecmisDurumu}): ` + (r.devreye.sonYarislar.length ? r.devreye.sonYarislar.map((s) => `${s.tarih} ${s.pist}${s.mesafe ?? "?"}m ${s.sinif} ${s.derece}.`).join(" | ") : "—"));
    console.log(`  DEVREYE: ${r.devreye.kullan ? "EVET — " + r.devreye.nedenler.join("; ") : "hayır (pedigri gösterilmez)"}`);
    if (!r.devreye.kullan) { console.log(); continue; }
    for (const [e, a] of [["BABA", r.sire], ["ANNE", r.dam], ["ANNE BABASI", r.damSire]] as const) { console.log(`  ${e}`); for (const l of satir(a)) console.log(l); }
    console.log();
  }
  await db.$disconnect();
}
main();
