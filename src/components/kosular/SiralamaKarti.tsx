"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ProgramRaceDay, KuponOnerisi } from "@/server/services/race.service";
import type { TempoSenaryosu } from "@/lib/methodology/pace-analizi";
import { KuponBlock } from "@/components/home/TahminOnerileri";
import SiralamaRaceView from "./SiralamaRaceView";
import { sunucuKosusuToSiralama } from "./siralama-tipleri";

type Race = ProgramRaceDay["races"][number];
type Kupon = NonNullable<KuponOnerisi>;

// 2026-09-14 — Koşu sekmesi pist renkleri: TJK'nın kendi Son 6 Yarış font-renkleri
// (bkz. proje hafızası "TJK Pist Renkleri"). 2026-09-28 yeni tasarımda sekmenin kendisi
// koyu yuvarlak — pist bilgisi alt kenardaki ince renk çizgisiyle korunuyor.
const SURFACE_CIZGI: Record<string, string> = {
  CIM: "bg-[#009900]",
  KUM: "bg-[#996633]",
  SENTETIK: "bg-[#D39B1E]",
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
      {/* Koşu sekmesi şeridi — "Altılı" sekmeleriyle aynı stil (yuvarlatılmış köşeli, seçili
          olan altın dolgu); yeşil nokta = analiz var, alt çizgi = TJK pist rengi. */}
      <div className="flex gap-1 overflow-x-auto px-0.5 py-1 sm:gap-2" role="tablist" aria-label="Koşu seçimi">
        {raceDay.races.map((r) => {
          const aktif = activeRaceNo === r.raceNo;
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={aktif}
              onClick={() => setActiveRaceNo(r.raceNo)}
              className={cn(
                // Mobilde (<640px) tüm koşular tek satıra eşit genişlikte SIĞAR (yarış programı
                // sekmeleri gibi), sm+'ta sabit genişlikli butonlar.
                "relative flex h-10 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg border px-0 text-sm font-bold transition-colors sm:min-w-[2.75rem] sm:flex-none sm:shrink-0 sm:px-3.5",
                aktif
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-white/15 bg-[#0d1018] text-white/70 hover:border-brand/60 hover:text-white",
                !hasAnalysis(r) && !aktif && "opacity-50"
              )}
            >
              {r.raceNo}
              {hasAnalysis(r) && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#27ae60] ring-1 ring-black/40" />
              )}
              <span className={cn("absolute inset-x-2.5 bottom-0.5 h-[3px] rounded-full", SURFACE_CIZGI[r.surface] ?? "bg-white/20")} />
            </button>
          );
        })}
      </div>

      {/* Karar hero'su — 2026-09-14 kullanıcı bulgusu (mobil): eskiden tek satırlık
          flex-wrap, dar ekranda at adı/piyasa farkı/kupon bloklarını üst üste garip
          kırıyordu. Artık <640px'te DİKEY istiflenen, kupon ayaklarının ayrı ayrı
          "chip" olarak sarıldığı (tek uzun "/" dizesi yerine) bir düzen; sm+'ta eski
          yatay tek satır geri geliyor. */}
      {/* 2026-09-16 — Anormal Pist Modu v1 (bkz. anormal-pist-risk.ts). SADE public
          rozet — sayısal katsayı/z-score/multiplier YOK (bkz. feedback_mutfagi_acma_ilkesi),
          yalnız TJK'nın kendi pist etiketi + kuponun SONUCU (genişletildi/banko yok)
          gösteriliyor. pistAnormalMi false olan (büyük çoğunluk) günlerde hiç görünmez.
          Kullanıcı kararı (2026-09-16): rozet TJK'nın o gün anormal pist bildirdiği HER
          koşuda gösterilsin — Stabil çıkan (model etkilenmemiş) koşularda da şeffaflık
          için görünsün, ama bu durumda ⚠ yerine nötr ℹ + sakinleştirici bir mesajla,
          yanlış alarm izlenimi vermeden. */}
      {race.prediction?.pistAnormalMi && (() => {
        const stabilVeMesajsiz = race.prediction.pistDuyarliligi === "STABIL" && !race.prediction.pistUyariMesaji;
        return (
          <div
            className={cn(
              "rounded-xl border px-4 py-2.5 text-sm",
              stabilVeMesajsiz
                ? "border-muted-foreground/25 bg-muted/30 text-muted-foreground"
                : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}
          >
            <span className="font-semibold">
              {stabilVeMesajsiz ? "ℹ Anormal Pist" : "⚠ Anormal Pist"}
              {race.prediction.pistDuyarliligi && ` — Pist Dayanıklılığı: ${race.prediction.pistDuyarliligi === "COK_HASSAS" ? "Çok Hassas" : race.prediction.pistDuyarliligi === "HASSAS" ? "Hassas" : "Stabil"}`}
            </span>
            <div className="mt-0.5 text-xs opacity-90">
              {race.prediction.pistUyariMesaji || "TJK bugün bu pist için normal-dışı bir koşul bildirdi — model bu durumu test etti, sıralaması etkilenmedi."}
            </div>
          </div>
        );
      })()}

      {/* Karar hero'su + sıralama listesi + kupon: /program'daki "Analiz Yayında" paneliyle PAYLAŞILAN
          bileşen (SiralamaRaceView) — kupon bu sayfaya özgü (yayınlanmış altılı) yan panel olarak geçilir. */}
      <SiralamaRaceView
        raceKey={race.id}
        race={sunucuKosusuToSiralama(race)}
        tempoSenaryosu={tempo}
        yan={
          kupon ? (
            <KuponBlock data={kupon} ikramiye={kupon.ikramiye} isAdmin={isAdmin} cityLabel="Kupon Önerisi" />
          ) : (
            <div className="rounded-2xl border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
              Bu hipodrom için kupon önerisi henüz yayınlanmadı.
            </div>
          )
        }
      />
    </div>
  );
}
