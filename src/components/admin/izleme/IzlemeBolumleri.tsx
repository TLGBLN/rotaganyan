// Dashboard bölümleri (sunucu bileşenleri) — veri: izleme.service.ts / kupon-tutma.service.ts (gerçek canlı veri).
import safW from "@/lib/methodology/weights/v546-1-saf-weights.json";
import type { IzlemeVerisi } from "@/server/services/izleme.service";
import type { KuponTutma } from "@/server/services/kupon-tutma.service";
import { EGITIM_Z } from "@/lib/izleme/model-surumleri";
import { degerlendir, sinyalDurumu, type DilimOzeti, type Aralik, type KalibrasyonKutusu } from "@/lib/izleme/metrikler";
import { Bolum, KpiIzgara, KpiKaro, Cip, HuniSatiri, IcgoruBandi, RenkliBaslikKarti, SatirDeger, TON_NOKTA, TON_METIN, yuzde, sayi, isaretli, para, zamanOnce, type Ton } from "./ui";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import SiralanabilirTablo, { type TabloSatiri, type Sutun, type Hucre } from "./SiralanabilirTablo";

const PIYASA_CV_LL = 1.877; // piyasa (son AGF) zaman-CV LogLoss'u — modelin CV farkı bununla hesaplanır
const SURUM_TONLARI: Ton[] = ["gri", "altin", "mavi", "yesil"];
const kisaAd = (ad: string) => ad.replace("Saf Model ", "");
const aralikMetni = (a: Aralik | null | undefined) => (a && Number.isFinite(a.lo) ? `[${yuzde(a.lo, 0)} – ${yuzde(a.hi, 0)}]` : "");
const fin = (x: number | null | undefined): number | null => (x != null && Number.isFinite(x) ? x : null);
const h = (metin: string, sirala: number | null, ton?: Ton, rozet?: boolean): Hucre => ({ metin, sirala: fin(sirala), ton, rozet });

/** Model Top3'ünün piyasaya göre rozet tonu: ≥ piyasa yeşil, 8 puana kadar altın, daha kötü kırmızı; az örnek/piyasa yok gri */
function tonOran(model: number | null | undefined, piyasa: number | null | undefined, n: number): Ton {
  if (model == null || piyasa == null || n < 8) return "gri";
  return model >= piyasa ? "yesil" : model >= piyasa - 0.08 ? "altin" : "kirmizi";
}

const DILIM_SUTUNLARI: Sutun[] = [
  { anahtar: "n", baslik: "Koşu" }, { anahtar: "t1", baslik: "Top1" }, { anahtar: "t3", baslik: "Top3" },
  { anahtar: "ll", baslik: "LogLoss" }, { anahtar: "pt3", baslik: "Piyasa Top3" }, { anahtar: "fark", baslik: "ΔLL" },
];
function dilimSatiri(d: DilimOzeti, ad = d.ad, altMetin?: string): TabloSatiri {
  const yok = d.n === 0;
  return {
    ad, altMetin,
    hucreler: {
      n: h(yok ? "—" : String(d.n), d.n || null, "gri", true),
      t1: h(yok ? "—" : yuzde(d.model?.top1, 1), d.model?.top1 ?? null),
      t3: h(yok ? "—" : yuzde(d.model?.top3, 1), d.model?.top3 ?? null, tonOran(d.model?.top3, d.piyasa?.top3, d.nPiyasa), true),
      ll: h(yok ? "—" : sayi(d.model?.ll, 3), d.model?.ll != null ? -d.model.ll : null),
      pt3: h(d.piyasa ? yuzde(d.piyasa.top3, 1) : "—", d.piyasa?.top3 ?? null),
      fark: h(d.fark ? isaretli(d.fark.m, 3) : "—", d.fark ? -d.fark.m : null),
    },
  };
}

