import type { KuponOnerisi } from "@/server/services/race.service";

export default function TahminOnerileri({ data }: { data: KuponOnerisi }) {
  if (!data) return null;

  return (
    <section className="border-t px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tahmin Önerileri</h2>
          <span className="text-xs text-muted-foreground">{data.hippodromeName}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {data.variants.map((variant) => (
            <div key={variant.key} className="overflow-hidden rounded-lg border bg-card">
              <div className="border-b bg-muted/30 px-4 py-2.5 text-center text-sm font-semibold">
                {variant.label}
              </div>

              {/* Ayak ızgarası */}
              <div className="overflow-x-auto">
                <div
                  className="grid divide-x"
                  style={{ gridTemplateColumns: `repeat(${variant.legs.length}, minmax(48px, 1fr))` }}
                >
                  {variant.legs.map((leg) => (
                    <div key={leg.raceNo} className="px-1.5 py-3 text-center">
                      <div className="mb-2 text-[10px] font-medium text-muted-foreground">
                        {leg.raceNo}. Koşu
                      </div>
                      <div className="space-y-1.5 text-sm font-semibold">
                        {leg.nos.map((no) => (
                          <div key={no}>{no}</div>
                        ))}
                      </div>
                    </div>
                  ))}
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
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
