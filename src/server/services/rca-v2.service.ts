// RCA v2 — dedektörler + kuponu öldüren ayak analizi. SALT-OKUMA (yazma yok); kayıt defteri ve çözüm aksiyonları ayrı.
// Her dedektör: ölçer → ölçüt ihlalinde belirti→neden zinciri + kök neden + çözüm + doğrulama ölçütü üretir;
// ölçüt sağlanıyorsa SAGLIKLI (kapalı döngünün "çözüldü" kanıtı), ölçülemiyorsa OLCULEMIYOR döner.
import { db } from "@/lib/db";
import { buildKuponOnerisi } from "@/server/services/race.service";
import { getIzleme } from "@/server/services/izleme.service";
import { getVeriTamligiRaporu } from "@/server/services/veri-tamligi.service";
import {
  ayakNedeniBelirle, kuponNedenOzeti, sorunlariSirala, SINYAL_KAYNAGI,
  type RcaSorun, type OldurenAyak, type KuponNedenOzeti, type CozumKodu,
} from "@/lib/rca/rca-cekirdek";
import { modelSurumuAt } from "@/lib/izleme/model-surumleri";

const GUN = 86_400_000;
const trTarih = (d: Date) => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
const gunFarki = (a: Date, b: Date) => (b.getTime() - a.getTime()) / GUN;
const f1 = (n: number) => Math.round(n * 10) / 10;

/* ───────────── Veri tazelik dedektörleri ───────────── */

type TazelikTanim = {
  kod: string; baslik: string; kaynakAd: string; cron: string; esikGun: number; kritikGun: number; cozum: CozumKodu | null;
  etkilenen: string; sorgu: () => Promise<Date | null>;
};

const TAZELIK: TazelikTanim[] = [
  {
    kod: "veri.derece-bayat", baslik: "Derece İstatistikleri arşivi bayat", kaynakAd: "TJK derece arşivi", cron: "sync-derece-ist", esikGun: 3, kritikGun: 7, cozum: "DERECE_SYNC",
    etkilenen: "hizDerecesi ve zeminMesafeDeneyim sinyalleri bayat dereceyle hesaplanır",
    sorgu: async () => (await db.$queryRaw<{ t: Date | null }[]>`SELECT max("tarih") AS t FROM "TjkDereceKaydi"`)[0]?.t ?? null,
  },
  {
    kod: "veri.galop-bayat", baslik: "Galop verisi bayat", kaynakAd: "TJK galop (idman)", cron: "sync-galop", esikGun: 3, kritikGun: 7, cozum: null,
    etkilenen: "galopKalite, idmJokey ve sonIdmanSprint sinyalleri gözlemsiz kalır / bayat okunur",
    sorgu: async () => (await db.$queryRaw<{ t: Date | null }[]>`SELECT max("date") AS t FROM "Gallop" WHERE "date" <= now()`)[0]?.t ?? null,
  },
  {
    kod: "veri.accurace-bayat", baslik: "Accurace (tempo) arşivi bayat", kaynakAd: "Accurace.net", cron: "sync-accurace-daily", esikGun: 4, kritikGun: 8, cozum: null,
    etkilenen: "ACC_* ve PS_* sinyalleri (tempo/hız artığı) ile yarisGidisatiSkoru eski koşuları görür",
    sorgu: async () => (await db.$queryRaw<{ t: Date | null }[]>`SELECT max("date") AS t FROM "AccuraceRace"`)[0]?.t ?? null,
  },
];