/* ───────────────────────── 1) MODEL GENEL GÖRÜNÜMÜ ───────────────────────── */
export function ModelGenelGorunumu({ v }: { v: IzlemeVerisi }) {
  const guncel = v.surumler[v.surumler.length - 1];
  const guncelYeterli = guncel.ozet.n >= 20;
  const k = guncelYeterli ? guncel.ozet : v.eraToplam;
  const kaynak = guncelYeterli ? `${kisaAd(guncel.ad)} (güncel sürüm)` : `Saf era, tüm sürümler (güncel sürümle henüz ${guncel.ozet.n} sonuçlanmış koşu)`;
  const cv = guncel.cv;
  const cvFark = cv ? cv.logLoss - PIYASA_CV_LL : NaN;
  const durum = degerlendir(k.fark, k.nPiyasa, cvFark);
  const kalan = Math.max(0, 150 - k.nPiyasa);
  const tonT3: Ton | undefined = k.top3Aralik && cv && Number.isFinite(k.top3Aralik.lo) ? (k.top3Aralik.lo > cv.top3 ? "yesil" : k.top3Aralik.hi < cv.top3 ? "kirmizi" : undefined) : undefined;
  const tonT1: Ton | undefined = k.top1Aralik && cv && Number.isFinite(k.top1Aralik.lo) ? (k.top1Aralik.lo > cv.top1 ? "yesil" : k.top1Aralik.hi < cv.top1 ? "kirmizi" : undefined) : undefined;
  const bas = new Date(guncel.baslangic);
  const basMetni = bas.toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

  return (
    <Bolum baslik="Model Genel Görünümü" aciklama={`Canlıda yayınlanıp sonuçlanan tahminlerden ölçülür. Gösterilen: ${kaynak}. Piyasa (son AGF) yalnız karşılaştırma referansıdır, modele girmez.`}>
      <KpiIzgara>
        <KpiKaro deger={guncel.ozellikSayisi} etiket="Özellik (güncel model)" alt={`Saf Model, AGF'siz · ${basMetni}'den beri`} />
        <KpiKaro deger={k.n} etiket="Değerlendirilen Koşu" alt={`piyasalı ${k.nPiyasa} · güncel sürümde ${guncel.ozet.n}`} />
        <KpiKaro deger={yuzde(k.model?.top1)} etiket="İlk Sıra (Top1)" ton={tonT1} alt={`${aralikMetni(k.top1Aralik)} · CV ${yuzde(cv?.top1)}`} />
        <KpiKaro deger={yuzde(k.model?.top3)} etiket="İlk 3 (Top3)" ton={tonT3} alt={`${aralikMetni(k.top3Aralik)} · CV ${yuzde(cv?.top3)}`} />
        <KpiKaro deger={sayi(k.model?.ll, 3)} etiket="LogLoss" alt={`CV ${sayi(cv?.logLoss, 3)} · düşük iyi`} />
        <KpiKaro deger={isaretli(k.fark?.m, 3)} etiket="Piyasa Farkı (ΔLL)" alt={`CV beklentisi ${isaretli(cvFark, 3)} · piyasa Top3 ${yuzde(k.piyasa?.top3, 0)}`} />
      </KpiIzgara>

      <div className="mt-3 flex flex-wrap gap-2">
        {v.surumler.map((s, i) => (s.ozet.n > 0 || i === v.surumler.length - 1) && <Cip key={s.ad} sayi={s.ozet.n} etiket={kisaAd(s.ad)} ton={SURUM_TONLARI[i % SURUM_TONLARI.length]} />)}
        {v.haric > 0 && <Cip sayi={v.haric} etiket="yarıştan sonra düzenlendi (dışarıda)" ton="gri" />}
      </div>

      {durum === "yetersiz" && (
        <IcgoruBandi ton="altin"><b>Henüz hüküm verilemez:</b> piyasa karşılaştırmalı {k.nPiyasa} koşu var, güvenilir bir okuma için ~150 gerekiyor (günde ~25 koşu ile yaklaşık {Math.ceil(kalan / 25)} gün). Bu arada rakamlar yalnız birikimi gösterir.</IcgoruBandi>
      )}
      {durum === "beklenen" && <IcgoruBandi ton="yesil">Canlı performans <b>CV beklentisiyle uyumlu</b>: piyasa farkının %95 aralığı [{isaretli(k.fark?.lo)} , {isaretli(k.fark?.hi)}] eğitim sırasındaki {isaretli(cvFark)} değerini içeriyor.</IcgoruBandi>}
      {durum === "iyi" && <IcgoruBandi ton="yesil">Model canlıda <b>CV beklentisinden daha iyi</b>: fark aralığı [{isaretli(k.fark?.lo)} , {isaretli(k.fark?.hi)}], beklenen {isaretli(cvFark)}.</IcgoruBandi>}
      {durum === "kotu" && <IcgoruBandi ton="kirmizi"><b>UYARI:</b> canlı fark aralığı [{isaretli(k.fark?.lo)} , {isaretli(k.fark?.hi)}] eğitim beklentisinin ({isaretli(cvFark)}) tamamen üstünde — model canlıda beklenenden kötü. Eğitim-canlı veri kaymasını araştır.</IcgoruBandi>}
    </Bolum>
  );
}

