"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ProgramRaceDay, KuponOnerisi } from "@/server/services/race.service";
import type { TempoSenaryosu } from "@/lib/methodology/pace-analizi";
import { Trophy } from "lucide-react";
import { siraliPickler } from "@/lib/methodology/pick-display-order";
import { puanYuzdesiMetni, piyasaFarkiPuani } from "@/lib/methodology/muhakeme-format";
import { surfaceLabel, breedLabel } from "@/lib/utils";
import { KuponBlock } from "@/components/home/TahminOnerileri";
import SiralamaListesi, { Son5Yaris } from "./SiralamaListesi";

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

const TEMPO_LABEL: Record<string, string> = {
  RAHAT_LIDERLIK: "Çok Yavaş",
  YAVAS_TEMPO: "Yavaş",
  DENGELI: "Dengeli",
  MUCADELELI: "Hızlı",
  COK_YUKSEK: "Çok Hızlı",
  DAGILMA_RISKI: "Çok Hızlı",
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
  const agfByNo = new Map(race.runners.map((r) => [r.no, r.agf]));
  const formByNo = new Map(race.runners.map((r) => [r.no, { recentForm: r.recentForm, recentFormSurfaces: r.recentFormSurfaces }]));
  const topPick = siraliPickler(picks)[0];
  const topModel = topPick ? topPick.scoreExact ?? topPick.score : null;
  const topAgf = topPick?.runner?.no != null ? agfByNo.get(topPick.runner.no) ?? null : null;
  const fark = topModel != null ? piyasaFarkiPuani(topModel, topAgf) : null;
  // 2026-10-19 kullanıcı talebi: "1. sıradaki at bu şekilde belirtilmesin, mütevazı
  // görünüm istiyorum diğer atlar gibi" — taçlı AGF-sırası rozeti KALDIRILDI. Gerçek
  // kazanan ise (sonuç varsa) TERSİNE belirginleştirilir (Trophy rozeti).
  const topIsWinner = topPick?.runner?.no != null && (race.result?.winnerNos ?? []).includes(topPick.runner.no);
  const tempo = tempoByRaceId[race.id] ?? null;

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

      {/* Karar hero'su — 2026-09-14 kullanıcı bulgusu (mobil): eskiden tek satırlık
          flex-wrap, dar ekranda at adı/piyasa farkı/kupon bloklarını üst üste garip
          kırıyordu. Artık <640px'te DİKEY istiflenen, kupon ayaklarının ayrı ayrı
          "chip" olarak sarıldığı (tek uzun "/" dizesi yerine) bir düzen; sm+'ta eski
          yatay tek satır geri geliyor. */}
      {/* 2026-09-14 kullanıcı talebi: eskiden "from-foreground to-foreground/80" —
          aynı rengin saydamlığı farklı olduğu için gözle neredeyse fark edilmiyordu.
          Artık sitenin KENDİ marka rengine (brand, kehribar) doğru gerçek bir renk
          geçişi var — jenerik mor/mavi gradyan değil. */}
      {topPick && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-foreground to-foreground/85 px-4 py-4 text-background shadow-sm sm:px-5">
          <div className="relative flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              {/* Model sırası — diğer atlarla TUTARLI, mütevazu bir rozet (kullanıcı
                  talebi: "1. sıradaki at diğer atlar gibi, mütevazı görünsün"). */}
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background/20 text-sm font-bold">
                1.
              </span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background/20 text-lg font-extrabold">
                {topPick.runner?.no ?? "—"}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span className="truncate text-lg font-bold sm:text-xl">{topPick.runner?.name ?? topPick.runnerLabel ?? "—"}</span>
                  {/* Gerçek kazanan (sonuç varsa) — AGF/model favorisinden FARKLI bir
                      bilgi, kullanıcı talebiyle BELİRGİNLEŞTİRİLDİ. */}
                  {topIsWinner && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-foreground">
                      <Trophy className="h-3 w-3" /> Kazanan
                    </span>
                  )}
                </div>
                {topAgf != null && (
                  <div className="text-xs opacity-75">AGF %{topAgf.toFixed(1)} — piyasa {fark != null && fark > 0 ? "henüz fiyatlamıyor" : "farklı görüyor"}</div>
                )}
                {/* 2026-09-14 kullanıcı talebi: hero da liste satırlarıyla AYNI jokey/
                    antrenör + Son 5 Yarış bilgisini taşısın. */}
                {(topPick.runner?.jockey || topPick.runner?.trainer) && (
                  <div className="text-xs opacity-75">
                    {[topPick.runner?.jockey, topPick.runner?.trainer].filter(Boolean).join(" · ")}
                  </div>
                )}
                <div className="mt-1">
                  <Son5Yaris form={formByNo.get(topPick.runner?.no ?? -1)} adet={5} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
              {/* Model tahmini — büyük yüzde + oran çubuğu, referans ekrandaki gibi. */}
              <div className="min-w-[140px]">
                <div className="text-[10px] font-semibold uppercase tracking-wide opacity-60">Model Tahmini</div>
                <div className="text-xl font-extrabold text-brand">%{puanYuzdesiMetni(topPick.score, topPick.scoreExact) ?? "—"}</div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-background/20">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.max(0, Math.min(100, topPick.scoreExact ?? topPick.score ?? 0))}%` }}
                  />
                </div>
              </div>
              {tempo && TEMPO_LABEL[tempo] && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide opacity-60">Yarış Gidişatı</div>
                  <div className="font-bold">{TEMPO_LABEL[tempo]}</div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <SiralamaListesi race={race} formByNo={formByNo} agfByNo={agfByNo} />

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
