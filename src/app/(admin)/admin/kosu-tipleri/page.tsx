import { db } from "@/lib/db";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { GUNCEL_MOTOR_BASLANGIC } from "@/server/services/admin.service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// 2026-10-31 kullanıcı talebi ("Toplam 1266 sonuçlanmış tahmin. bir sayfa oluştur adminde
// bu koşuları tiplerine göre ayır") — dashboard'daki "1266 sonuçlanmış" sayısı tam olarak
// getAnalystStats(undefined, true).overall.total ile doğrulandı (güncel motor dönemi,
// published+sonuçlanmış). Bu sayfa AYNI popülasyonu (aynı where koşulu) TEK bir sorguyla
// çekip hem özet tabloyu HEM de filtrelenebilir koşu listesini ondan türetir — iki farklı
// sorgu kullanılsaydı sayılar arasında uyuşmazlık riski olurdu.
//
// 2026-10-31 kullanıcı düzeltmesi (2. tur): kendi normalize ettiğim/kısalttığım kategoriler
// ("Handikap 16" gibi) İSTENMEDİ — "yarış programlarında yazan koşu tiplerine göre ayır"
// dedi, ekran görüntüsüyle (ör. "Handikap 16/Dişi /H1") doğruladı. Artık HİÇBİR normalize/
// gruplama yok — race.classType ham hâliyle (DB'de ve programda aynen nasıl duruyorsa) tek
// başına ayrım anahtarı. Bu yüzden her koşu KENDİ tam tipine göre sayılır, hiçbir satır
// "Diğer"e düşmez (ham değerin kendisi zaten bir satır).

type Tier = "rank1" | "rank2_3" | "rank4_6" | "miss";

const TIER: Record<Tier, { label: string; className: string }> = {
  rank1: { label: "1. Sıra", className: "bg-[#27ae60]/15 text-[#27ae60] border border-[#27ae60]/30" },
  rank2_3: { label: "2-3. Sıra", className: "bg-[#2980b9]/15 text-[#2980b9] border border-[#2980b9]/30" },
  rank4_6: { label: "4-6. Sıra", className: "bg-brand/15 text-brand border border-brand/30" },
  miss: { label: "6. Dışında/Yok", className: "bg-[#c0392b]/15 text-[#c0392b] border border-[#c0392b]/30" },
};

const SURFACE_LABEL: Record<string, string> = { CIM: "Çim", KUM: "Kum", SENTETIK: "Sentetik" };

function getTier(winnerNos: number[], picks: { rank: number; runnerNo: number | null }[]): Tier {
  const matched = picks
    .filter((p) => p.runnerNo != null && winnerNos.includes(p.runnerNo))
    .sort((a, b) => a.rank - b.rank)[0];
  if (!matched) return "miss";
  if (matched.rank === 1) return "rank1";
  if (matched.rank <= 3) return "rank2_3";
  if (matched.rank <= 6) return "rank4_6";
  return "miss";
}

async function getVeri() {
  const rows = await db.prediction.findMany({
    where: {
      published: true,
      createdAt: { gte: GUNCEL_MOTOR_BASLANGIC },
      race: { result: { isNot: null }, conditions: null },
    },
    select: {
      id: true,
      picks: { select: { rank: true, runner: { select: { no: true } } } },
      race: {
        select: {
          id: true,
          raceNo: true,
          classType: true,
          distance: true,
          surface: true,
          raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
          result: { select: { winnerNos: true, ganyan: true } },
        },
      },
    },
    orderBy: { race: { raceDay: { date: "desc" } } },
  });

  return rows.map((p) => {
    const winnerNos = p.race.result?.winnerNos ?? [];
    const picks = p.picks.map((pk) => ({ rank: pk.rank, runnerNo: pk.runner?.no ?? null }));
    const tier = getTier(winnerNos, picks);
    return {
      predictionId: p.id,
      raceId: p.race.id,
      tarih: p.race.raceDay.date,
      hipodrom: p.race.raceDay.hippodrome.name,
      raceNo: p.race.raceNo,
      tip: p.race.classType,
      mesafe: p.race.distance,
      pist: SURFACE_LABEL[p.race.surface] ?? p.race.surface,
      ganyan: p.race.result?.ganyan ?? null,
      winnerNos,
      tier,
    };
  });
}

type Satir = Awaited<ReturnType<typeof getVeri>>[number];