/* ───────────────────────── 2) SÜRÜM KARŞILAŞTIRMASI ───────────────────────── */
export function SurumKarsilastirma({ v }: { v: IzlemeVerisi }) {
  const dolu = v.surumler.map((s, i) => ({ s, i })).filter((x) => x.s.ozet.n > 0);
  const guncel = v.surumler[v.surumler.length - 1];
  const satirlar = dolu.map(({ s }) => dilimSatiri(s.ozet, kisaAd(s.ad), `${s.ozellikSayisi} özellik · ${new Date(s.baslangic).toLocaleDateString("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" })}'den beri`));
  return (
    <Bolum baslik="Sürüm Karşılaştırması — Model vs Piyasa" aciklama="Her model sürümü, kendi döneminde sonuçlanan koşulardan ölçülür (sürüm = tahminin son kaydedildiği anda canlı olan model). Çubuklar ilk-3 isabeti; ΔLL negatifse model piyasadan iyi.">
      <div className="space-y-2">
        {dolu.length === 0 && <p className="text-xs text-muted-foreground">Saf era için henüz sonuçlanmış canlı koşu yok.</p>}
        {dolu.map(({ s, i }) => (
          <HuniSatiri key={s.ad} etiket={kisaAd(s.ad)} alt={`${s.ozet.n} koşu`} yuzde={fin((s.ozet.model?.top3 ?? NaN) * 100)} ton={SURUM_TONLARI[i % SURUM_TONLARI.length]} icMetin={`${s.ozet.n}`} sagMetin={yuzde(s.ozet.model?.top3)} />
        ))}
        {v.eraToplam.piyasa && <HuniSatiri etiket="Piyasa" alt="aynı dönem, son AGF" yuzde={fin(v.eraToplam.piyasa.top3 * 100)} ton="mor" icMetin={`${v.eraToplam.nPiyasa}`} sagMetin={yuzde(v.eraToplam.piyasa.top3)} />}
        {guncel.cv && <HuniSatiri etiket="CV beklentisi" alt={`${kisaAd(guncel.ad)}, 827 test koşusu`} yuzde={guncel.cv.top3 * 100} ton="gri" soluk sagMetin={yuzde(guncel.cv.top3)} />}
      </div>
      {satirlar.length > 0 && (
        <div className="mt-5">
          <SiralanabilirTablo ilkSutunBasligi="Sürüm" sutunlar={DILIM_SUTUNLARI} satirlar={satirlar} toplam={dilimSatiri(v.eraToplam, "SAF ERA TOPLAM")} />
        </div>
      )}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {[v.son7, v.son30].map((d) => (
          <KpiKaro key={d.ad} deger={d.n ? yuzde(d.model?.top3) : "—"} etiket={`${d.ad} — İlk 3`} alt={d.n ? `${d.n} koşu · Top1 ${yuzde(d.model?.top1)} · piyasa Top3 ${yuzde(d.piyasa?.top3, 0)} · ΔLL ${isaretli(d.fark?.m)}` : "bu pencerede sonuçlanmış koşu yok"} />
        ))}
      </div>
    </Bolum>
  );
}

/* ───────────────────────── 3) TİP / ALAN BÜYÜKLÜĞÜ ───────────────────────── */
export function TipPerformansi({ v }: { v: IzlemeVerisi }) {
  const segment = new Set(["Maiden/ŞARTLI 19", "ŞARTLI 1/27"]);
  return (
    <Bolum baslik="Koşu Tipine ve Saha Büyüklüğüne Göre" aciklama="Saf era (tüm sürümler birlikte). Rozet rengi: model Top3'ü piyasadan iyi → yeşil, 8 puana kadar geride → altın, daha kötü → kırmızı, az örnek (n<8) → gri. Başlıklara tıklayarak sıralayın.">
      <SiralanabilirTablo
        ilkSutunBasligi="Koşu tipi" sutunlar={DILIM_SUTUNLARI}
        satirlar={v.tipler.map((d) => dilimSatiri(d, d.ad, segment.has(d.ad) ? "ayrı segment modeli" : undefined))}
        toplam={dilimSatiri(v.eraToplam, "TOPLAM")}
      />
      <div className="mt-5">
        <SiralanabilirTablo ilkSutunBasligi="Saha büyüklüğü" sutunlar={DILIM_SUTUNLARI} satirlar={v.alan.map((d) => dilimSatiri(d))} />
      </div>
    </Bolum>
  );
}

