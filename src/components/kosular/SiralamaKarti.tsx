"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ProgramRaceDay, KuponOnerisi } from "@/server/services/race.service";
import type { TempoSenaryosu } from "@/lib/methodology/pace-analizi";
import { siraliPickler } from "@/lib/methodology/pick-display-order";
import { puanYuzdesiMetni, piyasaFarkiPuani } from "@/lib/methodology/muhakeme-format";
import { KuponBlock } from "@/components/home/TahminOnerileri";
import SiralamaListesi from "./SiralamaListesi";

type Race = ProgramRaceDay["races"][number];
type Kupon = NonNullable<KuponOnerisi>;

// 2026-09-14 — Koşu sekmesi pist renkleri: ProgramView.tsx'teki SURFACE_TAB_BG ile
// AYNI kaynaktan (TJK'nın kendi Son 6 Yarış font-renkleri, bkz. proje hafızası
// "TJK Pist Renkleri") — o dosyanın büyüklüğü/karmaşıklığı yüzünden export edip
// import etmek yerine burada da (KuponForm.tsx'teki ALTILI_STAKE_PER_COMBINATION
// gibi) küçük, kararlı bir sabit olarak kopyalandı.
const SURFACE_TAB_BG: Record<string, string> = {
  CIM: "bg-[#009900] hover:bg-[#00b300] text-white",
  KUM: "bg-[#996633] hover:bg-[#a8754a] text-white",
  SENTETIK: "bg-[#D39B1E] hover:bg-[#e0ab3a] text-white",
};

const TEMPO_LABEL: Record<string, string> = {
  RAHAT_LIDERLIK: "Çok Yavaş",
  YAVAS_TEMPO: "Yavaş",
  DENGELI: "Dengeli",
  MUCADELELI: "Hızlı",
  COK_YUKSEK: "Çok Hızlı",
  DAGILMA_RISKI: "Çok Hızlı",
};
// Prediction.confidence (koşu-bazlı, at-bazlı DEĞİL) — CouponBox.tsx'teki AYNI
// etiket eşlemesinin küçük bir kopyası (o dosyaya export eklemek yerine).
const GUVEN_LABEL: Record<string, string> = { DUSUK: "Düşük", ORTA: "Orta", YUKSEK: "Yüksek" };

function hasAnalysis(r: Race): boolean {
  return !!r.prediction?.published && (r.prediction.picks?.length ?? 0) > 0;
}

type Props = {
  raceDay: ProgramRaceDay;
  tempoByRaceId: Record<string, TempoSenaryosu | null>;
  kuponlar: Kupon[];
  isAdmin: boolean;
};

export default function SiralamaKarti({ raceDay, tempoByRaceId, kuponlar, isAdmin }: Props) {
  const analyzed = raceDay.races.filter(hasAnalysis);
  const [activeRaceNo, setActiveRaceNo] = useState<number>(analyzed[0]?.raceNo ?? raceDay.races[0]?.raceNo ?? 1);
  if (analyzed.length === 0) return null;

  const race = raceDay.races.find((r) => r.raceNo === activeRaceNo) ?? analyzed[0];
  const picks = race.prediction?.picks ?? [];
  const agfByNo = new Map(race.runners.map((r) => [r.no, r.agf]));
  const topPick = siraliPickler(picks)[0];
  const topModel = topPick ? topPick.scoreExact ?? topPick.score : null;
  const topAgf = topPick?.runner?.no != null ? agfByNo.get(topPick.runner.no) ?? null : null;
  const fark = topModel != null ? piyasaFarkiPuani(topModel, topAgf) : null;
  const tempo = tempoByRaceId[race.id] ?? null;

  // Bu hipodromun bugünkü kuponu — birden fazla aday varsa (1./2. Altılı, 7'li Ganyan)
  // seçili koşuyu KAPSAYANI tercih et, yoksa ilk eşleşen.
  const hipoKuponlari = kuponlar.filter((k) => k.hippodromeName.split(" — ")[0] === raceDay.hippodrome.name);
  const kupon =
    hipoKuponlari.find((k) => k.variants.some((v) => v.legs.some((l) => l.raceNo === activeRaceNo))) ??
    hipoKuponlari[0] ??
    null;
  const kuponVaryant = kupon?.variants.find((v) => v.filled && v.key === "normal") ?? kupon?.variants.find((v) => v.filled);

  return (
    <div className="space-y-4">
      {/* Koşu sekmesi şeridi */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {raceDay.races.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setActiveRaceNo(r.raceNo)}
            className={cn(
              "relative shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition-all",
              SURFACE_TAB_BG[r.surface] ?? "bg-muted text-muted-foreground",
              activeRaceNo === r.raceNo ? "ring-2 ring-inset ring-white shadow-inner" : "opacity-70 hover:opacity-100"
            )}
          >
            {r.raceNo}
            {hasAnalysis(r) && (
              <span className="absolute top-1 right-0.5 h-1.5 w-1.5 rounded-full bg-[#27ae60] ring-1 ring-white" />
            )}
          </button>
        ))}
      </div>

      {/* Karar hero'su */}
      {topPick && (
        <div className="rounded-2xl bg-gradient-to-br from-foreground to-foreground/80 px-5 py-4 text-background shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-lg font-extrabold text-brand-foreground">
                {topPick.runner?.no ?? "—"}
              </span>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">{topPick.runner?.name ?? topPick.runnerLabel ?? "—"}</span>
                  <span className="text-xl font-extrabold text-brand">
                    %{puanYuzdesiMetni(topPick.score, topPick.scoreExact) ?? "—"}
                  </span>
                </div>
                {topAgf != null && (
                  <div className="text-xs opacity-75">AGF %{topAgf.toFixed(1)} — piyasa {fark != null && fark > 0 ? "henüz fiyatlamıyor" : "farklı görüyor"}</div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              {fark != null && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide opacity-60">Piyasa Farkı</div>
                  <div className={cn("font-bold", fark >= 0 ? "text-hit" : "text-miss")}>{fark >= 0 ? "+" : ""}{fark.toFixed(1)} puan</div>
                </div>
              )}
              {race.prediction?.confidence && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide opacity-60">Banko Güveni</div>
                  <div className="font-bold">{GUVEN_LABEL[race.prediction.confidence] ?? race.prediction.confidence}</div>
                </div>
              )}
              {tempo && TEMPO_LABEL[tempo] && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide opacity-60">Yarış Gidişatı</div>
                  <div className="font-bold">{TEMPO_LABEL[tempo]}</div>
                </div>
              )}
            </div>

            {kuponVaryant && (
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide opacity-60">Kupon · {kuponVaryant.label}</div>
                <div className="font-mono text-sm font-semibold">
                  {kuponVaryant.legs.map((l) => l.nos.join("-")).join(" / ")}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <SiralamaListesi race={race} agfByNo={agfByNo} />

        <div className="space-y-4 lg:sticky lg:top-4">
          {kupon ? (
            <KuponBlock data={kupon} ikramiye={kupon.ikramiye} isAdmin={isAdmin} cityLabel="Kupon Önerisi" />
          ) : (
            <div className="rounded-2xl border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
              Bu hipodrom için kupon önerisi henüz yayınlanmadı.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
