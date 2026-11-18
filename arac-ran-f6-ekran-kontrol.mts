// RAN F6 ekran kontrolü (salt-okuma): gerçek yarışlarda servis çıktısını doğrular. Formül/katsayı DEĞİŞTİRMEZ.
import { db } from "./src/lib/db";
import { ranF6Hesapla, ranF6Gun } from "./src/server/services/ran-f6.service";
import { F6_SINYALLER, turGrubu, type TurGrubu } from "./src/lib/methodology/ran-f6/ran-f6-model";
const gunler = ["2026-11-10", "2026-11-14", "2026-11-17"]; const secilen: Record<string, string[]> = {}; const tipSay: Record<string, number> = {};
const t0 = Date.now(); let ilk = true; const sat: string[] = []; let hata = 0;
for (const g of gunler) {
  const r = await db.race.findMany({ where: { raceDay: { date: new Date(g + "T00:00:00.000Z") } }, select: { id: true, classType: true } });
  for (const x of r) { const t = turGrubu(x.classType ?? ""); tipSay[t] = (tipSay[t] ?? 0) + 1; if ((secilen[t] ??= []).length < 3) secilen[t]!.push(x.id); }
}
const tum = Object.values(secilen).flat(); console.log("tip dağılımı", JSON.stringify(tipSay), "seçilen", tum.length);
const s0 = Date.now(); const res = await ranF6Hesapla(tum); const sure1 = (Date.now() - s0) / 1000; const s1 = Date.now(); await ranF6Hesapla(tum); const sure2 = (Date.now() - s1) / 1000;
console.log(`ilk yükleme ${sure1.toFixed(1)} sn (popülasyon ${res.populasyonSn.toFixed(1)}), ikinci (önbellekli) ${sure2.toFixed(1)} sn; atlanan ${res.atlananlar.length}`);
const k = { toplam: 0, sira: 0, ilkStart: 0, sinyal6: 0, katki: 0, nan: 0 }; const ozet: string[] = [];
for (const y of res.yarislar) {
  const topl = y.atlar.reduce((s, a) => s + a.olasilik, 0); if (Math.abs(topl - 1) > 1e-9) { k.toplam++; hata++; }
  const sr = [...y.atlar].sort((a, b) => a.sira - b.sira); for (let i = 1; i < sr.length; i++) if (sr[i - 1]!.olasilik < sr[i]!.olasilik - 1e-12) { k.sira++; hata++; break; }
  if (y.atlar.some((a) => !Number.isFinite(a.olasilik) || Object.values(a.katki).some((v) => v != null && !Number.isFinite(v)))) { k.nan++; hata++; }
  if (y.tur === "SARTLI_127") { if (JSON.stringify([...y.kullanilan].sort()) !== JSON.stringify(["S", "kap"])) { k.ilkStart++; hata++; } } else if (y.kullanilan.length !== 6) { k.sinyal6++; hata++; }
  const eksik: Record<string, number> = {}; for (const a of y.atlar) for (const c of a.eksik) eksik[c] = (eksik[c] ?? 0) + 1;
  const top = sr[0]!; ozet.push(`${y.hipodrom} ${y.raceNo} | ${y.turAdi} | at ${y.atlar.length} | kullanılan ${y.kullanilan.join(",")} | Σp=${topl.toFixed(6)} | 1.: ${top.ad} %${(top.olasilik * 100).toFixed(1)} | eksik ${JSON.stringify(eksik)}`);
}
console.log(ozet.join("\n")); console.log("hata sayaçları", JSON.stringify(k), "TOPLAM HATA", hata);
const gun = await ranF6Gun("2026-11-17"); console.log("ranF6Gun 2026-11-17:", gun.yarislar.length, "yarış, atlanan", gun.atlananlar.length);
process.exit(0);
