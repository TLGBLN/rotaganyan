import { Bolum, Cip, HuniSatiri, IcgoruBandi, KatlanirGrup, KpiIzgara, KpiKaro, Rozet, zamanOnce, type Ton } from "@/components/admin/izleme/ui";
import { AYAK_NEDENI_AD, KATEGORI_AD, SIDDET_AD, type AyakNedeni, type RcaSorun, type Siddet } from "@/lib/rca/rca-cekirdek";
import type { KuponRcaSonuc } from "@/server/services/rca-v2.service";
import type { KayitDetay } from "@/server/services/rca-kayit.service";
import { CozButonu } from "./CozButonu";

const SIDDET_TON: Record<Siddet, Ton> = { KRITIK: "kirmizi", YUKSEK: "altin", ORTA: "mavi", DUSUK: "gri" };
const NEDEN_TON: Record<AyakNedeni, Ton> = { KUPON_DAGILIMI: "mor", VERI_EKSIK: "altin", MODEL_PIYASA_GERI: "kirmizi", ONGORULEMEZ: "gri", BELIRSIZ: "gri" };

export function OzetSeridi({ sorunlar, kayitlar, kupon }: { sorunlar: RcaSorun[]; kayitlar: KayitDetay[]; kupon: KuponRcaSonuc | null }) {
  const acik = sorunlar.filter((s) => s.durum === "SORUN");
  const kritik = acik.filter((s) => s.siddet === "KRITIK").length;
  const saglikli = sorunlar.filter((s) => s.durum === "SAGLIKLI").length;
  const olculemeyen = sorunlar.filter((s) => s.durum === "OLCULEMIYOR").length;
  const cozulen = kayitlar.filter((k) => k.durum === "COZULDU").length;
  return (
    <div className="space-y-3">
      <IcgoruBandi ton={kritik ? "kirmizi" : acik.length ? "altin" : "yesil"}>
        {acik.length === 0
          ? `Tüm ${saglikli} kontrol sağlıklı — açık sorun yok.`
          : `${acik.length} açık sorun${kritik ? ` (${kritik} kritik)` : ""}; her birinin kök nedeni ve çözümü aşağıda. ${saglikli} kontrol sağlıklı.`}
      </IcgoruBandi>
      <KpiIzgara sutun={4}>
        <KpiKaro deger={acik.length} etiket="Açık sorun" ton={kritik ? "kirmizi" : acik.length ? "altin" : "yesil"} alt={kritik ? `${kritik} kritik` : undefined} />
        <KpiKaro deger={saglikli} etiket="Sağlıklı kontrol" ton="yesil" alt={olculemeyen ? `${olculemeyen} ölçülemedi` : undefined} />
        <KpiKaro deger={cozulen} etiket="Çözüldü (doğrulandı)" ton="mavi" alt={`kayıt defterinde ${kayitlar.length}`} />
        <KpiKaro deger={kupon ? kupon.ozet.tekAyakKupon : "—"} etiket="Tek ayaktan yatan kupon" ton="mor" alt={kupon ? `${kupon.yatanKupon} yatan kupondan` : undefined} />
      </KpiIzgara>
    </div>
  );
}

