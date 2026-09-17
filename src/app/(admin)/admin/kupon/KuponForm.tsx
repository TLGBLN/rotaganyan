"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ekuriRengi } from "@/lib/ekuri-colors";
import { KAPSAM_ESIK_ILK3, KAPSAM_ESIK_ILK6 } from "@/lib/methodology/kapsam-esikleri";
import { optimizeKuponAllocation, type LegProbability } from "@/lib/methodology/kupon-optimizer";
import {
  getRaceDayLegs,
  publishHomeKupon,
  type HomeKuponLegInput,
} from "@/server/actions/home-kupon.actions";

type Hippodrome = { id: string; name: string; slug: string };
type RaceRunner = { no: number; name: string; scratched: boolean; ekuriGroup: number | null; score: number | null; scoreExact: number | null; agfSirasi: number | null };
// 2026-09-16 — Anormal Pist Modu v1 (bkz. anormal-pist-risk.ts). V5.46 skoruna hiç
// girmez, yalnız otomatikGroupSelections'ın minUnitCounts zorlaması + amber uyarı için.
type RaceRiskInfo = {
  pistAnormalMi: boolean;
  pistDuyarliligi: string | null;
  gecmisRiskSeviyesi: string | null;
  pistUyariMesaji: string | null;
  // 2026-09-17 — Race Context Invalidation (bkz. race-context-invalidation.ts). true ise
  // bu koşunun analizi artık GEÇERSİZ bir yarış bağlamı için üretilmiş (pist/mesafe/sınıf/
  // at listesi değişti) — otomatikGroupSelections bu koşuyu TAMAMEN dışlar (bkz. aşağıda).
  stale: boolean;
  staleReason: string | null;
};
type RaceDayData = {
  hippodromeName: string;
  races: ({ raceNo: number; runners: RaceRunner[] } & RaceRiskInfo)[];
};

type Width = "narrow" | "normal" | "wide";
// 2026-09-05 kullanıcı bulgusu: "kuponlar birbirinden bağımsız olsun, birini
// işaretleyince diğerleri etkileniyor" — GroupSelections eskiden TEK, tüm KuponGrup
// örnekleri (1.Altılı/2.Altılı/7'li Ganyan) arasında raceNo bazında PAYLAŞILAN tek bir
// nesneydi. Altılı pencereleri kasıtlı olarak üst üste biniyor (bkz. chunkIntoAltili) ve
// 7'li Ganyan neredeyse her zaman 2.Altılı ile aynı koşuları kapsıyor — ortak bir raceNo
// için bir gruptaki işaret diğerinde de aynı at olarak görünüyordu. Artık her kupon grubu
// kendi anahtarıyla (altili-0/altili-1/yedili-ganyan) TAMAMEN ayrı bir GroupSelections
// tutuyor, aynı koşu numarası birden fazla grupta olsa bile birbirinden bağımsız.
type GroupSelections = Record<number, Record<Width, Set<number>>>;
type Selections = Record<string, GroupSelections>;

const WIDTHS: Width[] = ["narrow", "normal", "wide"];
const WIDTH_LABEL: Record<Width, string> = { narrow: "Ekonomik", normal: "Normal", wide: "Geniş" };
const ALTILI_STAKE_PER_COMBINATION = 1.25;
// 2026-09-12 kullanıcı talebi: Diyarbakır/Şanlıurfa/Elazığ'ın Altılı kombinasyon başı
// ücreti diğer hipodromlardan farklı, 1₺ — race.service.ts'teki stakeForHippodromeLabel
// ile AYNI ayrım burada da uygulanıyor (iki dosya AYRI kopyalar, admin formu ile
// yayınlanan kuponun anasayfa gösterimi tutarlı kalsın diye).
const DUSUK_UCRETLI_HIPODROMLAR = ["Diyarbakır", "Şanlıurfa", "Elazığ"];
const ALTILI_STAKE_DUSUK = 1;
function stakeForHippodrome(hippodromeName: string): number {
  return DUSUK_UCRETLI_HIPODROMLAR.some((h) => hippodromeName.includes(h)) ? ALTILI_STAKE_DUSUK : ALTILI_STAKE_PER_COMBINATION;
}
// v6.111 — kullanıcı düzeltmesi 2026-08-13: 7'li Ganyan'ın kombinasyon başı ücreti
// Altılı'dan (1.25₺) farklı, TJK'da 2₺. Pool limitleri (600/1500/3000) için gerçek
// 7'li Ganyan rakamı henüz doğrulanmadı, Altılı'dan aynen kopyalandı — yanlışsa düzelt.
const YEDILI_GANYAN_STAKE_PER_COMBINATION = 2;
const LIMITS: Record<Width, number> = { narrow: 600, normal: 1500, wide: 3000 };
const TOLERANCE = 1.10; // %10 esneme payı
// 2026-09-05 kullanıcı talebi: Ekonomik'te esneme payı 660₺ değil 700₺'ye kadar izin
// versin (diğer ikisi hâlâ standart +%10). Base LIMITS.narrow (600₺) hedef olarak kalır,
// yalnız üst sınır (effectiveLimit) genişliyor.
const TOLERANCES: Record<Width, number> = { narrow: 700 / LIMITS.narrow, normal: TOLERANCE, wide: TOLERANCE };
// 2026-09-12 kullanıcı talebi — 7'li Ganyan da artık Ekonomik/Normal/Geniş üçünü birden
// gösteriyor (v6.111'deki "yalnız Geniş" kararı GERİ ALINDI), kendi hedef aralıklarıyla:
// Eko 500-700₺, Normal 1400-1500₺, Geniş 3000-3200₺ — Altılı'nın LIMITS/TOLERANCES'ından
// BAĞIMSIZ, kendi sabitleri (kombinasyon ücreti hâlâ 2₺, YEDILI_GANYAN_STAKE_PER_COMBINATION).
const YEDILI_LIMITS: Record<Width, number> = { narrow: 500, normal: 1400, wide: 3000 };
const YEDILI_TOLERANCES: Record<Width, number> = { narrow: 700 / 500, normal: 1500 / 1400, wide: 3200 / 3000 };

