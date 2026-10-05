import Link from "next/link";
import {
  getKosuSonuclari,
  KACAN_TOP_N,
  TOP_N,
  type Filtre,
  type Gun,
  type Genislik,
  type KayipTipi,
  type SonucEtiketi,
  type YarisDegerlendirme,
} from "@/server/services/kosu-sonuc-degerlendirme.service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Koşu Sonuçları — karar ekranı. Sorular: Model kazananı gördü mü? Kupon değerlendirdi mi? Kaçtıysa neden?
// Yalnız okuma; sistem sağlığı Site Anatomisi'nde.

type PageProps = { searchParams: Promise<{ gun?: string; filtre?: string }> };

const GUN_ETIKET: Record<Gun, string> = { bugun: "Bugün", "7": "Son 7 gün", tum: "Tüm V5.46" };
const FILTRE_ETIKET: Record<Filtre, string> = {
  tumu: "Kaçırılanlar",
  model: "Model kaçırdı",
  kupon: "Kupon kaçırdı",
  olculemedi: "Model ölçülemedi",
};
const SONUC_ETIKET: Record<SonucEtiketi, string> = {
  MARKET_PRESSURE: "Piyasa baskısı",
  NO_INFORMATION: "Bilgi yok",
  CONTEXT_MISSING: "Bağlam eksik",
  MULTI_SIGNAL: "Çoklu sinyal",
};
const KAYIP_ETIKET: Record<KayipTipi, string> = {
  MODEL_MISS: "MODEL_MISS",
  COUPON_MISS: "COUPON_MISS",
  KUPON_KAPSAMI_YOK: "Kupon kaydı yok",
  OK: "Kaybı yok",
  OLCULMEDI: "Model ölçülemedi",
};
const GENISLIK_ETIKET: Record<Genislik, string> = { narrow: "Ekonomik", normal: "Normal", wide: "Geniş" };

