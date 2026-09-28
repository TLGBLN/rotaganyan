// KALICI ARAÇ (2026-09-28) — Bayat/eski şemalı Runner.raceStyle kayıtlarını hedefli yenile.
//
// NEDEN: V5.37'de (1 Eylül) Yarış Gidişatı için raceStyle'a `dagilim` + `erkenHizGucu` eklendi;
// production hedefi 25 Eylül'e kadar eski deployment'a sabit kaldığı için (bkz. Vercel cron kök
// nedeni) çoğu Runner eski şemalı kaldı → yarisGidisatiSkoru sessizce 0, Yarış Temposu rozeti yok.
// Bu bir MODEL değişikliği DEĞİL: V5.46 ağırlık/formül/postprocess/kupon koduna dokunmaz, yalnız
// mevcut ham Accurace verisinden kayıtları doğru şemada yeniden üretir (kullanıcı onaylı veri
// sözleşmesi düzeltmesi, 2026-09-28: önce dry-run → hedefli backfill → doğrulama).
//
// KORUMALAR: (1) varsayılan DRY-RUN, yazmaz; (2) yalnız KAPSAMDAKİ (bugün + yaklaşan koşular)
// ESKİ ŞEMALI ve HAM VERİDEN yeniden üretilebilen Runner satırları; (3) ATIN TÜM Runner satırları
// DEĞİL, yalnız o hedef satırların id'leri; (4) Pick/Prediction/featureSnapshot'a HİÇ dokunmaz
// (geçmiş tahmin tarihsel gerçek olarak kalır); (5) yazmadan önce eski değerlerin yedeği alınır.
//
// Kullanım:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-racestyle-yenile.mts            # dry-run
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-racestyle-yenile.mts --uygula   # hedefli yazma
import { writeFileSync, mkdirSync } from "fs";
import { db } from "./src/lib/db";
import { turkeyDateString } from "./src/lib/tz";
import { hesaplaRaceStyleDegerleri, raceStyleEskiSemaMi, normalizeName } from "./src/server/services/accurace-sync.service";
import { hesaplaYarisGidisati, type AtTempoProfili, type TekYarisStil } from "./src/lib/methodology/pace-analizi";

const UYGULA = process.argv.includes("--uygula");
const TEMPO_MIN_GECERLI_AT = 3; // race.service.ts ile AYNI eşik (rozet için gerekli profil sayısı)

type RS = { style?: string; veri?: number; dagilim?: Record<TekYarisStil, number>; erkenHizGucu?: number | null } | null;

const bugun = turkeyDateString();
const kapsamBaslangic = new Date(`${bugun}T00:00:00.000Z`);
console.log(`Mod: ${UYGULA ? "UYGULA (hedefli yazma)" : "DRY-RUN (yazma yok)"} | kapsam: ${bugun} ve sonrası koşular`);

async function yukle() {
  return db.runner.findMany({
    where: { scratched: false, race: { raceDay: { date: { gte: kapsamBaslangic } } } },
    select: {
      id: true, no: true, name: true, raceStyle: true,
      race: { select: { id: true, raceNo: true, distance: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } } } },
    },
  });
}

type Satir = Awaited<ReturnType<typeof yukle>>[number];

function profilOlustur(rs: RS): AtTempoProfili | null {
  if (!rs?.dagilim) return null;
  return { dagilim: rs.dagilim, erkenHizGucu: rs.erkenHizGucu ?? null, n: rs.veri ?? 0 };
}

