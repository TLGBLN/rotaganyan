// KALICI ARAÇ (2026-09-20) — Saf Model vs AGF Farkı, Forward Takip. SİLİNMİYOR.
//
// Bağlam: v5-engine.ts'te zaten CANLI bir mekanizma var — safModelDegerTerfisiUygula
// (SAF_MODEL_DEGER_TERFISI_AKTIF=true, 2026-09-02 THEATER OF WAR kararı): marketBlindProb1
// (Saf Model, AGF'siz) ile AGF payı arasındaki fark >=5pp (ilk3 penceresi için >=8pp) İSE
// VE modelin AGF-dışı katkı toplamı net pozitifse (nonAgfPozitifMi), at ilk6/ilk3 penceresine
// terfi ettiriliyor. Ama bu mekanizmanın KENDİSİ hiç forward doğrulanmadı — yalnız birkaç
// anekdot vakayla (THEATER OF WAR, BAY UMUT, KINDBERO) kuruldu.
//
// 20.09.2026 İstanbul günü tekrar gündeme geldi (ASRA İNAT K4, SHIROKE K7 — ikisi de
// kazandı, ikisinde de arac-tam-at-inceleme.mts'in "⚠ model piyasadan bağımsız değer
// buluyor" rozeti (ham fark>=5, nonAgfPozitifMi KONTROLÜ YOK) yanıyordu). Kullanıcı KESİN
// talimat verdi: yalnız kazananları not almak SAHTE bir örüntü yaratır (survivorship bias) —
// o gün uyarı alan TÜM adaylar (kazanan/kaybeden fark etmeksizin) kaydedilmeli ki
// P(win|uyarı) gerçek denominator'la hesaplanabilsin.
//
// Bu araç ÜÇ modda çalışır:
//   --hipodrom X --tarih Y   → o günün SONUÇLANMIŞ koşularını tarar, ham fark>=5pp olan
//                              HER adayı (kazanan/kaybeden) data/saf-agf-farki-forward-log.jsonl'a
//                              ekler (raceId+no ile idempotent — aynı gün tekrar çalıştırmak
//                              yinelenen satır yaratmaz).
//   --backfill               → V5'in canlıya alındığı 2026-08-16'dan bugüne TÜM sonuçlanmış
//                              koşuları (Karma hariç) tek seferde tarar — forward=false
//                              olarak işaretlenir (YALNIZ referans, sirkülerlik uyarısı geçerli).
//   --hesapla                → biriken logu okuyup P(win|uyarı) vs E[final olasılık] vs
//                              Σ(y-p) özetini basar; "forward" (2026-09-20 ve sonrası,
//                              gerçek doğrulama malzemesi) ile daha eski/backfill kayıtları
//                              AYRI raporlar — ikisini karıştırmak sirkülerlik riski taşır.
//                              Ayrıca ⚠ eşiğini geçip GERÇEKTEN kazanan her atın somut
//                              listesini basar ("yakalanan atlar").
//
// FORWARD_BASLANGIC: hipotez BUGÜN (2026-09-20) resmileşti — bu tarihten ÖNCEki hiçbir kayıt
// (backfill yapılırsa) gerçek doğrulama SAYILMAZ, yalnız referans/bağlam.
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "fs";
import { dirname } from "path";
import { db } from "./src/lib/db";
import { gatherFaz1V5, faz2V5Sirala } from "./src/lib/methodology/v5-engine";

const LOG_PATH = "./data/saf-agf-farki-forward-log.jsonl";
const FARK_ESIGI = 5; // v5-engine.ts SAF_MODEL_DEGER_ESIGI ile BİREBİR aynı sabit
const FORWARD_BASLANGIC = "2026-09-20";
const V5_BASLANGIC = new Date("2026-08-16T00:11:08+03:00"); // engine-versions.data.ts — V5 canlıya alındığı an

type Kayit = {
  raceId: string; hipodrom: string; tarih: string; raceNo: number; no: number; ad: string;
  safRank: number; safProb: number; agfRank: number; agfPayi: number;
  finalRank: number; finalProb: number; fark: number;
  degerTerfisiUygulandi: boolean; won: boolean; forward: boolean;
};

function get(argv: string[], bayrak: string) {
  const i = argv.indexOf(bayrak);
  return i >= 0 ? argv[i + 1] : undefined;
}
function yuvarla(x: number) { return Math.round(x * 10) / 10; }

