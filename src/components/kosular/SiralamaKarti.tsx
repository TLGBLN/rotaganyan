"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ProgramRaceDay, KuponOnerisi } from "@/server/services/race.service";
import type { TempoSenaryosu } from "@/lib/methodology/pace-analizi";
import { siraliPickler } from "@/lib/methodology/pick-display-order";
import { puanYuzdesiMetni, piyasaFarkiPuani } from "@/lib/methodology/muhakeme-format";
import { KuponBlock } from "@/components/home/TahminOnerileri";
import SiralamaListesi, { Son5Yaris } from "./SiralamaListesi";

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

      {/* 2026-09-14 kullanıcı talebi: eskiden "from-foreground to-foreground/80" —
          aynı rengin saydamlığı farklı olduğu için gözle neredeyse fark edilmiyordu.
          Artık sitenin KENDİ marka rengine (brand, kehribar) doğru gerçek bir renk
          geçişi var — jenerik mor/mavi gradyan değil. */}
      {topPick && (
        <div className="rounded-2xl bg-gradient-to-br from-foreground via-foreground to-brand/25 px-4 py-4 text-background shadow-sm sm:px-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-baseline gap-2">
              {/* 2026-09-14 kullanıcı talebi: hero'daki at, listedeki sıra rozetleriyle
                  (1,2,3...) TUTARLI şekilde ayrıca "1." (model sırası) taşısın — bib
                  numarasından (turuncu kutu) ayrı, ne olduğu karışmasın diye. */}
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background/20 text-sm font-bold">
                1.
              </span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-lg font-extrabold text-brand-foreground">
                {topPick.runner?.no ?? "—"}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="truncate text-lg font-bold sm:text-xl">{topPick.runner?.name ?? topPick.runnerLabel ?? "—"}</span>
                  <span className="text-lg font-extrabold text-brand sm:text-xl">
                    %{puanYuzdesiMetni(topPick.score, topPick.scoreExact) ?? "—"}
                  </span>
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

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {tempo && TEMPO_LABEL[tempo] && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide opacity-60">Yarış Gidişatı</div>
                  <div className="font-bold">{TEMPO_LABEL[tempo]}</div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <SiralamaListesi race={race} formByNo={formByNo} />

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
