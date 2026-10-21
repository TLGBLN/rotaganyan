"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ProgramRaceDay, KuponOnerisi } from "@/server/services/race.service";
import type { TempoSenaryosu } from "@/lib/methodology/pace-analizi";
import { surfaceLabel, breedLabel } from "@/lib/utils";
import { KuponBlock } from "@/components/home/TahminOnerileri";
import { AnalysisPanel } from "@/components/program/ProgramView";

/** Oval pist şeması — ekrandaki referansın "pist ikonu", markaya özgü basit bir SVG
 *  (dışarıdan illüstrasyon yerine — bkz. proje kuralı: AI-jenerik görsel yerine konuya
 *  özgü, kesin bir şekil). */
function PistIkonu({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 20" className={className} fill="none" aria-hidden="true">
      <rect x="1" y="1" width="30" height="18" rx="9" stroke="currentColor" strokeWidth="2" />
      <rect x="5" y="5" width="22" height="10" rx="5" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}

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

function hasAnalysis(r: Race): boolean {
  return !!r.prediction?.published && (r.prediction.picks?.length ?? 0) > 0;
}

type Props = {
  raceDay: ProgramRaceDay;
  tempoByRaceId: Record<string, TempoSenaryosu | null>;
  kuponlar: Kupon[];
  isAdmin: boolean;
  /** 2026-09-14 — /program'daki "Rotaganyan Sıralaması" butonundan derin bağlantı:
   *  bu koşu bu raceDay'de gerçekten analiz edilmişse başlangıç sekmesi bu olur,
   *  aksi halde (undefined veya eşleşmiyorsa) eski davranışa (ilk analiz edilen koşu) düşer. */
  initialRaceNo?: number;
};

export default function SiralamaKarti({ raceDay, tempoByRaceId, kuponlar, isAdmin, initialRaceNo }: Props) {
  const analyzed = raceDay.races.filter(hasAnalysis);
  const baslangicRaceNo =
    initialRaceNo != null && analyzed.some((r) => r.raceNo === initialRaceNo)
      ? initialRaceNo
      : analyzed[0]?.raceNo ?? raceDay.races[0]?.raceNo ?? 1;
  const [activeRaceNo, setActiveRaceNo] = useState<number>(baslangicRaceNo);
  if (analyzed.length === 0) return null;

  const race = raceDay.races.find((r) => r.raceNo === activeRaceNo) ?? analyzed[0];
  const picks = race.prediction?.picks ?? [];

  // Bu hipodromun bugünkü kuponu — birden fazla aday varsa (1./2. Altılı, 7'li Ganyan)
  // seçili koşuyu KAPSAYANI tercih et, yoksa ilk eşleşen.
  const hipoKuponlari = kuponlar.filter((k) => k.hippodromeName.split(" — ")[0] === raceDay.hippodrome.name);
  const kupon =
    hipoKuponlari.find((k) => k.variants.some((v) => v.legs.some((l) => l.raceNo === activeRaceNo))) ??
    hipoKuponlari[0] ??
    null;
  return (
    <div className="space-y-4">
      {/* Marka rozeti — eski PuanTablosu.tsx'in (bu sayfanın önceki görünümü) at-ikonu +
          ROTA/GANYAN logosu, SiralamaKarti'ye geçişte kaybolmuştu (kullanıcı bulgusu,
          2026-10-20) — geri eklendi, OG paylaşım kartıyla (api/og/kupon) AYNI varlık. */}
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/horse-icon-gold.png" alt="" width={22} height={22} style={{ objectFit: "contain" }} />
        <span className="text-xs font-extrabold tracking-wide">
          <span>ROTA</span><span className="text-brand">GANYAN</span>
        </span>
      </div>

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

      {/* Koşu bilgi şeridi — şart/yaş-cins/mesafe/pist, ekrandaki referansla aynı sırada. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border bg-muted/30 px-3.5 py-2 text-xs">
        <div className="font-bold">
          {race.raceNo}. Koşu{race.time ? ` · ${race.time}` : ""}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          {race.classType && <span>Şartlı {race.classType}</span>}
          <span>{breedLabel(race.breed)}</span>
          <span>{race.distance} Metre</span>
          <span>{surfaceLabel(race.surface)} Pist</span>
          <PistIkonu className="h-4 w-6 text-brand" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <AnalysisPanel
          picks={picks}
          runners={race.runners.map((r) => ({ no: r.no, name: r.name, scratched: false, ekuriGroup: r.ekuriGroup, agf: r.agf }))}
          winnerNos={race.result?.winnerNos}
          ganyan={race.result?.ganyan}
          isLoggedIn={true}
          isAdmin={isAdmin}
          isVerified={true}
          userEmail=""
          raceNo={race.raceNo}
          hippodromeName={raceDay.hippodrome.name}
          raceId={race.id}
          autoScroll={false}
        />

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
