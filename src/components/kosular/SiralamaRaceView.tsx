"use client";

import type { ReactNode } from "react";
import type { TempoSenaryosu } from "@/lib/methodology/pace-analizi";
import { siraliPickler } from "@/lib/methodology/pick-display-order";
import { piyasaFarkiPuani, kararOku } from "@/lib/methodology/muhakeme-format";
import { agfSiraMapOlustur } from "@/lib/agf-sira";
import SiralamaListesi from "./SiralamaListesi";
import SiralamaHero from "./SiralamaHero";
import type { SiralamaRace } from "./siralama-tipleri";

// Tempo senaryosu → 5 kademeli "Yarış Gidişatı" göstergesi (0 = en yavaş, 4 = en hızlı).
const TEMPO_KADEME_INDEX: Record<string, number> = {
  RAHAT_LIDERLIK: 0,
  YAVAS_TEMPO: 1,
  DENGELI: 2,
  MUCADELELI: 3,
  COK_YUKSEK: 4,
  DAGILMA_RISKI: 4,
};

/**
 * TEK koşunun sıralama görünümü: karar hero'su (1. sıradaki at, halka, karar, yarış gidişatı) + altında
 * sıralama listesi + sağda `yan` (kupon vb.). /rotaganyansiralamasi (SiralamaKarti) VE /program'daki
 * "Analiz Yayında" paneli AYNI bileşeni kullanır — 2026-09-28 kullanıcı talebi: "sıralama sayfasındaki
 * yapı ana sayfada Analiz Yayında tıklandığında açılsın".
 */
export default function SiralamaRaceView({
  race,
  tempoSenaryosu,
  raceKey,
  yan,
}: {
  race: SiralamaRace;
  tempoSenaryosu: TempoSenaryosu | null;
  /** Hero animasyonunun (halka/tempo çubuğu) koşu değişince yeniden başlaması için. */
  raceKey: string;
  yan?: ReactNode;
}) {
  const picks = race.picks;
  const agfByNo = new Map(race.runners.map((r) => [r.no, r.agf]));
  const formByNo = new Map(race.runners.map((r) => [r.no, { recentForm: r.recentForm, recentFormSurfaces: r.recentFormSurfaces }]));
  const topPick = siraliPickler(picks)[0];
  const topModel = topPick ? topPick.scoreExact ?? topPick.score : null;
  const topAgf = topPick?.runner?.no != null ? agfByNo.get(topPick.runner.no) ?? null : null;
  // 2026-09-17: AGF sırası (1., 2., ...) liste satırlarındaki gibi hero'da da adın yanında görünür.
  const agfSiraMap = agfSiraMapOlustur(race.runners);
  const fark = topModel != null ? piyasaFarkiPuani(topModel, topAgf) : null;

  return (
    <div className="space-y-4">
      {topPick && (
        <SiralamaHero
          key={raceKey}
          no={topPick.runner?.no ?? null}
          ad={topPick.runner?.name ?? topPick.runnerLabel ?? "—"}
          agfSirasi={topPick.runner?.no != null ? agfSiraMap.get(topPick.runner.no) ?? null : null}
          modelYuzde={topModel}
          agfYuzde={topAgf}
          fark={fark}
          karar={kararOku(topPick.details)}
          jokeyAntrenor={[topPick.runner?.jockey, topPick.runner?.trainer].filter(Boolean).join(" · ")}
          form={formByNo.get(topPick.runner?.no ?? -1)}
          tempoKademe={tempoSenaryosu != null ? TEMPO_KADEME_INDEX[tempoSenaryosu] ?? null : null}
        />
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <SiralamaListesi race={race} formByNo={formByNo} />
        {yan != null && <div className="space-y-4 lg:sticky lg:top-4">{yan}</div>}
      </div>
    </div>
  );
}