function emptySelection(): Record<Width, Set<number>> {
  return { narrow: new Set(), normal: new Set(), wide: new Set() };
}

function emptyGroupSelections(races: { raceNo: number }[]): GroupSelections {
  const sel: GroupSelections = {};
  races.forEach((r) => { sel[r.raceNo] = emptySelection(); });
  return sel;
}

// 2026-09-11 kullanıcı bulgusu ("bir 600 TL'lik kupon yaparken bu mantıkla hiç kupon
// tutturamayız") — her ayağa kendi "güvenli" genişliğini vermek sabit bütçeye SIĞMIYOR
// (6 ayağın hepsine 3 at bile yazsan 3⁶=729 kombinasyon, 700₺'nin üstü). Gerçek çözüm her
// ayağı ayrı ayrı değil, sabit bütçeyi TÜM ayaklar arasında en yüksek toplam-isabet
// olasılığını verecek şekilde DAĞITMAK — bkz. kupon-optimizer.ts. Bu fonksiyon her üç
// kademe (Ekonomik/Normal/Geniş) için AYRI bir optimizasyon çalıştırıp TEK bir
// GroupSelections'ta birleştiriyor.
// 2026-09-16 — Anormal Pist Modu v1 (bkz. anormal-pist-risk.ts): HASSAS/ÇOK HASSAS
// ayaklarda "tek at yazma, en az bir alternatif daha bırak" kuralı — kullanıcı kararı:
// v1'de ikisi de aynı zorunlu minimuma (2) tabi, "natural pick count + 1" hesaplamak
// (optimizer'ı önce kısıtsız çalıştırmayı gerektirir) ŞİMDİLİK basitleştirildi.
const ANORMAL_PIST_ZORUNLU_MINIMUM = 2;

function anormalPistZorunluMinimumHesapla(races: RaceDayData["races"]): Record<number, number> {
  const zorunlu: Record<number, number> = {};
  for (const race of races) {
    if (race.pistDuyarliligi === "HASSAS" || race.pistDuyarliligi === "COK_HASSAS") {
      zorunlu[race.raceNo] = ANORMAL_PIST_ZORUNLU_MINIMUM;
    }
  }
  return zorunlu;
}

