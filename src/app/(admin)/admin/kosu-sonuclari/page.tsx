import Link from "next/link";
import { getKosuSonucDegerlendirme, KACAN_TOP_N, TOP_N, type YarisDegerlendirme } from "@/server/services/kosu-sonuc-degerlendirme.service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Koşu Sonuçları Değerlendirme: "Sistem yarışları ne kadar doğru okudu ve hangi kazananları
// neden kaçırdı?" Yalnız okuma. Sistem sağlığı Site Anatomisi'nde; burada yalnız performans teşhisi.

type PageProps = { searchParams: Promise<{ kacan?: string }> };

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

function SinyalListesi({ baslik, satirlar, renk }: { baslik: string; satirlar: YarisDegerlendirme["enIyiKatkilar"]; renk: string }) {
  if (satirlar.length === 0) return null;
  return (
    <div>
      <p className="font-semibold text-muted-foreground">{baslik}</p>
      <ul className="space-y-0.5">
        {satirlar.map((s) => (
          <li key={s.kod} className="flex justify-between gap-3 tabular-nums">
            <span>{s.kod}</span>
            <span className={cn("font-semibold", renk)}>{fark(s.farkOrtalama)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Otopsi({ y }: { y: YarisDegerlendirme }) {
  return (
    <div className="space-y-2">
      {y.sinyalVeriVar ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <SinyalListesi baslik="Kazananı en çok aşağı çeken sinyaller" satirlar={y.enKotuKatkilar} renk="text-miss" />
            <SinyalListesi baslik="Kazananı en çok destekleyen sinyaller" satirlar={y.enIyiKatkilar} renk="text-hit" />
          </div>
          <p>
            Top{KACAN_TOP_N} sınırına skor farkı: <span className="font-semibold tabular-nums">{fark(y.sinirFarki)}</span>
            <span className="text-muted-foreground"> (negatif = sınırın altında)</span>
          </p>
        </>
      ) : (
        <span className="text-muted-foreground">Sinyal verisi yok (featureSnapshot eksik veya 6&apos;dan az at)</span>
      )}
    </div>
  );
}

export default async function KosuSonuclariPage({ searchParams }: PageProps) {
  const { kacan } = await searchParams;
  const sadeceKacan = kacan === "1";
  const { ozet, oranlar, yarislar } = await getKosuSonucDegerlendirme({ sadeceKacan });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Koşu Sonuçları Değerlendirme</h1>
          <p className="text-xs text-muted-foreground">
            Sistem yarışları ne kadar doğru okudu, hangi kazananları neden kaçırdı. Yalnızca okuma; hiçbir skor, sıra
            veya kupon değiştirilmez. Kaçan = kazanan Top{KACAN_TOP_N} dışında. Sinyal farkı, kazananın katkısının saha
            ortalamasından farkıdır; betimleyicidir, nedensel değildir.
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
            Sadece kaçan
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { etiket: "Sonuçlanmış koşu", deger: String(ozet.toplam) },
          { etiket: `Model Top${TOP_N} isabeti`, deger: `${yuzde(oranlar.modelTop3)} (${ozet.modelOlcumlu} koşu)` },
          { etiket: `Model Top${KACAN_TOP_N} isabeti`, deger: yuzde(oranlar.modelTop6) },
          { etiket: `Yayın Top${KACAN_TOP_N} isabeti`, deger: yuzde(oranlar.yayinTop6) },
        ].map((k) => (
          <div key={k.etiket} className="rounded-lg border p-3">
            <p className="text-[11px] text-muted-foreground">{k.etiket}</p>
            <p className="text-lg font-bold tabular-nums">{k.deger}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Kaçan koşu: {ozet.kacanSayi} · Kupon tutan: {ozet.kuponTutan} · Yayın Top{TOP_N} isabeti {yuzde(oranlar.yayinTop3)}.
        Model sırası, yayınlanan pick&apos;lerdeki featureSnapshot katkılarından yeniden toplanır; snapshot&apos;ı olmayan koşularda hesaplanmaz.
      </p>

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
                <th className="px-3 py-2 text-right font-medium">Olasılık</th>
                <th className="px-3 py-2 text-left font-medium">Yayın sırası</th>
                <th className="px-3 py-2 text-left font-medium">Model sırası</th>
                <th className="px-3 py-2 text-right font-medium">Top{KACAN_TOP_N} sınırı farkı</th>
                <th className="px-3 py-2 text-left font-medium">Kupon</th>
                <th className="px-3 py-2 text-left font-medium">Otopsi</th>
              </tr>
            </thead>
            <tbody>
              {yarislar.map((y) => (
                <tr key={y.raceId} className="border-b align-top last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{y.tarih}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {y.hipodrom} · {y.raceNo}. koşu · {y.n} at
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-semibold">#{y.kazananNo}</span> {y.kazananAd}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {y.olasilikYuzde === null ? "—" : `%${y.olasilikYuzde.toFixed(1)}`}
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
                    <Chip aktif={y.kuponTuttu} etiket={y.kuponTuttu ? "Tuttu" : "Tutmadı"} tip="hit" />
                  </td>
                  <td className="px-3 py-2">
                    {y.kacan ? (
                      <details>
                        <summary className="cursor-pointer text-miss">Kaçırıldı · otopsi</summary>
                        <div className="mt-2">
                          <Otopsi y={y} />
                        </div>
                      </details>
                    ) : (
                      <span className="text-muted-foreground">Kaçırılmadı</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Son 200 sonuçlanmış ve yayınlanmış koşu. Sinyal sağlığı (kapsama, drift, kaçan baskısı) için{" "}
        <Link href="/admin/site-anatomisi" className="text-brand">Site Anatomisi</Link> sayfasına bakın.
      </p>
    </div>
  );
}
