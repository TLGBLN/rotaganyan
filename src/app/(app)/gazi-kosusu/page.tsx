import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import BannerCountdown from "@/components/layout/BannerCountdown";
import { fetchGaziKayitlar, type GaziHorse } from "@/server/services/ingest/tjk-gazi.adapter";
import { cn } from "@/lib/utils";

const GAZI_KOSUSU_TARGET = "2026-06-28T17:15:00+03:00";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "100. Gazi Koşusu — ROTAGANYAN",
};

export default async function GaziKosusuPage() {
  const targetDate = new Date(GAZI_KOSUSU_TARGET);
  const dateLabel = format(targetDate, "d MMMM yyyy, EEEE", { locale: tr });
  const tarihParam = format(targetDate, "yyyy-MM-dd");

  let horses: GaziHorse[] = [];
  try {
    horses = await fetchGaziKayitlar();
  } catch {
    // TJK servisi erişilemezse listeyi sessizce atla, sayfanın geri kalanı çalışsın
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div className="overflow-hidden rounded-xl border">
        <Image
          src="/gazi%20banner.png"
          alt="100. Gazi Koşusu"
          width={2170}
          height={725}
          className="w-full h-auto"
          priority
        />
      </div>

      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">100. Gazi Koşusu</h1>
        <p className="text-sm text-muted-foreground">
          {dateLabel} · 17:15 · Veliefendi Hipodromu, İstanbul
        </p>
        <div className="flex justify-center">
          <BannerCountdown target={GAZI_KOSUSU_TARGET} />
        </div>
      </div>

      <div className="rounded-lg border p-6 space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>
          Gazi Koşusu, Türkiye&apos;de düzenlenen en köklü ve en prestijli üç yaşlı İngiliz at yarışıdır.
          Her yıl yılın en güçlü 3 yaşlı safkanlarını bir araya getirir ve at yarışı takviminin
          en çok ilgi gören koşusu olarak kabul edilir.
        </p>
        <p>
          ROTAGANYAN ekibi, koşu programı netleştiği anda bu yarış için tam analiz, sıralama ve
          kupon önerisini yayımlayacak. Analize ulaşmak için giriş yapmış olman gerekiyor.
        </p>
      </div>

      <div className="flex justify-center">
        <Button asChild size="lg" className="bg-brand hover:bg-brand/90 text-brand-foreground">
          <Link href={`/kosular?tarih=${tarihParam}`}>Koşu Programını Gör</Link>
        </Button>
      </div>

      {horses.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold">
            Kayıtlı Adaylar <span className="text-sm font-normal text-muted-foreground">({horses.length} at)</span>
          </h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">At</th>
                  <th className="px-3 py-2">Sahibi</th>
                  <th className="px-3 py-2">Antrenör</th>
                  <th className="px-3 py-2">Yetiştirici</th>
                  <th className="px-3 py-2 text-right">HP</th>
                </tr>
              </thead>
              <tbody>
                {horses.map((h, i) => (
                  <tr
                    key={h.atAdi}
                    className={cn(
                      "border-b last:border-0",
                      i % 2 === 1 && "race-row-even"
                    )}
                  >
                    <td className="px-3 py-2 font-medium">{h.atAdi}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{h.atSahibi ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{h.antrenor ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{h.yetistici ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{h.hp ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Jokey ataması yarış gününe yakın netleşir. Kaynak: gazi.tjk.org
          </p>
        </div>
      )}
    </main>
  );
}
