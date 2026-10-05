import Link from "next/link";
import { getSiteAnatomisi, type OrganDurum } from "@/server/services/site-anatomi.service";
import { SINYAL_SON_GUN, type SinyalDurum, type SinyalOzeti } from "@/server/services/sinyal-saglik.service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ETIKET: Record<OrganDurum, string> = { OK: "Sağlam", UYARI: "Dikkat", HATA: "Arıza" };
const RENK: Record<OrganDurum, string> = {
  OK: "bg-hit/15 text-hit",
  UYARI: "bg-brand/15 text-brand",
  HATA: "bg-miss/15 text-miss",
};

const SINYAL_ETIKET: Record<SinyalDurum, string> = {
  SAGLAM: "Sağlam",
  IZLE: "İzle",
  SORUN: "Sorun",
  DATA_HOLD: "Veri yetersiz",
};
const SINYAL_RENK: Record<SinyalDurum, string> = {
  SAGLAM: "bg-hit/15 text-hit",
  IZLE: "bg-brand/15 text-brand",
  SORUN: "bg-miss/15 text-miss",
  DATA_HOLD: "bg-muted/40 text-muted-foreground",
};

function yuzde(v: number | null): string {
  return v === null ? "—" : `%${(v * 100).toFixed(0)}`;
}
function sayi(v: number | null, ondalik = 3): string {
  return v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(ondalik)}`;
}

function SinyalBolumu({ sinyal }: { sinyal: SinyalOzeti }) {
  const s = sinyal.sayilar;
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold">Sinyal sağlığı</h2>
          <p className="text-xs text-muted-foreground">
            Son {sinyal.pencereGun} gün, referans dönemle karşılaştırılır. Eşikler sabit; hiçbir katsayı ya da skor
            değiştirilmez. Kaçan kazananlar, Top6 dışında kalan kazanandır.
          </p>
        </div>
        <Link href="/admin/kosu-sonuclari" className="text-xs font-semibold text-brand">
          Koşu Sonuçları Değerlendirme →
        </Link>
      </div>

      <details className="rounded-lg border">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">
          Ayrıntı: {sinyal.satirlar.length} sinyal · {s.SAGLAM} sağlam · {s.IZLE} izle · {s.SORUN} sorun · {s.DATA_HOLD} veri yetersiz
          {sinyal.sonTarih ? ` · son koşu ${sinyal.sonTarih}` : ""} · kaçan vaka {sinyal.kacanVakaSayisi}
        </summary>
        {sinyal.satirlar.length === 0 ? (
          <p className="px-3 pb-3 text-xs text-muted-foreground">Ölçülecek sinyal verisi yok.</p>
        ) : (
          <div className="overflow-x-auto border-t">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30 text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Sinyal</th>
                  <th className="px-3 py-2 text-left font-medium">Durum</th>
                  <th className="px-3 py-2 text-right font-medium">Kapsama</th>
                  <th className="px-3 py-2 text-right font-medium">Sıfır oranı</th>
                  <th className="px-3 py-2 text-right font-medium">Son ort. katkı</th>
                  <th className="px-3 py-2 text-right font-medium">Drift (σ)</th>
                  <th className="px-3 py-2 text-right font-medium">Kazanan farkı</th>
                  <th className="px-3 py-2 text-right font-medium">Kaçan farkı (n)</th>
                  <th className="px-3 py-2 text-right font-medium">Kaçanda ilk-3 negatif</th>
                  <th className="px-3 py-2 text-left font-medium">Not</th>
                </tr>
              </thead>
              <tbody>
                {sinyal.satirlar.map((r) => (
                  <tr key={r.kod} className="border-b align-top last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 font-semibold">{r.kod}</td>
                    <td className="px-3 py-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", SINYAL_RENK[r.durum])}>
                        {SINYAL_ETIKET[r.durum]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{yuzde(r.kapsama)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{yuzde(r.sifirOrani)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{sayi(r.sonOrt)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{sayi(r.driftSigma, 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {sayi(r.kazananFark)} <span className="text-muted-foreground">({r.kazananN})</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {sayi(r.kacanFark)} <span className="text-muted-foreground">({r.kacanN})</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.kacanIlk3Negatif}/{r.kacanN}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.notlar.join(" · ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </section>
  );
}

export default async function SiteAnatomisiPage() {
  const { genel, organlar, sinyal, uretildi } = await getSiteAnatomisi();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">Site Anatomisi</h1>
            <p className="text-xs text-muted-foreground">
              Sistem çalışıyor mu, veriler sağlıklı mı, sinyaller sağlıklı mı. Yalnızca okuma yapar; hiçbir veriyi
              değiştirmez.
            </p>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", RENK[genel])}>
            Genel durum: {ETIKET[genel]}
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30 text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">İşlev</th>
                <th className="px-3 py-2 text-left font-medium">Durum</th>
                <th className="px-3 py-2 text-left font-medium">Ayrıntı</th>
              </tr>
            </thead>
            <tbody>
              {organlar.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-semibold">{o.islev}</td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", RENK[o.durum])}>{ETIKET[o.durum]}</span>
                  </td>
                  <td className="px-3 py-2">{o.detay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Üretildi: {new Date(uretildi).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}. Sayfayı yenileyerek güncel durumu görebilirsiniz.
        </p>
      </div>

      {sinyal && <SinyalBolumu sinyal={sinyal} />}
    </div>
  );
}
