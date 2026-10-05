import { getSiteAnatomisi, type OrganDurum } from "@/server/services/site-anatomi.service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ETIKET: Record<OrganDurum, string> = { OK: "Sağlam", UYARI: "Dikkat", HATA: "Arıza" };
const RENK: Record<OrganDurum, string> = {
  OK: "bg-hit/15 text-hit",
  UYARI: "bg-brand/15 text-brand",
  HATA: "bg-miss/15 text-miss",
};

export default async function SiteAnatomisiPage() {
  const { genel, organlar, uretildi } = await getSiteAnatomisi();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Site Anatomisi</h1>
          <p className="text-xs text-muted-foreground">
            Site sağlık durumu: her sistem parçası ayrı izlenir. Yalnızca okuma yapar; hiçbir veriyi değiştirmez.
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
  );
}
