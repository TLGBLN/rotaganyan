// ROTAGANYAN ANALİZ MOTORU v1.0 — GEN/PEDİGRİ ailesi, İLİŞKİ #4: PEDİGRİ × PİST/MESAFE ×
// GERÇEK PERFORMANS.
//
// KULLANICI KARARI (2026-10-18): ExternalPedigreeStat Temmuz-Ağustos backtest'inde
// KULLANILMAYACAK — bağımsız doğrulandı: 22.935 kayıt, TÜMÜ year=2026, capturedAt yalnız
// 2026-10-11/12/13. Ekim'de derlenmiş bir sezon-toplamı Temmuz'da biliniyormuş gibi
// kullanılamaz (veri sızıntısı). Bu dosya o tabloya HİÇ dokunmaz.
//
// BABA HATTI: `getV5461SireOzetleriForRace` (src/server/actions/v5461-sire.actions.ts)
// kullanılır — TAM zinciriyle doğrulandı (2026-10-18): Runner/Race/Result'tan HER çağrıda
// SIFIRDAN, `race.raceDay.date` cutoff'uyla hesaplanır (SireStatOwn gibi kümülatif/önceden-
// hesaplanmış bir tabloya DOKUNMAZ) — origin/master'da (commit 400ec22), hem canlı repo hem
// bu worktree'de git diff HEAD boş (değişmemiş).
//
// ANNE HATTI: kullanıcı sorusu (2026-10-18) üzerine denetlendi — `getDamStatOzetleriForRace`/
// `getDamSireOwnStatForRace` (dam-stat.actions.ts) CUTOFF'SUZ, doğrudan DamStatOwn/
// DamSireStatOwn'u okuyor (sire'daki SireStatOwn ile AYNI, düzeltilMEMİŞ sızıntı deseni).
// AMA veri YOK değil, yalnız güvenli fonksiyon eksikti — `Runner.dam`/`Runner.damSire` alanları
// mevcut (schema'da doğrulandı). Bu dosyada getV5461SireOzetleriForRace'in AYNI deseni
// (Runner/Race/Result'tan cutoff'lu sıfırdan hesaplama) dam/damSire'a da uygulanır — canlı
// production dosyalarına (dam-stat.actions.ts) DOKUNULMADI, yalnız bu V1.0 dosyasında yeni,
// bağımsız bir hesaplama eklendi.
//
// DI/CD, MSTN, linebreeding — KULLANICI KURALI: veri yok, UYDURULMAZ, "DATA_UNAVAILABLE"
// olarak işaretlenir (bkz. dosya sonu).

import { db } from "@/lib/db";
import { finishPos } from "@/lib/race-result";
import { breedToIrk, surfaceToPist, mesafeBucket, normalizeSireName } from "@/lib/sire-stat-match";
import { getV5461SireOzetleriForRace } from "@/server/actions/v5461-sire.actions";
import { classifyCoverage, type CoverageState } from "./common";

export type GenPedigriSignalCode = "GEN_SIRE_01" | "GEN_DAM_01" | "GEN_DAMSIRE_01" | "GEN_SIRE_PMZ_01";

export type GenPedigriEntry = {
  code: GenPedigriSignalCode;
  family: "GEN_PEDIGRI";
  rawValue: number | null;
  observed: boolean;
  coverageState: CoverageState | null;
  asOfSafe: true;
  missingReason: string | null;
};

function entry(code: GenPedigriSignalCode, rawValue: number | null, observed: boolean, coverageState: CoverageState | null, missingReason: string | null): GenPedigriEntry {
  return { code, family: "GEN_PEDIGRI", rawValue, observed, coverageState, asOfSafe: true, missingReason };
}

type LineOzet = { ornekKendiVeri: number | null; kYuzde: number | null };

/**
 * getV5461SireOzetleriForRace İLE AYNI, doğrulanmış desen — yalnız `sire` yerine `dam` VEYA
 * `damSire` alanına uygulanır. Runner/Race/Result'tan HER çağrıda sıfırdan hesaplanır,
 * HİÇBİR önceden-biriktirilmiş tabloya (DamStatOwn/DamSireStatOwn) dokunmaz. `cutoffTarih`'ten
 * SONRAKİ hiçbir yarış sayıma KATILMAZ.
 */
/** GEN SELF-CONTAMINATION DUZELTMESI (2026-10-22) — AYNI mantik getV5461SireOzetleriForRace
 *  ile: hedef atin KENDI gecmis startlari, kendi dam/damSire istatistigine KARISMAZ.
 *  `excludeTjkAtIds`, `names` ile AYNI sirada, HER hedef icin kendi tjkAtId'si. */
