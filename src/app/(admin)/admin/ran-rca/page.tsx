// RAN'a özel, izole/salt-okuma RCA önizlemesi.
// Eski /admin/root-cause (V5.46.1) ve production tahmin akışları değiştirilmez.
// Yönetici layout'u auth()+EDITOR eşiğini uygular; yarış analizi ancak geçerli query ile başlar.
// Yalnız RAN RCA önizleme sayfası: hesaplamayı Supabase'in Seul (ap-northeast-2)
// bölgesiyle aynı Vercel bölgesine yönlendir. Diğer production rotaları ETKİLENMEZ.
// Gerçek region, ancak preview deployment Function metadata/loglarından doğrulanır.
export const preferredRegion = "icn1";

import { loadTrainedModel } from "@/lib/rotaganyan-analiz-motoru/load-trained-model";
import { analyzeRaceDemotion, type MissAnalysis } from "@/lib/rotaganyan-analiz-motoru/rca/analyze-race";
import type { PedigreeComparison, PedigreeEffect } from "@/lib/rotaganyan-analiz-motoru/rca/pedigree-breakdown";

type Query = { raceId?: string | string[]; winnerNo?: string | string[] };
const number = (x: number | null, decimals = 4) => x == null ? "Veri yok" : x.toFixed(decimals);
const state = (x: PedigreeEffect) => !x.present ? "Sinyal yok" : x.observed ? "Gözlemli" : "Veri eksik";

