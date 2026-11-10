import { db } from "@/lib/db";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { GUNCEL_MOTOR_BASLANGIC, normalizeClassType } from "@/server/services/admin.service";
import { cn } from "@/lib/utils";
import SonuclarPaginator from "@/components/admin/SonuclarPaginator";

export const dynamic = "force-dynamic";

// 2026-11-10 kullanıcı talebi ("https://rotaganyan.com/admin/sonuclar ile .../kosu-tipleri
// bu sayfa birleştirilsin, hangi koşu tiplerinde kaç yarış olduğunu ve bunların sonuçlarını
// istiyorum") — iki ayrı sayfa (kosu-tipleri'nin tip-bazlı özet tablosu + sonuclar'ın zengin
// tek-tek sonuç satırları: hitTop1/hitInCoupon'dan türeyen kesin tier, ganyan, errorTag,
// "en yüksek puan" rozeti) TEK sayfada birleştirildi. /admin/sonuclar artık buraya yönlendirir
// (bkz. o dizindeki redirect). Tier hesabı artık Result.hitTop1/hitInCoupon'dan (DAHA KESİN,
// sonuclar'ın kullandığı kaynak) geliyor — eskiden kosu-tipleri kendi basit picks-türevi
// getTier'ını kullanıyordu, iki sayfa farklı sayı üretebiliyordu. GUNCEL_MOTOR_BASLANGIC filtresi
// KORUNDU (sonuclar'da hiç yoktu — ama eski V1-V22 dönem skorları gerçek olasılık değil, bkz.
// admin.service.ts'teki aynı tarihli not; kapsam hesaplarına hiç girmemeli).

type Tier = "rank1" | "rank2_3" | "rank4_6" | "miss";

const TIER: Record<Tier, { label: string; className: string }> = {
  rank1: { label: "1. Sıra", className: "bg-[#27ae60]/15 text-[#27ae60] border border-[#27ae60]/30" },
  rank2_3: { label: "2-3. Sıra", className: "bg-[#2980b9]/15 text-[#2980b9] border border-[#2980b9]/30" },
  rank4_6: { label: "4-6. Sıra", className: "bg-brand/15 text-brand border border-brand/30" },
  miss: { label: "Listede Yok", className: "bg-[#c0392b]/15 text-[#c0392b] border border-[#c0392b]/30" },
};

const SURFACE_LABEL: Record<string, string> = { CIM: "Çim", KUM: "Kum", SENTETIK: "Sentetik" };

function getTier(r: { hitTop1: boolean; hitInCoupon: boolean; winnerNos: number[]; picks: { rank: number; runnerNo: number | null }[] }): Tier {
  if (r.hitTop1) return "rank1";
  if (r.hitInCoupon) return "rank2_3";
  const pick = r.picks.filter((p) => p.runnerNo != null && r.winnerNos.includes(p.runnerNo)).sort((a, b) => a.rank - b.rank)[0];
  if (pick && pick.rank >= 4 && pick.rank <= 6) return "rank4_6";
  return "miss";
}

async function getVeri() {
  const results = await db.result.findMany({
    where: { race: { prediction: { published: true, createdAt: { gte: GUNCEL_MOTOR_BASLANGIC } }, conditions: null } },
    select: {
      id: true, hitTop1: true, hitInCoupon: true, winnerNos: true, ganyan: true, errorTag: true, cikan: true,
      race: {
        select: {
          id: true, raceNo: true, classType: true, distance: true, surface: true,
          raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
          prediction: { select: { picks: { select: { rank: true, score: true, runner: { select: { no: true } } } } } },
        },
      },
    },
    orderBy: { race: { raceDay: { date: "desc" } } },
  });

  return results.map((r) => {
    const picks = r.race.prediction?.picks ?? [];
    const picksBasit = picks.map((p) => ({ rank: p.rank, runnerNo: p.runner?.no ?? null }));
    const tier = getTier({ hitTop1: r.hitTop1, hitInCoupon: r.hitInCoupon, winnerNos: r.winnerNos, picks: picksBasit });
    const winnerPick = picks.filter((p) => p.runner?.no != null && r.winnerNos.includes(p.runner.no)).sort((a, b) => a.rank - b.rank)[0];
    const topScoredPick = [...picks].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    const topScoredIsWinner = topScoredPick?.runner?.no != null && r.winnerNos.includes(topScoredPick.runner.no);
    return {
      resultId: r.id,
      raceId: r.race.id,
      tarih: r.race.raceDay.date,
      hipodrom: r.race.raceDay.hippodrome.name,
      raceNo: r.race.raceNo,
      tip: normalizeClassType(r.race.classType),
      classTypeRaw: r.race.classType,
      mesafe: r.race.distance,
      pist: SURFACE_LABEL[r.race.surface] ?? r.race.surface,
      ganyan: r.ganyan,
      winnerNos: r.winnerNos,
      winnerRank: winnerPick?.rank ?? null,
      errorTag: r.errorTag,
      cikan: r.cikan,
      topScoredIsWinner,
      tier,
    };
  });
}

