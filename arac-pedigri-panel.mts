// SALT-OKUMA — program "Pedigriler" panelinin verisini bir koşu için yazdırır. Kullanım: node ... arac-pedigri-panel.mts <raceId>
import { db } from "./src/lib/db";
import { pedigriPanelKosu, type AtaSatiri } from "./src/server/services/pedigri-panel.service";
const f1 = (x: number | null, d = 1) => (x == null ? "—" : x.toFixed(d));
const sat = (a: AtaSatiri) => a.durum === "VERI_YOK" ? `${a.ad ?? "—"}: ${a.not}` : `${a.ad} [${a.kategori}${a.durum === "GENEL_YEDEK" ? " ⚠YEDEK" : ""}] ${a.wins}/${a.starts} (%${f1((a.ham ?? 0) * 100)}) yavru ${a.yavru} | KALİTE ${f1(a.kalite, 0)} (akran ${a.akranSayisi}) | VERİ GÜVENİ %${f1(a.veriGuveni, 0)} (n_etkin ${f1(a.nEtkin, 1)}) | UZMANLAŞMA ${a.uzmanlasma ? (a.uzmanlasma.farkPp >= 0 ? "+" : "") + f1(a.uzmanlasma.farkPp) + " pp (dışı %" + f1(a.uzmanlasma.refK * 100) + ", n=" + a.uzmanlasma.refStarts + ")" : "—"}${a.kendiKosuCikarildi ? " | kendi koşusu çıkarıldı " + a.kendiKosuCikarildi.wins + "/" + a.kendiKosuCikarildi.starts : ""}${a.yarisSonrasiVeri ? " | ⛔YARIŞ SONRASI VERİ" : ""}${a.ayrintilar.length ? " | ayrı: " + a.ayrintilar.map((x) => `${x.etiket} ${x.wins}/${x.starts}`).join(", ") : ""}`;
async function main() {
  const s = await pedigriPanelKosu(process.argv[2]!); if (!s) { console.log("yok"); return; }
  if (s.uyari) console.log("UYARI:", s.uyari);
  for (const a of s.atlar) { console.log(`\n${a.no}. ${a.name} (yaş ${a.yas}) — PEDİGRİ KALİTE ${f1(a.pedigriKalite, 0)} | PEDİGRİ GÜVEN ${f1(a.pedigriGuven, 0)}${a.eksik.length ? " | EKSİK: " + a.eksik.join(", ") : ""}`); console.log("   BABA  ", sat(a.baba)); console.log("   ANNE  ", sat(a.anne)); console.log("   K.BABA", sat(a.kisrakBabasi)); }
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