function PedigreeTable({ winner, compare, rivalLabel }: {
  winner: readonly PedigreeEffect[];
  compare?: readonly PedigreeComparison[];
  rivalLabel?: string;
}) {
  const compareByCode = new Map(compare?.map((x) => [x.code, x]) ?? []);
  return (
    <div className="overflow-x-auto rounded-lg border border-brand/20">
      <table className="w-full text-left text-xs sm:text-sm">
        <thead className="bg-foreground/5 text-muted-foreground">
          <tr>
            <th className="p-3">Soy hattı</th>
            <th className="p-3">Kazanan: ham değer</th>
            <th className="p-3">Veri durumu</th>
            <th className="p-3">Öğrenilmiş katsayı (β)</th>
            <th className="p-3">Kazanan: skor katkısı</th>
            {compare && <th className="p-3">{rivalLabel ?? "Rakip"}: skor katkısı</th>}
            {compare && <th className="p-3">Fark (rakip - kazanan)</th>}
          </tr>
        </thead>
        <tbody>
          {winner.map((p) => {
            const other = compareByCode.get(p.code);
            return (
              <tr key={p.code} className="border-t border-brand/10 align-top">
                <td className="p-3 font-semibold">{p.label}</td>
                <td className="p-3 tabular-nums">{number(p.raw, 3)}</td>
                <td className="p-3">
                  <span className={p.observed ? "text-foreground" : "text-amber-500"}>{state(p)}</span>
                  {!p.observed && <p className="mt-1 text-xs text-muted-foreground">{p.missingReason ?? "Gözlem bulunamadı"}</p>}
                </td>
                <td className="p-3 tabular-nums">{number(p.coefficient)}</td>
                <td className="p-3 tabular-nums">{number(p.contribution)}</td>
                {compare && <td className="p-3 tabular-nums">
                  {other ? number(other.rival.contribution) : "Veri yok"}
                  {other && !other.rival.observed && <p className="mt-1 text-xs text-amber-500">{state(other.rival)}: {other.rival.missingReason ?? "Gözlem bulunamadı"}</p>}
                </td>}
                {compare && <td className="p-3 tabular-nums">{other ? number(other.delta) : "Veri yok"}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MissSection({ heading, miss, winner }: { heading: string; miss: MissAnalysis; winner: readonly PedigreeEffect[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{heading}: {miss.category}</h2>
      <p className="text-sm text-muted-foreground">Karşılaştırılan rakip: {miss.rivalName} (No {miss.rivalNo})</p>
      <p className="text-xs text-muted-foreground">Bu sınıflandırma tek yarışın skor açıklamasıdır; istatistiksel kök neden kanıtı değildir.</p>
      <h3 className="font-semibold">Rakip lehine en büyük 5 sinyal farkı</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-brand/20 text-muted-foreground"><th className="p-2">Sinyal</th><th className="p-2">Kazanan</th><th className="p-2">Rakip</th><th className="p-2">Fark</th></tr></thead>
          <tbody>{miss.demotionDrivers.map((d) => <tr className="border-b border-brand/10" key={d.code}>
            <td className="p-2">{d.code}</td><td className="p-2 tabular-nums">{number(d.winnerTotal)}</td>
            <td className="p-2 tabular-nums">{number(d.rivalTotal)}</td><td className="p-2 tabular-nums">{number(d.delta)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <h3 className="font-semibold">Baba / Anne / Anne babası — tüm soy hatları</h3>
      <PedigreeTable winner={winner} compare={miss.pedigreeComparison} rivalLabel="Rakip" />
      <p className="text-xs text-muted-foreground">Pozitif fark rakip lehine, negatif fark kazanan lehinedir. Veri eksikliği sıfır gibi gösterilmez; gerçek missing-indicator katkısı toplamın içindedir.</p>
      <div className="space-y-1 text-xs text-muted-foreground">{miss.evidence.map((e, i) => <p key={i}>{e}</p>)}</div>
    </section>
  );
}

export default async function RanRcaPage({ searchParams }: { searchParams: Promise<Query> }) {
  const q = await searchParams;
  const raceId = typeof q.raceId === "string" ? q.raceId.trim() : "";
  const winnerRaw = typeof q.winnerNo === "string" ? q.winnerNo : "";
  const winnerNo = Number(winnerRaw);
  const valid = raceId.length > 0 && raceId.length <= 128 && /^\d+$/.test(winnerRaw) && winnerNo > 0 && Number.isSafeInteger(winnerNo);
  let result: Awaited<ReturnType<typeof analyzeRaceDemotion>> | null = null;
  let error: string | null = null;
  if (valid) {
    try {
      result = await analyzeRaceDemotion(raceId, loadTrainedModel(), winnerNo);
    } catch (e) {
      console.error("[admin/ran-rca] read-only analysis failed", e);
      error = "RAN RCA hesaplaması başarısız oldu. Sunucu kayıtlarını inceleyin.";
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 text-foreground">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">ROTAGANYAN — RAN RCA (izole önizleme)</h1>
        <p className="text-sm text-muted-foreground">Bu ekran yeni RAN motorunundur; eski /admin/root-cause V5.46.1 ekranını veya üretim tahmin kayıtlarını değiştirmez.</p>
        <p className="text-xs text-amber-500">İşlem yarış verilerini yeniden okuyarak salt-okuma hesap yapar; tarihsel olarak kaydedilmiş/published snapshot kanıtı değildir. Hesaplama veri arşivi nedeniyle uzun sürebilir.</p>
      </header>
      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-brand/20 p-4" method="get" action="/admin/ran-rca">
        <label className="flex flex-col gap-1 text-sm">Race ID
          <input required name="raceId" defaultValue={raceId} maxLength={128} className="rounded border border-brand/30 bg-transparent px-3 py-2" placeholder="Race.id" />
        </label>
        <label className="flex flex-col gap-1 text-sm">Gerçek kazananın at numarası
          <input required name="winnerNo" type="number" min={1} step={1} defaultValue={winnerRaw} className="rounded border border-brand/30 bg-transparent px-3 py-2" />
        </label>
        <button type="submit" className="rounded bg-brand px-4 py-2 font-semibold text-black">RCA hesapla (salt okuma)</button>
      </form>
      {!valid && (raceId || winnerRaw) && <p className="text-amber-500">Geçerli Race ID ve pozitif tam sayı kazanan numarası gerekli.</p>}
      {error && <p className="text-risk">{error}</p>}
      {result && result.status !== "OK" && <section className="rounded border border-amber-500/30 p-4">
        <h2 className="font-semibold">RCA durumu: {result.status}</h2>
        {result.status === "STALE" && <p className="text-sm">{result.reasons.join(" | ")}</p>}
      </section>}
      {result?.status === "OK" && <div className="space-y-6">
        <section className="rounded-lg border border-brand/20 p-4">
          <h2 className="text-lg font-semibold">Kazanan: {result.winnerName} (No {result.winnerNo})</h2>
          <p className="text-sm">Model sırası: {result.winnerRank}/{result.fieldSize} — TOP-1 {result.winnerRank === 1 ? "isabet" : "kaçırdı"} / TOP-3 {result.winnerRank <= 3 ? "isabet" : "kaçırdı"}</p>
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Pedigri özeti (her yarışta üç soy hattı)</h2>
          <PedigreeTable winner={result.winnerPedigree} />
        </section>
        {result.top1Miss && <MissSection heading="TOP-1 RCA" miss={result.top1Miss} winner={result.winnerPedigree} />}
        {result.top3Miss && <MissSection heading="TOP-3 RCA" miss={result.top3Miss} winner={result.winnerPedigree} />}
      </div>}
    </div>
  );
}
