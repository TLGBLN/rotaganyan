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

function KuponBlock({ data, ikramiye }: { data: Kupon; ikramiye: string | null }) {
  return (
    <div>
      <div className="mb-3 text-sm font-medium text-muted-foreground">{data.hippodromeName}</div>
      <div className="grid gap-4 sm:grid-cols-3">
        {data.variants.map((variant) => (
          <div key={variant.key} className="overflow-hidden rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
              <span className="text-sm font-semibold">{variant.label}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_CLASS[variant.status])}>
                {STATUS_LABEL[variant.status]}
              </span>
            </div>

            {/* Ayak ızgarası */}
            <div className="overflow-x-auto">
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
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-hit text-hit">
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

type Props = { data: KuponOnerisi[]; altiliResults?: AltiliCityResult[] };

export default function TahminOnerileri({ data, altiliResults = [] }: Props) {
  const items = data.filter((k): k is Kupon => k !== null);
  if (items.length === 0) return null;

  return (
    <section className="border-t px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <h2 className="text-lg font-semibold">Kupon Önerileri</h2>
        {items.map((kupon, i) => (
          <KuponBlock key={i} data={kupon} ikramiye={findIkramiye(kupon.hippodromeName, altiliResults)} />
        ))}
      </div>
    </section>
  );
}