function otomatikGroupSelections(
  races: RaceDayData["races"],
  stakePerCombination: number,
  limits: Record<Width, number> = LIMITS,
  tolerances: Record<Width, number> = TOLERANCES
): GroupSelections {
  const zorunluMinimum = anormalPistZorunluMinimumHesapla(races);
  // 2026-09-17 — Race Context Invalidation: STALE bir koşunun picks'i artık GEÇERSİZ bir
  // yarış bağlamına (eski pist/mesafe/at listesi) ait olabilir — otomatik doldurma bu
  // ayağa HİÇ dokunmaz (0 at seçili kalır), admin elle yeniden analiz edip doldurmalı.
  const legs: LegProbability[] = races
    .filter((race) => !race.stale)
    .map((race) => ({
    raceNo: race.raceNo,
    runners: race.runners
      .filter((r) => !r.scratched)
      // 2026-09-13 kullanıcı bulgusu (İstanbul K5) — yuvarlanmış tam sayı score (11=11)
      // gerçekte farklı iki atı eşitmiş gibi gösterip DP'nin yanlış atı seçmesine yol
      // açabiliyordu; varsa ham scoreExact kullanılıyor. ekuriGroup de taşınıyor —
      // optimizer artık eküri çiftini TEK kombinasyon birimi olarak sayabiliyor (bkz.
      // kupon-optimizer.ts, aynı bulgudan gelen ikinci düzeltme).
      .map((r) => ({ no: r.no, olasilik: (r.scoreExact ?? r.score ?? 0) / 100, ekuriGroup: r.ekuriGroup })),
  }));
  const sel = emptyGroupSelections(races);
  // 2026-09-13 kullanıcı bulgusu (Adana K1/K2) — Ekonomik/Normal/Geniş eskiden birbirinden
  // habersiz üç bağımsız DP koşusuydu; gerçek veriyle test edilince bütçe arttıkça bir
  // ayaktaki at sayısının MONOTON artmadığı kanıtlandı (daha pahalı kademe bazı ayaklarda
  // daha ucuz kademeden DAHA AZ at seçebiliyordu). WIDTHS zaten ucuzdan pahalıya sıralı
  // (narrow→normal→wide) — her kademe artık bir öncekinin seçtiği birim sayısını TABAN
  // alıyor (yalnız üzerine ekler, hiç eksiltmez), taban bir sonraki DP çağrısına
  // `minUnitCounts` olarak geçiyor.
  let oncekiBirimSayilari: Record<number, number> | undefined;
  for (const width of WIDTHS) {
    const effectiveLimit = limits[width] * tolerances[width];
    const maxCombinations = Math.max(1, Math.floor(effectiveLimit / stakePerCombination));
    // Anormal Pist Modu: zorunlu minimum, bir önceki (ucuz) kademenin tabanıyla
    // BİRLEŞTİRİLİR (ikisinin büyüğü) — HASSAS/ÇOK HASSAS bir ayak Ekonomik'te bile
    // en az 2 at taşır; bütçeye sığmıyorsa optimizeKuponAllocation zaten boş
    // (toplamKombinasyon=0) döner, o kademe otomatik boş kalır (bkz. buildKuponOnerisi
    // hasNarrow/hasNormal/hasWide — boş kademe yayınlanmaz, ZORLA doldurulmaz).
    const minUnitCounts: Record<number, number> = { ...oncekiBirimSayilari };
    for (const [raceNoStr, min] of Object.entries(zorunluMinimum)) {
      const raceNo = Number(raceNoStr);
      minUnitCounts[raceNo] = Math.max(minUnitCounts[raceNo] ?? 1, min);
    }
    const { secimler, birimSayilari } = optimizeKuponAllocation(legs, maxCombinations, minUnitCounts);
    oncekiBirimSayilari = birimSayilari;
    for (const race of races) {
      sel[race.raceNo][width] = new Set(secimler[race.raceNo] ?? []);
    }
  }
  return sel;
}

/**
 * 1. Altılı her zaman ilk 6 koşu (1-6); 2. Altılı her zaman son 6 koşu.
 * Günde 9 koşu varsa: 1. Altılı = 1-6, 2. Altılı = 4-9 (4-5-6 ortak/üst üste biner).
 * 12 koşu varsa üst üste binme olmaz (1-6 / 7-12). 6 veya daha az koşu varsa tek grup.
 */
function chunkIntoAltili<T>(races: T[]): T[][] {
  if (races.length <= 6) return races.length > 0 ? [races] : [];
  return [races.slice(0, 6), races.slice(races.length - 6)];
}

// v6.110 — kullanıcı talebi 2026-08-13: "7'li Ganyan" — TJK'nın gerçek bahis türü,
// Altılı'dan farklı olarak SONDAN başlayarak 7 koşu (günün son 7 koşusu). Altılı'nın
// aksine tek bir sabit pencere — 9 koşu olsa da 12 koşu olsa da her zaman son 7'si.
// Günün 7'den az koşusu varsa bölüm hiç gösterilmez (7'li Ganyan oynanamaz).
const YEDILI_GANYAN_SLOT = 7; // Altılı slotları (1, en fazla 2) ile asla çakışmaz
function sonYediKosu<T>(races: T[]): T[] | null {
  return races.length >= 7 ? races.slice(races.length - 7) : null;
}