async function tazelikDedektorleri(simdi: Date): Promise<RcaSorun[]> {
  const out: RcaSorun[] = [];
  for (const t of TAZELIK) {
    let son: Date | null = null;
    try { son = await t.sorgu(); } catch { son = null; }
    if (!son) {
      out.push({ kod: t.kod, baslik: t.baslik, kategori: "VERI", siddet: "YUKSEK", durum: "OLCULEMIYOR", etki: "Tazelik ölçülemedi (kayıt/erişim yok)", kanit: {}, zincir: [], kokNeden: "", cozum: "", otomatikCozum: t.cozum, dogrulama: "" });
      continue;
    }
    const gec = gunFarki(son, simdi);
    const sorun = gec > t.esikGun;
    out.push({
      kod: t.kod, baslik: t.baslik, kategori: "VERI",
      siddet: gec > t.kritikGun ? "KRITIK" : "YUKSEK", durum: sorun ? "SORUN" : "SAGLIKLI",
      etki: sorun ? `${t.etkilenen}.` : `${t.kaynakAd} güncel (${f1(gec)} gün gecikme).`,
      kanit: { enSonKayit: son.toISOString().slice(0, 10), gecikmeGun: f1(gec), esikGun: t.esikGun },
      zincir: sorun ? [
        { soru: "Belirti nedir?", cevap: `${t.kaynakAd} son kaydı ${son.toISOString().slice(0, 10)} — ${f1(gec)} gün gecikmeli (eşik ${t.esikGun} gün).` },
        { soru: "Neden güncellenmedi?", cevap: `${t.cron} senkronu son günlerde bu kaynağa yeni kayıt yazamadı (cron çalışmadı, yarıda kaldı veya TJK sayfası değişti).` },
        { soru: "Bu neden önemli?", cevap: t.etkilenen + "." },
      ] : [],
      kokNeden: sorun ? `${t.cron} senkronu yeni kayıt üretmiyor` : "",
      cozum: sorun ? (t.cozum ? "Aşağıdaki düğmeyle senkronu şimdi çalıştır; sonra kaynağın cron günlüğünü incele." : `${t.cron} cron'unun Vercel günlüğünü ve kaynak sitenin erişilebilirliğini kontrol et.`) : "",
      otomatikCozum: sorun ? t.cozum : null,
      dogrulama: `Kaynağın en son kaydı ≤ ${t.esikGun} gün gecikmeli olmalı.`,
    });
  }
  return out;
}

/* ───────────── AGF tazelik (yarış günü pencere kuralı) ───────────── */

async function agfDedektoru(simdi: Date): Promise<RcaSorun> {
  const bugun = new Date(trTarih(simdi) + "T00:00:00.000Z");
  const [kosu, son] = await Promise.all([
    db.race.count({ where: { raceDay: { date: bugun, hippodrome: { name: { not: "Karma" } } } } }),
    db.$queryRaw<{ t: Date | null }[]>`SELECT max("capturedAt") AS t FROM "AgfSnapshot" WHERE "capturedAt" >= ${new Date(simdi.getTime() - 2 * GUN)}`,
  ]);
  const t = son[0]?.t ?? null;
  const trSaat = new Date(simdi.getTime() + 3 * 3600_000).getUTCHours();
  const temel = { kod: "sistem.agf-bayat", baslik: "AGF senkronu durmuş", kategori: "SISTEM" as const };
  if (kosu === 0 || trSaat < 9 || trSaat > 20) {
    return { ...temel, siddet: "YUKSEK", durum: "OLCULEMIYOR", etki: kosu === 0 ? "Bugün yarış yok — AGF beklenmez." : "Yarış günü penceresi (09–20 TR) dışında — AGF kontrolü yapılmaz.", kanit: { bugunKosu: kosu, trSaat }, zincir: [], kokNeden: "", cozum: "", otomatikCozum: "AGF_SYNC", dogrulama: "" };
  }
  const saat = t ? (simdi.getTime() - t.getTime()) / 3600_000 : Infinity;
  const sorun = saat > 3;
  return {
    ...temel, siddet: saat > 6 ? "KRITIK" : "YUKSEK", durum: sorun ? "SORUN" : "SAGLIKLI",
    etki: sorun ? "Piyasa verisi eski: model karşılaştırması ve AGF'ye bağlı kupon kararları bayat veriye dayanır." : "AGF güncel.",
    kanit: { sonSnapshot: t?.toISOString() ?? "yok", gecikmeSaat: Number.isFinite(saat) ? f1(saat) : "yok", bugunKosu: kosu },
    zincir: sorun ? [
      { soru: "Belirti nedir?", cevap: `Yarış günü ama son AGF görüntüsü ${Number.isFinite(saat) ? f1(saat) + " saat" : "hiç"} önce (eşik 3 saat).` },
      { soru: "Neden?", cevap: "agf-sync cron'u (Vercel + GitHub zamanlaması) çalışmıyor ya da hata veriyor. 2026-11-13'te uç nokta 15 sn'de bitecek şekilde düzeltildi — tekrar ediyorsa GitHub Actions 'AGF Sync' iş akışı kırmızıdır." },
    ] : [],
    kokNeden: sorun ? "agf-sync zamanlaması çalışmıyor" : "", cozum: sorun ? "Senkronu şimdi çalıştır; GitHub Actions 'AGF Sync' günlüğünü kontrol et." : "",
    otomatikCozum: sorun ? "AGF_SYNC" : null, dogrulama: "Yarış günü pencerede son AGF görüntüsü ≤ 3 saat eski olmalı.",
  };
}