type Satir = Awaited<ReturnType<typeof getVeri>>[number];
type Ozet = { label: string; total: number; top1: number; top3: number; top6: number; disinda: number };

const SIRALAMA_ISTISNALARI: Record<string, string> = { "ŞARTLI 19": "Maiden", "ŞARTLI 27": "ŞARTLI 1" };
function siralamaAnahtari(label: string): string {
  return SIRALAMA_ISTISNALARI[label.toUpperCase()] ?? label;
}

function ozetle(rows: Satir[]): Ozet[] {
  const map = new Map<string, Ozet>();
  for (const r of rows) {
    const entry = map.get(r.tip) ?? { label: r.tip, total: 0, top1: 0, top3: 0, top6: 0, disinda: 0 };
    entry.total++;
    if (r.tier === "rank1") { entry.top1++; entry.top3++; entry.top6++; }
    else if (r.tier === "rank2_3") { entry.top3++; entry.top6++; }
    else if (r.tier === "rank4_6") { entry.top6++; }
    else entry.disinda++;
    map.set(r.tip, entry);
  }
  return [...map.values()].sort((a, b) => {
    const cmp = siralamaAnahtari(a.label).localeCompare(siralamaAnahtari(b.label), "tr");
    if (cmp !== 0) return cmp;
    const aExc = a.label.toUpperCase() in SIRALAMA_ISTISNALARI;
    const bExc = b.label.toUpperCase() in SIRALAMA_ISTISNALARI;
    if (aExc !== bExc) return aExc ? 1 : -1;
    return a.label.localeCompare(b.label, "tr");
  });
}

function pct(n: number, total: number): string {
  return total > 0 ? `%${((n / total) * 100).toFixed(1)}` : "—";
}

type PageProps = { searchParams: Promise<{ tip?: string; sayfa?: string }> };
const SAYFA_BOYU = 50;