/** Kapsamdaki koşular için: sıfır-oran, rozet kapsamı ve eski-şema sayısı (verilen raceStyle görünümüyle). */
function olc(satirlar: Satir[], stilOf: (s: Satir) => RS) {
  const byRace = new Map<string, Satir[]>();
  for (const s of satirlar) (byRace.get(s.race.id) ?? byRace.set(s.race.id, []).get(s.race.id)!).push(s);
  let atSayisi = 0, sifirSkor = 0, eskiSema = 0, rozetKosu = 0, kosuSayisi = 0;
  for (const rs of byRace.values()) {
    kosuSayisi++;
    const profiller = rs.map((s) => profilOlustur(stilOf(s)));
    if (profiller.filter(Boolean).length >= TEMPO_MIN_GECERLI_AT) rozetKosu++;
    const sonuc = hesaplaYarisGidisati(profiller, rs[0].race.distance, rs.map(() => null));
    rs.forEach((s, i) => {
      atSayisi++;
      const fs = sonuc.atSonuclari[i]?.finalSkor ?? 0;
      if (!fs) sifirSkor++;
      if (raceStyleEskiSemaMi(stilOf(s))) eskiSema++;
    });
  }
  return { kosuSayisi, atSayisi, eskiSema, sifirOran: atSayisi ? (100 * sifirSkor) / atSayisi : 0, rozetKosu };
}

const satirlar = await yukle();
const stilNull = satirlar.filter((s) => !s.raceStyle).length;
const eskiler = satirlar.filter((s) => raceStyleEskiSemaMi(s.raceStyle));

// ── A. DRY-RUN RAPORU ──────────────────────────────────────────────────────────
const gunDagilimi = new Map<string, number>();
for (const s of eskiler) { const d = s.race.raceDay.date.toISOString().slice(0, 10); gunDagilimi.set(d, (gunDagilimi.get(d) ?? 0) + 1); }
const eksikAlan = { dagilimYok: 0, erkenHizGucuAnahtariYok: 0 };
for (const s of eskiler) { const o = s.raceStyle as Record<string, unknown>; if (!o.dagilim) eksikAlan.dagilimYok++; if (!("erkenHizGucu" in o)) eksikAlan.erkenHizGucuAnahtariYok++; }
const eskiAdlar = [...new Set(eskiler.map((s) => s.name))];
const degerler = await hesaplaRaceStyleDegerleri(eskiAdlar);
const yenilenebilir = eskiler.filter((s) => degerler.has(normalizeName(s.name)));
const yenilenemez = eskiler.filter((s) => !degerler.has(normalizeName(s.name)));
// ham Accurace verisi var mı (n<3 olabilir) ayrımı
const yenilenemezAdlar = [...new Set(yenilenemez.map((s) => s.name))];
const hamVar = new Set<string>();
if (yenilenemezAdlar.length) {
  const kayit = await db.accuraceHorseSplit.findMany({ where: { horseName: { in: yenilenemezAdlar.flatMap((a) => [a, a.replace(/\s*\([A-ZİĞÜŞÖÇ]{2,4}\)\s*$/i, "")]) } }, select: { horseName: true }, distinct: ["horseName"] });
  const varNorm = new Set(kayit.map((k) => normalizeName(k.horseName)));
  for (const a of yenilenemezAdlar) if (varNorm.has(normalizeName(a))) hamVar.add(a);
}
const oncesi = olc(satirlar, (s) => s.raceStyle as RS);
const simSonrasi = olc(satirlar, (s) => (degerler.has(normalizeName(s.name)) && raceStyleEskiSemaMi(s.raceStyle) ? (degerler.get(normalizeName(s.name)) as unknown as RS) : (s.raceStyle as RS)));

console.log(`\n=== DRY-RUN RAPORU (kapsam: ${satirlar.length} koşan at, ${oncesi.kosuSayisi} koşu) ===`);
console.log(`raceStyle NULL (stil hiç yok, hedef DEĞİL): ${stilNull}`);
console.log(`ESKİ ŞEMALI (hedef adayı): ${eskiler.length} Runner satırı, ${eskiAdlar.length} benzersiz at`);
console.log(`  eksik alan: dagilim yok=${eksikAlan.dagilimYok} | erkenHizGucu anahtarı yok=${eksikAlan.erkenHizGucuAnahtariYok}`);
console.log(`  raceDay dağılımı: ${[...gunDagilimi.entries()].sort().map(([d, n]) => `${d}:${n}`).join(" ")}`);
console.log(`YENİDEN ÜRETİLEBİLİR (ham Accurace n>=3): ${yenilenebilir.length} satır (${new Set(yenilenebilir.map((s) => s.name)).size} at)`);
console.log(`YENİDEN ÜRETİLEMEZ: ${yenilenemez.length} satır (${yenilenemezAdlar.length} at) — bunlardan ham Accurace kaydı olan (n<3): ${hamVar.size} at, hiç kaydı olmayan: ${yenilenemezAdlar.length - hamVar.size} at`);
console.log(`\nÖLÇÜ (kapsam)                   ÖNCE     SİMÜLE SONRA`);
console.log(`eski şemalı Runner              ${String(oncesi.eskiSema).padEnd(8)} ${simSonrasi.eskiSema}`);
console.log(`yarisGidisatiSkoru=0 oranı      ${oncesi.sifirOran.toFixed(1).padStart(4)}%    ${simSonrasi.sifirOran.toFixed(1)}%`);
console.log(`tempo rozeti çıkan koşu         ${oncesi.rozetKosu}/${oncesi.kosuSayisi}     ${simSonrasi.rozetKosu}/${simSonrasi.kosuSayisi}`);