/* ───────────── Sinyal doluluk düşüşü (kök nedeni veri kaynağına bağlar) ───────────── */

/** Doğal olarak seyrek sinyaller (kaynak sorunu DEĞİL) — düşüş kuralından muaf. */
const DOGAL_SEYREK = new Set(["h2hNetSkor", "lastWon", "takiDegisikligi"]);

async function sinyalDedektorleri(): Promise<RcaSorun[]> {
  const iz = await getIzleme();
  const out: RcaSorun[] = [];
  for (const s of iz.sinyaller) {
    if (DOGAL_SEYREK.has(s.kod) || s.n7 < 40 || s.n30 < 120) continue;
    const o7 = s.obs7 / s.n7, o30 = s.obs30 / s.n30;
    const dusus = o30 - o7;
    const sorun = o7 < 0.7 && dusus > 0.1; // son 7 gün %70 altı VE 30 güne göre ≥10 puan düşüş
    const k = SINYAL_KAYNAGI[s.kod];
    out.push({
      kod: `sinyal.doluluk.${s.kod}`, baslik: `Sinyal doluluğu düştü: ${s.kod}`, kategori: "VERI", siddet: o7 < 0.4 ? "YUKSEK" : "ORTA", durum: sorun ? "SORUN" : "SAGLIKLI",
      etki: sorun ? `${s.kod} son 7 günde atların yalnız %${Math.round(o7 * 100)}'inde gözlemli (30 gün: %${Math.round(o30 * 100)}); model bu sinyalde "bilmiyor" kararı veriyor.` : `${s.kod} doluluğu normal (%${Math.round(o7 * 100)}).`,
      kanit: { doluluk7g: `%${Math.round(o7 * 100)}`, doluluk30g: `%${Math.round(o30 * 100)}`, n7: s.n7 },
      zincir: sorun ? [
        { soru: "Belirti nedir?", cevap: `Gözlemli oran %${Math.round(o30 * 100)} → %${Math.round(o7 * 100)} (−${Math.round(dusus * 100)} puan).` },
        { soru: "Sinyal nereden besleniyor?", cevap: k?.kaynak ?? "Kaynak tanımsız" },
        { soru: "Kök neden?", cevap: `${k?.kaynak ?? "Kaynak"} son günlerde bu sinyal için yeterli veri üretmiyor.` },
      ] : [],
      kokNeden: sorun ? `${k?.kaynak ?? "Veri kaynağı"} eksik/bayat` : "", cozum: sorun ? (k?.cozum ?? "Kaynağı incele") : "", otomatikCozum: null,
      dogrulama: "Son 7 gün gözlemli oranı ≥ %70 veya 30 güne göre düşüş < 10 puan olmalı.",
    });
  }
  return out;
}

