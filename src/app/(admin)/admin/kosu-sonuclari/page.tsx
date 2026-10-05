import Link from "next/link";
import {
  getKosuSonucDegerlendirme,
  KACAN_TOP_N,
  TOP_N,
  type KayipTipi,
  type Otopsi,
  type SonucEtiketi,
  type YarisDegerlendirme,
} from "@/server/services/kosu-sonuc-degerlendirme.service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Koşu Sonuçları Değerlendirme: sistem yarışları ne kadar doğru okudu, kazananı kaçıncı gördü,
// ne kadar farkla kaçırdı, hangi sinyaller aşağı çekti, sorun sinyal mi eksik bilgi mi kupon mu.
// Yalnız okuma. Sistem sağlığı Site Anatomisi'nde.

type PageProps = { searchParams: Promise<{ kacan?: string }> };

const SONUC_ETIKET: Record<SonucEtiketi, string> = {
  MARKET_PRESSURE: "Piyasa baskısı",
  NO_INFORMATION: "Bilgi yok",
  CONTEXT_MISSING: "Bağlam eksik",
  MULTI_SIGNAL: "Çoklu sinyal",
};
const KAYIP_ETIKET: Record<KayipTipi, string> = {
  MODEL_MISS: "Model kaçırdı",
  COUPON_MISS: "Kupon kaçırdı",
  OK: "Kaybı yok",
  OLCULMEDI: "Model ölçülmedi",
};

