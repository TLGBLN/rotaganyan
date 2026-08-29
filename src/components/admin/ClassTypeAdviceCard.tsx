import { cn } from "@/lib/utils";
import type { ClassTypeAdvice } from "@/server/services/admin.service";

const LEVEL_LABEL: Record<ClassTypeAdvice["level"], string> = {
  warn: "⚠ Dikkat",
  good: "✓ Güçlü Geçmiş",
  info: "ℹ Bilgi",
  none: "Geçmiş Veri",
};

// 2026-08-30 kullanıcı talebi ("tam bir kılavuz olarak ver, verimli hale getir") —
// admin/kupon'daki koşu tablosunda bu kart öncesinde yalnız advice.text (ham istatistik
// cümlesi) gösteriliyordu, asıl TAVSİYE (oneri) hiç görünmüyordu ve her şey dar bir
// tablo hücresine sıkışıp yatay kaydırmaya zorluyordu (metin görünürde kesik duruyordu).
// Şimdi: oneri kalın başlık olarak öne çıkıyor, Eko/Nor/Geniş dağılımı bir orantı
// çubuğuyla GÖRSEL olarak gösteriliyor (tierYuzdeler varsa), ham metin küçük/soluk alt not.
function TierCubugu({ t }: { t: NonNullable<ClassTypeAdvice["tierYuzdeler"]> }) {
  if (t.toplam === 0) return null;
  const pct = (n: number) => (n / t.toplam) * 100;
  const segments = [
    { pay: pct(t.eko), cls: "bg-hit", etiket: "Eko", yuzde: pct(t.eko) },
    { pay: pct(t.nor), cls: "bg-brand", etiket: "Nor", yuzde: pct(t.nor) },
    { pay: pct(t.genis), cls: "bg-amber-500", etiket: "Gen", yuzde: pct(t.genis) },
    { pay: pct(t.kacti), cls: "bg-miss", etiket: "Kaçtı", yuzde: pct(t.kacti) },
  ].filter((s) => s.pay > 0.5);

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Ekonomik/Normal/Geniş dağılımı">
        {segments.map((s, i) => (
          <div key={i} className={s.cls} style={{ width: `${s.pay}%` }} title={`${s.etiket} %${s.yuzde.toFixed(0)}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground">
        {segments.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <span className={cn("inline-block h-1.5 w-1.5 rounded-full", s.cls)} />
            {s.etiket} %{s.yuzde.toFixed(0)}
          </span>
        ))}
        <span className="text-muted-foreground/60">({t.toplam} koşu)</span>
      </div>
    </div>
  );
}

export default function ClassTypeAdviceCard({
  advice,
  classType,
  compact = false,
}: {
  advice: ClassTypeAdvice;
  classType: string;
  /** admin/kupon'daki tablo satırı gibi dar yerlerde — kenarlık/arka plan yerine yalnız
   *  metin, tablonun kendi zebra-şeridiyle karışsın diye. */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "max-w-[340px] text-xs",
        !compact && [
          "rounded-lg border p-3",
          advice.level === "warn" && "border-miss/30 bg-miss/10 text-miss",
          advice.level === "info" && "border-brand/30 bg-brand/10 text-brand",
          advice.level === "good" && "border-hit/30 bg-hit/10 text-hit",
          advice.level === "none" && "border-dashed text-muted-foreground",
        ]
      )}
    >
      {!compact && (
        <p className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide">
          <span>{LEVEL_LABEL[advice.level]}</span>
          <span className="font-normal text-muted-foreground">{classType}</span>
        </p>
      )}
      {advice.oneri && (
        <p
          className={cn(
            "font-semibold leading-snug",
            compact &&
              (advice.level === "warn"
                ? "text-miss"
                : advice.level === "good"
                  ? "text-hit"
                  : advice.level === "info"
                    ? "text-brand"
                    : "text-foreground")
          )}
        >
          {compact ? "→ " : ""}
          {advice.oneri}
        </p>
      )}
      {advice.tierYuzdeler && <TierCubugu t={advice.tierYuzdeler} />}
      <p className={cn("leading-snug", advice.oneri ? "mt-1 text-[10px] opacity-75" : "text-[11px]")}>{advice.text}</p>
    </div>
  );
}