/* ───────────── Veri tamlığı (mevcut denetim → sorun biçimine) ───────────── */

async function tamlikDedektorleri(): Promise<RcaSorun[]> {
  const satirlar = await getVeriTamligiRaporu();
  return satirlar.filter((s) => s.birim !== "gun" && s.toplamSon7 >= 30).map((s) => {
    const sorun = s.yuzdeSon7 < 85;
    const atProfil = /profil|stats|history|geçmiş/i.test(s.alan);
    return {
      kod: `tamlik.${s.alan.toLowerCase().replace(/[^a-z0-9ğüşıöç]+/gi, "-").replace(/^-|-$/g, "")}`,
      baslik: `Veri tamlığı düşük: ${s.alan}`, kategori: "VERI" as const, siddet: s.yuzdeSon7 < 60 ? ("YUKSEK" as const) : ("ORTA" as const), durum: sorun ? ("SORUN" as const) : ("SAGLIKLI" as const),
      etki: sorun ? `${s.alan}: son 7 günde %${Math.round(s.yuzdeSon7)} dolu (${s.doluSon7}/${s.toplamSon7}).` : `${s.alan} yeterli (%${Math.round(s.yuzdeSon7)}).`,
      kanit: { son7: `%${Math.round(s.yuzdeSon7)}`, tumDonem: `%${Math.round(s.yuzdeKapsam)}`, dolu: s.doluSon7, toplam: s.toplamSon7 },
      zincir: sorun ? [
        { soru: "Belirti nedir?", cevap: `${s.aciklama} — son 7 gün doluluğu %${Math.round(s.yuzdeSon7)} (eşik %85).` },
        { soru: "Neden?", cevap: "Bu alanı dolduran senkron yeni koşuları yakalayamıyor veya arka plan onarımı geride." },
      ] : [],
      kokNeden: sorun ? "Dolduran senkron/onarım işi geride" : "", cozum: sorun ? (atProfil ? "At profillerini şimdi tamamla düğmesini kullan; veri-tamligi-onarim cron'unu izle." : "veri-tamligi-onarim cron'unu ve ilgili senkron günlüğünü kontrol et.") : "",
      otomatikCozum: sorun && atProfil ? ("AT_PROFIL_SYNC" as const) : null, dogrulama: "Son 7 gün doluluğu ≥ %85 olmalı.",
    };
  });
}

/* ───────────── Model: banko sağlığı ───────────── */

async function bankoDedektoru(): Promise<RcaSorun> {
  const iz = await getIzleme();
  const b = iz.banko;
  const temel = { kod: "model.banko-zayif", baslik: "Banko isabeti hedefin altında", kategori: "MODEL" as const, siddet: "ORTA" as const };
  if (b.n < 15) return { ...temel, durum: "OLCULEMIYOR", etki: `Banko örneği yetersiz (n=${b.n}, ≥15 gerekir).`, kanit: { n: b.n }, zincir: [], kokNeden: "", cozum: "", otomatikCozum: null, dogrulama: "" };
  const sorun = b.aralik.hi < 0.45; // Wilson üst sınırı bile %45'in altında: istatistiksel olarak zayıf
  return {
    ...temel, durum: sorun ? "SORUN" : "SAGLIKLI",
    etki: sorun ? `Banko isabeti %${Math.round(b.aralik.oran * 100)} (${b.tuttu}/${b.n}); %95 aralığın üstü bile %${Math.round(b.aralik.hi * 100)}.` : `Banko isabeti makul: %${Math.round(b.aralik.oran * 100)} (${b.tuttu}/${b.n}).`,
    kanit: { n: b.n, tuttu: b.tuttu, oran: `%${Math.round(b.aralik.oran * 100)}`, wilsonUst: `%${Math.round(b.aralik.hi * 100)}` },
    zincir: sorun ? [
      { soru: "Belirti nedir?", cevap: `Banko denen atlar yalnız %${Math.round(b.aralik.oran * 100)} kazandı (n=${b.n}).` },
      { soru: "Banko nasıl seçiliyor?", cevap: "Kalibre olasılık ≥ %40 eşiği (Platt kalibrasyonu, tip grubu başına)." },
      { soru: "Kök neden?", cevap: "Eşik belirli tip gruplarında (ör. KV/Satış) olduğundan iyimser; grup bazlı kalibrasyon bu kümede zayıf." },
    ] : [],
    kokNeden: sorun ? "Banko eşiği zayıf tip gruplarında iyimser" : "", cozum: sorun ? "Zayıf tip gruplarında banko eşiğini yükselt veya o gruplarda banko verme; /admin izleme sayfasındaki tip kırılımına bak." : "",
    otomatikCozum: null, dogrulama: "n ≥ 15 iken Wilson üst sınırı ≥ %45 olmalı.",
  };
}