function SorunKarti({ s, kayit }: { s: RcaSorun; kayit?: KayitDetay }) {
  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Rozet ton={SIDDET_TON[s.siddet]}>{SIDDET_AD[s.siddet]}</Rozet>
        <Rozet ton="gri">{KATEGORI_AD[s.kategori]}</Rozet>
        <h3 className="min-w-0 flex-1 break-words text-sm font-bold sm:text-base">{s.baslik}</h3>
        {kayit && <span className="text-[11px] text-muted-foreground">ilk görülme {zamanOnce(kayit.ilkGorulme).metin}{kayit.tekrarSayisi > 0 ? ` · ${kayit.tekrarSayisi}. kez tekrarlıyor` : ""}</span>}
      </header>
      <div className="space-y-4 px-4 py-4">
        <p className="text-sm leading-relaxed">{s.etki}</p>
        {s.zincir.length > 0 && (
          <ol className="space-y-2 border-l-2 border-brand/40 pl-4">
            {s.zincir.map((a, i) => (
              <li key={i} className="text-sm">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{i + 1}. {a.soru}</span>
                <span className="leading-relaxed">{a.cevap}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Kök neden</p>
            <p className="mt-1 text-sm font-semibold">{s.kokNeden}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Çözüm</p>
            <p className="mt-1 text-sm">{s.cozum}</p>
          </div>
        </div>
        {s.otomatikCozum && <CozButonu kod={s.otomatikCozum} />}
        <p className="text-[11px] text-muted-foreground">Çözüldü sayılma ölçütü: {s.dogrulama} Ölçüt sağlandığında bu kayıt kendiliğinden “çözüldü” olur.</p>
        <details className="text-[11px] text-muted-foreground">
          <summary className="cursor-pointer">Ölçülen değerler</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(s.kanit).map(([k, v]) => <Cip key={k} sayi={String(v)} etiket={k} />)}</div>
        </details>
      </div>
    </article>
  );
}

export function AcikSorunlar({ sorunlar, kayitlar }: { sorunlar: RcaSorun[]; kayitlar: KayitDetay[] }) {
  const acik = sorunlar.filter((s) => s.durum === "SORUN");
  const harita = new Map(kayitlar.map((k) => [k.kod, k]));
  return (
    <Bolum baslik="Açık sorunlar" aciklama="Şiddete göre sıralı. Her kart: belirti → neden zinciri → kök neden → çözüm → doğrulama ölçütü.">
      {acik.length === 0 ? <p className="text-sm text-muted-foreground">Açık sorun yok.</p> : <div className="space-y-3">{acik.map((s) => <SorunKarti key={s.kod} s={s} kayit={harita.get(s.kod)} />)}</div>}
    </Bolum>
  );
}

export function KuponKokNeden({ kupon }: { kupon: KuponRcaSonuc }) {
  const o = kupon.ozet;
  const max = Math.max(1, ...o.nedenler.map((n) => n.sayi));
  const tek = kupon.ayaklar.filter((a) => a.tekAyak).slice(0, 25);
  return (
    <Bolum baslik="Kuponları kim öldürüyor?" aciklama={`Son ${kupon.gunSayisi} günde yatan ${kupon.yatanKupon} kuponun kaçan ${o.toplamAyak} ayağı, kök nedene göre.`}>
      <div className="space-y-2">
        {o.nedenler.map((n) => (
          <HuniSatiri key={n.neden} etiket={AYAK_NEDENI_AD[n.neden]} yuzde={n.sayi / max} ton={NEDEN_TON[n.neden]} sagMetin={`${n.sayi} ayak · %${Math.round(n.oran * 100)}${n.tekAyak ? ` · ${n.tekAyak} tek-ayak` : ""}`} />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Müdahale edilebilir (dağıtım + veri + model) oran: <b>%{Math.round(o.mudahaleOrani * 100)}</b>. Kalanı gerçek sürpriz veya belirsiz.</p>
      <h3 className="mb-2 mt-5 text-sm font-bold">Kuponu tek başına öldüren ayaklar (düzelseydi kupon tutardı)</h3>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2">Gün</th><th className="px-3 py-2">Hipodrom / Koşu</th><th className="px-3 py-2 text-right">Kazanan</th><th className="px-3 py-2 text-right">Model sırası</th><th className="px-3 py-2 text-right">Piyasa sırası</th><th className="px-3 py-2 text-right">Yazılan at</th><th className="px-3 py-2">Neden</th></tr>
          </thead>
          <tbody>
            {tek.map((a, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2 tabular-nums">{a.tarih}</td>
                <td className="px-3 py-2">{a.hipodrom.split(" — ")[0]} K{a.raceNo}</td>
                <td className="px-3 py-2 text-right tabular-nums">#{a.kazananNo}{a.ganyan ? ` (${a.ganyan.toFixed(1)})` : ""}</td>
                <td className="px-3 py-2 text-right tabular-nums">{a.modelSira ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{a.piyasaSira ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{a.ayagaYazilan}</td>
                <td className="px-3 py-2"><span className="font-semibold">{AYAK_NEDENI_AD[a.neden].split(" (")[0]}</span><span className="block text-[10px] text-muted-foreground">{a.aciklama}</span></td>
              </tr>
            ))}
            {tek.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">Tek ayaktan yatan kupon yok.</td></tr>}
          </tbody>
        </table>
      </div>
    </Bolum>
  );
}

export function SaglikliKontroller({ sorunlar }: { sorunlar: RcaSorun[] }) {
  const s = sorunlar.filter((x) => x.durum !== "SORUN");
  return (
    <KatlanirGrup baslik={`Sağlıklı / ölçülemeyen kontroller (${s.length})`} aciklama="Sorun çıkmayan denetimler — ‘kontrol edildi ve temiz’ kanıtı." ton="yesil">
      <div className="grid gap-2 sm:grid-cols-2">
        {s.map((x) => (
          <div key={x.kod} className="flex items-start gap-2 rounded-xl border bg-card px-3 py-2">
            <Rozet ton={x.durum === "SAGLIKLI" ? "yesil" : "gri"}>{x.durum === "SAGLIKLI" ? "Sağlıklı" : "Ölçülemedi"}</Rozet>
            <span className="min-w-0 text-xs"><b className="block break-words">{x.baslik}</b><span className="text-muted-foreground">{x.etki}</span></span>
          </div>
        ))}
      </div>
    </KatlanirGrup>
  );
}

export function KayitDefteriTablosu({ kayitlar }: { kayitlar: KayitDetay[] }) {
  return (
    <Bolum baslik="Kapalı döngü kayıt defteri" aciklama="Bulunan her sorun burada izlenir: açıldı → çözüldü (dedektörün kendi ölçütüyle doğrulanmış) → tekrar etti mi.">
      {kayitlar.length === 0 ? <p className="text-sm text-muted-foreground">Henüz kayıt yok — ilk tarama sonrası dolar.</p> : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2">Sorun</th><th className="px-3 py-2">Durum</th><th className="px-3 py-2">İlk görülme</th><th className="px-3 py-2">Çözülme</th><th className="px-3 py-2 text-right">Tekrar</th></tr></thead>
            <tbody>
              {kayitlar.map((k) => (
                <tr key={k.kod} className="border-t">
                  <td className="px-3 py-2">{k.baslik}</td>
                  <td className="px-3 py-2"><Rozet ton={k.durum === "ACIK" ? "kirmizi" : "yesil"}>{k.durum === "ACIK" ? "Açık" : "Çözüldü"}</Rozet></td>
                  <td className="px-3 py-2 tabular-nums">{k.ilkGorulme.slice(0, 10)}</td>
                  <td className="px-3 py-2 tabular-nums">{k.cozulmeZamani ? k.cozulmeZamani.slice(0, 10) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{k.tekrarSayisi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Bolum>
  );
}
