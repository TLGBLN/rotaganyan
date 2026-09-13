import { Lock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn, raceTimeForLocale } from "@/lib/utils";
import { getLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/request";
import type { ProgramRaceDay } from "@/server/services/race.service";
import { finishPos } from "@/lib/race-result";
import { kararOku, puanYuzdesiMetni } from "@/lib/methodology/muhakeme-format";
import { ekuriRengi } from "@/lib/ekuri-colors";
import { siraliPickSatirlari } from "@/lib/methodology/pick-display-order";
import { agfSiraMapOlustur } from "@/lib/agf-sira";

// PuanTablosu.tsx'in kendi pick şekli — ProgramView.tsx'in ProgramPick'inden FARKLI
// (o daha dar, runner.scratched/ekuriGroup taşımıyor). ProgramRaceDay'den türetiliyor
// ki tek kaynaktan (Prisma select) sapmasın.
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
    return analyzedRaces.length > 0 ? [{ label: "1.Altılı", races: analyzedRaces }] : [];
  }
  const g1Nos = new Set(allRaces.slice(0, 6).map((r) => r.raceNo));
  const g2Nos = new Set(allRaces.slice(allRaces.length - 6).map((r) => r.raceNo));
  const g1 = analyzedRaces.filter((r) => g1Nos.has(r.raceNo));
  const g2 = analyzedRaces.filter((r) => g2Nos.has(r.raceNo));
  const result: { label: string; races: T[] }[] = [];
  if (g1.length > 0) result.push({ label: "1.Altılı", races: g1 });
  if (g2.length > 0) result.push({ label: "2.Altılı", races: g2 });
  return result;
}

// 2026-09-02 kullanıcı talebi ("ekürileri yan yana al") — ProgramView.tsx'in Analiz
// Detayları tablosundaki AYNI mantık: iki eküri ortağı ayrı satır olarak iki kat yer
// kaplamasın, aynı satırda birlikte gösterilsin. Bu tablo o zaman GÜNCELLENMEMİŞTİ
// (farklı bir dosya, PuanTablosu.tsx) — burada da aynı desen uygulanıyor.
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

  // 2026-09-05 kullanıcı talebi: gösterim sırası artık HER ZAMAN yüzdesel (Puan/score)
  // yüksekten azalana — terfi/garanti mekanizmalarının admin tarafında tuttuğu Sıra (rank)
  // kasıtlı olarak ham olasılıktan sapabildiği için burada KULLANILMIYOR. displayRank zaten
  // rowIdx+1 olarak hesaplanıyor, diziyi puana göre sıralamak yeterli. Paylaşılan/test edilen
  // fonksiyon — bkz. pick-display-order.ts'in başındaki not (bu bug üç ayrı dosyada vardı).
  return siraliPickSatirlari(rows);
}

function rankColor(rank: number): string {
  if (rank <= 3) return "text-hit";
  if (rank <= 6) return "text-brand";
  return "text-muted-foreground";
}

function rankWeight(rank: number): string {
  if (rank === 1) return "font-bold";
  if (rank <= 3) return "font-semibold";
  if (rank <= 6) return "font-medium";
  return "";
}