type Ozet = { label: string; total: number; top1: number; top3: number; top6: number; disinda: number };

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
  return [...map.values()].sort((a, b) => b.total - a.total);
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

  const filtreliSatirlar = sp.tip ? rows.filter((r) => r.tip === sp.tip) : [];
  const sayfa = Math.max(0, parseInt(sp.sayfa ?? "0", 10) || 0);
  const skip = sayfa * SAYFA_BOYU;
  const sayfalikListe = filtreliSatirlar.slice(skip, skip + SAYFA_BOYU);
  const sonSayfa = Math.max(0, Math.ceil(filtreliSatirlar.length / SAYFA_BOYU) - 1);

  const temizleLink = "/admin/kosu-tipleri";
  const tipLink = (t: string) => `/admin/kosu-tipleri?tip=${encodeURIComponent(t)}`;

  const toplam = {
    total: rows.length,
    top1: ozet.reduce((s, o) => s + o.top1, 0),
    top3: ozet.reduce((s, o) => s + o.top3, 0),
    top6: ozet.reduce((s, o) => s + o.top6, 0),
    disinda: ozet.reduce((s, o) => s + o.disinda, 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold">Koşu Tiplerine Göre Performans</h1>
          <p className="text-xs text-muted-foreground">
            Güncel motor dönemi, yayınlanmış + sonuçlanmış {rows.length} tahmin — yarış
            programında yazdığı HAM haliyle koşu tipine göre ayrılmış isabet dağılımı.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30 text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Koşu Tipi</th>
              <th className="px-3 py-2 text-right font-medium">Koşu</th>
              <th className="px-3 py-2 text-right font-medium">1. Sıra</th>
              <th className="px-3 py-2 text-right font-medium">İlk 3</th>
              <th className="px-3 py-2 text-right font-medium">İlk 6</th>
              <th className="px-3 py-2 text-right font-medium">6. Dışında/Yok</th>
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
              <td className="px-3 py-2 text-right tabular-nums">{toplam.total}</td>
              <td className="px-3 py-2 text-right tabular-nums">{toplam.top1} ({pct(toplam.top1, toplam.total)})</td>
              <td className="px-3 py-2 text-right tabular-nums">{toplam.top3} ({pct(toplam.top3, toplam.total)})</td>
              <td className="px-3 py-2 text-right tabular-nums">{toplam.top6} ({pct(toplam.top6, toplam.total)})</td>
              <td className="px-3 py-2 text-right tabular-nums text-[#c0392b]">{toplam.disinda} ({pct(toplam.disinda, toplam.total)})</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Filtrelenmiş koşu listesi */}
      {sp.tip && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-semibold">
              {sp.tip} <span className="text-muted-foreground font-normal">({filtreliSatirlar.length} koşu)</span>
            </p>
            <a href={temizleLink} className="text-xs text-muted-foreground underline">Filtreyi temizle</a>
          </div>
          {filtreliSatirlar.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              Bu tipte sonuçlanmış koşu yok.
            </div>
          ) : (
            <div className="rounded-lg border divide-y">
              {sayfalikListe.map((r) => (
                <div key={r.predictionId} className="px-3 py-2.5 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(r.tarih, "d MMM yy", { locale: tr })}
                      </span>
                      <span className="font-medium text-sm whitespace-nowrap">
                        {r.hipodrom}
                        <span className="text-muted-foreground font-normal"> · {r.raceNo}. Koşu</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{r.pist} · {r.mesafe}m</span>
                    </div>
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold shrink-0", TIER[r.tier].className)}>
                      {TIER[r.tier].label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {r.winnerNos.length > 0 && (
                      <span>
                        Kazanan: <span className="font-mono font-bold text-foreground">{r.winnerNos.map((n) => `#${n}`).join(", ")}</span>
                      </span>
                    )}
                    {r.ganyan != null && (
                      <span>
                        Ganyan:{" "}
                        <span className={cn("font-semibold", r.ganyan < 5 ? "text-foreground" : r.ganyan < 15 ? "text-brand" : "text-[#c0392b]")}>
                          {r.ganyan.toFixed(2)}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {sonSayfa > 0 && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs">
              {sayfa > 0 && (
                <a className="rounded-md border px-2.5 py-1 hover:bg-muted" href={`?${new URLSearchParams({ ...sp, sayfa: String(sayfa - 1) }).toString()}`}>
                  ← Önceki
                </a>
              )}
              <span className="text-muted-foreground">Sayfa {sayfa + 1} / {sonSayfa + 1}</span>
              {sayfa < sonSayfa && (
                <a className="rounded-md border px-2.5 py-1 hover:bg-muted" href={`?${new URLSearchParams({ ...sp, sayfa: String(sayfa + 1) }).toString()}`}>
                  Sonraki →
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