/* ───────────── Kuponu öldüren ayak analizi ───────────── */

export type KuponRcaSonuc = { gunSayisi: number; kuponSayisi: number; yatanKupon: number; ayaklar: OldurenAyak[]; ozet: KuponNedenOzeti };

export async function kuponOldurenAyaklar(gunSayisi = 30, simdi: Date = new Date()): Promise<KuponRcaSonuc> {
  const bas = new Date(simdi.getTime() - gunSayisi * GUN);
  const hepsi = await db.homeKupon.findMany({ where: { date: { gte: bas } }, orderBy: [{ date: "desc" }, { updatedAt: "desc" }] });
  const goruldu = new Set<string>();
  const tekil = hepsi.filter((k) => { const key = `${k.hippodromeName}|${k.date.toISOString()}|${k.slot}`; if (goruldu.has(key)) return false; goruldu.add(key); return !k.hippodromeName.includes("7'li") && !k.hippodromeName.startsWith("Karma"); }); // Karma: ayak numaraları farklı hipodromlara karışır, koşu eşleşmesi güvenilmez

  type Ham = { kuponId: string; hip: string; tarih: string; raceNo: number; kazananNo: number; yazilan: number; tekAyak: boolean; baseName: string; date: Date };
  const ham: Ham[] = [];
  let yatan = 0;
  for (let i = 0; i < tekil.length; i += 8) {
    const grup = tekil.slice(i, i + 8);
    const sonuc = await Promise.all(grup.map((k) => buildKuponOnerisi(k).catch(() => null)));
    sonuc.forEach((o, gi) => {
      if (!o) return;
      const k = grup[gi];
      const v = o.variants.find((x) => x.key === "normal" && x.filled) ?? o.variants.find((x) => x.filled);
      if (!v || v.status !== "miss") return;
      yatan++;
      const kacan = v.legs.filter((l) => l.resulted && !l.nos.some((no) => l.winnerNos.includes(no) || no in l.ekuriWinnerByNo));
      for (const l of kacan) {
        const w = l.winnerNos[0] ?? l.winnerNo;
        if (w == null) continue;
        ham.push({ kuponId: k.id, hip: k.hippodromeName, tarih: trTarih(k.date), raceNo: l.raceNo, kazananNo: w, yazilan: l.nos.length, tekAyak: kacan.length === 1, baseName: k.hippodromeName.split(" — ")[0], date: k.date });
      }
    });
  }
  if (!ham.length) return { gunSayisi, kuponSayisi: tekil.length, yatanKupon: yatan, ayaklar: [], ozet: kuponNedenOzeti([]) };

  // yarış + pick + sonuç + piyasa sırası, tek toplu okuma
  const gunler = [...new Set(ham.map((h) => h.tarih))];
  const races = await db.race.findMany({
    where: { raceDay: { date: { in: gunler.map((g) => new Date(g + "T00:00:00.000Z")) } } },
    select: {
      id: true, raceNo: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } }, result: { select: { ganyan: true } },
      prediction: { select: { updatedAt: true, picks: { select: { rank: true, featureSnapshot: true, runner: { select: { id: true, no: true } } } } } },
      runners: { where: { scratched: false }, select: { id: true, no: true } },
    },
  });
  const raceBy = new Map(races.map((r) => [`${r.raceDay.hippodrome.name}|${trTarih(r.raceDay.date)}|${r.raceNo}`, r]));
  const raceIds = races.map((r) => r.id);
  const agf = new Map<string, number>();
  if (raceIds.length) {
    const rows = await db.$queryRaw<{ runnerId: string; agf: number }[]>`
      SELECT DISTINCT ON (s."runnerId") s."runnerId" AS "runnerId", s.agf AS agf
      FROM "AgfSnapshot" s JOIN "Runner" r ON r.id = s."runnerId" JOIN "Race" ra ON ra.id = r."raceId" JOIN "RaceDay" rd ON rd.id = ra."raceDayId"
      WHERE ra.id = ANY(${raceIds}::text[]) AND ra.time ~ '^[0-9]{1,2}[:.][0-9]{2}$'
        AND s."capturedAt" <= (rd.date + replace(ra.time, '.', ':')::time - interval '3 hours')
      ORDER BY s."runnerId", s."capturedAt" DESC`;
    for (const r of rows) if (r.agf > 0) agf.set(r.runnerId, r.agf);
  }

  const ayaklar: OldurenAyak[] = ham.map((h) => {
    const r = raceBy.get(`${h.baseName}|${h.tarih}|${h.raceNo}`);
    const pick = r?.prediction?.picks.find((p) => p.runner?.no === h.kazananNo) ?? null;
    const kazananRunner = r?.runners.find((x) => x.no === h.kazananNo) ?? null;
    let piyasaSira: number | null = null;
    if (r && kazananRunner && agf.has(kazananRunner.id)) {
      const degerler = r.runners.map((x) => agf.get(x.id)).filter((x): x is number => x != null);
      if (degerler.length === r.runners.length) piyasaSira = 1 + degerler.filter((d) => d > agf.get(kazananRunner.id)!).length;
    }
    const snap = pick?.featureSnapshot as { tumSinyaller?: { observed?: boolean }[] } | null | undefined;
    const eksik = Array.isArray(snap?.tumSinyaller) ? snap!.tumSinyaller!.filter((s) => s.observed === false).length : 0;
    const ganyan = r?.result?.ganyan ?? null;
    const modelSira = pick?.rank ?? null;
    const { neden, aciklama } = ayakNedeniBelirle({ modelSira, piyasaSira, ayagaYazilan: h.yazilan, ganyan, eksikSinyal: eksik });
    const donem = r?.prediction ? (modelSurumuAt(r.prediction.updatedAt)?.ad ?? "eski/bilinmiyor") : "tahmin yok";
    return { kuponId: h.kuponId, hipodrom: h.hip, tarih: h.tarih, raceNo: h.raceNo, kazananNo: h.kazananNo, modelSira, piyasaSira, ayagaYazilan: h.yazilan, ganyan, eksikSinyal: eksik, neden, aciklama, tekAyak: h.tekAyak, donem };
  });
  return { gunSayisi, kuponSayisi: tekil.length, yatanKupon: yatan, ayaklar, ozet: kuponNedenOzeti(ayaklar) };
}