export default async function KosuTipleriPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const rows = await getVeri();
  const ozet = ozetle(rows);

  const listeSatirlari = sp.tip ? rows.filter((r) => r.tip === sp.tip) : rows;
  const sayfa = Math.max(0, parseInt(sp.sayfa ?? "0", 10) || 0);
  const skip = sayfa * SAYFA_BOYU;
  const sayfalikListe = listeSatirlari.slice(skip, skip + SAYFA_BOYU);
  const sonSayfa = Math.max(0, Math.ceil(listeSatirlari.length / SAYFA_BOYU) - 1);

  const temizleLink = "/admin/kosu-tipleri";
  const tipLink = (t: string) => `/admin/kosu-tipleri?tip=${encodeURIComponent(t)}`;

  const genelToplam = {
    total: rows.length,
    top1: ozet.reduce((s, o) => s + o.top1, 0),
    top3: ozet.reduce((s, o) => s + o.top3, 0),
    top6: ozet.reduce((s, o) => s + o.top6, 0),
    disinda: ozet.reduce((s, o) => s + o.disinda, 0),
  };
  const ganyanHits = rows.filter((r) => r.tier === "rank1" && r.ganyan != null);
  const avgGanyan = ganyanHits.length > 0 ? (ganyanHits.reduce((s, r) => s + r.ganyan!, 0) / ganyanHits.length).toFixed(2) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">Koşu Tiplerine Göre Sonuçlar</h1>
        <p className="text-xs text-muted-foreground">
          Güncel motor dönemi, yayınlanmış + sonuçlanmış {rows.length} yarış — temel koşu tipine göre
          ayrılmış isabet dağılımı (Dişi/DHÖW/H1-H2-H3 gibi ekler birleştirildi, tam/ham tip ve
          detaylı sonuç aşağıdaki listede görünür).
        </p>
      </div>

      {/* Genel özet kartlar (TÜM satırlardan, sayfa/filtre etkilemez) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["rank1", "rank2_3", "rank4_6", "miss"] as Tier[]).map((tier) => (
          <div key={tier} className="rounded-lg border p-4 space-y-1">
            <div className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", TIER[tier].className)}>
              {TIER[tier].label}
            </div>
            <div className="text-2xl font-bold">
              {{ rank1: genelToplam.top1, rank2_3: genelToplam.top3 - genelToplam.top1, rank4_6: genelToplam.top6 - genelToplam.top3, miss: genelToplam.disinda }[tier]}
            </div>
          </div>
        ))}
      </div>
      {avgGanyan && (
        <p className="text-xs text-muted-foreground">Ort. ganyan (1. sıra isabetle): <strong className="text-foreground">{avgGanyan}</strong></p>
      )}

      {/* Koşu tipi özet tablosu */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30 text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Koşu Tipi</th>
              <th className="px-3 py-2 text-right font-medium">Koşu</th>
              <th className="px-3 py-2 text-right font-medium">1. Sıra</th>
              <th className="px-3 py-2 text-right font-medium">İlk 3</th>
              <th className="px-3 py-2 text-right font-medium">İlk 6</th>
              <th className="px-3 py-2 text-right font-medium">Listede Yok</th>
            </tr>
          </thead>
          <tbody>
            {ozet.map((o) => (
              <tr key={o.label} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-3 py-2 font-medium">
                  <a href={tipLink(o.label)} className={cn("underline-offset-2 hover:underline", sp.tip === o.label && "text-brand")}>
                    {o.label}
                  </a>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{o.total}</td>
                <td className="px-3 py-2 text-right tabular-nums">{o.top1} ({pct(o.top1, o.total)})</td>
                <td className="px-3 py-2 text-right tabular-nums">{o.top3} ({pct(o.top3, o.total)})</td>
                <td className="px-3 py-2 text-right tabular-nums">{o.top6} ({pct(o.top6, o.total)})</td>
                <td className="px-3 py-2 text-right tabular-nums text-[#c0392b]">{o.disinda} ({pct(o.disinda, o.total)})</td>
              </tr>
            ))}
            <tr className="border-t-2 font-semibold">
              <td className="px-3 py-2">Toplam</td>
              <td className="px-3 py-2 text-right tabular-nums">{genelToplam.total}</td>
              <td className="px-3 py-2 text-right tabular-nums">{genelToplam.top1} ({pct(genelToplam.top1, genelToplam.total)})</td>
              <td className="px-3 py-2 text-right tabular-nums">{genelToplam.top3} ({pct(genelToplam.top3, genelToplam.total)})</td>
              <td className="px-3 py-2 text-right tabular-nums">{genelToplam.top6} ({pct(genelToplam.top6, genelToplam.total)})</td>
              <td className="px-3 py-2 text-right tabular-nums text-[#c0392b]">{genelToplam.disinda} ({pct(genelToplam.disinda, genelToplam.total)})</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Sonuç listesi — tip seçiliyse filtreli, değilse TÜMÜ (eski /admin/sonuclar davranışı) */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-semibold">
            {sp.tip ?? "Tüm koşular"} <span className="text-muted-foreground font-normal">({listeSatirlari.length} koşu)</span>
          </p>
          {sp.tip && <a href={temizleLink} className="text-xs text-muted-foreground underline">Filtreyi temizle</a>}
        </div>
        {sayfalikListe.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">Bu tipte sonuçlanmış koşu yok.</div>
        ) : (
          <div className="rounded-lg border divide-y">
            {sayfalikListe.map((r) => (
              <div key={r.resultId} className="px-3 py-2.5 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{format(r.tarih, "d MMM yy", { locale: tr })}</span>
                    <span className="font-medium text-sm whitespace-nowrap">
                      {r.hipodrom}
                      <span className="text-muted-foreground font-normal"> · {r.raceNo}. Koşu</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{r.classTypeRaw} · {r.pist} · {r.mesafe}m</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", TIER[r.tier].className)}>
                      {TIER[r.tier].label}
                    </span>
                    {r.topScoredIsWinner && (
                      <span className="hidden sm:inline-flex items-center rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs font-semibold text-yellow-600 border border-yellow-500/30">
                        En yüksek puan
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  {r.winnerNos.length > 0 && (
                    <span>
                      Kazanan: <span className="font-mono font-bold text-foreground">{r.winnerNos.map((n) => `#${n}`).join(", ")}</span>
                      {r.cikan && <span className="ml-1">{r.cikan}</span>}
                    </span>
                  )}
                  {r.winnerRank != null ? (
                    <span>Sıra: <span className="font-semibold text-foreground">{r.winnerRank}.</span></span>
                  ) : r.winnerNos.length > 0 ? (
                    <span className="text-[#c0392b]">listede yok</span>
                  ) : null}
                  {r.ganyan != null && (
                    <span>
                      Ganyan:{" "}
                      <span className={cn("font-semibold", r.ganyan < 5 ? "text-foreground" : r.ganyan < 15 ? "text-brand" : "text-[#c0392b]")}>
                        {r.ganyan.toFixed(2)}
                      </span>
                    </span>
                  )}
                  {r.errorTag && <span className="text-[#c0392b]">{r.errorTag}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {sonSayfa > 0 && (
          <div className="mt-3 flex justify-center">
            <SonuclarPaginator sayfa={sayfa} sonSayfa={sonSayfa} basePath="/admin/kosu-tipleri" extraParams={sp.tip ? { tip: sp.tip } : undefined} />
          </div>
        )}
      </div>
    </div>
  );
}