function yuzde(v: number): string {
  return `%${(v * 100).toFixed(0)}`;
}
function fark(v: number | null): string {
  return v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(3)}`;
}

function Chip({ aktif, etiket, tip }: { aktif: boolean | null; etiket: string; tip: "hit" | "miss" }) {
  if (aktif === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
        aktif ? (tip === "hit" ? "bg-hit/15 text-hit" : "bg-miss/15 text-miss") : "bg-muted/40 text-muted-foreground",
      )}
    >
      {etiket}
    </span>
  );
}

function Otopsi6({ o, kazananAgf, kazananOlasilik }: { o: Otopsi; kazananAgf: number | null; kazananOlasilik: number | null }) {
  const negatifler = o.farkVs6.slice(0, 3);
  const pozitifler = o.farkVs6.slice(-3).reverse().filter((f) => f.fark > 0);
  const kurtaranlar = o.tekKurtaranlar;
  return (
    <div className="space-y-3">
      <p>
        Kazanan AGF {kazananAgf ?? "—"} · olasılık {kazananOlasilik !== null ? `%${kazananOlasilik.toFixed(1)}` : "—"} · 6. at #{o.altinciNo ?? "—"} {o.altinciAd}
      </p>
      <p>
        Sonuç: <span className="font-semibold">{SONUC_ETIKET[o.sonuc]}</span> · sinyal destekleyen {o.destekSayisi} (eşik +{0.05})
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="font-semibold text-muted-foreground">En büyük negatif farklar (kazanan − 6. at)</p>
          <ul className="space-y-0.5">
            {negatifler.map((f) => (
              <li key={f.kod} className="flex justify-between gap-3 tabular-nums">
                <span>{f.kod}</span>
                <span className="font-semibold text-miss">{fark(f.fark)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-muted-foreground">Kazananı yukarı çeken sinyaller</p>
          {pozitifler.length === 0 ? (
            <p className="text-muted-foreground">Yok</p>
          ) : (
            <ul className="space-y-0.5">
              {pozitifler.map((f) => (
                <li key={f.kod} className="flex justify-between gap-3 tabular-nums">
                  <span>{f.kod}</span>
                  <span className="font-semibold text-hit">{fark(f.fark)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="font-semibold text-muted-foreground">Sıfır/eksik katkı (kazanan)</p>
          <p className="tabular-nums">{o.sifirKatki.length ? o.sifirKatki.join(", ") : "Yok"}</p>
          {o.baglamSifir.length > 0 && (
            <p className="text-miss">Bağlam verisi kazananda 0: {o.baglamSifir.join(", ")}</p>
          )}
        </div>
        <div>
          <p className="font-semibold text-muted-foreground">Tek-sinyal counterfactual</p>
          {kurtaranlar.length === 0 ? (
            <p className="text-muted-foreground">Tek bir sinyal çıkarılınca Top{KACAN_TOP_N}&apos;a girmiyor</p>
          ) : (
            <ul className="space-y-0.5">
              {kurtaranlar.map((t) => (
                <li key={t.kod} className="flex justify-between gap-3">
                  <span>{t.kod} çıkarılırsa</span>
                  <span className="font-semibold text-hit">{t.yeniSira}. sıra → Top{KACAN_TOP_N} içinde</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1">
            Piyasa bloğu ({["agfSirasi", "agfPayi", "agfPayi2"].join(" + ")}) çıkarılırsa: {o.piyasaYeniSira}. sıra
            {o.piyasaKurtarir ? <span className="font-semibold text-hit"> → kurtarıyor</span> : " → kurtarmıyor"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function KosuSonuclariPage({ searchParams }: PageProps) {
  const { kacan } = await searchParams;
  const sadeceKacan = kacan === "1";
  const { ozet, oranlar, kacanOzeti, yarislar } = await getKosuSonucDegerlendirme({ sadeceKacan });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Koşu Sonuçları Değerlendirme</h1>
          <p className="text-xs text-muted-foreground">
            Sistem yarışları ne kadar doğru okudu, kazananı kaçıncı gördü, ne kadar farkla kaçırdı. Yalnız okuma; hiçbir
            skor, sıra veya kupon değiştirilmez. Model kaçırdı = kazanan model Top{KACAN_TOP_N} dışında. Kupon kaçırdı =
            model Top{KACAN_TOP_N} içinde ama kuponda yok (kupon üç attan oluşur); bu durumda sinyaller suçlanmaz. Sinyal farkı = kazanan − 6. at.
            Betimleyicidir, nedensel değildir.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Link
            href="/admin/kosu-sonuclari"
            className={cn("rounded-full px-3 py-1 font-semibold", !sadeceKacan ? "bg-brand/15 text-brand" : "bg-muted/40 text-muted-foreground")}
          >
            Tümü
          </Link>
          <Link
            href="/admin/kosu-sonuclari?kacan=1"
            className={cn("rounded-full px-3 py-1 font-semibold", sadeceKacan ? "bg-miss/15 text-miss" : "bg-muted/40 text-muted-foreground")}
          >
            Sadece model kaçırdı
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { etiket: "Sonuçlanmış koşu", deger: String(ozet.toplam) },
          { etiket: `Model Top${KACAN_TOP_N} isabeti`, deger: `${yuzde(oranlar.modelTop6)} (${ozet.modelOlcumlu} koşu)` },
          { etiket: `Yayın Top${KACAN_TOP_N} isabeti`, deger: yuzde(oranlar.yayinTop6) },
          { etiket: "Model kaçırdı / kupon kaçırdı", deger: `${kacanOzeti.modelMiss} / ${kacanOzeti.couponMiss}` },
        ].map((k) => (
          <div key={k.etiket} className="rounded-lg border p-3">
            <p className="text-[11px] text-muted-foreground">{k.etiket}</p>
            <p className="text-lg font-bold tabular-nums">{k.deger}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3 rounded-lg border p-3">
        <h2 className="text-sm font-bold">Model kaçırdığı vakalarda sinyal otopsisi ({kacanOzeti.modelMiss})</h2>
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          {(Object.keys(SONUC_ETIKET) as SonucEtiketi[]).map((s) => (
            <div key={s}>
              <p className="text-muted-foreground">{SONUC_ETIKET[s]}</p>
              <p className="font-semibold tabular-nums">{kacanOzeti.sonuc[s]}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Ort. Top{KACAN_TOP_N} sınır farkı</p>
            <p className="font-semibold tabular-nums">{fark(kacanOzeti.ortSinirFarki)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Tek sinyal kurtarıyor</p>
            <p className="font-semibold tabular-nums">{kacanOzeti.tekKurtaranVaka} vaka</p>
          </div>
          <div>
            <p className="text-muted-foreground">Piyasa bloğu kurtarıyor</p>
            <p className="font-semibold tabular-nums">{kacanOzeti.piyasaKurtaranVaka} vaka</p>
          </div>
          <div>
            <p className="text-muted-foreground">En az bir sinyali 0</p>
            <p className="font-semibold tabular-nums">{kacanOzeti.sifirKatkiliVaka} vaka</p>
          </div>
        </div>
        {kacanOzeti.sinyalTablosu.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30 text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Sinyal</th>
                  <th className="px-3 py-2 text-right font-medium">İlk-3 negatif</th>
                  <th className="px-3 py-2 text-right font-medium">Tek başına kurtarıyor</th>
                  <th className="px-3 py-2 text-right font-medium">Kazanan katkısı 0</th>
                  <th className="px-3 py-2 text-right font-medium">Ort. fark (6. at)</th>
                </tr>
              </thead>
              <tbody>
                {kacanOzeti.sinyalTablosu.map((s) => (
                  <tr key={s.kod} className="border-b last:border-0">
                    <td className="px-3 py-2 font-semibold">{s.kod}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.ilk3Negatif}/{kacanOzeti.modelMiss}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.tekKurtaran}/{kacanOzeti.modelMiss}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.sifir}/{kacanOzeti.modelMiss}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fark(s.ortFark)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {yarislar.length === 0 ? (
        <p className="text-xs text-muted-foreground">Gösterilecek koşu yok.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30 text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Tarih</th>
                <th className="px-3 py-2 text-left font-medium">Koşu</th>
                <th className="px-3 py-2 text-left font-medium">Kazanan</th>
                <th className="px-3 py-2 text-left font-medium">Yayın sırası</th>
                <th className="px-3 py-2 text-left font-medium">Model sırası</th>
                <th className="px-3 py-2 text-right font-medium">Top{KACAN_TOP_N} sınırı farkı</th>
                <th className="px-3 py-2 text-left font-medium">Kayıp</th>
                <th className="px-3 py-2 text-left font-medium">Ayrıntı</th>
              </tr>
            </thead>
            <tbody>
              {yarislar.map((y: YarisDegerlendirme) => (
                <tr key={y.raceId} className="border-b align-top last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{y.tarih}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {y.hipodrom} · {y.raceNo}. koşu · {y.n} at
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-semibold">#{y.kazananNo}</span> {y.kazananAd}
                    <span className="text-muted-foreground"> · AGF {y.kazananAgf ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="tabular-nums">{y.yayinlananSira ?? "—"}.</span>
                      <Chip aktif={y.yayinTop3} etiket={`Top${TOP_N}`} tip="hit" />
                      <Chip aktif={y.yayinTop6} etiket={`Top${KACAN_TOP_N}`} tip="hit" />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={cn("font-semibold tabular-nums", y.modelTop6 === false ? "text-miss" : "")}>{y.modelSira ?? "—"}.</span>
                      <Chip aktif={y.modelTop3} etiket={`Top${TOP_N}`} tip="hit" />
                      <Chip aktif={y.modelTop6} etiket={`Top${KACAN_TOP_N}`} tip="hit" />
                    </div>
                  </td>
                  <td className={cn("px-3 py-2 text-right tabular-nums", y.sinirFarki !== null && y.sinirFarki < 0 ? "text-miss" : "")}>
                    {fark(y.sinirFarki)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        y.kayipTipi === "MODEL_MISS" ? "bg-miss/15 text-miss" : y.kayipTipi === "COUPON_MISS" ? "bg-brand/15 text-brand" : "bg-muted/40 text-muted-foreground",
                      )}
                    >
                      {KAYIP_ETIKET[y.kayipTipi]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {y.kayipTipi === "MODEL_MISS" && y.otopsi ? (
                      <details>
                        <summary className="cursor-pointer text-miss">Otopsi · {SONUC_ETIKET[y.otopsi.sonuc]}</summary>
                        <div className="mt-2">
                          <Otopsi6 o={y.otopsi} kazananAgf={y.kazananAgf} kazananOlasilik={y.olasilikYuzde} />
                        </div>
                      </details>
                    ) : y.kayipTipi === "COUPON_MISS" ? (
                      <span className="text-brand">Model Top{KACAN_TOP_N} içinde; kuponda yok. Kupon seçimi incelenmeli, sinyaller değil.</span>
                    ) : y.kayipTipi === "OLCULMEDI" ? (
                      <span className="text-muted-foreground">Model sırası ölçülemedi (snapshot eksik)</span>
                    ) : (
                      <span className="text-muted-foreground">Kaybı yok</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        V5.46 dönemi (12 Eylül 2026&apos;dan bu yana) sonuçlanmış ve yayınlanmış tüm koşular. Sinyal sağlığı için{" "}
        <Link href="/admin/site-anatomisi" className="text-brand">Site Anatomisi</Link> sayfasına bakın.
      </p>
    </div>
  );
}