function mevcutSatirlariOku(): Kayit[] {
  if (!existsSync(LOG_PATH)) return [];
  return readFileSync(LOG_PATH, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

type RaceIcinKayit = {
  id: string; raceNo: number;
  raceDay: { date: Date; hippodrome: { name: string } };
  result: { winnerNos: number[] } | null;
};

// 2026-09-20 kullanıcı bulgusu ("kapalı kutusun") — önceki sürüm TÜM koşuları bitirmeden
// tek satır bile yazmıyordu (yeniSatirlar sonda toplu append edilirdi). 644 koşuluk bir
// backfill'de bu, dakikalarca hiçbir görünür ilerleme olmaması demek — şeffaf değil, kör
// bekleme. Artık HER koşu bitince HEMEN o koşunun satırları log'a yazılıyor (append,
// koşu başına) ve ilerleme (i/toplam) ekrana basılıyor — `tail -f`/dosya boyutuyla veya
// konsol çıktısıyla ANLIK izlenebilir.
// 2026-09-20 kullanıcı bulgusu ("sürekli 20 dakika diyorsun, çabuk") — sıralı (tek tek
// await) işleme her koşu için ayrı DB round-trip'i bekletiyordu. gatherFaz1V5 çağrıları
// BİRBİRİNDEN BAĞIMSIZ (salt okunur, farklı raceId) — eşzamanlı (batch halinde Promise.all)
// çalıştırmak sonucu DEĞİŞTİRMEZ, yalnız bekleme süresini kısaltır.
const ESZAMANLILIK = 12;

function kosuyuIsle(race: RaceIcinKayit) {
  return gatherFaz1V5(race.id).then((faz1) => {
    if (!faz1) return { race, satirlar: [] as Kayit[] };
    const sirali = faz2V5Sirala(faz1);
    const safSirali = [...sirali].sort((a, b) => b.marketBlindProb1 - a.marketBlindProb1);
    const safRankByNo = new Map(safSirali.map((r, i2) => [r.no, i2 + 1]));
    const winnerNos = new Set(race.result?.winnerNos ?? []);
    const tarih = race.raceDay.date.toISOString().slice(0, 10);
    const forward = tarih >= FORWARD_BASLANGIC;

    const satirlar: Kayit[] = [];
    for (const r of sirali) {
      const safProb = r.marketBlindProb1 * 100;
      const fark = safProb - r.agfPayi;
      if (fark < FARK_ESIGI) continue; // yalnız uyarı eşiğini geçen adaylar
      satirlar.push({
        raceId: race.id, hipodrom: race.raceDay.hippodrome.name, tarih, raceNo: race.raceNo,
        no: r.no, ad: r.ad, safRank: safRankByNo.get(r.no)!, safProb: yuvarla(safProb),
        agfRank: r.agfSirasi, agfPayi: yuvarla(r.agfPayi), finalRank: r.teknikSira,
        finalProb: yuvarla(r.olasilik * 100), fark: yuvarla(fark),
        degerTerfisiUygulandi: r.degerTerfisi != null, won: winnerNos.has(r.no), forward,
      });
    }
    return { race, satirlar };
  });
}

async function raceListesiniIsle(races: RaceIcinKayit[]) {
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  const mevcutAnahtarlar = new Set(mevcutSatirlariOku().map((s) => `${s.raceId}#${s.no}`));
  let toplamYeni = 0;
  let islenen = 0;

  for (let batchStart = 0; batchStart < races.length; batchStart += ESZAMANLILIK) {
    const batch = races.slice(batchStart, batchStart + ESZAMANLILIK);
    const sonuclar = await Promise.all(batch.map((race) => kosuyuIsle(race)));

    for (const { satirlar } of sonuclar) {
      for (const s of satirlar) {
        const anahtar = `${s.raceId}#${s.no}`;
        if (mevcutAnahtarlar.has(anahtar)) continue;
        mevcutAnahtarlar.add(anahtar);
        appendFileSync(LOG_PATH, JSON.stringify(s) + "\n");
        toplamYeni++;
        console.log(
          `  [${s.forward ? "forward" : "backfill"}] ${s.tarih} ${s.hipodrom} K${s.raceNo} #${s.no} ${s.ad} — Saf ${s.safRank}.(%${s.safProb}) AGF ${s.agfRank}.(%${s.agfPayi}) ` +
          `Final ${s.finalRank}.(%${s.finalProb}) fark=+${s.fark}pp terfi=${s.degerTerfisiUygulandi ? "EVET" : "hayır"} won=${s.won ? "★" : "-"}`
        );
      }
      islenen++;
    }
    console.log(`... ilerleme: ${islenen}/${races.length} koşu işlendi, şu ana kadar ${toplamYeni} yeni satır.`);
  }

  if (toplamYeni === 0) console.log("Yeni (uyarı eşiğini geçen, henüz kayıtlı olmayan) satır yok.");
  else console.log(`\nBitti: ${toplamYeni} yeni satır eklendi → ${LOG_PATH}`);
}

async function kaydet(hipodrom: string, tarih: string) {
  const races = await db.race.findMany({
    where: { raceDay: { date: new Date(`${tarih}T00:00:00.000Z`), hippodrome: { slug: hipodrom } }, result: { isNot: null } },
    select: {
      id: true, raceNo: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
      result: { select: { winnerNos: true } },
    },
    orderBy: { raceNo: "asc" },
  });
  if (races.length === 0) { console.log("Sonuçlanmış koşu bulunamadı."); return; }
  await raceListesiniIsle(races);
}

// 2026-09-20 kullanıcı talebi: "bir çok yarış kaydımız var" — V5'in canlıya alındığı andan
// (2026-08-16) bugüne TÜM sonuçlanmış koşuları (Karma HARİÇ — bkz. [[feedback_karma_cift_sayim_kontrolu]])
// tek seferde tara. Bu satırlar forward=false (raceDay tarihi FORWARD_BASLANGIC'ten önce)
// olarak işaretlenir — yalnız REFERANS/bağlam, [[project_saf_model_agf_farki_bekliyor]]'daki
// sirkülerlik uyarısı GEÇERLİ kalır (hipotez zaten bu dönemin anekdotlarından keşfedildi).
async function backfillTumGecmis() {
  const races = await db.race.findMany({
    where: { raceDay: { date: { gte: V5_BASLANGIC } }, result: { isNot: null }, conditions: null },
    select: {
      id: true, raceNo: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
      result: { select: { winnerNos: true } },
    },
    orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }],
  });
  console.log(`${races.length} sonuçlanmış koşu (V5 dönemi, Karma hariç) taranacak — bu birkaç dakika sürebilir.\n`);
  await raceListesiniIsle(races);
}

