import { getVeriTamligiRaporu } from "@/server/services/veri-tamligi.service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function renk(yuzde: number): string {
  if (yuzde >= 80) return "text-hit";
  if (yuzde >= 50) return "text-brand";
  return "text-miss";
}

export default async function VeriTamligiPage() {
  const rapor = await getVeriTamligiRaporu();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">Veri Tamlığı</h1>
        <p className="text-xs text-muted-foreground">
          Analiz motorunun kullandığı/kullanabileceği ana veri kaynaklarının doluluk yüzdesi —
          2026-08-20 kullanıcı bulgusu (galop verisinin %47,8&apos;i eksik çıktı, meğer TJK&apos;da
          varmış, yalnız geriye dönük hiç taranmamış) sonrası eklendi. Amaç: bu tür sessiz
          boşlukları elle bulmayı beklemeden görünür kılmak.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30 text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Alan</th>
              <th className="px-3 py-2 text-left font-medium">Açıklama</th>
              <th className="px-3 py-2 text-right font-medium">Tüm Kapsam (2026-07-01&apos;den)</th>
              <th className="px-3 py-2 text-right font-medium">Son 7 Gün</th>
            </tr>
          </thead>
          <tbody>
            {rapor.map((satir) => (
              <tr key={satir.alan} className="border-b last:border-0">
                <td className="px-3 py-2 font-semibold">{satir.alan}</td>
                <td className="px-3 py-2 text-muted-foreground">{satir.aciklama}</td>
                <td className={cn("px-3 py-2 text-right font-mono tabular-nums", renk(satir.yuzdeKapsam))}>
                  %{satir.yuzdeKapsam.toFixed(1)}{" "}
                  <span className="text-muted-foreground">
                    ({satir.doluKapsam}/{satir.toplamKapsam})
                  </span>
                </td>
                <td className={cn("px-3 py-2 text-right font-mono tabular-nums", renk(satir.yuzdeSon7))}>
                  %{satir.yuzdeSon7.toFixed(1)}{" "}
                  <span className="text-muted-foreground">
                    ({satir.doluSon7}/{satir.toplamSon7})
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Renk eşiği: %80+ yeşil, %50-79 kehribar, altı kırmızı. &quot;Son 7 Gün&quot; sütunu canlı/güncel
        senkronizasyon sorunlarını, &quot;Tüm Kapsam&quot; sütunu geçmiş backfill boşluklarını ayrı ayrı
        gösterir.
      </p>
    </div>
  );
}
