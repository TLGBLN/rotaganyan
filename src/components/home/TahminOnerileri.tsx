import type { KuponOnerisi, KuponStatus } from "@/server/services/race.service";
import type { AltiliCityResult } from "@/server/services/ingest/tjk-altili.adapter";
import { cn } from "@/lib/utils";

type Kupon = NonNullable<KuponOnerisi>;

const STATUS_LABEL: Record<KuponStatus, string> = { hit: "Tuttu", miss: "Tutmadı", pending: "Bekliyor" };
const STATUS_CLASS: Record<KuponStatus, string> = {
  hit: "bg-hit/15 text-hit",
  miss: "bg-miss/15 text-miss",
  pending: "bg-muted text-muted-foreground",
};

function buildTweetText(data: Kupon): string {
  const visibleVariants = data.variants.filter((v) => v.status !== "miss");
  const lines: string[] = [`🏇 ${data.hippodromeName}`, ""];
  for (const variant of visibleVariants) {
    const legs = variant.legs.map((l) => l.nos.join(",")).join(" | ");
    lines.push(`${variant.label}: ${legs}`);
  }
  lines.push("", "rotaganyan.com/program");
  return lines.join("\n");
}

/** "Bursa — 2. Altılı" gibi bir hipodrom etiketinden gerçek TJK Altılı Ganyan ikramiye cümlesini bulur. */
function findIkramiye(hippodromeName: string, altiliResults: AltiliCityResult[]): string | null {
  const [cityName, altiliLabel] = hippodromeName.split(" — ");
  if (!cityName || !altiliLabel) return null;
  const slotMatch = altiliLabel.match(/^(\d+)\./);
  if (!slotMatch) return null;
  const slot = parseInt(slotMatch[1], 10);

  const city = altiliResults.find((c) => c.sehirAdi.trim().toLowerCase() === cityName.trim().toLowerCase());
  const group = city?.groups[slot - 1];
  return group?.ikramiye ?? null;
}

const GRID_COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
};

function KuponBlock({ data, ikramiye, isAdmin }: { data: Kupon; ikramiye: string | null; isAdmin: boolean }) {
  const visibleVariants = data.variants.filter((v) => v.status !== "miss");
  if (visibleVariants.length === 0) return null;

  const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(buildTweetText(data))}`;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{data.hippodromeName}</span>
        {isAdmin && (
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-muted-foreground/25 px-2.5 py-1 text-xs font-semibold hover:bg-muted transition-colors"
          >
            <span>𝕏</span>
            <span>Paylaş</span>
          </a>
        )}
      </div>
      <div className={cn("grid gap-4", GRID_COLS[visibleVariants.length] ?? "sm:grid-cols-3")}>
        {visibleVariants.map((variant) => (
          <div key={variant.key} className="flex flex-col overflow-hidden rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
              <span className="text-sm font-semibold">{variant.label}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_CLASS[variant.status])}>
                {STATUS_LABEL[variant.status]}
              </span>
            </div>

            {/* Ayak ızgarası */}
            <div className="flex-1 overflow-x-auto">
              <div
                className="grid divide-x"
                style={{ gridTemplateColumns: `repeat(${variant.legs.length}, minmax(48px, 1fr))` }}
              >
                {variant.legs.map((leg) => {
                  const missed = leg.resulted && !leg.nos.includes(leg.winnerNo as number);
                  return (
                    <div key={leg.raceNo} className="px-1.5 py-3 text-center">
                      <div className="mb-2 text-[10px] font-medium text-muted-foreground">
                        {leg.raceNo}. Koşu
                      </div>
                      <div className="space-y-1.5 text-sm font-semibold">
                        {leg.nos.map((no) => (
                          <div key={no}>
                            {no === leg.winnerNo ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-hit text-white text-xs font-bold">
                                {no}
                              </span>
                            ) : (
                              <span className={missed ? "text-muted-foreground line-through" : undefined}>{no}</span>
                            )}
                          </div>
                        ))}
                      </div>
                      {missed && (
                        <div className="mt-1.5 text-[10px] font-medium text-miss">Kazanan: {leg.winnerNo}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Kupon tutarı */}
            <div className="border-t px-4 py-3">
              <div className="text-xs text-muted-foreground">Kupon Tutarı</div>
              <div className="text-lg font-bold">
                {variant.amount.toLocaleString("tr-TR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                ₺
              </div>
              {ikramiye && <div className="mt-1.5 text-xs font-medium text-hit">{ikramiye}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type Props = { data: KuponOnerisi[]; altiliResults?: AltiliCityResult[]; isLoggedIn?: boolean; isAdmin?: boolean };

export default function TahminOnerileri({ data, altiliResults = [], isLoggedIn = false, isAdmin = false }: Props) {
  const items = data.filter((k): k is Kupon => k !== null);
  const hasVisible = items.some((k) => k.variants.some((v) => v.status !== "miss"));
  if (items.length === 0 || !hasVisible) return null;

  if (!isLoggedIn) {
    return (
      <section className="border-t px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-lg font-semibold">Kupon Önerileri</h2>
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            <span className="text-2xl">🔒</span>
            <p className="font-medium">Kupon önerilerini görmek için üye olmalısınız.</p>
            <div className="flex gap-2">
              <a href="/giris" className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground hover:bg-brand/90">
                Giriş Yap
              </a>
              <a href="/kayit" className="rounded-md border px-4 py-2 text-xs font-semibold hover:bg-muted">
                Kayıt Ol
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border-t px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <h2 className="text-lg font-semibold">Kupon Önerileri</h2>
        {items.map((kupon, i) => (
          <KuponBlock key={i} data={kupon} ikramiye={findIkramiye(kupon.hippodromeName, altiliResults)} isAdmin={isAdmin} />
        ))}
      </div>
    </section>
  );
}