// 2026-08-31 kullanıcı bulgusu (Karma/GÜL AYALI vakası, kök-neden analiziyle KANITLANDI):
// bir ayakta Ekonomik/Normal/Geniş'in AYNI atları taşıması ("statik ayak") — Geniş'e
// bütçe ödenip hiç genişletilmemesi — kuponun en zayıf halkası oluyor. O gerçek vakada
// 6 ayaktan 5'i tuttu, yalnız statik bırakılan tek ayak kaçırdı (gerçek kazanan %3
// olasılıklı bir at, hiçbir tier'de yoktu). Bu, otomatik kupon oluşturma DEĞİL (o
// özellik ayrı bir kullanıcı kararıyla tamamen geri alındı) — yalnız yayınlamadan ÖNCE
// admin'i UYARAN, engellemeyen bir kontrol. Genişletmenin gerçekten MÜMKÜN olduğu
// (sahada seçilenden daha fazla koşabilir at varken) durumlarda tetiklenir.
function statikAyaklariBul(races: RaceDayData["races"], selections: GroupSelections): number[] {
  const sonuc: number[] = [];
  for (const race of races) {
    const sel = selections[race.raceNo] ?? emptySelection();
    if (sel.narrow.size === 0) continue;
    const ayniMi =
      sel.narrow.size === sel.normal.size &&
      sel.normal.size === sel.wide.size &&
      [...sel.narrow].every((no) => sel.normal.has(no) && sel.wide.has(no));
    if (!ayniMi) continue;
    const musaitAtSayisi = race.runners.filter((r) => !r.scratched).length;
    if (musaitAtSayisi > sel.narrow.size) sonuc.push(race.raceNo);
  }
  return sonuc;
}

// 2026-09-09 kullanıcı talebi ("kırmızı bir çizgi ile sınırı çizebilirsin, toplamları
// göstermek için") — seçim tablosunda ilk 3/ilk 6 atın kümülatif toplamı gösteriliyor;
// RaceAdviceCard'daki modelTabanliKapsamOnerisi'nin (top3≥%65/top6≥%80 eşikleri) AYNISI,
// burada da admin seçim yaparken görsün diye kırmızı çizgiyle işaretleniyor. `race.runners`
// artık getRaceDayLegs'ten ZATEN puana göre (yüksekten düşüğe) sıralı geliyor — bkz.
// home-kupon.actions.ts, 2026-09-09 düzeltmesi (eskiden Pick.rank'e göreydi, puan tablosuyla
// tutarsızlık yaratıyordu). Çekilen (scratched) at kümülatif toplama katkı vermiyor.
function kumulatifToplam(sirali: RaceRunner[], n: number): number {
  return sirali.slice(0, n).reduce((acc, r) => acc + (r.scratched ? 0 : r.score ?? 0), 0);
}

// 2026-09-13 kullanıcı bulgusu (İstanbul K5) — bkz. kupon-optimizer.ts'teki eküri-birimi
// yorumu. Otomatik doldurma artık eküri çiftini tek birim sayıyor ama admin bir ayakta
// AYNI eküriden iki atı ELLE de işaretleyebilir — kombinasyon/tutar hesabı da (yalnız DP
// değil) tutarlı olsun diye burada da aynı gruplama uygulanıyor: aynı ekuriGroup'tan
// seçilen atlar TEK kombinasyon birimi sayılır.
function secilenBirimSayisi(race: RaceDayData["races"][number], secilenNolar: Set<number>): number {
  const gruplar = new Set<number>();
  let tekilSayisi = 0;
  for (const no of secilenNolar) {
    const runner = race.runners.find((r) => r.no === no);
    if (runner?.ekuriGroup != null && runner.ekuriGroup >= 1) {
      gruplar.add(runner.ekuriGroup);
    } else {
      tekilSayisi++;
    }
  }
  return tekilSayisi + gruplar.size;
}

function legCounts(races: RaceDayData["races"], selections: GroupSelections, width: Width): number[] {
  return races.map((r) => Math.max(secilenBirimSayisi(r, (selections[r.raceNo] ?? emptySelection())[width]), 1));
}

function amountFor(counts: number[], stakePerCombination: number): number {
  const combinations = counts.reduce((acc, n) => acc * n, 1);
  return Math.round(combinations * stakePerCombination * 100) / 100;
}

