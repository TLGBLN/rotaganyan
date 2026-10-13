import {
  getPedigriMerkeziData,
  type PedigriMerkeziBreed,
  type PedigriMerkeziDistance,
  type PedigriMerkeziFilters,
  type PedigriMerkeziSurface,
  type PedigriMerkeziType,
} from "@/server/services/pedigri-merkezi.service";

function num(value: number, digits = 0): string {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function money(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toLocaleString("tr-TR")} ₺` : value;
}

function sourceLabel(value: string): string {
  if (value === "SIRE") return "Baba / Sire";
  if (value === "DAM") return "Anne / Dam";
  return "Anne Babası / DamSire";
}

function surfaceLabel(value: string): string {
  if (value === "CIM") return "Çim";
  if (value === "KUM") return "Kum";
  if (value === "SENTETIK") return "Sentetik";
  return value;
}

function SummaryCard({
  title,
  total,
  sire,
  dam,
  damSire,
  note,
}: {
  title: string;
  total: number;
  sire: number;
  dam: number;
  damSire: number;
  note: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <p className="mt-1 text-3xl font-black">{total.toLocaleString("tr-TR")}</p>
      <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-muted-foreground">Sire</p>
          <p className="font-bold">{sire.toLocaleString("tr-TR")}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Dam</p>
          <p className="font-bold">{dam.toLocaleString("tr-TR")}</p>
        </div>
        <div>
          <p className="text-muted-foreground">DamSire</p>
          <p className="font-bold">{damSire.toLocaleString("tr-TR")}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{note}</p>
    </div>
  );
}

export type PedigriMerkeziSearchParams = {
  pedBreed?: string;
  pedQ?: string;
  pedType?: string;
  pedSurface?: string;
  pedDistance?: string;
};

function parseBreed(value?: string): PedigriMerkeziBreed {
  return value === "ARAP" ? "ARAP" : "INGILIZ";
}

function parseType(value?: string): PedigriMerkeziType {
  return value === "SIRE" || value === "DAM" || value === "DAMSIRE" ? value : "ALL";
}

function parseSurface(value?: string): PedigriMerkeziSurface {
  return value === "CIM" || value === "KUM" || value === "SENTETIK" ? value : "ALL";
}

function parseDistance(value?: string): PedigriMerkeziDistance {
  return value === "800-1400" || value === "1500-2000" || value === "2100-3200" ? value : "ALL";
}

export default async function PedigriMerkeziPanel({
  searchParams,
  currentDate,
}: {
  searchParams: PedigriMerkeziSearchParams;
  currentDate: string;
}) {
  const filters: PedigriMerkeziFilters = {
    breed: parseBreed(searchParams.pedBreed),
    q: (searchParams.pedQ ?? "").trim(),
    sourceType: parseType(searchParams.pedType),
    surface: parseSurface(searchParams.pedSurface),
    distanceBand: parseDistance(searchParams.pedDistance),
  };

  const data = await getPedigriMerkeziData(filters);

  return (
    <section className="space-y-5 rounded-xl border bg-muted/10 p-4 md:p-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">ROTAGANYAN</p>
        <h1 className="mt-1 text-2xl font-black">Pedigri Merkezi</h1>
        <p className="mt-2 max-w-5xl text-xs leading-relaxed text-muted-foreground">
          Rotaganyan Own verisi yarış sonuçlarından üretilir. External pedigree ayrı bir referans katmanıdır;
          Own tablolarını ezmez. Mevcut V5 skorunda Own Sire sinyali kullanılır. Dam, DamSire ve External
          Sire/Dam/DamSire bu ekranda destek/audit verisi olarak gösterilir ve mevcut skoru değiştirmez.
          Genel Not yalnız manuel kayıt/gösterim alanıdır; güncel V5 motoruna otomatik olarak girmez.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <SummaryCard
          title={`${filters.breed === "INGILIZ" ? "İngiliz" : "Arap"} External`}
          total={data.externalCounts.total}
          sire={data.externalCounts.sire}
          dam={data.externalCounts.dam}
          damSire={data.externalCounts.damSire}
          note="2026 dış referans snapshot. SIRE / DAM / DAMSIRE ayrı tutulur."
        />
        <SummaryCard
          title={`${filters.breed === "INGILIZ" ? "İngiliz" : "Arap"} Rotaganyan Own`}
          total={data.ownCounts.total}
          sire={data.ownCounts.sire}
          dam={data.ownCounts.dam}
          damSire={data.ownCounts.damSire}
          note="Sonuçlanmış Runner + Result kayıtlarından otomatik hesaplanır."
        />
      </div>

      {!data.externalAvailable ? (
        <div className="rounded-lg border border-miss/30 bg-miss/5 p-3 text-xs text-miss">
          External pedigree tablosu okunamadı. Own veriler çalışmaya devam eder.
          {data.externalError ? <span className="ml-1 font-mono">{data.externalError}</span> : null}
        </div>
      ) : null}

      {filters.breed === "ARAP" && data.externalCounts.total === 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Arap external verisi henüz yüklenmedi. Veri geldiğinde aynı tablo ve filtreler otomatik çalışacak;
          yeni bir sayfa gerekmeyecek.
        </div>
      ) : null}

      <form method="get" className="grid gap-2 lg:grid-cols-6">
        <input type="hidden" name="tarih" value={currentDate} />

        <select
          name="pedBreed"
          defaultValue={filters.breed}
          className="rounded-md border bg-background px-2 py-2 text-xs"
        >
          <option value="INGILIZ">İngiliz</option>
          <option value="ARAP">Arap</option>
        </select>

        <input
          name="pedQ"
          defaultValue={filters.q}
          placeholder="Aygır / kısrak / damsire ara"
          className="rounded-md border bg-background px-3 py-2 text-xs lg:col-span-2"
        />

        <select
          name="pedType"
          defaultValue={filters.sourceType}
          className="rounded-md border bg-background px-2 py-2 text-xs"
        >
          <option value="ALL">Sire + Dam + DamSire</option>
          <option value="SIRE">Sire</option>
          <option value="DAM">Dam</option>
          <option value="DAMSIRE">DamSire</option>
        </select>

        <select
          name="pedSurface"
          defaultValue={filters.surface}
          className="rounded-md border bg-background px-2 py-2 text-xs"
        >
          <option value="ALL">Tüm pistler</option>
          <option value="CIM">Çim</option>
          <option value="KUM">Kum</option>
          <option value="SENTETIK">Sentetik</option>
        </select>

        <div className="flex gap-2">
          <select
            name="pedDistance"
            defaultValue={filters.distanceBand}
            className="min-w-0 flex-1 rounded-md border bg-background px-2 py-2 text-xs"
          >
            <option value="ALL">Tüm mesafeler</option>
            <option value="800-1400">800-1400</option>
            <option value="1500-2000">1500-2000</option>
            <option value="2100-3200">2100-3200</option>
          </select>
          <button type="submit" className="rounded-md bg-brand px-3 py-2 text-xs font-bold text-brand-foreground">
            Ara
          </button>
        </div>
      </form>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black">External referans</h2>
          <span className="text-[11px] text-muted-foreground">
            {data.externalRows.length} kayıt gösteriliyor / {data.externalCounts.total.toLocaleString("tr-TR")} toplam
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-background">
          <table className="w-full min-w-[980px] text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Tür</th>
                <th className="px-3 py-2 text-left">İsim</th>
                <th className="px-3 py-2 text-left">Pist</th>
                <th className="px-3 py-2 text-left">Mesafe</th>
                <th className="px-3 py-2 text-right">Start</th>
                <th className="px-3 py-2 text-right">1.</th>
                <th className="px-3 py-2 text-right">K%</th>
                <th className="px-3 py-2 text-right">2.</th>
                <th className="px-3 py-2 text-right">3.</th>
                <th className="px-3 py-2 text-right">AEI</th>
                <th className="px-3 py-2 text-right">Kazanç</th>
                <th className="px-3 py-2 text-left">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.externalRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-6 text-center text-muted-foreground">
                    Bu filtrelerde external kayıt yok.
                  </td>
                </tr>
              ) : (
                data.externalRows.map((row, index) => (
                  <tr key={`${row.sourceType}-${row.entityName}-${row.surface}-${row.distanceBand}-${index}`}>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold">{sourceLabel(row.sourceType)}</td>
                    <td className="min-w-[180px] px-3 py-2">
                      <div className="font-bold">{row.entityName}</div>
                      {row.damSireName ? (
                        <div className="text-[10px] text-muted-foreground">DamSire: {row.damSireName}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{surfaceLabel(row.surface)}</td>
                    <td className="px-3 py-2">{row.distanceBand}</td>
                    <td className="px-3 py-2 text-right">{num(row.starts)}</td>
                    <td className="px-3 py-2 text-right">{num(row.wins)}</td>
                    <td className="px-3 py-2 text-right font-bold">%{num(row.winRatePct)}</td>
                    <td className="px-3 py-2 text-right">{num(row.seconds)}</td>
                    <td className="px-3 py-2 text-right">{num(row.thirds)}</td>
                    <td className="px-3 py-2 text-right">{row.aei == null ? "—" : num(row.aei, 2)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{money(row.earningsTRY)}</td>
                    <td className="px-3 py-2">
                      <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
                        Destek / audit
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black">Rotaganyan Own</h2>
          <span className="text-[11px] text-muted-foreground">
            {data.ownRows.length} kayıt gösteriliyor / {data.ownCounts.total.toLocaleString("tr-TR")} toplam
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-background">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Tür</th>
                <th className="px-3 py-2 text-left">İsim</th>
                <th className="px-3 py-2 text-left">Pist</th>
                <th className="px-3 py-2 text-left">Mesafe</th>
                <th className="px-3 py-2 text-right">Start</th>
                <th className="px-3 py-2 text-right">1.</th>
                <th className="px-3 py-2 text-right">K%</th>
                <th className="px-3 py-2 text-right">2.</th>
                <th className="px-3 py-2 text-right">3.</th>
                <th className="px-3 py-2 text-right">Yavru/Torun</th>
                <th className="px-3 py-2 text-left">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.ownRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-muted-foreground">
                    Bu filtrelerde Own kayıt yok.
                  </td>
                </tr>
              ) : (
                data.ownRows.map((row, index) => (
                  <tr key={`${row.sourceType}-${row.entityName}-${row.surface}-${row.distanceBand}-${index}`}>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold">{sourceLabel(row.sourceType)}</td>
                    <td className="min-w-[180px] px-3 py-2">
                      <div className="font-bold">{row.entityName}</div>
                      {row.relatedName ? (
                        <div className="text-[10px] text-muted-foreground">DamSire: {row.relatedName}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{row.surface}</td>
                    <td className="px-3 py-2">{row.distanceBand}</td>
                    <td className="px-3 py-2 text-right">{num(row.starts)}</td>
                    <td className="px-3 py-2 text-right">{num(row.wins)}</td>
                    <td className="px-3 py-2 text-right font-bold">%{num(row.winRatePct)}</td>
                    <td className="px-3 py-2 text-right">{num(row.seconds)}</td>
                    <td className="px-3 py-2 text-right">{num(row.thirds)}</td>
                    <td className="px-3 py-2 text-right">
                      {row.sourceType === "SIRE"
                        ? "—"
                        : `${num(row.winningOffspringCount)}/${num(row.offspringCount)}`}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          row.sourceType === "SIRE"
                            ? "whitespace-nowrap rounded-full bg-hit/15 px-2 py-1 text-[10px] font-bold text-hit"
                            : "whitespace-nowrap rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground"
                        }
                      >
                        {row.sourceType === "SIRE" ? "V5 Sire sinyali" : "Destek"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