function yuzde(pay: number, payda: number): string {
  return payda === 0 ? "—" : `%${Math.round((pay / payda) * 100)}`;
}
function fark(v: number | null): string {
  return v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(3)}`;
}
function parseGun(v?: string): Gun {
  return v === "7" || v === "tum" ? v : "bugun";
}
function parseFiltre(v?: string): Filtre {
  return v === "model" || v === "kupon" || v === "olculemedi" ? v : "tumu";
}

function Kart({ etiket, deger, alt, tip }: { etiket: string; deger: string; alt?: string; tip?: "miss" }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-[11px] text-muted-foreground">{etiket}</p>
      <p className={cn("text-xl font-bold tabular-nums", tip === "miss" && "text-miss")}>{deger}</p>
      {alt && <p className="text-[11px] text-muted-foreground">{alt}</p>}
    </div>
  );
}

// Genişlik işaretleri: ✅ kazanan kuponda · ❌ kuponda yok · — kupon kaydı yok.
function KuponIsaretleri({ y }: { y: YarisDegerlendirme }) {
  const isaret = (v: boolean | null) => (v === null ? "—" : v ? "✅" : "❌");
  return (
    <span className="tabular-nums">
      {(["narrow", "normal", "wide"] as Genislik[]).map((g, i) => (
        <span key={g}>
          {i > 0 && " · "}
          {GENISLIK_ETIKET[g]} {isaret(y.kupon[g])}
        </span>
      ))}
    </span>
  );
}

function Satir({ y }: { y: YarisDegerlendirme }) {
  const o = y.otopsi;
  return (
    <div className="space-y-1.5 rounded-lg border px-3 py-2.5 text-xs">
      <p className="text-sm font-semibold">
        {y.hipodrom} {y.raceNo}. Koşu — {y.kazananAd} <span className="text-muted-foreground">#{y.kazananNo}</span>
        <span className="ml-2 text-[11px] font-normal text-muted-foreground">{y.tarih}</span>
      </p>
      <p className="text-muted-foreground tabular-nums">
        AGF {y.kazananAgf ?? "—"} · Model {y.modelSira ?? "—"}. sıra · Top{KACAN_TOP_N} farkı{" "}
        <span className={cn("font-semibold", y.sinirFarki !== null && y.sinirFarki < 0 ? "text-miss" : "text-foreground")}>
          {fark(y.sinirFarki)}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            y.kayipTipi === "MODEL_MISS"
              ? "bg-miss/15 text-miss"
              : y.kayipTipi === "COUPON_MISS"
                ? "bg-brand/15 text-brand"
                : "bg-muted/40 text-muted-foreground",
          )}
        >
          {KAYIP_ETIKET[y.kayipTipi]}
        </span>
        {o && <span className="text-muted-foreground">{SONUC_ETIKET[o.sonuc]}</span>}
        {y.kupon && (y.kayipTipi === "COUPON_MISS" || y.kayipTipi === "OK") && <KuponIsaretleri y={y} />}
      </div>

      {o ? (
        <details className="pt-1">
          <summary className="cursor-pointer text-miss">Otopsiyi aç</summary>
          <div className="mt-2 space-y-1.5 border-t pt-2">
            <p>
              <span className="font-semibold">Aşağı çeken:</span>{" "}
              {o.farkVs6
                .slice(0, 3)
                .map((f) => `${f.kod} ${fark(f.fark)}`)
                .join(", ") || "—"}
            </p>
            <p>
              <span className="font-semibold">Destekleyen:</span>{" "}
              {o.farkVs6
                .filter((f) => f.fark > 0)
                .slice(-3)
                .reverse()
                .map((f) => `${f.kod} ${fark(f.fark)}`)
                .join(", ") || "Yok"}
            </p>
            <p>
              <span className="font-semibold">Sıfır bilgi:</span> {o.sifirKatki.join(", ") || "Yok"}
            </p>
            <p>
              <span className="font-semibold">Tek sinyal rescue:</span> {o.tekKurtaranlar.length > 0 ? "Evet" : "Hayır"}
              {o.tekKurtaranlar.length > 0 && ` (${o.tekKurtaranlar.map((t) => t.kod).join(", ")})`}
            </p>
            <p>
              <span className="font-semibold">Market block rescue:</span> {o.piyasaKurtarir ? "Evet" : "Hayır"} ·{" "}
              {o.piyasaYeniSira}. sıra
            </p>
          </div>
        </details>
      ) : y.kayipTipi === "COUPON_MISS" ? (
        <p className="text-brand">Model Top{KACAN_TOP_N} içinde; kupon seçimi incelenmeli, sinyaller değil.</p>
      ) : null}
    </div>
  );
}

export default async function KosuSonuclariPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const gun = parseGun(sp.gun);
  const filtre = parseFiltre(sp.filtre);
  const { sonTarih, pencere, kacanOzeti, yarislar } = await getKosuSonuclari({ gun, filtre });

  const linkGun = (g: Gun) => `/admin/kosu-sonuclari?gun=${g}&filtre=${filtre}`;
  const linkFiltre = (f: Filtre) => `/admin/kosu-sonuclari?gun=${gun}&filtre=${f}`;
  const btn = (aktif: boolean) =>
    cn("rounded-full px-3 py-1 text-xs font-semibold", aktif ? "bg-brand/15 text-brand" : "bg-muted/40 text-muted-foreground");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold">Koşu Sonuçları</h1>
        <p className="text-xs text-muted-foreground">
          Model kazananı gördü mü? Kupon değerlendirdi mi? Kaçtıysa neden? Yalnız okuma; hiçbir skor, sıra veya kupon
          değiştirilmez.
          {sonTarih && <> Son koşu günü: <span className="font-semibold">{sonTarih}</span>.</>}
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(GUN_ETIKET) as Gun[]).map((g) => (
            <Link key={g} href={linkGun(g)} className={btn(gun === g)}>
              {GUN_ETIKET[g]}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(FILTRE_ETIKET) as Filtre[]).map((f) => (
            <Link key={f} href={linkFiltre(f)} className={btn(filtre === f)}>
              {FILTRE_ETIKET[f]}
            </Link>
          ))}
        </div>
      </div>

      {sonTarih === null ? (
        <p className="text-sm text-muted-foreground">Henüz sonuçlanmış V5.46 koşusu yok.</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Kart etiket="Koşu" deger={String(pencere.toplam)} />
            <Kart etiket={`Model Top${TOP_N}`} deger={yuzde(pencere.modelTop3, pencere.modelOlcumlu)} alt={`${pencere.modelOlcumlu} koşuda ölçüldü`} />
            <Kart etiket={`Model Top${KACAN_TOP_N}`} deger={yuzde(pencere.modelTop6, pencere.modelOlcumlu)} />
            <Kart etiket="MODEL_MISS" deger={String(pencere.modelMiss)} tip="miss" />
            <Kart etiket="COUPON_MISS" deger={String(pencere.couponMiss)} alt="model Top6 içinde, kuponda yok" tip="miss" />
          </section>

          <section className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              Kupon kaçırmaları (model Top{KACAN_TOP_N} içindeki kazananlar)
            </p>
            <div className="grid grid-cols-3 gap-3 text-xs">
              {(["narrow", "normal", "wide"] as Genislik[]).map((g) => (
                <div key={g}>
                  <p className="text-muted-foreground">{GENISLIK_ETIKET[g]}</p>
                  <p className={cn("text-lg font-bold tabular-nums", pencere.kupon[g].kayip > 0 && "text-miss")}>
                    {pencere.kupon[g].kayip}{" "}
                    <span className="text-xs font-normal text-muted-foreground">/ {pencere.kupon[g].degerlendirilen} değerlendirildi</span>
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold">
                {FILTRE_ETIKET[filtre]} · {GUN_ETIKET[gun]} <span className="text-muted-foreground">({yarislar.length})</span>
              </h2>
              <p className="text-[11px] text-muted-foreground">Ekonomik kaçanlar önce</p>
            </div>
            {yarislar.length === 0 ? (
              <p className="text-xs text-muted-foreground">Bu filtrede koşu yok.</p>
            ) : (
              yarislar.map((y) => <Satir key={y.raceId} y={y} />)
            )}
          </section>

          <details className="rounded-lg border">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">
              Sinyal özeti ({GUN_ETIKET[gun]}) — {kacanOzeti.modelMiss} model kaçırması üzerinden
            </summary>
            <div className="space-y-3 border-t p-3 text-xs">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(Object.keys(SONUC_ETIKET) as SonucEtiketi[]).map((s) => (
                  <div key={s}>
                    <p className="text-muted-foreground">{SONUC_ETIKET[s]}</p>
                    <p className="font-semibold tabular-nums">{kacanOzeti.sonuc[s]}</p>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground">
                Ort. Top{KACAN_TOP_N} sınır farkı: <span className="font-semibold text-foreground">{fark(kacanOzeti.ortSinirFarki)}</span>
                {" · "}Tek sinyal kurtarıyor: {kacanOzeti.tekKurtaranVaka} · Piyasa bloğu kurtarıyor: {kacanOzeti.piyasaKurtaranVaka} · Sıfır katkılı: {kacanOzeti.sifirKatkiliVaka}
              </p>
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
            </div>
          </details>
        </>
      )}

      <p className="text-[11px] text-muted-foreground">
        Sinyal sağlığı (kapsama, drift) için{" "}
        <Link href="/admin/site-anatomisi" className="text-brand">Site Anatomisi</Link> sayfasına bakın.
      </p>
    </div>
  );
}