function kuponSorunu(k: KuponRcaSonuc): RcaSorun {
  const o = k.ozet;
  const temel = { kod: "kupon.dagilim", baslik: "Kuponlar müdahale edilebilir nedenle yatıyor", kategori: "KUPON" as const, siddet: "YUKSEK" as const };
  if (o.toplamAyak < 8) return { ...temel, durum: "OLCULEMIYOR", etki: `Yatan kupon ayağı az (n=${o.toplamAyak}, ≥8 gerekir).`, kanit: { ayak: o.toplamAyak }, zincir: [], kokNeden: "", cozum: "", otomatikCozum: null, dogrulama: "" };
  const b = o.nedenler.find((n) => n.neden === o.baskin);
  const sorun = o.mudahaleOrani >= 0.4;
  return {
    ...temel, durum: sorun ? "SORUN" : "SAGLIKLI",
    etki: sorun ? `Kaçan ${o.toplamAyak} ayağın %${Math.round(o.mudahaleOrani * 100)}'i müdahale edilebilir nedenlerle (kupon dağıtımı, veri, model); ${o.tekAyakKupon} kupon yalnız TEK ayakla yattı.` : `Kaçan ayakların çoğu öngörülemez (müdahale oranı %${Math.round(o.mudahaleOrani * 100)}).`,
    kanit: { yatanKupon: k.yatanKupon, kacanAyak: o.toplamAyak, tekAyakKupon: o.tekAyakKupon, mudahaleOrani: `%${Math.round(o.mudahaleOrani * 100)}` },
    zincir: sorun && b ? [
      { soru: "Belirti nedir?", cevap: `Son ${k.gunSayisi} günde ${k.yatanKupon} kupon yattı; ${o.tekAyakKupon}'i tek ayaktan.` },
      { soru: "En sık neden?", cevap: `${b.ad}: ${b.sayi} ayak (%${Math.round(b.oran * 100)}).` },
      { soru: "Ne değişirse kupon tutardı?", cevap: `${o.tekAyakKupon} tek-ayak kuponunda o ayak düzelseydi kupon tutacaktı.` },
    ] : [],
    kokNeden: sorun && b ? b.ad : "", cozum: sorun ? "Aşağıdaki ayak tablosunda nedeni 'Kupon dağıtımı' olan koşulları incele: model kazananı ilk 4'e koymuş ama kupona girmemiş." : "",
    otomatikCozum: null, dogrulama: "Son 30 günde müdahale edilebilir neden oranı < %40 olmalı.",
  };
}