// v6.51 — kullanıcı kararı: V2 motoru (Faz3/sayısal puanlama yok) kaydettiği pick'lerde
// score HER ZAMAN null — bu durumda ham "—" göstermek yerine Faz2'nin ürettiği "karar"
// etiketini (details[0] = "Karar: Güçlü Aday" gibi) gösteriyoruz, kullanıcı boş bir
// hücreyle karşılaşmasın. Eski (Faz3'lü) tahminlerde score dolu olduğu için davranış
// AYNEN korunuyor, hiçbir şey değişmiyor.
// 2026-08-16 kullanıcı talebi: çıplak sayı (81, 3, 1...) "güven vermiyor" hissi
// veriyordu — mantık/ölçek (0-100) AYNEN korunuyor, yalnız gösterime atın kendi
// puanıyla orantılı ince bir dolgu çubuğu eklendi (bg-current, hücrenin zaten
// hesaplanmış rank rengini miras alır) — sayı artık boşlukta değil, görsel bir
// büyüklük göstergesinin üstünde duruyor.
function PuanHucre({ score, details, scoreExact }: { score: number | null; details: unknown; scoreExact?: number | null }) {
  const metin = puanYuzdesiMetni(score, scoreExact);
  if (metin == null) return <span>{kararOku(details) ?? "—"}</span>;
  // Dolgu çubuğu genişliği hep tam sayı score'a göre (scoreExact yalnız metinde daha
  // hassas) — score null ama scoreExact doluysa (teorik olarak olmaz, ikisi birlikte
  // yazılıyor) çubuk 0 kalır, metin yine de gösterilir.
  const pct = Math.max(0, Math.min(100, score ?? Math.round(scoreExact ?? 0)));
  return (
    <span className="relative isolate inline-flex w-full items-center justify-center overflow-hidden rounded-sm py-px">
      <span aria-hidden className="absolute inset-y-0 left-0 -z-10 bg-current opacity-[0.16]" style={{ width: `${pct}%` }} />
      <span>%{metin}</span>
    </span>
  );
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
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
        <Lock className="h-5 w-5" />
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
      {groups.map(({ label: altiliLabel, races: group }, gi) => {
        // 2026-09-02 — eküri ortakları birleşince (buildPickRows) satır sayısı raw
        // picks.length'ten AZ olabilir — maxRows/desktop tablosu BİRLEŞMİŞ satır
        // sayısına göre hesaplanmalı, yoksa gereksiz boş satırlar oluşur.
        const pickRowsByRaceId = new Map(group.map((r) => [r.id, buildPickRows(r.prediction!.picks)]));
        const maxRows = Math.max(...group.map((r) => pickRowsByRaceId.get(r.id)!.length));

        return (
          <div key={gi} className="rounded-xl border">
            {/* Başlık */}
            <div className="border-b bg-muted/30 px-4 py-2.5">
              <span className="text-sm font-semibold">
                {hipName} — {altiliLabel} Rotaganyan Puan Tablosu
              </span>
            </div>

            {/* ── MOBİL: her koşu ayrı kart, alt alta ── */}
            <div className="sm:hidden divide-y">
              {group.map((race) => (
                <div key={race.id}>
                  <div className="bg-muted/20 px-3 py-2 text-xs font-bold">
                    {race.raceNo}. Koşu{race.time ? ` · ${raceTimeForLocale(race.time, locale)}` : ""}
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/10">
                        <th className="w-6 px-2 py-1 text-center text-[10px] font-medium text-muted-foreground">#</th>
                        <th className="px-2 py-1 text-left text-[10px] font-medium text-muted-foreground">No · Ad</th>
                        <th className="w-12 px-2 py-1 text-center text-[10px] font-medium text-muted-foreground">Puan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buildPickRows(race.prediction!.picks).map((rowPicks, rowIdx) => {
                        // v6.68 — kullanıcı bulgusu: ham pick.rank scratch sonrası boşluklu
                        // kalabiliyordu (ör. 3..12) — ekrandaki "#" pozisyonu zaten sırayla
                        // (rowIdx+1) gösteriliyordu, ama banko/renk/kalınlık HAM rank'a
                        // bakıyordu, ikisi çelişebiliyordu. Artık ikisi de aynı (ekrandaki)
                        // pozisyonu kullanıyor — completeFullField artık rank'ı yazarken
                        // sıkıştırdığı için yeni veride zaten eşitler, eski veri için de bu
                        // bileşen kendi içinde tutarlı kalır.
                        // 2026-09-02 — eküri ortağı aynı satırda birleşince (bkz. buildPickRows)
                        // displayRank artık HAM rank değil, birleşmiş listedeki SIRALI konum.
                        const displayRank = rowIdx + 1;
                        const isBanko = race.prediction!.isBanko && displayRank === 1;
                        const isTarget = rowPicks.some((p) => p.isTarget);
                        const isWinner = rowPicks.some(
                          (p) => p.runner?.no != null && (race.result?.winnerNos ?? []).includes(p.runner.no)
                        );
                        const rowBg = isWinner
                          ? "bg-[#C98F02]/20"
                          : isTarget
                          ? "bg-hit/15"
                          : "";
                        const textColor = isWinner
                          ? "text-winner"
                          : rankColor(displayRank);
                        const weight = rankWeight(displayRank);

                        return (
                          <tr key={rowIdx} className={cn("border-b last:border-0", rowBg)}>
                            <td className="px-2 py-1.5 text-center tabular-nums text-muted-foreground">
                              {rowIdx + 1}
                            </td>
                            <td className={cn("px-2 py-1.5", textColor, weight)}>
                              {isBanko && (
                                <span title="Banko — modelin en güçlü işareti, garanti değil (yandaki % modelin kendi olasılığı)">
                                  <Star className="inline-block h-3 w-3 mr-0.5 -mt-0.5 fill-brand text-brand" />
                                </span>
                              )}
                              {rowPicks.map((pick, pi) => (
                                <span key={pick.runner?.no ?? pi} className={cn(pi > 0 && "ml-1.5 before:content-['/'] before:mr-1.5 before:text-muted-foreground")}>
                                  <span className="font-mono mr-1 tabular-nums">
                                    {pick.runner?.no ?? "—"}
                                  </span>
                                  <span className={cn(pick.runner?.scratched && "line-through opacity-50")}>
                                    {(pick.runner?.name && !/^\d+$/.test(pick.runner.name) ? pick.runner.name : null) ?? pick.runnerLabel?.replace(/^\d+\s+/, "") ?? pick.runnerLabel ?? "—"}
                                  </span>
                                  {rowPicks.length === 1 && !pick.runner?.scratched && pick.runner?.ekuriGroup != null && (
                                    <span title={`Eküri grubu ${pick.runner.ekuriGroup}`} className="ml-1 inline-flex items-center gap-0.5 text-[10px]">
                                      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", ekuriRengi(pick.runner.ekuriGroup).badge)} />
                                      🐴
                                    </span>
                                  )}
                                  {pick.runner?.scratched && (
                                    <span className="ml-1 text-[10px] font-semibold text-red-400">Koşmaz</span>
                                  )}
                                  {(() => {
                                    const pos = finishPos(race.result?.actualOrder, pick.runner?.no, race.result?.winnerNos);
                                    return pos != null ? (
                                      <span className={cn("ml-1 text-[10px] font-semibold", pos === 1 ? "text-winner" : "text-muted-foreground")}>
                                        ({pos}.)
                                        {pos === 1 && race.result?.ganyan != null && ` Gny: ${race.result.ganyan.toFixed(2)}`}
                                      </span>
                                    ) : null;
                                  })()}
                                  {isAdmin && pick.runner?.no != null && agfSiraByRaceId.get(race.id)?.has(pick.runner.no) && (
                                    <span className="ml-1 rounded bg-purple-500/15 px-1 text-[9px] font-semibold text-purple-500">
                                      AGF {agfSiraByRaceId.get(race.id)!.get(pick.runner.no)}.
                                    </span>
                                  )}
                                </span>
                              ))}
                            </td>
                            <td className={cn("px-2 py-1.5 text-center font-mono tabular-nums whitespace-nowrap", textColor, weight)}>
                              <span className="inline-flex items-center gap-1">
                                {rowPicks.map((p) => <PuanHucre key={p.runner?.no ?? p.runnerLabel} score={p.score} details={p.details} scoreExact={p.scoreExact} />)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {/* ── MASAÜSTÜ: tüm koşular yan yana tablo ──
                v6.69 — kullanıcı talebi: sayfa altında yatay scroll çubuğu çıkmasın, 6
                koşuluk bir altılı sayfaya (max-w-1400px) tek ekranda sığsın. At isimleri
                sabit genişlikte kısaltılıp (truncate + title tooltip) yazı boyutu biraz
                küçültüldü — eskiden isim sütunu sınırsız büyüyüp uzun isimlerde (ör.
                "SULTANIM NERİMAN") tabloyu container genişliğinin çok üzerine taşırıyordu.
                overflow-x-auto yine de bir güvenlik ağı olarak kalıyor (çok dar ekran/uç
                durum için), ama normal masaüstü genişliğinde artık hiç scroll gerekmiyor. */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th
                      rowSpan={2}
                      className="w-6 border-r px-1 text-center text-[9px] font-medium text-muted-foreground align-middle"
                    >
                      #
                    </th>
                    {group.map((race, ri) => (
                      <th
                        key={race.id}
                        colSpan={3}
                        className={cn(
                          "border-r px-1.5 py-1 text-center last:border-r-0",
                          ri % 2 === 1 && "bg-muted/10"
                        )}
                      >
                        <div className="whitespace-nowrap text-[10px] font-bold">
                          {race.raceNo}. Koşu
                        </div>
                        <div className="whitespace-nowrap text-[9px] font-normal text-muted-foreground">
                          {race.time ? raceTimeForLocale(race.time, locale) : "—"}
                        </div>
                      </th>
                    ))}
                  </tr>

                  <tr className="border-b bg-muted/10">
                    {group.map((race, ri) => (
                      <>
                        <th
                          key={`${race.id}-ni`}
                          colSpan={2}
                          className={cn(
                            "px-1.5 py-1 text-left text-[9px] font-medium text-muted-foreground",
                            ri % 2 === 1 && "bg-muted/10"
                          )}
                        >
                          No · İsim
                        </th>
                        <th
                          key={`${race.id}-puan`}
                          className={cn(
                            "w-9 border-r px-1 py-1 text-center text-[9px] font-medium text-muted-foreground last:border-r-0",
                            ri % 2 === 1 && "bg-muted/10"
                          )}
                        >
                          Puan
                        </th>
                      </>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {Array.from({ length: maxRows }).map((_, rowIdx) => (
                    <tr key={rowIdx} className="border-b last:border-0">
                      <td className="border-r px-1 py-1 text-center text-[9px] tabular-nums text-muted-foreground">
                        {rowIdx + 1}
                      </td>

                      {group.map((race, ri) => {
                        const rowPicks = pickRowsByRaceId.get(race.id)![rowIdx];
                        // v6.68 — bkz. mobil tablodaki aynı düzeltme: ekran pozisyonu
                        // (rowIdx+1) ile ham pick.rank ayrışabildiği için stil/banko artık
                        // ikisi için de aynı (ekrandaki) pozisyona bakıyor. 2026-09-02 —
                        // eküri ortağı birleşince displayRank de birleşmiş listedeki sıra.
                        const displayRank = rowIdx + 1;
                        const isBanko = race.prediction!.isBanko && displayRank === 1;
                        const isTarget = rowPicks?.some((p) => p.isTarget) ?? false;
                        const isWinner =
                          rowPicks?.some((p) => p.runner?.no != null && (race.result?.winnerNos ?? []).includes(p.runner.no)) ?? false;
                        const colBg = ri % 2 === 1 ? "bg-muted/5" : "";

                        if (!rowPicks) {
                          return (
                            <>
                              <td key={`${race.id}-${rowIdx}-a`} colSpan={2} className={cn("px-1.5 py-1", colBg)} />
                              <td key={`${race.id}-${rowIdx}-b`} className={cn("border-r px-1.5 py-1 last:border-r-0", colBg)} />
                            </>
                          );
                        }

                        const rowBg = isWinner ? "bg-[#C98F02]/20" : isTarget ? "bg-hit/15" : colBg;
                        const textColor = isWinner ? "text-winner" : rankColor(displayRank);
                        const weight = rankWeight(displayRank);
                        const nameMaxWidth = rowPicks.length > 1 ? "max-w-[26px]" : "max-w-[56px]";

                        return (
                          <>
                            <td
                              key={`${race.id}-${rowIdx}-ni`}
                              colSpan={2}
                              className={cn("px-1.5 py-1", rowBg, textColor)}
                            >
                              <div className="flex items-center gap-0.5 min-w-0">
                                {isBanko && (
                                  <Star className="h-2.5 w-2.5 shrink-0 fill-brand text-brand" />
                                )}
                                {rowPicks.map((pick, pi) => (
                                  <span key={pick.runner?.no ?? pi} className="flex items-center gap-0.5 min-w-0">
                                    {pi > 0 && <span className="shrink-0 text-muted-foreground">/</span>}
                                    <span className={cn("shrink-0 font-mono tabular-nums", weight)}>
                                      {pick.runner?.no ?? "—"}
                                    </span>
                                    <span
                                      title={(pick.runner?.name && !/^\d+$/.test(pick.runner.name) ? pick.runner.name : null) ?? pick.runnerLabel?.replace(/^\d+\s+/, "") ?? pick.runnerLabel ?? "—"}
                                      className={cn("min-w-0 truncate", nameMaxWidth, weight, pick.runner?.scratched && "line-through opacity-50")}
                                    >
                                      {(pick.runner?.name && !/^\d+$/.test(pick.runner.name) ? pick.runner.name : null) ?? pick.runnerLabel?.replace(/^\d+\s+/, "") ?? pick.runnerLabel ?? "—"}
                                    </span>
                                    {rowPicks.length === 1 && !pick.runner?.scratched && pick.runner?.ekuriGroup != null && (
                                      <span title={`Eküri grubu ${pick.runner.ekuriGroup}`} className="shrink-0 inline-flex items-center gap-0.5 text-[9px]">
                                        <span className={cn("inline-block h-1.5 w-1.5 rounded-full", ekuriRengi(pick.runner.ekuriGroup).badge)} />
                                        🐴
                                      </span>
                                    )}
                                    {pick.runner?.scratched && (
                                      <span className="shrink-0 text-[9px] font-semibold text-red-400">Koşmaz</span>
                                    )}
                                    {(() => {
                                      const pos = finishPos(race.result?.actualOrder, pick.runner?.no, race.result?.winnerNos);
                                      return pos != null ? (
                                        <span className={cn("shrink-0 text-[9px] font-semibold", pos === 1 ? "text-winner" : "text-muted-foreground")}>
                                          ({pos}.)
                                        </span>
                                      ) : null;
                                    })()}
                                    {isAdmin && pick.runner?.no != null && agfSiraByRaceId.get(race.id)?.has(pick.runner.no) && (
                                      <span className="shrink-0 rounded bg-purple-500/15 px-1 text-[8px] font-semibold text-purple-500">
                                        A{agfSiraByRaceId.get(race.id)!.get(pick.runner.no)}
                                      </span>
                                    )}
                                  </span>
                                ))}
                                {isWinner && race.result?.ganyan != null && (
                                  <span className="shrink-0 text-[9px] font-semibold text-winner">Gny: {race.result.ganyan.toFixed(2)}</span>
                                )}
                              </div>
                            </td>

                            <td
                              key={`${race.id}-${rowIdx}-puan`}
                              className={cn(
                                "border-r px-1.5 py-1 text-center font-mono tabular-nums whitespace-nowrap last:border-r-0",
                                rowBg,
                                textColor,
                                weight
                              )}
                            >
                              <span className="inline-flex items-center gap-0.5">
                                {rowPicks.map((p) => <PuanHucre key={p.runner?.no ?? p.runnerLabel} score={p.score} details={p.details} scoreExact={p.scoreExact} />)}
                              </span>
                            </td>
                          </>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
