// KUPON PERFORMANS DERİN ANALİZ (2026-10-02, kullanıcı talebi: "tek gün değil, bugüne
// kadarki tüm sonuçlara bakarak detaylı analiz yap").
//
// 4 bölüm:
//   1. Zaman trendi (haftalık) — narrow/normal/wide tuttu oranı DÜŞÜYOR mu?
//   2. Kaçırma derinliği — tutmayan kuponlarda KAÇ ayak kaçırıldı (1 mi, 3+ mi)?
//   3. AGF-favorisi referansı — yalnız piyasa favorisini seçseydik ne olurdu (gerçekten
//      değer katıyor muyuz, yoksa piyasayı mı takip ediyoruz)?
//   4. Hipodrom/slot kırılımı.
//
// Salt-okunur, hiçbir şey değiştirmez.
import { db } from "./src/lib/db";

type Leg = { raceNo: number; narrow: number[]; normal: number[]; wide: number[] };

async function main() {
  console.log("1/5 — Tüm HomeKupon kayıtları yükleniyor (tam tarihçe)...");
  const kuponlar = await db.homeKupon.findMany({
    select: { id: true, hippodromeName: true, date: true, slot: true, legs: true },
    orderBy: { date: "asc" },
  });
  console.log(`   ${kuponlar.length} kayıt bulundu.\n`);

  type KuponSonuc = {
    date: Date; hippodromeName: string; slot: number;
    narrowTuttu: boolean; normalTuttu: boolean; wideTuttu: boolean;
    wideKacirilanAyak: number; toplamAyak: number;
    agfFavoriTuttu: boolean; // yalnız her ayağın AGF favorisini seçseydik
  };
  const sonuclar: KuponSonuc[] = [];
  let atlananEksikSonuc = 0;

  console.log("2/5 — Her kupon için gerçek sonuç + AGF-favori referansı hesaplanıyor...");
  let i = 0;
  for (const k of kuponlar) {
    i++;
    if (i % 50 === 0) console.log(`   ${i}/${kuponlar.length}...`);
    const legs = k.legs as Leg[];
    const raceNos = legs.map((l) => l.raceNo);
    const baseName = k.hippodromeName.split(" — ")[0];
    const races = await db.race.findMany({
      where: { raceNo: { in: raceNos }, raceDay: { date: k.date, hippodrome: { name: baseName } } },
      select: {
        raceNo: true,
        result: { select: { winnerNos: true } },
        runners: { where: { scratched: false }, select: { no: true, agf: true } },
      },
    });
    if (races.length < raceNos.length || races.some((r) => !r.result)) { atlananEksikSonuc++; continue; }
    const byRaceNo = new Map(races.map((r) => [r.raceNo, r]));

    let narrowTuttu = true, normalTuttu = true, wideTuttu = true, agfFavoriTuttu = true, wideKacirilan = 0;
    for (const l of legs) {
      const race = byRaceNo.get(l.raceNo)!;
      const kazananlar = race.result!.winnerNos;
      if (!kazananlar.some((w) => l.narrow.includes(w))) narrowTuttu = false;
      if (!kazananlar.some((w) => l.normal.includes(w))) normalTuttu = false;
      if (!kazananlar.some((w) => l.wide.includes(w))) { wideTuttu = false; wideKacirilan++; }
      const favori = [...race.runners].sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0))[0];
      if (!favori || !kazananlar.includes(favori.no)) agfFavoriTuttu = false;
    }
    sonuclar.push({ date: k.date, hippodromeName: k.hippodromeName, slot: k.slot, narrowTuttu, normalTuttu, wideTuttu, wideKacirilanAyak: wideKacirilan, toplamAyak: legs.length, agfFavoriTuttu });
  }
  console.log(`   ${sonuclar.length} tamamlanmış kupon analiz edildi (${atlananEksikSonuc} eksik sonuç yüzünden atlandı).\n`);

  console.log("3/5 — Zaman trendi (haftalık)...\n");
  const haftaAnahtari = (d: Date) => {
    const t = new Date(d);
    const gun = (t.getUTCDay() + 6) % 7; // Pazartesi=0
    t.setUTCDate(t.getUTCDate() - gun);
    return t.toISOString().slice(0, 10);
  };
  const haftalar = new Map<string, KuponSonuc[]>();
  for (const s of sonuclar) {
    const h = haftaAnahtari(s.date);
    const l = haftalar.get(h) ?? [];
    l.push(s);
    haftalar.set(h, l);
  }
  console.log("Hafta(Pzt)".padEnd(12) + "n".padStart(5) + "narrow%".padStart(9) + "normal%".padStart(9) + "wide%".padStart(8) + "AGFfav%".padStart(9));
  for (const [hafta, liste] of [...haftalar.entries()].sort()) {
    const n = liste.length;
    const pct = (f: (s: KuponSonuc) => boolean) => ((liste.filter(f).length / n) * 100).toFixed(1);
    console.log(hafta.padEnd(12) + String(n).padStart(5) + `${pct((s) => s.narrowTuttu)}%`.padStart(9) + `${pct((s) => s.normalTuttu)}%`.padStart(9) + `${pct((s) => s.wideTuttu)}%`.padStart(8) + `${pct((s) => s.agfFavoriTuttu)}%`.padStart(9));
  }

  console.log("\n4/5 — Kaçırma derinliği (wide tutmayan kuponlarda kaç ayak kaçırıldı)...\n");
  const tutmayanlar = sonuclar.filter((s) => !s.wideTuttu);
  const derinlikSayac = new Map<number, number>();
  for (const s of tutmayanlar) derinlikSayac.set(s.wideKacirilanAyak, (derinlikSayac.get(s.wideKacirilanAyak) ?? 0) + 1);
  for (const [derinlik, sayi] of [...derinlikSayac.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${derinlik} ayak kaçırıldı: ${sayi} kupon (%${((sayi / tutmayanlar.length) * 100).toFixed(1)})`);
  }
  const tekAyakKacan = tutmayanlar.filter((s) => s.wideKacirilanAyak === 1).length;
  console.log(`\n  → "Yalnız 1 ayak eksikti" (çok yakın ıska) oranı: %${((tekAyakKacan / tutmayanlar.length) * 100).toFixed(1)} (${tekAyakKacan}/${tutmayanlar.length})`);

  console.log("\n5/5 — AGF-favorisi referansı (GENEL) ve Hipodrom kırılımı...\n");
  const narrowGenel = (sonuclar.filter((s) => s.narrowTuttu).length / sonuclar.length) * 100;
  const wideGenel = (sonuclar.filter((s) => s.wideTuttu).length / sonuclar.length) * 100;
  const agfGenel = (sonuclar.filter((s) => s.agfFavoriTuttu).length / sonuclar.length) * 100;
  console.log(`GENEL (n=${sonuclar.length}): narrow=%${narrowGenel.toFixed(1)}  wide=%${wideGenel.toFixed(1)}  |  Yalnız-AGF-favorisi=%${agfGenel.toFixed(1)}`);
  console.log(`  → Narrow (modelin EN DAR seçimi, genelde favoriye yakın) ile Yalnız-AGF-favorisi KIYASI:`);
  console.log(`     ${narrowGenel > agfGenel ? "Model, salt piyasa favorisinden DAHA İYİ" : narrowGenel < agfGenel ? "Model, salt piyasa favorisinden DAHA KÖTÜ" : "Fark yok"} (${narrowGenel.toFixed(1)} vs ${agfGenel.toFixed(1)})\n`);

  const hipodromlar = new Map<string, KuponSonuc[]>();
  for (const s of sonuclar) {
    const baseName = s.hippodromeName.split(" — ")[0];
    const l = hipodromlar.get(baseName) ?? [];
    l.push(s);
    hipodromlar.set(baseName, l);
  }
  console.log("Hipodrom".padEnd(14) + "n".padStart(5) + "narrow%".padStart(9) + "wide%".padStart(8) + "AGFfav%".padStart(9));
  for (const [hip, liste] of [...hipodromlar.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const n = liste.length;
    const pct = (f: (s: KuponSonuc) => boolean) => ((liste.filter(f).length / n) * 100).toFixed(1);
    console.log(hip.padEnd(14) + String(n).padStart(5) + `${pct((s) => s.narrowTuttu)}%`.padStart(9) + `${pct((s) => s.wideTuttu)}%`.padStart(8) + `${pct((s) => s.agfFavoriTuttu)}%`.padStart(9));
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
