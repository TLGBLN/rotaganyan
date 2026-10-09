import { Lock, Star, CircleCheck, Clock, Trophy, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn, raceTimeForLocale } from "@/lib/utils";
import { getLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/request";
import type { ProgramRaceDay } from "@/server/services/race.service";
import { kararOku, puanYuzdesiMetni } from "@/lib/methodology/muhakeme-format";
import { ekuriRengi } from "@/lib/ekuri-colors";
import { siraliPickSatirlari } from "@/lib/methodology/pick-display-order";
import { agfSiraMapOlustur } from "@/lib/agf-sira";

// 2026-10-10 kullanıcı talebi — "rotaganyan sıralama tablosu buna benzer dizayn eder
// misin" (ekran görüntüsü: koyu lacivert/altın marka temalı, her ayak ayrı kart olarak
// yan yana, gerçek kazanan kupa rozetiyle işaretli). Referans görsel, bu projenin KENDİ
// paylaşım kartı (/api/og/kupon/[kuponId]/route.tsx) ile AYNI marka dilini taşıyor —
// GOLD/arka plan gradyanı/horse-icon-gold.png oradan BİREBİR alındı, iki yerde ayrı
// renk kararı olmasın diye. Bu bileşen artık sabit koyu/altın temalı (sitenin
// açık/koyu tema anahtarından BAĞIMSIZ) — tıpkı OG kartı gibi, görüntüleyenin temasına
// göre değişmeyen, markaya özgü sabit bir kimlik.
//
// Veri mantığı (buildPickRows/chunkIntoAltili/kazanan tespiti/puan metni) DEĞİŞMEDİ —
// bu bileşen daha önce hiçbir route'tan import edilmiyordu (bkz. proje hafızası/git
// geçmişi: v6.50'de /rotaganyansiralamasi'ne geçilince kullanımdan düştü, kod silinmedi).
// Şimdi yeniden /rotaganyansiralamasi'ne BAĞLANDI.
const GOLD = "#DF9D00";
const BG_GRADIENT = "linear-gradient(165deg, #0a1524 0%, #0d1b2e 55%, #050b16 100%)";
const CARD_BG = "#0f1e32";
const CARD_BORDER = "rgba(223,157,0,0.22)";
const INK = "#eef2f7";
const INK_DIM = "#8592a6";
const HIT = "#2ecc71"; // yüksek puan
const MID = "#e0a72e"; // orta puan
const LOW = "#e05a2e"; // düşük puan
const FLOOR = "#4a6fa5"; // en alt (neredeyse sıfır)

type PuanPick = NonNullable<ProgramRaceDay["races"][number]["prediction"]>["picks"][number];

type Props = {
  raceDay: ProgramRaceDay;
  isLoggedIn: boolean;
  currentDate: string;
  isAdmin?: boolean;
};

type Race = { raceNo: number };
function chunkIntoAltili<T extends Race>(
  allRaces: T[],
  analyzedRaces: T[]
): { label: string; races: T[] }[] {
  if (allRaces.length <= 6) {
    return analyzedRaces.length > 0 ? [{ label: "1. 6'lı", races: analyzedRaces }] : [];
  }
  const g1Nos = new Set(allRaces.slice(0, 6).map((r) => r.raceNo));
  const g2Nos = new Set(allRaces.slice(allRaces.length - 6).map((r) => r.raceNo));
  const g1 = analyzedRaces.filter((r) => g1Nos.has(r.raceNo));
  const g2 = analyzedRaces.filter((r) => g2Nos.has(r.raceNo));
  const result: { label: string; races: T[] }[] = [];
  if (g1.length > 0) result.push({ label: "1. 6'lı", races: g1 });
  if (g2.length > 0) result.push({ label: "2. 6'lı", races: g2 });
  return result;
}

function buildPickRows(picks: PuanPick[]): PuanPick[][] {
  const renderedNos = new Set<number>();
  const rows: PuanPick[][] = [];
  for (const p of picks) {
    const no = p.runner?.no;
    if (no != null && renderedNos.has(no)) continue;
    const grp = p.runner?.ekuriGroup;
    const partner = grp != null
      ? picks.find((q) => q !== p && q.runner?.no != null && !renderedNos.has(q.runner.no) && q.runner?.ekuriGroup === grp)
      : undefined;
    if (no != null) renderedNos.add(no);
    if (partner?.runner?.no != null) {
      renderedNos.add(partner.runner.no);
      rows.push([p, partner]);
    } else {
      rows.push([p]);
    }
  }
  // Gösterim her zaman yüzdesel (Puan/score) yüksekten azalana — bkz. pick-display-order.ts.
  return siraliPickSatirlari(rows);
}

/** Ham puana göre (sıraya göre DEĞİL) renk bandı — ekrandaki referansla aynı mantık:
 *  yüksek=yeşil, orta=amber, düşük=turuncu-kırmızı, tabana yakın=soluk mavi. */
function scoreColor(score: number): string {
  if (score >= 70) return HIT;
  if (score >= 40) return MID;
  if (score >= 10) return LOW;
  return FLOOR;
}

export default async function PuanTablosu({ raceDay, isLoggedIn, currentDate, isAdmin = false }: Props) {
  const locale = (await getLocale()) as AppLocale;
  const analyzedRaces = raceDay.races.filter(
    (r) => r.prediction?.published && (r.prediction.picks?.length ?? 0) > 0
  );

  if (analyzedRaces.length === 0) return null;

  const agfSiraByRaceId = new Map(raceDay.races.map((r) => [r.id, agfSiraMapOlustur(r.runners)]));
  const hipName = raceDay.hippodrome.name;
  const racePath = `/kosular?tarih=${currentDate}&hippodrom=${raceDay.hippodrome.slug}`;

  if (!isLoggedIn) {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-2xl border py-8 text-center text-sm"
        style={{ background: BG_GRADIENT, borderColor: CARD_BORDER, color: INK }}
      >
        <Lock className="h-5 w-5" style={{ color: GOLD }} />
        <p className="font-medium">{hipName} puan tablosunu görmek için giriş yapmalısınız.</p>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link href={`/giris?callbackUrl=${encodeURIComponent(racePath)}`}>Giriş Yap</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/kayit?callbackUrl=${encodeURIComponent(racePath)}`}>Kayıt Ol</Link>
          </Button>
        </div>
      </div>
    );
  }

  const groups = chunkIntoAltili(raceDay.races, analyzedRaces);

  return (
    <div className="space-y-6">
      {groups.map(({ label: altiliLabel, races: group }, gi) => (
        <div
          key={gi}
          className="overflow-hidden rounded-2xl border"
          style={{ background: BG_GRADIENT, borderColor: CARD_BORDER }}
        >
          {/* Marka başlığı — OG kartıyla aynı dil: logo + ROTA/GANYAN + hipodrom konum rozeti.
              2026-10-10 kullanıcı talebi (mobil): dar ekranda ikon+çizgi+başlık+konum rozeti
              AYNI satıra sıkışıp başlık (hipodrom adı dahil) truncate ile kırpılıyordu —
              konum rozeti (başlıktaki bilgiyi zaten TEKRARLIYOR) artık yalnız sm+'ta
              görünüyor, başlık da mobilde truncate yerine 2 satıra sarabiliyor
              (leading-snug) — hipodrom adı/ayak bilgisi dar ekranda da hiç kırpılmıyor. */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-3 sm:px-5" style={{ borderColor: CARD_BORDER }}>
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/horse-icon-gold.png" alt="" width={30} height={30} className="shrink-0 sm:w-[34px] sm:h-[34px]" style={{ objectFit: "contain" }} />
              <div className="hidden h-7 w-px shrink-0 sm:block" style={{ background: "rgba(223,157,0,0.35)" }} />
              <div className="min-w-0">
                <div className="text-sm font-extrabold leading-snug sm:truncate sm:text-lg" style={{ color: INK }}>
                  {hipName} — <span style={{ color: GOLD }}>{altiliLabel}</span> Puan Tablosu
                </div>
              </div>
            </div>
            <div
              className="hidden shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold sm:flex"
              style={{ borderColor: "rgba(223,157,0,0.35)", color: INK }}
            >
              <MapPin className="h-3.5 w-3.5" style={{ color: GOLD }} />
              {hipName} Hipodromu
            </div>
          </div>

          {/* Kart gridi — her ayak kendi kartı, ekrandaki referansla aynı düzen.
              overflow-x-auto güvenlik ağı: beklenmedik taşma olursa sessizce kırpılmak
              yerine yatay kaydırılabilir olsun (bkz. proje kuralı: overflow-hidden yerine
              overflow-x-auto). */}
          <div className="overflow-x-auto">
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 xl:grid-cols-6">
            {group.map((race) => {
              const rows = buildPickRows(race.prediction!.picks);
              const sonuclandi = race.result != null;
              return (
                <div
                  key={race.id}
                  className="flex flex-col overflow-hidden rounded-xl border"
                  style={{ background: CARD_BG, borderColor: "rgba(255,255,255,0.08)" }}
                >
                  {/* Ayak başlığı */}
                  <div className="flex items-center justify-between gap-2 border-b px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold"
                        style={{ background: GOLD, color: "#1a1206" }}
                      >
                        {race.raceNo}
                      </span>
                      <span className="truncate text-xs font-bold" style={{ color: INK }}>
                        {race.raceNo}. AYAK
                      </span>
                    </div>
                    <span
                      className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: sonuclandi ? "rgba(46,204,113,0.15)" : "rgba(224,167,46,0.15)",
                        color: sonuclandi ? HIT : MID,
                      }}
                    >
                      {sonuclandi ? <CircleCheck className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {sonuclandi ? "Sonuçlandı" : "Bekliyor"}
                    </span>
                  </div>
                  {race.time && (
                    <div className="px-3 pt-1.5 text-[10px]" style={{ color: INK_DIM }}>
                      {raceTimeForLocale(race.time, locale)}
                    </div>
                  )}

                  {/* At listesi */}
                  <div className="flex flex-1 flex-col gap-1 p-2">
                    {rows.map((rowPicks, rowIdx) => {
                      const displayRank = rowIdx + 1;
                      const isBanko = race.prediction!.isBanko && displayRank === 1;
                      const isWinner = rowPicks.some(
                        (p) => p.runner?.no != null && (race.result?.winnerNos ?? []).includes(p.runner.no)
                      );
                      const primary = rowPicks[0];
                      const metin = puanYuzdesiMetni(primary.score, primary.scoreExact);
                      const scoreNum = primary.score ?? Math.round(primary.scoreExact ?? 0);
                      const renk = isWinner ? GOLD : scoreColor(scoreNum);

                      return (
                        <div
                          key={rowIdx}
                          className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
                          style={{ background: isWinner ? "rgba(223,157,0,0.14)" : rowIdx % 2 === 0 ? "rgba(255,255,255,0.025)" : "transparent" }}
                        >
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold"
                              style={{ borderColor: "rgba(255,255,255,0.15)", color: INK }}
                            >
                              {rowPicks[0].runner?.no ?? "—"}
                            </span>
                            {rowPicks.length > 1 && (
                              <span className="text-[9px]" style={{ color: INK_DIM }}>
                                +{rowPicks[1].runner?.no}
                              </span>
                            )}
                            {isBanko && <Star className="h-3 w-3 shrink-0" style={{ fill: GOLD, color: GOLD }} />}
                            <span
                              className="truncate text-[11px] font-medium"
                              style={{ color: isWinner ? INK : INK_DIM }}
                              title={(primary.runner?.name && !/^\d+$/.test(primary.runner.name) ? primary.runner.name : null) ?? primary.runnerLabel ?? "—"}
                            >
                              {(primary.runner?.name && !/^\d+$/.test(primary.runner.name) ? primary.runner.name : null) ?? primary.runnerLabel ?? "—"}
                            </span>
                            {rowPicks.length === 1 && primary.runner?.ekuriGroup != null && !primary.runner?.scratched && (
                              <span title={`Eküri grubu ${primary.runner.ekuriGroup}`} className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", ekuriRengi(primary.runner.ekuriGroup).badge)} />
                            )}
                            {isAdmin && primary.runner?.no != null && agfSiraByRaceId.get(race.id)?.has(primary.runner.no) && (
                              <span className="shrink-0 rounded px-1 text-[8px] font-semibold" style={{ background: "rgba(168,85,247,0.18)", color: "#c084fc" }}>
                                AGF{agfSiraByRaceId.get(race.id)!.get(primary.runner.no)}
                              </span>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {isWinner && (
                              <Trophy className="h-3 w-3" style={{ color: GOLD }} />
                            )}
                            <span className="font-mono text-sm font-extrabold tabular-nums" style={{ color: renk }}>
                              {metin != null ? metin : (kararOku(primary.details) ?? "—")}
                            </span>
                            {isWinner && (
                              <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: GOLD, color: "#1a1206" }}>
                                Kazanan
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {rows.length === 0 && (
                      <div className="py-4 text-center text-[11px]" style={{ color: INK_DIM }}>Veri yok</div>
                    )}
                  </div>

                  {/* Kazanan ganyanı (varsa) */}
                  {race.result?.ganyan != null && (
                    <div className="border-t px-3 py-1.5 text-[10px] font-semibold" style={{ borderColor: "rgba(255,255,255,0.08)", color: GOLD }}>
                      Ganyan: {race.result.ganyan.toFixed(2)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        </div>
      ))}
    </div>
  );
}
