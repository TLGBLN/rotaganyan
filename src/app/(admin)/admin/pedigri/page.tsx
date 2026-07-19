import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import SireTierForm from "@/components/admin/SireTierForm";
import SireTierDeleteButton from "@/components/admin/SireTierDeleteButton";
import RacePedigreeTable from "@/components/admin/RacePedigreeTable";
import DateNavigator from "@/components/kosular/DateNavigator";
import { getRaceDaysForPedigreeEntry } from "@/server/services/admin.service";
import { turkeyDateString } from "@/lib/tz";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = {
  COK_YUKSEK: "Çok Yüksek",
  YUKSEK: "Yüksek",
  GUCLU: "Güçlü",
  ORTA: "Orta",
  DUSUK: "Düşük",
  ZAYIF: "Zayıf",
  SORU: "?",
  BILINMIYOR: "—",
};

const TIER_COLOR: Record<string, string> = {
  COK_YUKSEK: "text-brand border-brand/30",
  YUKSEK: "text-hit border-hit/30",
  GUCLU: "text-hit border-hit/30",
  ORTA: "text-muted-foreground border-border",
  DUSUK: "text-miss border-miss/30",
  ZAYIF: "text-miss border-miss/30",
  SORU: "text-muted-foreground border-border",
  BILINMIYOR: "text-muted-foreground border-border",
};

type PageProps = { searchParams: Promise<{ tarih?: string }> };

export default async function PedigriPage({ searchParams }: PageProps) {
  const { tarih } = await searchParams;
  const currentDate = tarih ?? turkeyDateString();

  const [sireTiers, raceDays] = await Promise.all([
    db.sireTier.findMany({ orderBy: [{ tier: "asc" }, { name: "asc" }] }),
    getRaceDaysForPedigreeEntry(currentDate),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">At Pedigrileri &amp; Eksik Veri</h1>
            <p className="text-xs text-muted-foreground">
              O günün koşan atlarına baba (sire), anne (dam), anne babası (damsire) ve pedigri notu
              girin. TJK programında zaten varsa otomatik dolu gelir, siz üzerine yazabilirsiniz.
              Kaydettiğiniz bilgi kullanıcılara &quot;Pedigriler&quot; panelinde gösterilir. Ayrıca her
              atın yanındaki &quot;Genel Not&quot; alanına pedigri dışında herhangi bir eksik veriyi
              (sakatlık haberi, antrenman gözlemi, pist notu vb.) girebilirsiniz — otomatik analiz
              motoru bu notu okur ve değerlendirmesine dahil eder.
            </p>
          </div>
          <DateNavigator currentDate={currentDate} basePath="/admin/pedigri" />
        </div>

        {raceDays.length === 0 && (
          <div className="mt-4 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            Bu tarih için koşu programı bulunamadı.
          </div>
        )}

        <div className="mt-4 space-y-4">
          {raceDays.map((rd) => (
            <section key={rd.id} className="rounded-lg border">
              <div className="border-b bg-muted/30 px-4 py-2">
                <h2 className="text-sm font-semibold">{rd.hippodrome.name}</h2>
              </div>
              <div className="divide-y">
                {rd.races.map((race) => (
                  <RacePedigreeTable key={race.id} raceNo={race.raceNo} runners={race.runners} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold">Aygır İtibarı (Sire Tier)</h2>
        <p className="text-xs text-muted-foreground">
          Otomatik analiz motoru, koşan atların sire/damSire bilgisini buradaki listeyle eşleştirip
          Pedigri puanı üretir. Bu liste sizin bildiğiniz aygır itibarını içerir — sistem hiçbir
          tier&apos;ı kendiliğinden tahmin etmez.
        </p>
      </div>

      <SireTierForm />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Aygır</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tier</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Pist</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Irk</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Not</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {sireTiers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Henüz sire tier eklenmedi.
                </td>
              </tr>
            ) : (
              sireTiers.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-semibold">{s.name}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={TIER_COLOR[s.tier]}>
                      {TIER_LABEL[s.tier]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{s.surface ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.breed ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.note ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <SireTierDeleteButton id={s.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