/* ───────────────────────── 4) KALİBRASYON ───────────────────────── */
function KalibrasyonBlok({ baslik, aciklama, kutular }: { baslik: string; aciklama: string; kutular: KalibrasyonKutusu[] }) {
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-bold">{baslik}</h3>
      <p className="mb-3 text-[11px] text-muted-foreground">{aciklama}</p>
      <div className="space-y-3">
        {kutular.map((k) => (
          <div key={k.etiket}>
            <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Tahmin {k.etiket} <span className="font-normal">· {k.n} koşu</span></div>
            {k.n === 0 ? <div className="text-[11px] text-muted-foreground/50">–</div> : (
              <div className={k.n < 8 ? "space-y-1 opacity-60" : "space-y-1"}>
                <HuniSatiri ince etiket="Tahmin" yuzde={k.ortTahmin * 100} ton="altin" sagMetin={yuzde(k.ortTahmin, 0)} />
                <HuniSatiri ince etiket="Gerçek" alt={aralikMetni(k.gercek)} yuzde={k.gercek.oran * 100} ton="mavi" sagMetin={yuzde(k.gercek.oran, 0)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
export function KalibrasyonKarti({ v }: { v: IzlemeVerisi }) {
  return (
    <Bolum baslik="Kalibrasyon — Modelin Dediği vs Gerçek" aciklama="Saf era. Model %30 dediği atların yaklaşık %30'u kazanıyorsa kalibredir; çubuklar yakın olmalı. Gerçek çubuğu tahminin altındaysa model aşırı iddialı.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <KalibrasyonBlok baslik="En iyi atın kazanma olasılığı" aciklama="Modelin 1. seçimi kazandı mı? (banko eşiği kararı bu eğriye dayanır)" kutular={v.kalibrasyonTop1} />
        <KalibrasyonBlok baslik="İlk-3 olasılık toplamı" aciklama="Kazanan modelin ilk 3'ünde mi? (kupon ayak genişliği bu eğriye dayanır)" kutular={v.kalibrasyonTop3} />
      </div>
      <IcgoruBandi ton="mavi">Soluk satırlar 8&apos;den az koşu içerir (gürültü). Eğriler birikim arttıkça anlam kazanır; eğitim CV&apos;sinde Handikap&apos;ta en iyi at olasılığı aşırı iddialıydı (%24 denirken %19 tuttu).</IcgoruBandi>
    </Bolum>
  );
}

/* ───────────────────────── 5) BANKO ───────────────────────── */
export function BankoKarti({ v }: { v: IzlemeVerisi }) {
  const b = v.banko;
  const yeterli = b.n >= 10;
  return (
    <Bolum baslik="Banko Adayları" aciklama="Kalibre olasılığı ≥ %40 olan koşu-tipi bazlı otomatik banko kuralı (Handikap ve segment modellerinde banko verilmez). İsabet = banko adayının kazanması.">
      <KpiIzgara sutun={4}>
        <KpiKaro deger={b.n} etiket="Banko Adayı" alt="saf era, sonuçlanan" />
        <KpiKaro deger={b.tuttu} etiket="Tuttu" />
        <KpiKaro deger={b.n ? yuzde(b.aralik.oran, 0) : "—"} etiket="İsabet" ton={yeterli && Number.isFinite(b.aralik.lo) ? (b.aralik.lo >= 0.4 ? "yesil" : b.aralik.hi < 0.4 ? "kirmizi" : undefined) : undefined} alt={b.n ? aralikMetni(b.aralik) : undefined} />
        <KpiKaro deger="%40" etiket="Hedef" alt="eğitim CV: eşiği geçen kümede ≈%46 (n≈46)" />
      </KpiIzgara>
      <IcgoruBandi ton={yeterli ? "mavi" : "altin"}>{yeterli ? <>Banko adaylarının isabeti hedefle karşılaştırılabilir: örneklem {b.n} koşu.</> : <><b>Henüz yeterli banko adayı yok</b> ({b.n}). Eşiği geçen koşu seyrek (CV&apos;de koşuların yaklaşık %8&apos;i); 10&apos;dan az örnekle isabet oranına güvenilmez.</>}</IcgoruBandi>
    </Bolum>
  );
}

/* ───────────────────────── 6) KUPON ───────────────────────── */
export function KuponPerformansi({ k }: { k: KuponTutma }) {
  const TON: Record<string, Ton> = { ekonomik: "yesil", normal: "mavi", genis: "altin" };
  const eko = k.kademeler[0];
  const buyukIkramiyeUyari = k.kademeler.some((x) => x.tuttu > 0 && x.medyanIkramiye != null && x.ikramiye / Math.max(x.tuttu - x.ikramiyeKayitsiz, 1) > 2 * x.medyanIkramiye);
  return (
    <Bolum baslik="Kupon Performansı — Son 30 Gün" aciklama={`Yayınlanmış Altılı kuponlar (${k.kuponSayisi} kupon, 7'li Ganyan hariç); isabet sitenin kendi mantığıyla (eküri dahil). Net = toplam ikramiye − toplam harcama.`}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {k.kademeler.map((x) => (
          <RenkliBaslikKarti key={x.anahtar} baslik={x.ad} sag={`${x.n} kupon`} ton={TON[x.anahtar]}>
            <SatirDeger etiket="Tutma" deger={`${x.tuttu}/${x.n}`} alt={x.n ? `${yuzde(x.aralik.oran, 1)} ${aralikMetni(x.aralik)}` : undefined} />
            <SatirDeger etiket="Ort. maliyet" deger={para(x.ortMaliyet)} />
            <SatirDeger etiket="Toplam harcama" deger={para(x.harcama)} />
            <SatirDeger etiket="Toplam ikramiye" deger={para(x.ikramiye)} alt={x.ikramiyeKayitsiz ? `${x.ikramiyeKayitsiz} tutanın ikramiyesi kayıtsız` : undefined} />
            <SatirDeger etiket="Medyan ikramiye" deger={x.medyanIkramiye != null ? para(x.medyanIkramiye) : "—"} />
            <SatirDeger etiket="Net" deger={`${x.net >= 0 ? "+" : "−"}${para(Math.abs(x.net))}`} ton={x.n ? (x.net >= 0 ? "yesil" : "kirmizi") : undefined} />
          </RenkliBaslikKarti>
        ))}
      </div>
      {eko && eko.n > 0 && <IcgoruBandi ton="yesil">Son {k.gunSayisi} günde Ekonomik kademe <b>{eko.tuttu}/{eko.n}</b> ({yuzde(eko.aralik.oran, 1)}) tuttu; Normal <b>{k.kademeler[1].tuttu}/{k.kademeler[1].n}</b>, Geniş <b>{k.kademeler[2].tuttu}/{k.kademeler[2].n}</b>. Kademe genişliği beklenen getiriyi değil, tutma oranını ve dalgalanmayı değiştirir.</IcgoruBandi>}
      {buyukIkramiyeUyari && <IcgoruBandi ton="altin"><b>İkramiye ağır kuyruklu:</b> toplam, birkaç büyük ikramiyeyle belirleniyor (ortalama medyanın ≥2 katı). Karlılık için net yerine medyan ikramiyeye ve tutma oranına bakın.</IcgoruBandi>}
    </Bolum>
  );
}

/* ───────────────────────── 7) SİNYAL SAĞLIĞI ───────────────────────── */
export function SinyalSagligi({ v }: { v: IzlemeVerisi }) {
  const modelKodlari = (safW as { featureNames: string[] }).featureNames;
  const beta = new Map(modelKodlari.map((f, i) => [f, (safW as { weights: number[] }).weights[i]]));
  const harita = new Map(v.sinyaller.map((s) => [s.kod, s]));
  const kodlar = [...modelKodlari, ...v.sinyaller.map((s) => s.kod).filter((c) => !modelKodlari.includes(c))];
  const sutunlar: Sutun[] = [
    { anahtar: "b", baslik: "Katsayı β" }, { anahtar: "z", baslik: "Eğitim |z|" }, { anahtar: "o7", baslik: "Gözlem 7g" },
    { anahtar: "o30", baslik: "Gözlem 30g" }, { anahtar: "k", baslik: "Ort. |katkı|" }, { anahtar: "d", baslik: "Durum" },
  ];
  let dusus = 0; const veriYok: string[] = [];
  const satirlar: TabloSatiri[] = kodlar.map((kod) => {
    const s = harita.get(kod); const segmentOnly = !modelKodlari.includes(kod);
    const o7 = s && s.n7 ? s.obs7 / s.n7 : null, o30 = s && s.n30 ? s.obs30 / s.n30 : null;
    const sd = sinyalDurumu(s);
    let durum: { m: string; t: Ton };
    if (sd === "veriYok") { durum = { m: "Veri yok", t: "gri" }; if (!segmentOnly) veriYok.push(kod); }
    else if (sd === "yediGunYok") durum = { m: "7g yok", t: "gri" };
    else if (sd === "dusus") { durum = { m: "Düşüş", t: "kirmizi" }; dusus++; }
    else durum = { m: "OK", t: "yesil" };
    const z = EGITIM_Z[kod] ?? null;
    return {
      ad: kod, altMetin: segmentOnly ? "yalnız segment modeli" : undefined,
      hucreler: {
        b: h(beta.has(kod) ? isaretli(beta.get(kod), 3) : "—", beta.has(kod) ? Math.abs(beta.get(kod)!) : null),
        z: h(z == null ? "—" : sayi(Math.abs(z), 1), z == null ? null : Math.abs(z), z == null ? "gri" : Math.abs(z) >= 4 ? "yesil" : Math.abs(z) >= 2 ? "mavi" : "gri", true),
        o7: h(yuzde(o7, 0), o7), o30: h(yuzde(o30, 0), o30), k: h(sayi(s?.katki7, 3), s?.katki7 ?? null), d: h(durum.m, durum.t === "yesil" ? 2 : durum.t === "kirmizi" ? 0 : 1, durum.t, true),
      },
    };
  });
  return (
    <Bolum baslik="Sinyal Sağlığı — Canlı Gözlem Oranı" aciklama="Yayınlanan tahminlerin kayıtlı sinyal dökümünden: her sinyalin son 7 / 30 günde gerçekten GÖZLENEN (veri dolu) at oranı. Eğitim |z|: katsayının eğitimdeki güvenilirliği (≥4 güçlü, 2–4 orta, <2 belirsiz). Düşüş = son 7 gün, 30 günden 10+ puan düşük.">
      <SiralanabilirTablo ilkSutunBasligi="Sinyal" sutunlar={sutunlar} satirlar={satirlar} ilkSiralama={{ anahtar: "z", yon: "azalan" }} />
      {dusus > 0 && <IcgoruBandi ton="kirmizi"><b>{dusus} sinyalde gözlem oranı düştü</b> — veri kaynağı (senkron/cron) bozulmuş olabilir; model eksik veriyi sıfır katkı sayar, sessizce zayıflar.</IcgoruBandi>}
      {veriYok.length > 0 && <IcgoruBandi ton="altin">Güncel modelin şu sinyalleri henüz canlı tahmin kaydında görülmedi: <b>{veriYok.join(", ")}</b>. Yeni model sürümüyle ilk tahminler üretildikçe görünür.</IcgoruBandi>}
      {dusus === 0 && veriYok.length === 0 && <IcgoruBandi ton="yesil">Tüm sinyallerin gözlem oranı kararlı.</IcgoruBandi>}
    </Bolum>
  );
}

/* ───────────────────────── 8) VERİ GÜNCELLİĞİ ───────────────────────── */
export function VeriGuncelligi({ v }: { v: IzlemeVerisi }) {
  const simdi = new Date();
  const agf = zamanOnce(v.veri.sonAgf, simdi), sonuc = zamanOnce(v.veri.sonSonuc, simdi), tahmin = zamanOnce(v.veri.sonTahmin, simdi);
  const agfTon: Ton = agf.dakika == null ? "kirmizi" : agf.dakika < 180 ? "yesil" : agf.dakika < 720 ? "altin" : "kirmizi";
  const yas = (d: number | null): Ton => (d == null ? "gri" : d < 60 * 24 ? "yesil" : d < 60 * 48 ? "altin" : "kirmizi");
  return (
    <Bolum baslik="Veri Güncelliği" aciklama={`Bu sayfadaki izleme verisi ${zamanOnce(v.uretildi, simdi).metin} hesaplandı (15 dk önbellek). Piyasa karşılaştırması AGF senkronuna bağlı.`}>
      <div className="flex flex-wrap gap-2">
        <Cip sayi={agf.metin} etiket="son AGF senkronu" ton={agfTon} />
        <Cip sayi={sonuc.metin} etiket="son sonuç girişi" ton={yas(sonuc.dakika)} />
        <Cip sayi={tahmin.metin} etiket="son tahmin yayını" ton={yas(tahmin.dakika)} />
        <Cip sayi={`${v.veri.bugunKosu}`} etiket={`bugünkü koşu (${v.veri.bugunTarih})`} ton="mavi" />
        <Cip sayi={`${v.veri.bugunTahminli}`} etiket="tahmini yayınlanmış" ton={v.veri.bugunKosu && v.veri.bugunTahminli < v.veri.bugunKosu ? "altin" : "yesil"} />
        <Cip sayi={`${v.veri.bugunSonuclanan}`} etiket="sonuçlanmış" ton="gri" />
      </div>
    </Bolum>
  );
}


/* ───────────────────────── 0) DURUM ÖZETİ (üç trafik ışığı) ───────────────────────── */
/** Kupon tutma oranı referansı: 2026 Temmuz–Kasım, 340 sonuçlanmış Altılı kupon (HomeKupon geçmişi). Yeni kupon mantığı gelirse güncelle. */
export const KUPON_REFERANS = { ekonomik: 0.088, normal: 0.141, genis: 0.179 } as const;

type Isik = { ton: Ton; etiket: string; cumle: ReactNode; ayrinti: string };

export function modelIsigi(v: IzlemeVerisi | null): Isik {
  if (!v) return { ton: "gri", etiket: "Hesaplanamadı", cumle: "Canlı izleme verisi şu an alınamadı.", ayrinti: "Model Detayı" };
  const guncel = v.surumler[v.surumler.length - 1];
  const k = guncel.ozet.n >= 20 ? guncel.ozet : v.eraToplam;
  const cv = guncel.cv;
  const cvFark = cv ? cv.logLoss - PIYASA_CV_LL : NaN;
  const durum = degerlendir(k.fark, k.nPiyasa, cvFark);
  const sayilar = <>İlk 3: <b>{yuzde(k.model?.top3)}</b> (eğitim beklentisi {yuzde(cv?.top3)}); piyasa farkı <b>{isaretli(k.fark?.m)}</b> (beklenti {isaretli(cvFark)}).</>;
  if (durum === "yetersiz") return { ton: "altin", etiket: "Henüz erken", cumle: <>Piyasa karşılaştırmalı <b>{k.nPiyasa}</b> koşu var, hüküm için ~150 gerekiyor (≈{Math.ceil(Math.max(0, 150 - k.nPiyasa) / 25)} gün). {sayilar}</>, ayrinti: "Model Detayı" };
  if (durum === "kotu") return { ton: "kirmizi", etiket: "Beklentinin altında", cumle: <>Canlı performans eğitimdekinden belirgin kötü; veri kayması araştırılmalı. {sayilar}</>, ayrinti: "Model Detayı" };
  if (durum === "iyi") return { ton: "yesil", etiket: "Beklentiden iyi", cumle: sayilar, ayrinti: "Model Detayı" };
  return { ton: "yesil", etiket: "Beklenen gibi", cumle: sayilar, ayrinti: "Model Detayı" };
}

export function kuponIsigi(k: KuponTutma | null): Isik {
  if (!k) return { ton: "gri", etiket: "Hesaplanamadı", cumle: "Kupon verisi şu an alınamadı.", ayrinti: "Kupon Detayı" };
  const ref = [KUPON_REFERANS.ekonomik, KUPON_REFERANS.normal, KUPON_REFERANS.genis];
  const satir = k.kademeler.map((x) => `${x.ad} ${x.tuttu}/${x.n} (${yuzde(x.aralik.oran, 0)})`).join(" · ");
  const cumle = <>Son {k.gunSayisi} gün: {satir}. Geçmiş ortalama {yuzde(ref[0])} / {yuzde(ref[1])} / {yuzde(ref[2])}. Net&apos;in eksi olması beklenir (piyasa payı); tutma oranına bakın.</>;
  const yeterli = k.kademeler.map((x) => x.n >= 20 && Number.isFinite(x.aralik.lo));
  if (!yeterli.some(Boolean)) return { ton: "altin", etiket: "Henüz erken", cumle, ayrinti: "Kupon Detayı" };
  const kotu = k.kademeler.some((x, i) => yeterli[i] && x.aralik.hi < ref[i]);
  const iyi = k.kademeler.some((x, i) => yeterli[i] && x.aralik.lo > ref[i]);
  if (kotu) return { ton: "kirmizi", etiket: "Geçmiş ortalamanın altında", cumle, ayrinti: "Kupon Detayı" };
  return { ton: "yesil", etiket: iyi ? "Geçmişten iyi" : "Geçmişle uyumlu", cumle, ayrinti: "Kupon Detayı" };
}

export function veriIsigi(v: IzlemeVerisi | null): Isik {
  if (!v) return { ton: "gri", etiket: "Hesaplanamadı", cumle: "Veri sağlığı şu an hesaplanamadı.", ayrinti: "Sinyal ve Veri Sağlığı" };
  const agf = zamanOnce(v.veri.sonAgf);
  const modelKodlari = (safW as { featureNames: string[] }).featureNames;
  const harita = new Map(v.sinyaller.map((s) => [s.kod, s]));
  const dusenler = modelKodlari.filter((kod) => sinyalDurumu(harita.get(kod)) === "dusus");
  const henuzYok = modelKodlari.filter((kod) => sinyalDurumu(harita.get(kod)) === "veriYok").length;
  const agfKotu = agf.dakika == null || agf.dakika > 720, agfOrta = agf.dakika != null && agf.dakika > 180 && agf.dakika <= 720;
  const ton: Ton = agfKotu || dusenler.length >= 3 ? "kirmizi" : agfOrta || dusenler.length >= 1 ? "altin" : "yesil";
  const etiket = ton === "kirmizi" ? "Dikkat gerekiyor" : ton === "altin" ? "Küçük sapma" : "Sağlıklı";
  return {
    ton, etiket, ayrinti: "Sinyal ve Veri Sağlığı",
    cumle: <>AGF senkronu <b>{agf.metin}</b>; {dusenler.length ? <><b>{dusenler.length}</b> sinyalde gözlem oranı düştü ({dusenler.slice(0, 3).join(", ")}{dusenler.length > 3 ? "…" : ""})</> : "sinyal gözlem oranlarında düşüş yok"}{henuzYok > 0 ? <> · {henuzYok} model sinyali henüz canlı kayıtta görülmedi (yeni sürümün ilk tahminleriyle dolar)</> : null}.</>,
  };
}

function IsikKarti({ baslik, isik }: { baslik: string; isik: Isik }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className={cn("h-5 w-5 shrink-0 rounded-full ring-4 ring-offset-0", TON_NOKTA[isik.ton], isik.ton === "yesil" && "ring-hit/20", isik.ton === "altin" && "ring-brand/25", isik.ton === "kirmizi" && "ring-miss/20", isik.ton === "gri" && "ring-muted")} />
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{baslik}</div>
          <div className={cn("text-lg font-bold leading-tight", TON_METIN[isik.ton])}>{isik.etiket}</div>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-foreground/90 [&_b]:font-bold">{isik.cumle}</p>
      <p className="mt-2 text-[11px] text-muted-foreground">Ayrıntı: aşağıda “{isik.ayrinti}” ▾</p>
    </div>
  );
}

export function DurumOzeti({ v, k }: { v: IzlemeVerisi | null; k: KuponTutma | null }) {
  const m = modelIsigi(v), p = kuponIsigi(k), d = veriIsigi(v);
  const hepsi = [m, p, d];
  const kirmizi = hepsi.filter((x) => x.ton === "kirmizi").length, altin = hepsi.filter((x) => x.ton === "altin").length;
  return (
    <Bolum baslik="Durum Özeti" aciklama="Üç soru: model piyasaya göre beklendiği gibi mi, kuponlar geçmişle uyumlu mu, veri hattı sağlıklı mı? Yeşil = iyi, altın = erken ya da küçük sapma, kırmızı = bakılması gerekir.">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <IsikKarti baslik="Model" isik={m} />
        <IsikKarti baslik="Kuponlar" isik={p} />
        <IsikKarti baslik="Veri ve Sistem" isik={d} />
      </div>
      {kirmizi > 0 ? <IcgoruBandi ton="kirmizi"><b>{kirmizi} alanda uyarı var</b> — kırmızı kartın altındaki detay grubunu açın.</IcgoruBandi>
        : altin > 0 ? <IcgoruBandi ton="altin">Şu an kırmızı bir uyarı yok. Altın kartlar &ldquo;henüz hüküm için erken&rdquo; ya da küçük sapma demek; yeni model sürümüyle veri biriktikçe netleşir.</IcgoruBandi>
        : <IcgoruBandi ton="yesil"><b>Her şey beklendiği gibi.</b> Model, kuponlar ve veri hattı normal aralıkta.</IcgoruBandi>}
    </Bolum>
  );
}