// 2026-10-24 — PERF: bu temel satir kumesi (scratched=false, sonuclanmis, dam/damSire dolu)
// HICBIR parametreye (breed/surface/distance/cutoff) gore DB-seviyesinde filtrelenmiyordu —
// her cagri TAM AYNI binlerce satiri yeniden cekiyordu (toplu Faz1 toplamasinda yaris basina
// 2 kez = 1140 yaris x 2 = 2280 tam tablo taramasi, 0.01 yaris/sn'ye dustu). Proje genelindeki
// "tumArsiviGetir" deseniyle AYNI: TEK SEFERDE cek, surec boyunca PAYLAS. Sonuc/filtre mantigi
// DEGISMEDI, yalniz DB gidis-donusu tekillestirildi.
let cachedRowsPromise: ReturnType<typeof fetchAllDamRows> | null = null;
function fetchAllDamRows() {
  return db.runner.findMany({
    where: { scratched: false, race: { result: { isNot: null } }, OR: [{ dam: { not: null } }, { damSire: { not: null } }] },
    select: {
      dam: true,
      damSire: true,
      no: true,
      tjkAtId: true,
      race: {
        select: {
          breed: true, surface: true, distance: true,
          raceDay: { select: { date: true } },
          result: { select: { actualOrder: true, winnerNos: true } },
        },
      },
    },
  });
}

async function getOwnLineOzetleriForRace(
  names: (string | null)[],
  field: "dam" | "damSire",
  breed: string,
  surface: string,
  distance: number,
  cutoffTarih: Date,
  excludeTjkAtIds: (number | null)[] = []
): Promise<LineOzet[]> {
  const irk = breedToIrk(breed);
  const pist = surfaceToPist(surface);
  const mesafe = mesafeBucket(distance);
  const hedefIsimler = new Set(names.map((s) => (s ? normalizeSireName(s) : "")).filter((s) => s.length > 0));
  if (hedefIsimler.size === 0) return names.map(() => ({ ornekKendiVeri: null, kYuzde: null }));

  // field dinamik olduğu için (dam|damSire) Prisma select'te computed-key KULLANILMAZ
  // (tip daralması bozuluyor) — her iki alan da her zaman seçilir, ilgili olan JS'te seçilir.
  if (!cachedRowsPromise) cachedRowsPromise = fetchAllDamRows();
  const rows = await cachedRowsPromise;

  const sayim = new Map<string, { start: number; wins: number }>();
  const kendiKatki = new Map<string, Map<number, { start: number; wins: number }>>();
  const cutoffMs = cutoffTarih.getTime();
  for (const r of rows) {
    const rawName = field === "dam" ? r.dam : r.damSire;
    if (!rawName || !r.race.result) continue;
    if (r.race.raceDay.date.getTime() >= cutoffMs) continue;
    if (breedToIrk(r.race.breed) !== irk) continue;
    if (surfaceToPist(r.race.surface) !== pist) continue;
    if (mesafeBucket(r.race.distance) !== mesafe) continue;
    const name = normalizeSireName(rawName);
    if (!hedefIsimler.has(name)) continue;
    const pos = finishPos(r.race.result.actualOrder, r.no, r.race.result.winnerNos);
    const win = pos === 1 ? 1 : 0;
    const cur = sayim.get(name) ?? { start: 0, wins: 0 };
    cur.start++;
    cur.wins += win;
    sayim.set(name, cur);

    if (r.tjkAtId != null) {
      const bySire = kendiKatki.get(name) ?? new Map<number, { start: number; wins: number }>();
      const own = bySire.get(r.tjkAtId) ?? { start: 0, wins: 0 };
      own.start++;
      own.wins += win;
      bySire.set(r.tjkAtId, own);
      kendiKatki.set(name, bySire);
    }
  }

  return names.map((name, i) => {
    if (!name) return { ornekKendiVeri: null, kYuzde: null };
    const norm = normalizeSireName(name);
    const cur = sayim.get(norm);
    if (!cur || cur.start === 0) return { ornekKendiVeri: null, kYuzde: null };
    let start = cur.start, wins = cur.wins;
    const excludeId = excludeTjkAtIds[i];
    if (excludeId != null) {
      const own = kendiKatki.get(norm)?.get(excludeId);
      if (own) { start -= own.start; wins -= own.wins; }
    }
    if (start <= 0) return { ornekKendiVeri: null, kYuzde: null };
    return { ornekKendiVeri: start, kYuzde: (wins / start) * 100 };
  });
}

export type GenPedigriRunnerInput = { no: number; sire: string | null; dam: string | null; damSire: string | null; tjkAtId: number | null };

export type GenPedigriRaceResult = {
  no: number;
  signals: GenPedigriEntry[]; // [GEN_SIRE_01, GEN_DAM_01, GEN_DAMSIRE_01, GEN_SIRE_PMZ_01]
};

