"use client";

import { useState } from "react";
import { getRaceOptionsForDate, type V1RaceOption } from "@/server/actions/v1-analiz.actions";
import {
  FAMILY_TO_STANDARD, STANDARD_FAMILY_ORDER, STANDARD_FAMILY_LABEL,
  signalLabel, EXTREME_Z_THRESHOLD,
} from "./labels";

// ROTAGANYAN ANALİZ MOTORU v1.0 — AnalysisPanel nihai düzenleme (kullanıcı talimatı,
// 2026-10-21, "araştırma tamamlandı, veri bağlantılarında hata yok" sonrası). Bu dosya
// YALNIZ GÖRÜNTÜLEME katmanıdır — /api/admin/v1-analiz'in döndürdüğü ham/skor/katsayı/
// olasılık değerlerine HİÇBİR MÜDAHALE YOK, yalnız aile etiketleri birleştiriliyor,
// veri kapsamı ve aşırı-z-skor uyarısı GÖRÜNÜR kılınıyor.

type SignalRow = {
  code: string;
  family: string | null;
  rawValue: number | null;
  standardizedValue: number;
  learnedCoefficient: number;
  scoreContribution: number;
  missingIndicatorCoefficient: number;
  missingIndicatorContribution: number;
  observed: boolean;
};
type AgfOlcum = { agf: number; capturedAt: string };
type AgfTrend = {
  olcumSayisi: number;
  ilkOlcum: AgfOlcum | null;
  sonOlcum: AgfOlcum | null;
  mutlakPuanFarki: number | null;
  yon: "YUKSELIYOR" | "DUSUYOR" | "DEGISMEDI" | "BILINMIYOR";
  sinif: "ISTIKRARLI" | "OYNAK" | "INCELEME_GEREKTIREN" | null;
  enBuyukTekAdimSicrama: number | null;
  tumOlcumler: AgfOlcum[];
};
type V1AgfDurum = "V1_GUCLU_AGF_YUKSELIYOR" | "V1_GUCLU_AGF_DUSUYOR" | "V1_ZAYIF_AGF_YUKSELIYOR" | "V1_ZAYIF_AGF_DUSUYOR" | "BELIRSIZ";
type RunnerResult = {
  no: number;
  name: string;
  score: number;
  probability: number;
  signalRows: SignalRow[];
  observedCount: number;
  totalCodeCount: number;
  agfTrend: AgfTrend | null;
  v1AgfDurum: V1AgfDurum;
};

const AGF_SINIF_LABEL: Record<string, string> = {
  ISTIKRARLI: "İstikrarlı",
  OYNAK: "Oynak",
  INCELEME_GEREKTIREN: "İnceleme gerektiren",
};
const AGF_SINIF_RENK: Record<string, string> = {
  ISTIKRARLI: "text-hit border-hit/40",
  OYNAK: "text-amber-500 border-amber-500/40",
  INCELEME_GEREKTIREN: "text-miss border-miss/40",
};
const AGF_YON_OK: Record<string, string> = {
  YUKSELIYOR: "▲", DUSUYOR: "▼", DEGISMEDI: "—", BILINMIYOR: "?",
};
const V1_AGF_DURUM_LABEL: Record<V1AgfDurum, string> = {
  V1_GUCLU_AGF_YUKSELIYOR: "V1.0 güçlü / AGF yükseliyor",
  V1_GUCLU_AGF_DUSUYOR: "V1.0 güçlü / AGF düşüyor",
  V1_ZAYIF_AGF_YUKSELIYOR: "V1.0 zayıf / AGF yükseliyor",
  V1_ZAYIF_AGF_DUSUYOR: "V1.0 zayıf / AGF düşüyor",
  BELIRSIZ: "Belirsiz",
};
type FamilyRepresentation = { family: string; scoredCodes: string[]; pendingCodes: string[] };
type ModelMeta = {
  modelVersion: string;
  nTrainRaces: number;
  nHoldoutRaces: number;
  candidateCodeCount: number;
  trainedCodeCount: number;
  excludedCodes: { code: string; observedRate: number | undefined }[];
};
type RaceMeta = {
  raceNo: number; time: string | null; breed: string; surface: string; distance: number;
  classType: string | null; date: string; hippodromeName: string;
};
type ApiResult = {
  raceId: string;
  race: RaceMeta | null;
  analyzedAt: string;
  modelVersion: string;
  modelMeta: ModelMeta;
  modelCodeCount: number;
  fullyPendingFamilies: string[];
  partiallyScoredFamilies: string[];
  families: FamilyRepresentation[];
  runners: RunnerResult[];
};