// v6.110 — Altılı gruplarıyla 7'li Ganyan bölümü AYNI tablo/özet/yayınla arayüzünü
// paylaşıyor, yalnız hangi koşuları kapsadığı ve etiketi farklı — kod tekrarını
// önlemek için ortak bileşene çıkarıldı.
function KuponGrup({
  label, races, selections, onToggle, onAutoFill, amounts, onSubmit, publishing, stakePerCombination, widths = WIDTHS,
  limits = LIMITS, tolerances = TOLERANCES,
}: {
  label: string;
  races: RaceDayData["races"];
  selections: GroupSelections;
  onToggle: (raceNo: number, width: Width, no: number) => void;
  onAutoFill: () => void;
  amounts: Record<Width, number>;
  onSubmit: () => void;
  publishing: boolean;
  stakePerCombination: number;
  widths?: Width[];
  /** 2026-09-12 — 7'li Ganyan Altılı'dan FARKLI hedef aralıklar kullanıyor (YEDILI_LIMITS/
   *  YEDILI_TOLERANCES) — verilmezse Altılı'nın varsayılan LIMITS/TOLERANCES'ı kullanılır. */
  limits?: Record<Width, number>;
  tolerances?: Record<Width, number>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        {/* 2026-09-11 kullanıcı bulgusu ("600₺'ye bu mantıkla hiç kupon tutturamayız") —
            her ayağa kendi güvenli genişliğini vermek sabit bütçeye sığmıyor; bu buton
            sabit bütçeyi ayaklar arasında en yüksek toplam-isabet olasılığını verecek
            şekilde dağıtır (bkz. kupon-optimizer.ts), üç kademeyi de TEK tıkla doldurur.
            Yalnız ÖNERİ doldurur — "Kupon Oluştur" (Yayınla) ayrı, admin gözden geçirip
            onaylamadan hiçbir şey yayınlanmaz. */}
        <button
          type="button"
          onClick={onAutoFill}
          className="shrink-0 rounded-md border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/20"
        >
          ⚡ Otomatik Doldur (bütçeye göre)
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/40">
              <th className="border-b px-3 py-2 text-left text-xs font-medium text-muted-foreground">Koşu</th>
              {widths.map((width) => (
                <th key={width} className="border-b px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  {WIDTH_LABEL[width]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {races.map((race, i) => {
              const sel = selections[race.raceNo] ?? emptySelection();
              const sirali = race.runners;
              return (
                <tr key={race.raceNo} className={cn("border-b last:border-0", i % 2 === 1 && "bg-muted/20")}>
                  <td className="px-3 py-3 align-top text-sm font-semibold whitespace-nowrap">
                    {race.raceNo}. Koşu
                  </td>
                  {widths.map((width) => (
                    <td key={width} className="px-3 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        {sirali.map((runner, idx) => {
                          const checked = sel[width].has(runner.no);
                          return (
                            <div key={runner.no}>
                              <button
                                type="button"
                                onClick={() => !runner.scratched && onToggle(race.raceNo, width, runner.no)}
                                disabled={runner.scratched}
                                className={cn(
                                  "flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-xs transition-colors",
                                  runner.scratched
                                    ? "border-muted-foreground/15 opacity-40 cursor-not-allowed"
                                    : checked
                                    ? "border-brand bg-brand text-brand-foreground"
                                    : "border-muted-foreground/30 text-muted-foreground hover:border-brand/50 hover:text-foreground"
                                )}
                              >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-black/10 font-bold">
                                  {runner.no}
                                </span>
                                <span className={cn("truncate font-medium", runner.scratched && "line-through")}>
                                  {runner.name}
                                </span>
                                {runner.score != null && (
                                  <span
                                    className="shrink-0 text-[10px] font-semibold tabular-nums opacity-80"
                                    title={runner.scoreExact != null ? "Ham (yuvarlanmamış) olasılık" : undefined}
                                  >
                                    {/* 2026-09-13 kullanıcı bulgusu (İstanbul K5) — yuvarlanmış
                                        tam sayı (%11) iki farklı atı eşitmiş gibi gösterip kupon
                                        seçiminde yanlış tercihe yol açabiliyor (gerçek: %25.6 vs
                                        %24.8) — ondalık hane varsa göster. */}
                                    %{runner.scoreExact != null ? runner.scoreExact.toFixed(1) : runner.score}
                                  </span>
                                )}
                                {runner.agfSirasi != null && (
                                  <span
                                    title="AGF sırası"
                                    className="shrink-0 rounded-sm bg-black/10 px-1 text-[9px] font-bold tabular-nums opacity-70"
                                  >
                                    AGF{runner.agfSirasi}
                                  </span>
                                )}
                                {runner.scratched ? (
                                  <span className="ml-auto shrink-0 text-[10px] text-red-400 font-semibold">Koşmaz</span>
                                ) : runner.ekuriGroup != null ? (
                                  <span title={`Eküri grubu ${runner.ekuriGroup}`} className="ml-auto shrink-0 inline-flex items-center gap-0.5 text-[10px]">
                                    <span className={cn("inline-block h-1.5 w-1.5 rounded-full", ekuriRengi(runner.ekuriGroup).badge)} />
                                    🐴
                                  </span>
                                ) : null}
                              </button>
                              {(idx === 2 || idx === 5) && sirali.length > idx + 1 && (() => {
                                // 2026-09-10 kullanıcı talebi: ayraç eşik altındaysa kırmızı,
                                // eşik ve üstündeyse yeşil olsun — RaceAdviceCard'daki rozetle
                                // AYNI paylaşılan eşiklerden (kapsam-esikleri.ts) besleniyor.
                                const esik = idx === 2 ? KAPSAM_ESIK_ILK3 : KAPSAM_ESIK_ILK6;
                                const toplam = kumulatifToplam(sirali, idx + 1);
                                const yeterli = toplam >= esik;
                                return (
                                  <div
                                    className="my-1 flex items-center gap-1.5 px-0.5"
                                    title={`İlk ${idx + 1} atın modele göre toplam kazanma olasılığı — eşik ≥%${esik}`}
                                  >
                                    <div className={cn("h-px flex-1", yeterli ? "bg-hit/50" : "bg-red-500/50")} />
                                    <span className={cn("shrink-0 text-[9px] font-bold tabular-nums", yeterli ? "text-hit" : "text-red-500")}>
                                      İlk {idx + 1}: %{Math.round(toplam)} {yeterli ? "✓" : `(eşik ≥%${esik})`}
                                    </span>
                                    <div className={cn("h-px flex-1", yeterli ? "bg-hit/50" : "bg-red-500/50")} />
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Canlı özet — formül: ayaklardaki at sayıları çarpılır × kombinasyon ücreti */}
      <div className={cn("grid gap-3", widths.length === 1 ? "grid-cols-1 max-w-xs" : "grid-cols-3")}>
        {widths.map((width) => {
          const amount = amounts[width];
          const limit = limits[width];
          const effectiveLimit = limit * tolerances[width];
          const maxCombos = Math.floor(effectiveLimit / stakePerCombination);
          const currentCombos = Math.round(amount / stakePerCombination);
          const remaining = maxCombos - currentCombos;
          const over = amount > effectiveLimit;
          return (
            <div key={width} className={cn("rounded-lg border p-3 text-center transition-colors", over ? "border-red-500/60 bg-red-500/5" : "")}>
              <div className="text-xs font-medium text-muted-foreground">{WIDTH_LABEL[width]}</div>
              <div className={cn("mt-1 text-lg font-bold", over ? "text-red-500" : "")}>
                {amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {currentCombos.toLocaleString("tr-TR")} / {maxCombos.toLocaleString("tr-TR")} kombo
              </div>
              <div className={cn("text-[10px] mt-0.5 font-semibold", over ? "text-red-500" : "text-muted-foreground")}>
                {over
                  ? `⚠ ${Math.abs(remaining).toLocaleString("tr-TR")} kombo aştı`
                  : `${remaining.toLocaleString("tr-TR")} kombo kaldı`}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 border-t pt-1">
                max {maxCombos.toLocaleString("tr-TR")} kombo · {effectiveLimit.toLocaleString("tr-TR")} ₺{" "}
                <span className="opacity-60">(+%{Math.round((tolerances[width] - 1) * 100)})</span>
              </div>
            </div>
          );
        })}
      </div>

      {widths.some((w) => amounts[w] > limits[w] * tolerances[w]) && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          ⚠ Bir veya daha fazla kupon türü limit aşıyor. Kaydetmeden önce seçimleri azaltın.
        </div>
      )}

      {widths.length === 3 && statikAyaklariBul(races, selections).length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
          ⚠ {statikAyaklariBul(races, selections).map((n) => `${n}. Koşu`).join(", ")} ayağında Ekonomik/Normal/Geniş
          AYNI atları taşıyor — bu ayak hiç genişletilmemiş. Genişletmeden bütçe ödemek, kazananın
          başka bir atta çıktığı her senaryoda TÜM kuponu düşürür (bkz. Karma/GÜL AYALI vakası).
        </div>
      )}

      {/* 2026-09-17 — Race Context Invalidation: bu ayaklar otomatik doldurmaya HİÇ dahil
          edilmedi (bkz. otomatikGroupSelections'taki filtre) — admin bu koşuları yeniden
          analiz edip elle doldurmalı, aksi halde bu ayaklar boş kalır. */}
      {races.some((r) => r.stale) && (
        <div className="space-y-1 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {races
            .filter((r) => r.stale)
            .map((r) => (
              <div key={r.raceNo} className="font-semibold">
                🛑 {r.raceNo}. Koşu — ANALİZ BAYAT, otomatik doldurmaya dahil edilmedi: {r.staleReason ?? "yarış bağlamı değişti, yeniden analiz gerekli."}
              </div>
            ))}
        </div>
      )}

      {/* 2026-09-16 — Anormal Pist Modu v1 (bkz. anormal-pist-risk.ts): V5.46 skoruna
          hiç girmez, yalnız admin'i bilgilendirir — bu ayaklarda zorunlu minimum 2 at
          uygulandı, bütçeye sığmıyorsa o kademe (özellikle Ekonomik) boş kalabilir. */}
      {races.some((r) => r.pistDuyarliligi === "HASSAS" || r.pistDuyarliligi === "COK_HASSAS") && (
        <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
          {races
            .filter((r) => r.pistDuyarliligi === "HASSAS" || r.pistDuyarliligi === "COK_HASSAS")
            .map((r) => (
              <div key={r.raceNo}>
                ⚠ {r.raceNo}. Koşu — Anormal Pist ({r.pistDuyarliligi}
                {r.gecmisRiskSeviyesi && r.gecmisRiskSeviyesi !== "YETERLI" ? `, Geçmiş Riski: ${r.gecmisRiskSeviyesi}` : ""}):{" "}
                {r.pistUyariMesaji || "bu ayakta en az 2 at zorunlu tutuldu, bütçeye sığmıyorsa kademe boş kalabilir."}
              </div>
            ))}
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={publishing}
        className="w-full rounded-md bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
      >
        {publishing ? "Oluşturuluyor…" : "Kupon Oluştur"}
      </button>
    </div>
  );
}

function amountsForGroup(group: RaceDayData["races"], selections: GroupSelections, stakePerCombination: number): Record<Width, number> {
  return WIDTHS.reduce((acc, width) => {
    acc[width] = amountFor(legCounts(group, selections, width), stakePerCombination);
    return acc;
  }, {} as Record<Width, number>);
}

export default function KuponForm({ hippodromes }: { hippodromes: Hippodrome[] }) {
  const router = useRouter();
  const [loading, startLoading] = useTransition();
  const [publishingKey, setPublishingKey] = useState<string | null>(null);

  const [slug, setSlug] = useState(hippodromes[0]?.slug ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [raceDay, setRaceDay] = useState<RaceDayData | null>(null);
  const [selections, setSelections] = useState<Selections>({});

  const altiliGroups = useMemo(
    () => (raceDay ? chunkIntoAltili(raceDay.races) : []),
    [raceDay]
  );

  const altiliStake = stakeForHippodrome(raceDay?.hippodromeName ?? "");

  const groupAmounts = useMemo(
    () => altiliGroups.map((group, i) => amountsForGroup(group, selections[`altili-${i}`] ?? {}, altiliStake)),
    [altiliGroups, selections, altiliStake]
  );

  // v6.110 — "7'li Ganyan": her zaman günün SON 7 koşusu, Altılı pencerelerinden
  // bağımsız sabit bir dilim. 7'den az koşu varsa bölüm hiç render edilmez.
  const yediliGanyanRaces = useMemo(
    () => (raceDay ? sonYediKosu(raceDay.races) : null),
    [raceDay]
  );
  const yediliGanyanAmounts = useMemo(
    () => (yediliGanyanRaces ? amountsForGroup(yediliGanyanRaces, selections["yedili-ganyan"] ?? {}, YEDILI_GANYAN_STAKE_PER_COMBINATION) : null),
    [yediliGanyanRaces, selections]
  );

  function fetchRaceDay() {
    if (!slug) return;
    startLoading(async () => {
      const data = await getRaceDayLegs(slug, date);
      if (!data) {
        toast.error("Bu tarih için koşu programı bulunamadı");
        setRaceDay(null);
        return;
      }
      setRaceDay(data);
      const next: Selections = {};
      chunkIntoAltili(data.races).forEach((group, i) => { next[`altili-${i}`] = emptyGroupSelections(group); });
      const yedili = sonYediKosu(data.races);
      if (yedili) next["yedili-ganyan"] = emptyGroupSelections(yedili);
      setSelections(next);
    });
  }

  function toggleHorse(groupKey: string, raceNo: number, width: Width, no: number) {
    setSelections((prev) => {
      const group = prev[groupKey] ?? {};
      const race = group[raceNo] ?? emptySelection();
      const set = new Set(race[width]);
      if (set.has(no)) set.delete(no);
      else set.add(no);
      return { ...prev, [groupKey]: { ...group, [raceNo]: { ...race, [width]: set } } };
    });
  }

  function autoFillGroup(
    groupKey: string,
    races: RaceDayData["races"],
    stakePerCombination: number,
    limits?: Record<Width, number>,
    tolerances?: Record<Width, number>
  ) {
    const sel = otomatikGroupSelections(races, stakePerCombination, limits, tolerances);
    setSelections((prev) => ({ ...prev, [groupKey]: sel }));
    toast.success("Öneri dolduruldu — gözden geçirip yayınlamadan önce düzenleyebilirsin");
  }

  async function submitGroup(group: RaceDayData["races"], key: string, label: string, slot: number) {
    if (!raceDay) return;

    const groupSel = selections[key] ?? {};
    const legs: HomeKuponLegInput[] = group
      .map((r) => {
        const sel = groupSel[r.raceNo] ?? emptySelection();
        return {
          raceNo: r.raceNo,
          narrow: [...sel.narrow].sort((a, b) => a - b),
          normal: [...sel.normal].sort((a, b) => a - b),
          wide: [...sel.wide].sort((a, b) => a - b),
        };
      })
      .filter((l) => l.narrow.length > 0 || l.normal.length > 0 || l.wide.length > 0);

    if (legs.length === 0) {
      toast.error("En az bir koşuda at seç");
      return;
    }

    setPublishingKey(key);
    try {
      await publishHomeKupon({
        hippodromeName: `${raceDay.hippodromeName} — ${label}`,
        date,
        legs,
        slot,
      });
      toast.success(`${label} kuponu oluşturuldu ve anasayfada yayınlandı`);
      router.refresh();
    } finally {
      setPublishingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Hipodrom</label>
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {hippodromes.map((h) => (
              <option key={h.slug} value={h.slug}>{h.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Tarih</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:brightness-200"
          />
        </div>
        <button
          type="button"
          onClick={fetchRaceDay}
          disabled={loading}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {loading ? "Yükleniyor…" : "Koşuları Getir"}
        </button>
      </div>

      {raceDay && (
        <div className="space-y-4">
          {/* Bahis kuponu tarzı: her ayak için at numarası butonları, sütun=şablon */}
          {altiliGroups.map((chunk, chunkIdx) => {
            // 2026-08-16 kullanıcı bulgusu: bu slotLabel eskiden hem burada hem
            // submitGroup içinde raceDay.hippodromeName ile birleştiriliyordu —
            // "İstanbul — İstanbul — 1. Altılı" gibi ÇİFT şehir adı üretiyordu, bu da
            // altili-match.ts'in "cityName — altiliLabel" 2-parçalı bölme varsayımını
            // bozup TJK ikramiye eşleşmesini sessizce hep null döndürüyordu. label
            // (gösterim) şehirli kalır, submitGroup'a şehirsiz slotLabel gönderilir —
            // şehir prefiksi ARTIK YALNIZ submitGroup'ta tek yerde ekleniyor.
            const slotLabel = altiliGroups.length > 1 ? `${chunkIdx + 1}. Altılı` : "1. Altılı";
            const label = `${raceDay.hippodromeName} — ${slotLabel}`;
            const key = `altili-${chunkIdx}`;
            return (
              <KuponGrup
                key={key}
                label={label}
                races={chunk}
                selections={selections[key] ?? {}}
                onToggle={(raceNo, width, no) => toggleHorse(key, raceNo, width, no)}
                onAutoFill={() => autoFillGroup(key, chunk, altiliStake)}
                amounts={groupAmounts[chunkIdx]}
                stakePerCombination={altiliStake}
                onSubmit={() => submitGroup(chunk, key, slotLabel, chunkIdx + 1)}
                publishing={publishingKey === key}
              />
            );
          })}

          {/* v6.110 — "7'li Ganyan": her zaman günün son 7 koşusu, kullanıcı talebi 2026-08-13.
              2026-09-12: artık Ekonomik/Normal/Geniş üçünü birden gösterir (v6.111'deki
              "yalnız Geniş" kararı geri alındı), kendi hedef aralıklarıyla (YEDILI_LIMITS). */}
          {yediliGanyanRaces && yediliGanyanAmounts && (
            <KuponGrup
              label={`${raceDay.hippodromeName} — 7'li Ganyan`}
              races={yediliGanyanRaces}
              selections={selections["yedili-ganyan"] ?? {}}
              onToggle={(raceNo, width, no) => toggleHorse("yedili-ganyan", raceNo, width, no)}
              onAutoFill={() => autoFillGroup("yedili-ganyan", yediliGanyanRaces, YEDILI_GANYAN_STAKE_PER_COMBINATION, YEDILI_LIMITS, YEDILI_TOLERANCES)}
              amounts={yediliGanyanAmounts}
              stakePerCombination={YEDILI_GANYAN_STAKE_PER_COMBINATION}
              limits={YEDILI_LIMITS}
              tolerances={YEDILI_TOLERANCES}
              onSubmit={() => submitGroup(yediliGanyanRaces, "yedili-ganyan", "7'li Ganyan", YEDILI_GANYAN_SLOT)}
              publishing={publishingKey === "yedili-ganyan"}
            />
          )}
        </div>
      )}
    </div>
  );
}