if (!UYGULA) {
  console.log("\n(Dry-run: hiçbir şey yazılmadı. Yazmak için --uygula)");
  process.exit(0);
}

// ── B. HEDEFLİ BACKFILL ────────────────────────────────────────────────────────
mkdirSync("C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad", { recursive: true });
const yedekYol = `C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad/racestyle-yedek-${Date.now()}.json`;
writeFileSync(yedekYol, JSON.stringify(yenilenebilir.map((s) => ({ id: s.id, name: s.name, eski: s.raceStyle })), null, 1));
console.log(`\nYedek (eski değerler): ${yedekYol}`);
let guncellenen = 0, basarisiz = 0;
for (const s of yenilenebilir) {
  try {
    const guncel = await db.runner.findUnique({ where: { id: s.id }, select: { raceStyle: true } });
    if (!raceStyleEskiSemaMi(guncel?.raceStyle)) continue; // arada başka biri güncellediyse dokunma
    await db.runner.update({ where: { id: s.id }, data: { raceStyle: degerler.get(normalizeName(s.name)) as never } });
    guncellenen++;
  } catch (e) {
    basarisiz++;
    console.log("HATA", s.id, s.name, String(e).slice(0, 120));
  }
}

// ── C. DOĞRULAMA ───────────────────────────────────────────────────────────────
const sonra = await yukle();
const olcSonra = olc(sonra, (s) => s.raceStyle as RS);
console.log(`\n=== DOĞRULAMA ===`);
console.log(`ÖLÇÜ                            ÖNCE     SONRA`);
console.log(`eski şemalı Runner              ${String(oncesi.eskiSema).padEnd(8)} ${olcSonra.eskiSema}`);
console.log(`yarisGidisatiSkoru=0 oranı      ${oncesi.sifirOran.toFixed(1).padStart(4)}%    ${olcSonra.sifirOran.toFixed(1)}%`);
console.log(`tempo rozeti çıkan koşu         ${oncesi.rozetKosu}/${oncesi.kosuSayisi}     ${olcSonra.rozetKosu}/${olcSonra.kosuSayisi}`);
console.log(`GÜNCELLENEN Runner: ${guncellenen} | BAŞARISIZ: ${basarisiz} | YENİDEN ÜRETİLEMEZ (dokunulmadı): ${yenilenemez.length}`);
console.log(`\nÖrnek 10 Runner farkı (eski → yeni):`);
const eskiMap = new Map(yenilenebilir.map((s) => [s.id, s.raceStyle as RS]));
const yeniMap = new Map(sonra.map((s) => [s.id, s.raceStyle as RS]));
for (const s of yenilenebilir.slice(0, 10)) {
  const e = eskiMap.get(s.id), y = yeniMap.get(s.id);
  console.log(` ${s.race.raceDay.hippodrome.name.trim()} K${s.race.raceNo} #${s.no} ${s.name}: ${e?.style}(n=${e?.veri}, dagilim=${e?.dagilim ? "var" : "YOK"}) → ${y?.style}(n=${y?.veri}, dagilim=${y?.dagilim ? JSON.stringify(y.dagilim) : "YOK"}, erkenHizGucu=${y?.erkenHizGucu})`);
}
process.exit(0);