/**
 * GEN_SIRE_01/GEN_DAM_01/GEN_DAMSIRE_01 — ilgili atanın bugünkü ırk/pist/mesafe bağlamındaki
 * (yalnız BİZİM Runner/Race/Result verimizden, hedef tarihten ÖNCEKİ yarışlardan) kazanma
 * yüzdesi.
 *
 * GEN_SIRE_PMZ_01 — İLİŞKİ #4'ün kendisi: GEN_SIRE_01 × PMZ_01 (yalnız baba hattı — dam/
 * damSire etkileşimleri bu ilk sürümde YOK, açık iş). Standardizasyon (z-skor) EĞİTİM
 * aşamasında ortak μ/σ ile yapılır — burada yalnız HAM çarpım döner (SINIF_01/KILO_03 ile
 * AYNI disiplin, §5.6).
 *
 * ÇİFT SAYIM DENETİMİ (2026-10-18 kullanıcı talebi üzerine AÇIKÇA belgelendi): GEN_SIRE_01 ve
 * PMZ_01, İKİ FARKLI POPÜLASYONDAN gelir — GEN_SIRE_01 babanın DİĞER yavrularının (bu at
 * HARİÇ) o ırk/pist/mesafe kovasındaki kazanma oranı; PMZ_01 İSE BİZZAT BU ATIN KENDİ
 * koşmuş-bitirmiş yarışlarından (HIZ_01 üzerinden) hesaplanır — yani İLİŞKİ, "genetik
 * beklenti (başkalarının verisi) × atın KENDİ gerçekleşmiş performansı" sorusunu sorar, AYNI
 * bilginin iki kez sayılması DEĞİL. Bununla birlikte: bu YALNIZ KAVRAMSAL bir ayrım
 * denetimidir — GEN_SIRE_01 ile PMZ_01'in GERÇEKTEN ne kadar bağımsız/çakışık olduğu
 * (korelasyon/VIF) bu turda ÖLÇÜLMEDİ (V5.46.1'in agfSirasi/agfPayi için yaptığı türden bir
 * VIF denetimi HENÜZ yapılmadı) — eğitim aşamasında AYRICA doğrulanmalı, burada "bağımsız
 * kanıtlanmıştır" İDDİA EDİLMİYOR.
 */
export async function computeGenPedigriForRace(
  runners: GenPedigriRunnerInput[],
  breed: string,
  surface: string,
  distance: number,
  cutoff: Date,
  pmzHam: Map<number, number | null> // runner no -> PMZ_01 ham değeri (çağıran taraftan, YENİDEN HESAPLANMAZ)
): Promise<GenPedigriRaceResult[]> {
  const excludeIds = runners.map((r) => r.tjkAtId);
  const [sireOzet, damOzet, damSireOzet] = await Promise.all([
    getV5461SireOzetleriForRace(runners.map((r) => r.sire), breed, surface, distance, cutoff, excludeIds),
    getOwnLineOzetleriForRace(runners.map((r) => r.dam), "dam", breed, surface, distance, cutoff, excludeIds),
    getOwnLineOzetleriForRace(runners.map((r) => r.damSire), "damSire", breed, surface, distance, cutoff, excludeIds),
  ]);

  return runners.map((r, i) => {
    const so = sireOzet[i], dmo = damOzet[i], dso = damSireOzet[i];

    const mk = (code: GenPedigriSignalCode, name: string | null, o: LineOzet, label: string): GenPedigriEntry => {
      const has = name != null && name.trim().length > 0;
      const observed = o.kYuzde != null && o.ornekKendiVeri != null;
      return entry(
        code, observed ? o.kYuzde : null, observed,
        classifyCoverage(has, o.ornekKendiVeri ?? 0, observed ? 1 : 0, 1),
        !has ? `${label} adı bilinmiyor` : !observed ? `bu ${label}+ırk+pist+mesafe kovasında hedef tarihten önce hiç start yok` : null
      );
    };

    const gen01 = mk("GEN_SIRE_01", r.sire, so, "baba");
    const genDam = mk("GEN_DAM_01", r.dam, dmo, "anne");
    const genDamSire = mk("GEN_DAMSIRE_01", r.damSire, dso, "anne babası");

    const pmz = pmzHam.get(r.no) ?? null;
    const interactionObserved = gen01.observed && pmz != null;
    const genPmz = entry(
      "GEN_SIRE_PMZ_01",
      interactionObserved ? so.kYuzde! * pmz! : null,
      interactionObserved,
      gen01.coverageState,
      !gen01.observed ? gen01.missingReason : pmz == null ? "PMZ_01 bu at için gözlemsiz" : null
    );

    return { no: r.no, signals: [gen01, genDam, genDamSire, genPmz] };
  });
}

/**
 * Yalnız dürüstlük/raporlama amaçlı — kullanıcı talimatı: "DI/CD, MSTN veya linebreeding
 * verisi bulunmuyorsa uydurma; eksik olarak işaretle." Bu fonksiyon gerçek bir sinyal
 * ÜRETMEZ, yalnız veri-kapsam raporunda GEN ailesinin eksik kalan parçalarını AÇIKÇA
 * listelemek için var.
 */
export const GEN_PEDIGRI_DATA_UNAVAILABLE = [
  { component: "DI/CD (Dosage Index/Center of Distribution)", reason: "Bu projede daha önce denenip İPTAL edilmiş (project_dosage_dp_di_cd). Kullanıcı talimatıyla YENİDEN ETKİNLEŞTİRİLMEDİ." },
  { component: "MSTN genotipi", reason: "Bu veritabanında belgelenmiş genetik test verisi YOK — uydurulmadı." },
  { component: "Linebreeding/akrabalık katsayısı", reason: "HorsePedigree.treeJson 3 kuşaklık ağacı taşıyor ama akrabalık-katsayısı HESAPLANMADI (bu turun kapsamı dışında, ayrı iş)." },
] as const;
