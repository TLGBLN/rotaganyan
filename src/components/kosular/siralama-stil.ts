// Sıralama sayfası (hero + liste) için paylaşılan küçük stil yardımcıları.
// Pick.details.karar'ın gerçek değerleri: Güçlü Aday / Düşük Risk / Orta Risk / Yüksek Risk.
type Renk = "emerald" | "sky" | "amber" | "rose";
const KARAR_RENK: Record<string, Renk> = {
  "Güçlü Aday": "emerald",
  "Düşük Risk": "sky",
  "Orta Risk": "amber",
  "Yüksek Risk": "rose",
};

// Tailwind sınıfları dinamik birleştirilemediği için (purge) tam metin olarak yazılı.
const KOYU: Record<Renk, string> = {
  emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/40",
  sky: "bg-sky-500/15 text-sky-300 ring-sky-400/40",
  amber: "bg-amber-500/15 text-amber-300 ring-amber-400/40",
  rose: "bg-rose-500/15 text-rose-300 ring-rose-400/40",
};
const TEMA: Record<Renk, string> = {
  emerald: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  sky: "bg-sky-500/10 text-sky-700 ring-sky-500/30 dark:text-sky-300",
  amber: "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  rose: "bg-rose-500/10 text-rose-700 ring-rose-500/30 dark:text-rose-300",
};

/** `koyuZemin`: sabit koyu zeminli kart (hero) için true; site temasını izleyen liste için false. */
export function kararStil(karar: string | null | undefined, koyuZemin = false): string {
  const renk = karar ? KARAR_RENK[karar] : undefined;
  if (!renk) return koyuZemin ? "bg-white/10 text-white/70 ring-white/20" : "bg-muted text-muted-foreground ring-border";
  return (koyuZemin ? KOYU : TEMA)[renk];
}