function contrib(r: SignalRow): number {
  return r.scoreContribution + r.missingIndicatorContribution;
}

/** Bir atın sinyallerini standart aileye göre grupla (INTERACTION ayrı tutulur, 11. aile
 *  SAYILMAZ — kullanıcı talimatı). */
function groupByStandardFamily(rows: SignalRow[]): Map<string, SignalRow[]> {
  const map = new Map<string, SignalRow[]>();
  for (const row of rows) {
    const std = FAMILY_TO_STANDARD[row.family ?? ""] ?? "DIGER";
    const arr = map.get(std) ?? [];
    arr.push(row);
    map.set(std, arr);
  }
  return map;
}

function fmt(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(3);
}

export default function V1AnalizClient({
  initialDate,
  initialRaces,
}: {
  initialDate: string;
  initialRaces: V1RaceOption[];
}) {
  const [date, setDate] = useState(initialDate);
  const [races, setRaces] = useState(initialRaces);
  const [raceId, setRaceId] = useState<string>(initialRaces[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [expandedNo, setExpandedNo] = useState<number | null>(null);
  const [openFamilies, setOpenFamilies] = useState<Set<string>>(new Set());

  async function onDateChange(d: string) {
    setDate(d);
    setResult(null);
    const opts = await getRaceOptionsForDate(d);
    setRaces(opts);
    setRaceId(opts[0]?.id ?? "");
  }

  async function analizEt() {
    if (!raceId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setOpenFamilies(new Set());
    try {
      const res = await fetch("/api/admin/v1-analiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Hata (${res.status})`);
        return;
      }
      setResult(data as ApiResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }

  function toggleFamily(key: string) {
    setOpenFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const excludedByCode = new Map((result?.modelMeta.excludedCodes ?? []).map((e) => [e.code, e.observedRate]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/20 p-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase text-muted-foreground">Tarih</label>
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="mt-1 rounded-md border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <div className="min-w-[260px] flex-1">
          <label className="block text-[10px] font-semibold uppercase text-muted-foreground">Yarış</label>
          <select
            value={raceId}
            onChange={(e) => setRaceId(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            {races.length === 0 && <option value="">Bu tarihte yarış yok</option>}
            {races.map((r) => (
              <option key={r.id} value={r.id}>
                {r.hippodromeName} — {r.raceNo}. Koşu{r.time ? ` (${r.time})` : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={analizEt}
          disabled={!raceId || loading}
          className="rounded-md bg-brand px-4 py-2 text-xs font-bold text-brand-foreground disabled:opacity-50"
        >
          {loading ? "Analiz ediliyor…" : "V1.0 ile Analiz Et"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Model + yarış bilgilendirmesi */}
          <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-xs">
            <div className="font-bold text-foreground">RotaGanyan Analiz Motoru V1.0</div>
            <div className="mt-1 text-muted-foreground">
              Model sürümü: <span className="font-mono text-foreground">{result.modelVersion}</span>
              {" · "}{result.modelMeta.trainedCodeCount} öğrenilmiş özellik ({result.modelMeta.trainedCodeCount - 8} ana aile özelliği + 8 ilişki)
              {" · "}Eğitim: {result.modelMeta.nTrainRaces} yarış, ilk kontrol: {result.modelMeta.nHoldoutRaces} yarış
            </div>
            {result.race && (
              <div className="mt-1 text-muted-foreground">
                {result.race.hippodromeName} — {result.race.raceNo}. Koşu{result.race.time ? ` (${result.race.time})` : ""}
                {" · "}{result.race.breed === "ARAP" ? "Arap" : "İngiliz"} · {result.race.surface} · {result.race.distance}m
                {result.race.classType && ` · ${result.race.classType}`}
                {" · "}{result.race.date.slice(0, 10)}
              </div>
            )}
            <div className="mt-1 text-muted-foreground">
              Analiz zamanı: {new Date(result.analyzedAt).toLocaleString("tr-TR")}
            </div>
            {result.partiallyScoredFamilies.length > 0 && (
              <div className="mt-1.5 text-amber-500">
                Kısmen eğitilmiş aile{result.partiallyScoredFamilies.length > 1 ? "ler" : ""}:{" "}
                {result.partiallyScoredFamilies.map((f) => STANDARD_FAMILY_LABEL[FAMILY_TO_STANDARD[f] ?? f] ?? f).join(", ")}
                {" — "}
                {result.modelMeta.excludedCodes.map((e) => (
                  <span key={e.code} className="ml-1">
                    {signalLabel(e.code)} dışarıda (veri kapsamı %{((e.observedRate ?? 0) * 100).toFixed(1)});
                  </span>
                ))}
              </div>
            )}
            {result.fullyPendingFamilies.length > 0 && (
              <div className="mt-1 text-amber-500">
                Tamamen bekleyen aile: {result.fullyPendingFamilies.map((f) => STANDARD_FAMILY_LABEL[FAMILY_TO_STANDARD[f] ?? f] ?? f).join(", ")}
              </div>
            )}
          </div>

          {/* AGF Trend — ayrı piyasa izleme katmanı (kullanıcı talimatı, 2026-10-21: "AGF
              yükseldi diye ata puan eklemeyelim, V1.0'ın 38 özellikli modeli aynen kalsın,
              AGF Trend ayrı bir izleme katmanı olsun"). Bu bölüm SKORU/SIRALAMAYI/OLASILIĞI
              HİÇ ETKİLEMEZ — yalnız 4-durum matrisi (V1.0 güçlü/zayıf × AGF yön) özetidir. */}
          <div className="rounded-lg border border-dashed bg-muted/10 px-3 py-2.5 text-xs">
            <div className="font-semibold text-foreground">AGF Trend — piyasa izleme katmanı (skora girmez)</div>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["V1_GUCLU_AGF_YUKSELIYOR", "V1_GUCLU_AGF_DUSUYOR", "V1_ZAYIF_AGF_YUKSELIYOR", "V1_ZAYIF_AGF_DUSUYOR"] as const).map((durum) => {
                const atlar = result.runners.filter((r) => r.v1AgfDurum === durum);
                return (
                  <div key={durum} className="rounded-md border px-2 py-1.5">
                    <div className="text-[10px] text-muted-foreground">{V1_AGF_DURUM_LABEL[durum]}</div>
                    <div className="font-bold tabular-nums">{atlar.length}</div>
                    {atlar.length > 0 && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{atlar.map((a) => a.name).join(", ")}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ana tablo — sadeleştirilmiş */}
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left">Sıra</th>
                  <th className="px-3 py-2 text-left">No</th>
                  <th className="px-3 py-2 text-left">At</th>
                  <th className="px-3 py-2 text-right">Kazanma Olasılığı</th>
                  <th className="px-3 py-2 text-right">Skor</th>
                  <th className="px-3 py-2 text-right">Veri Kapsamı</th>
                  <th className="px-3 py-2 text-right">AGF Trend</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {result.runners.map((r, i) => {
                  const isOpen = expandedNo === r.no;
                  const famMap = groupByStandardFamily(r.signalRows);
                  const interactionRows = r.signalRows.filter((row) => (FAMILY_TO_STANDARD[row.family ?? ""] ?? "DIGER") === "INTERACTION");
                  return (
                    <RunnerBlock
                      key={r.no}
                      r={r}
                      i={i}
                      isOpen={isOpen}
                      famMap={famMap}
                      interactionRows={interactionRows}
                      openFamilies={openFamilies}
                      toggleFamily={toggleFamily}
                      excludedByCode={excludedByCode}
                      onToggleOpen={() => setExpandedNo(isOpen ? null : r.no)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RunnerBlock({
  r, i, isOpen, famMap, interactionRows, openFamilies, toggleFamily, excludedByCode, onToggleOpen,
}: {
  r: RunnerResult;
  i: number;
  isOpen: boolean;
  famMap: Map<string, SignalRow[]>;
  interactionRows: SignalRow[];
  openFamilies: Set<string>;
  toggleFamily: (key: string) => void;
  excludedByCode: Map<string, number | undefined>;
  onToggleOpen: () => void;
}) {
  const interactionTotal = interactionRows.reduce((acc, row) => acc + contrib(row), 0);
  return (
    <>
      <tr className={i % 2 === 0 ? "bg-background" : "bg-muted/10"}>
        <td className="px-3 py-2 font-bold">{i + 1}.</td>
        <td className="px-3 py-2 tabular-nums">{r.no}</td>
        <td className="px-3 py-2 font-medium">{r.name}</td>
        <td className="px-3 py-2 text-right font-bold tabular-nums">{(r.probability * 100).toFixed(1)}%</td>
        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.score.toFixed(3)}</td>
        <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
          {r.observedCount}/{r.totalCodeCount} gözlemli
        </td>
        <td className="px-3 py-2 text-right">
          {r.agfTrend?.sinif ? (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${AGF_SINIF_RENK[r.agfTrend.sinif]}`}>
              {AGF_YON_OK[r.agfTrend.yon]} {AGF_SINIF_LABEL[r.agfTrend.sinif]}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">tek ölçüm</span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          <button type="button" onClick={onToggleOpen} className="text-[11px] text-brand underline">
            {isOpen ? "Gizle" : "Analiz detayı"}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={8} className="bg-muted/10 px-3 py-3">
            <div className="space-y-1.5">
              {r.agfTrend && r.agfTrend.olcumSayisi > 0 && <AgfTrendCard trend={r.agfTrend} durum={r.v1AgfDurum} />}
              {STANDARD_FAMILY_ORDER.map((famKey) => {
                const rows = famMap.get(famKey) ?? [];
                if (rows.length === 0) return null;
                const total = rows.reduce((acc, row) => acc + contrib(row), 0);
                const key = `${r.no}-${famKey}`;
                const open = openFamilies.has(key);
                return (
                  <FamilyCard
                    key={key}
                    label={STANDARD_FAMILY_LABEL[famKey]}
                    total={total}
                    rows={rows}
                    open={open}
                    onToggle={() => toggleFamily(key)}
                    excludedByCode={excludedByCode}
                  />
                );
              })}
              {interactionRows.length > 0 && (
                <FamilyCard
                  label={STANDARD_FAMILY_LABEL.INTERACTION}
                  total={interactionTotal}
                  rows={interactionRows}
                  open={openFamilies.has(`${r.no}-INTERACTION`)}
                  onToggle={() => toggleFamily(`${r.no}-INTERACTION`)}
                  excludedByCode={excludedByCode}
                  isInteraction
                />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function AgfTrendCard({ trend, durum }: { trend: AgfTrend; durum: V1AgfDurum }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs"
      >
        <span className="font-semibold">AGF Trend ({V1_AGF_DURUM_LABEL[durum]})</span>
        <span className="flex items-center gap-2">
          {trend.sinif && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${AGF_SINIF_RENK[trend.sinif]}`}>
              {AGF_YON_OK[trend.yon]} {AGF_SINIF_LABEL[trend.sinif]}
            </span>
          )}
          <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t px-3 py-2 text-[11px]">
          <div className="text-muted-foreground">
            {trend.olcumSayisi} ölçüm · ilk %{trend.ilkOlcum?.agf.toFixed(1)} → son %{trend.sonOlcum?.agf.toFixed(1)}
            {trend.mutlakPuanFarki != null && (
              <> · mutlak fark {trend.mutlakPuanFarki >= 0 ? "+" : ""}{trend.mutlakPuanFarki.toFixed(1)} puan</>
            )}
            {trend.enBuyukTekAdimSicrama != null && (
              <> · en büyük tek-adım sıçrama {trend.enBuyukTekAdimSicrama.toFixed(1)} puan</>
            )}
          </div>
          {trend.sinif === "INCELEME_GEREKTIREN" && (
            <div className="text-amber-500">
              Not: bu olağan dışı bir büyüklükte tek-adım hareket — manipülasyon kanıtı DEĞİLDİR, yalnız nedeni henüz açıklanmamış bir hareket olarak işaretlenmiştir.
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {trend.tumOlcumler.map((o, i) => (
              <span key={i} className="rounded border px-1.5 py-0.5 font-mono tabular-nums text-muted-foreground">
                %{o.agf.toFixed(1)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FamilyCard({
  label, total, rows, open, onToggle, excludedByCode, isInteraction,
}: {
  label: string;
  total: number;
  rows: SignalRow[];
  open: boolean;
  onToggle: () => void;
  excludedByCode: Map<string, number | undefined>;
  isInteraction?: boolean;
}) {
  const allMissing = rows.every((r) => !r.observed);
  return (
    <div className={`rounded-lg border ${isInteraction ? "border-brand/30 bg-brand/5" : "border-border"}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs"
      >
        <span className="font-semibold">{label}</span>
        <span className="flex items-center gap-2">
          {allMissing && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">tüm veriler eksik — eksik-veri katkısı</span>
          )}
          <span className={`font-mono font-bold tabular-nums ${total >= 0 ? "text-hit" : "text-miss"}`}>{fmt(total)}</span>
          <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div className="space-y-1 border-t px-3 py-2">
          {rows.map((row) => {
            const extreme = Math.abs(row.standardizedValue) >= EXTREME_Z_THRESHOLD;
            const observedRatePct = excludedByCode.get(row.code);
            return (
              <div key={row.code} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-dashed py-1.5 text-[11px] last:border-0">
                <div className="min-w-[180px] font-medium">
                  {signalLabel(row.code)} <span className="text-muted-foreground">({row.code})</span>
                </div>
                <div className="text-muted-foreground">
                  ham={row.observed ? (row.rawValue != null ? row.rawValue.toFixed(3) : "—") : "yok"}
                </div>
                <div className={row.observed ? "text-foreground" : "text-amber-500"}>
                  {row.observed ? "gözlemli" : "eksik veri" + (observedRatePct != null ? ` (kapsam %${(observedRatePct * 100).toFixed(1)})` : "")}
                </div>
                {row.observed && (
                  <div className="text-muted-foreground">
                    z={row.standardizedValue.toFixed(3)}
                    {extreme && (
                      <span className="ml-1 rounded bg-amber-500/20 px-1 text-[10px] font-semibold text-amber-500">
                        aşırı değer (|z|≥{EXTREME_Z_THRESHOLD})
                      </span>
                    )}
                  </div>
                )}
                <div className="text-muted-foreground">β={row.observed ? row.learnedCoefficient.toFixed(3) : row.missingIndicatorCoefficient.toFixed(3)}</div>
                <div className={`ml-auto font-mono font-semibold tabular-nums ${contrib(row) >= 0 ? "text-hit" : "text-miss"}`}>
                  {fmt(contrib(row))}
                  {!row.observed && <span className="ml-1 text-[9px] text-amber-500">eksik-veri katkısı</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
