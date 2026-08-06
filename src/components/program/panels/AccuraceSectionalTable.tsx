import { cn } from "@/lib/utils";
import type { PaceCheckpoint, TekYarisStil } from "@/lib/methodology/pace-analizi";
import { fmtSaniye, checkpointCols, STIL_LABEL, STIL_RENK } from "@/lib/methodology/pace-format";

// v6.59 — İngilizce arayüz desteği: bu tablo hem admin panosunda (her zaman Türkçe
// kalır, `t` verilmez → STIL_LABEL'in Türkçe metni kullanılır) hem herkese açık
// Son800Panel'de (locale'e göre çeviri geçilir) kullanılıyor. STIL_LABEL sabit bir
// obje olduğu için (hook değil) doğrudan içeride useTranslations çağrılamıyor —
// bu yüzden çağıran taraf `t` fonksiyonunu opsiyonel prop olarak geçiyor.
const STIL_KEY: Record<TekYarisStil, "kacakAt" | "onGrupArkasi" | "beklemeGrubu" | "enGeriTakip"> = {
  KACAK_AT: "kacakAt",
  ON_GRUP_ARKASI: "onGrupArkasi",
  BEKLEME_GRUBU: "beklemeGrubu",
  EN_GERI_TAKIP: "enGeriTakip",
};

type PaceT = (key: string, values?: Record<string, string | number>) => string;

/**
 * Bir atın TEK bir yarışındaki tam sektörel (200/400/600...) checkpoint kırılımını
 * gösteren, saf sunum amaçlı (client/server ikisinde de çalışan) paylaşılan tablo —
 * hem herkese açık Accurace panelinde (Son800Panel.tsx) hem admin Accurace panosunda
 * (admin/accurace/page.tsx, hem günlük listede hem at arama sonuçlarında) kullanılır.
 */
export default function AccuraceSectionalTable({
  length, checkpoints, stil, son800Sure, fark, t,
}: {
  length: number;
  checkpoints: PaceCheckpoint[];
  stil: TekYarisStil | null;
  son800Sure?: string;
  // 2026-07-25: kullanıcı isteği — ham dereceyle değil, o yarıştaki EN İYİ (sahanın en
  // hızlı) son 800'üyle farkla okunmalı. 0=o yarışın en iyi kapanışını yakaladı,
  // pozitif=daha yavaş kapandı. Veri yoksa (sibling koşucu bulunamadıysa) undefined.
  fark?: number | null;
  /** Verilmezse admin panosu gibi Türkçe sabit metinler kullanılır. */
  t?: PaceT;
}) {
  const cols = checkpointCols(length);
  return (
    <div className="rounded-md border border-border/40 overflow-hidden">
      {(son800Sure || stil) && (
        <div className="flex flex-wrap items-center gap-2 bg-muted/20 px-1.5 py-1 text-[11px]">
          {son800Sure && (
            <span className="ml-auto font-mono font-semibold text-sky-500 tabular-nums">
              {t ? t("son800Prefix") : "Son 800:"} {son800Sure}
              {fark != null && (
                // 2026-07-25: kullanıcı tespiti — "+1.42s farkla" gibi nötr bir ifade,
                // bunun aslında OLUMSUZ bir sinyal olduğunu (yarışın en iyisinden yavaş
                // kapandığı) okuyucuya açıkça anlatmıyordu. Kelime seçimi artık kendi
                // kendini açıklıyor: "yavaş" ibaresi + kırmızı renk birlikte.
                <span className={cn("ml-1.5 font-semibold", fark <= 0 ? "text-hit" : fark <= 0.5 ? "text-muted-foreground" : "text-[#c0392b]")}>
                  {fark <= 0
                    ? (t ? t("sonBestTam") : "(yarışın en iyisi ✓)")
                    : fark <= 0.5
                      ? (t ? t("sonBestYakinFormat", { fark: fark.toFixed(2) }) : `(+${fark.toFixed(2)}s, en iyiye yakın)`)
                      : (t ? t("sonBestGerideFormat", { fark: fark.toFixed(2) }) : `(+${fark.toFixed(2)}s yavaş — yarışın en iyisinden geride)`)}
                </span>
              )}
            </span>
          )}
          {stil && (
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", STIL_RENK[stil])}>
              {t ? t(STIL_KEY[stil]) : STIL_LABEL[stil]}
            </span>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-muted-foreground">
              {cols.map((c) => (
                <th key={c} className="px-1.5 py-0.5 text-center font-medium tabular-nums">{c}m</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border/30">
              {cols.map((c) => {
                const cp = checkpoints.find((x) => x.checkpoint === c);
                return (
                  <td key={c} className="px-1.5 py-1 text-center tabular-nums">
                    {cp ? (
                      <>
                        {fmtSaniye(cp.timeReal)}
                        <span className="ml-1 text-muted-foreground">[{cp.place}]</span>
                      </>
                    ) : "—"}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
