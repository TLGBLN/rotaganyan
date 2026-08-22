import { getDereceIstOzeti, getDereceIstListesi } from "@/server/services/derece-ist.service";
import DereceIstSyncButton from "@/components/admin/DereceIstSyncButton";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function pistDurumuRenk(pistDurumu: string): string {
  if (/normal/i.test(pistDurumu)) return "text-muted-foreground";
  if (/(ağır|agir|sulu|nemli|ıslak|islak)/i.test(pistDurumu)) return "text-miss";
  return "text-brand";
}

export default async function DereceIstatistikleriPage({
  searchParams,
}: {
  searchParams: Promise<{ atAdi?: string; pistDurumu?: string; sayfa?: string }>;
}) {
  const sp = await searchParams;
  const [ozet, liste] = await Promise.all([
    getDereceIstOzeti(),
    getDereceIstListesi({ atAdi: sp.atAdi, pistDurumu: sp.pistDurumu, sayfa: sp.sayfa ? parseInt(sp.sayfa, 10) : 1 }),
  ]);
  const yil = new Date().getUTCFullYear();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Detaylı Derece İstatistikleri</h1>
          <p className="text-xs text-muted-foreground">
            TJK&apos;nın ülke çapındaki koşu performans arşivi (
            <a href="https://www.tjk.org/TR/YarisSever/Query/Page/DetayliDereceIst" target="_blank" rel="noreferrer" className="underline">
              kaynak
            </a>
            ) — her gece otomatik senkronize edilir. Amaç: kendi verimizde seyrek olan pist
            durumu (yağmurlu/ıslak/ağır zemin) bilgisini zengin bir popülasyon referansıyla
            desteklemek. Şu an yalnız arşiv/inceleme amaçlı — analiz motorunda henüz bir sinyal
            olarak kullanılmıyor, ayrı bir backtest sonrası eklenebilir.
          </p>
        </div>
        <DereceIstSyncButton yil={yil} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Toplam Kayıt</p>
          <p className="text-xl font-bold tabular-nums">{ozet.toplamKayit.toLocaleString("tr-TR")}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Son Güncelleme</p>
          <p className="text-sm font-semibold">
            {ozet.sonGuncelleme ? new Date(ozet.sonGuncelleme).toLocaleString("tr-TR") : "—"}
          </p>
        </div>
        {ozet.yilDagilimi.map((y) => (
          <div key={y.yil} className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{y.yil}</p>
            <p className="text-xl font-bold tabular-nums">{y.sayi.toLocaleString("tr-TR")}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-3">
        <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">Pist Durumu Dağılımı</p>
        <div className="flex flex-wrap gap-2">
          {ozet.pistDurumuDagilimi.map((p) => (
            <a
              key={p.pistDurumu}
              href={`/admin/derece-istatistikleri?pistDurumu=${encodeURIComponent(p.pistDurumu)}`}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-muted",
                pistDurumuRenk(p.pistDurumu)
              )}
            >
              {p.pistDurumu || "(boş)"} <span className="text-muted-foreground">({p.sayi})</span>
            </a>
          ))}
        </div>
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          name="atAdi"
          defaultValue={sp.atAdi}
          placeholder="At ismine göre ara..."
          className="rounded-md border bg-transparent px-3 py-1.5 text-xs"
        />
        {sp.pistDurumu && <input type="hidden" name="pistDurumu" value={sp.pistDurumu} />}
        <button type="submit" className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
          Ara
        </button>
        {(sp.atAdi || sp.pistDurumu) && (
          <a href="/admin/derece-istatistikleri" className="text-xs text-muted-foreground underline">
            Filtreleri temizle
          </a>
        )}
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30 text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">At İsmi</th>
              <th className="px-3 py-2 text-left font-medium">Tarih</th>
              <th className="px-3 py-2 text-left font-medium">Hipodrom</th>
              <th className="px-3 py-2 text-left font-medium">Pist</th>
              <th className="px-3 py-2 text-left font-medium">Pist Durumu</th>
              <th className="px-3 py-2 text-right font-medium">Mesafe</th>
              <th className="px-3 py-2 text-right font-medium">Derece</th>
              <th className="px-3 py-2 text-left font-medium">Koşu Cinsi</th>
            </tr>
          </thead>
          <tbody>
            {liste.kayitlar.map((k) => (
              <tr key={k.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-semibold">{k.atAdi}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {k.tarih ? new Date(k.tarih).toLocaleDateString("tr-TR") : "—"}
                </td>
                <td className="px-3 py-2">{k.hipodrom}</td>
                <td className="px-3 py-2">{k.pist}</td>
                <td className={cn("px-3 py-2 font-medium", pistDurumuRenk(k.pistDurumu))}>{k.pistDurumu}</td>
                <td className="px-3 py-2 text-right tabular-nums">{k.mesafe}</td>
                <td className="px-3 py-2 text-right tabular-nums">{k.derece ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{k.cinsAdi}</td>
              </tr>
            ))}
            {liste.kayitlar.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Kayıt bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {liste.toplamSayfa > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs">
          {liste.sayfa > 1 && (
            <a
              className="rounded-md border px-2.5 py-1 hover:bg-muted"
              href={`?${new URLSearchParams({ ...sp, sayfa: String(liste.sayfa - 1) }).toString()}`}
            >
              ← Önceki
            </a>
          )}
          <span className="text-muted-foreground">
            Sayfa {liste.sayfa} / {liste.toplamSayfa} ({liste.toplam.toLocaleString("tr-TR")} kayıt)
          </span>
          {liste.sayfa < liste.toplamSayfa && (
            <a
              className="rounded-md border px-2.5 py-1 hover:bg-muted"
              href={`?${new URLSearchParams({ ...sp, sayfa: String(liste.sayfa + 1) }).toString()}`}
            >
              Sonraki →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