/* ───────────── Ana rapor ───────────── */

export type RcaV2Rapor = { uretildi: string; sorunlar: RcaSorun[]; kupon: KuponRcaSonuc | null; hatalar: string[] };

async function guvenli<T>(ad: string, f: () => Promise<T>, hatalar: string[]): Promise<T | null> {
  try { return await f(); } catch (e) { hatalar.push(`${ad}: ${e instanceof Error ? e.message : String(e)}`); return null; }
}

export async function hesaplaRcaV2(simdi: Date = new Date()): Promise<RcaV2Rapor> {
  const hatalar: string[] = [];
  const [taze, agf, sinyal, tamlik, banko, kupon] = await Promise.all([
    guvenli("tazelik", () => tazelikDedektorleri(simdi), hatalar),
    guvenli("agf", () => agfDedektoru(simdi), hatalar),
    guvenli("sinyal", sinyalDedektorleri, hatalar),
    guvenli("tamlik", tamlikDedektorleri, hatalar),
    guvenli("banko", bankoDedektoru, hatalar),
    guvenli("kupon", () => kuponOldurenAyaklar(30, simdi), hatalar),
  ]);
  const sorunlar: RcaSorun[] = [...(taze ?? []), ...(agf ? [agf] : []), ...(sinyal ?? []), ...(tamlik ?? []), ...(banko ? [banko] : []), ...(kupon ? [kuponSorunu(kupon)] : [])];
  return { uretildi: simdi.toISOString(), sorunlar: sorunlariSirala(sorunlar), kupon, hatalar };
}

let onbellek: { t: number; v: RcaV2Rapor } | null = null;
export async function getRcaV2(zorla = false): Promise<RcaV2Rapor> {
  if (!zorla && onbellek && Date.now() - onbellek.t < 5 * 60_000) return onbellek.v;
  const v = await hesaplaRcaV2();
  onbellek = { t: Date.now(), v };
  return v;
}
export function rcaOnbellekSil(): void { onbellek = null; }
