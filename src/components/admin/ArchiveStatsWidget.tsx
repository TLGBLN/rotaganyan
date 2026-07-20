import { format } from "date-fns";
import { tr } from "date-fns/locale";

type Props = {
  gecmisYarisKaydi: number;
  koşuArsivi: number;
  arsivGunu: number;
  hipodrom: number;
  pedigriArsivi: number;
  galopKaydi: number;
  baslangicTarihi: Date | null;
};

/** "37750" -> "37.8K", "3709" -> "3.7K", "482" -> "482" — büyük sayıları kısaltır, küçükleri olduğu gibi bırakır. */
function kisalt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K+`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("tr-TR");
}

const KARTLAR: { key: keyof Omit<Props, "baslangicTarihi">; label: string }[] = [
  { key: "gecmisYarisKaydi", label: "Geçmiş Yarış Kaydı" },
  { key: "koşuArsivi", label: "Koşu Arşivi" },
  { key: "arsivGunu", label: "Arşiv Günü" },
  { key: "hipodrom", label: "Hipodrom" },
  { key: "pedigriArsivi", label: "Pedigri Arşivi" },
  { key: "galopKaydi", label: "Galop Kaydı" },
];

export default function ArchiveStatsWidget(props: Props) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Arşiv Kapsamı
        </h3>
        {props.baslangicTarihi && (
          <span className="text-[11px] text-muted-foreground">
            {format(new Date(props.baslangicTarihi), "d MMMM yyyy", { locale: tr })} beri
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {KARTLAR.map(({ key, label }) => (
          <div key={key} className="rounded-md border bg-muted/20 px-3 py-2.5 text-center">
            <div className="text-lg font-bold tabular-nums">{kisalt(props[key])}</div>
            <div className="text-[10px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground/70">
        Sitenin kendi veritabanından gerçek zamanlı sayım — tahmini/yuvarlanmış değil.
      </p>
    </div>
  );
}