function hesapla() {
  const satirlar = mevcutSatirlariOku();
  if (satirlar.length === 0) { console.log("Log boş — önce --hipodrom/--tarih ile kayıt biriktirin."); return; }

  function ozetYaz(baslik: string, rows: Kayit[]) {
    console.log(`\n--- ${baslik} ---`);
    if (rows.length === 0) { console.log("  (0 satır)"); return; }
    const n = rows.length;
    const kazanan = rows.filter((r) => r.won).length;
    const gercekOran = kazanan / n;
    const ortFinal = rows.reduce((s, r) => s + r.finalProb, 0) / n / 100;
    const residual = gercekOran - ortFinal;
    console.log(`  n=${n}  kazanan=${kazanan}  gerçek oran=%${(gercekOran * 100).toFixed(1)}  E[final olasılık]=%${(ortFinal * 100).toFixed(1)}  Σ(y-p)/n=${(residual * 100).toFixed(1)}pp`);
    const terfili = rows.filter((r) => r.degerTerfisiUygulandi);
    const terfisiz = rows.filter((r) => !r.degerTerfisiUygulandi);
    console.log(`  terfi UYGULANMIŞ (nonAgfPozitifMi geçti): n=${terfili.length}, kazanan=${terfili.filter((r) => r.won).length}`);
    console.log(`  terfi UYGULANMAMIŞ (⚠ var ama mekanizma atlamadı): n=${terfisiz.length}, kazanan=${terfisiz.filter((r) => r.won).length}`);
  }

  ozetYaz("YALNIZ FORWARD (2026-09-20+, gerçek doğrulama malzemesi)", satirlar.filter((s) => s.forward));
  ozetYaz("TÜM KAYITLAR (backfill dahil — YALNIZ referans, sirkülerlik riski taşır)", satirlar);

  const forwardN = satirlar.filter((s) => s.forward).length;
  if (forwardN < 100) {
    console.log(`\n⚠ Forward n=${forwardN} < 100 — kullanıcının belirttiği eşiğin (100-200) altında, henüz karar için YETERSİZ. Yalnız izleniyor.`);
  }

  // 2026-09-20 kullanıcı talebi ("kaçırdığımız atları da yakalamak istiyorum") — yalnız
  // özet sayı değil, uyarı eşiğini geçmiş VE kazanmış her atın somut listesi.
  const yakalananlar = satirlar.filter((s) => s.won).sort((a, b) => a.tarih.localeCompare(b.tarih));
  console.log(`\n--- Yakalanan atlar (⚠ eşiğini geçip kazanan, n=${yakalananlar.length}) ---`);
  for (const s of yakalananlar) {
    console.log(
      `  [${s.forward ? "forward" : "backfill"}] ${s.tarih} ${s.hipodrom} K${s.raceNo} #${s.no} ${s.ad} — ` +
      `Saf ${s.safRank}.(%${s.safProb}) AGF ${s.agfRank}.(%${s.agfPayi}) Final ${s.finalRank}.(%${s.finalProb}) terfi=${s.degerTerfisiUygulandi ? "EVET" : "hayır"}`
    );
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--hesapla")) { hesapla(); return; }
  if (argv.includes("--backfill")) { await backfillTumGecmis(); return; }
  const hipodrom = get(argv, "--hipodrom");
  const tarih = get(argv, "--tarih");
  if (!hipodrom || !tarih) {
    console.log("Kullanım: arac-saf-agf-farki-takip.mts --hipodrom <slug> --tarih YYYY-MM-DD   VEYA   --backfill   VEYA   --hesapla");
    return;
  }
  await kaydet(hipodrom, tarih);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
