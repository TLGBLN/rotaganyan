import { cn } from "@/lib/utils";
import Link from "next/link";
import { getRootCauseRaporu, type RootCauseCategory } from "@/server/services/root-cause.service";
import { sonRcaTaramalari } from "@/server/services/rca-scan.service";
import { siniflandirMiss, type MissType } from "@/server/services/miss-classification.service";
import { tumAdaylar, type CorrectionStatus } from "@/server/services/correction-candidate.service";
import { KACAN_TOP_N, type Gun } from "@/server/services/kosu-sonuc-degerlendirme.service";

const MISS_TYPE_RENK: Record<MissType, string> = {
  ANALYSIS_MISS: "text-risk",
  ALLOCATOR_MISS: "text-violet-600 dark:text-violet-400",
  PUBLISH_OVERRIDE_MISS: "text-blue-600 dark:text-blue-400",
  DATA_ISSUE: "text-amber-600 dark:text-amber-400",
  UNCERTAINTY: "text-muted-foreground",
};
const STATUS_RENK: Record<CorrectionStatus, string> = {
  DETECTED: "text-muted-foreground", NEEDS_TEST_DESIGN: "text-amber-600 dark:text-amber-400",
  OOS_TESTING: "text-brand", OOS_FAIL: "text-risk", OOS_PASS: "text-hit",
  SHADOW_TESTING: "text-brand", SHADOW_FAIL: "text-risk", READY_FOR_APPROVAL: "text-amber-600 dark:text-amber-400 font-bold",
  ACTIVE: "text-hit font-bold", ROLLBACK_CANDIDATE: "text-risk font-bold", ROLLED_BACK: "text-muted-foreground",
};

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ gun?: string; raceId?: string }> };

const KATEGORI_RENK: Record<RootCauseCategory, string> = {
  DATA: "text-amber-600 dark:text-amber-400",
  PRODUCER: "text-violet-600 dark:text-violet-400",
  FEATURE: "text-blue-600 dark:text-blue-400",
  MODEL: "text-risk",
  CONTEXT: "text-brand",
  UNCERTAINTY: "text-muted-foreground",
};

export default async function AdminRootCausePage({ searchParams }: PageProps) {
  const { gun: gunRaw, raceId } = await searchParams;
  const gun: Gun = gunRaw === "bugun" || gunRaw === "7" ? gunRaw : "tum";

  const rapor = await getRootCauseRaporu({ gun }); // snapshot-tabanlı — hızlı, scoreV461 ÇAĞIRMAZ
  const secili = raceId ? rapor.olaylar.find((o) => o.y.raceId === raceId) ?? rapor.olaylar[0] : rapor.olaylar[0];
  const taramalar = await sonRcaTaramalari(); // günlük cron (RcaScanSnapshot, raw-SQL) — tablo yoksa []
  const missSiniflandirma = secili ? await siniflandirMiss(secili.y.raceId, secili.y.otopsi?.sifirKatki.length ?? 0, secili.y.kuponGenislik) : null; // yalnız SEÇİLİ olay için — liste HIZLI kalsın
  const adaylar = await tumAdaylar(); // CorrectionCandidate registry — tablo yoksa []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">Root-Cause Analizi (RCA)</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          SALT OKUMA · kaynak: stored Prediction/Pick.featureSnapshot (hızlı) · V5.46.1 canlı yeniden hesap yalnız snapshot&apos;ı olmayan tek bir yarışın detayı açıldığında fallback olarak çalışır ·
          {" "}{rapor.missSayisi} MISS (model kazananı top-{KACAN_TOP_N} dışına attı) · {rapor.controlSayisi} CONTROL · {rapor.olculemeyenSayisi} ölçülemeyen (snapshot yok)
        </p>
      </div>

      {/* Günlük otomatik tarama (cron, RcaScanSnapshot) — bu bölüm salt bilgi amaçlı, aşağıdaki
          canlı-hesaplanan rapor ile AYNI anda farklı anlarda üretilmiş olabilir. */}
      <div className="rounded-lg border p-3 text-xs flex flex-wrap gap-4">
        {taramalar.length === 0 ? (
          <span className="text-muted-foreground">Henüz otomatik tarama çalışmadı (cron deploy sonrası ilk çalıştığında burada görünür).</span>
        ) : (
          taramalar.map((t) => (
            <span key={t.pencere}>
              <b>{t.pencere}</b> son tarama: {new Date(t.scanDate).toISOString().slice(0, 10)} ({t.modelVersion}/{t.rcaVersion}, eşik&gt;{t.missThreshold}) —
              {" "}{t.candidateKodlar.length} candidate
              {t.yeniCandidateKodlar.length > 0 && <b className="text-risk"> · {t.yeniCandidateKodlar.length} YENİ: {t.yeniCandidateKodlar.join(", ")}</b>}
            </span>
          ))
        )}
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Pencere</label>
          <select name="gun" defaultValue={gun} className="rounded-md border bg-background px-2 py-1.5 text-xs min-w-[110px]">
            <option value="tum">Tüm V5.46.1 dönemi</option>
            <option value="7">Son 7 gün</option>
            <option value="bugun">Bugün</option>
          </select>
        </div>
        <button type="submit" className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 transition-colors">
          Filtrele
        </button>
      </form>

      {/* Güvenlik kontrolü #1: snapshot coverage bias */}
      <div className={cn("rounded-lg border p-3 text-xs", rapor.snapshotBias.uyari ? "border-risk/50 bg-risk/5" : "")}>
        <b className={rapor.snapshotBias.uyari ? "text-risk" : "text-muted-foreground"}>{rapor.snapshotBias.uyari ? "⚠ Snapshot Coverage Bias" : "Snapshot Coverage"}:</b>{" "}
        {rapor.snapshotBias.not} (yayınlanan top-6 içinde eksik oranı %{Math.round(rapor.snapshotBias.yayinTop6IcindeOran * 100)}, dışında %{Math.round(rapor.snapshotBias.yayinTop6DisindaOran * 100)}, fark {(rapor.snapshotBias.fark * 100).toFixed(1)}pp)
      </div>

      {/* PATTERN_EVIDENCE özeti — MISS vs CONTROL, enrichment + bootstrap CI */}
      <div className="rounded-lg border p-3 space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pattern Evidence (MISS vs CONTROL, aggregate)</h2>
        {rapor.patternler.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ölçülebilir veri yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-1 px-1">Kod</th>
                  <th className="px-1">Kategori</th>
                  <th className="px-1">Miss%</th>
                  <th className="px-1">Control%</th>
                  <th className="px-1">Enrichment (CI)</th>
                  <th className="px-1">Δ Katkı (CI)</th>
                  <th className="px-1">Aday mı</th>
                </tr>
              </thead>
              <tbody>
                {rapor.patternler.slice(0, 15).map((p) => (
                  <tr key={p.kod} className={cn("border-b last:border-0", p.candidate && "bg-risk/5")}>
                    <td className="py-1 px-1 font-mono">{p.kod}{p.piyasaKaynakli && <span className="text-muted-foreground"> (piyasa)</span>}</td>
                    <td className={cn("px-1 text-center", KATEGORI_RENK[p.category])}>{p.category}</td>
                    <td className="px-1 text-center tabular-nums">%{Math.round(p.missFreq * 100)}</td>
                    <td className="px-1 text-center tabular-nums">%{Math.round(p.controlFreq * 100)} <span className="text-muted-foreground">(Δ[{p.freqDiffCi[0]},{p.freqDiffCi[1]}])</span></td>
                    <td className="px-1 text-center tabular-nums font-medium">{Number.isFinite(p.enrichment) ? `${p.enrichment}x` : "∞"} <span className="text-muted-foreground">[{p.enrichmentCi[0]},{p.enrichmentCi[1]}]</span></td>
                    <td className={cn("px-1 text-center tabular-nums", p.meanDiff < 0 ? "text-risk" : "text-hit")}>{p.meanDiff} <span className="text-muted-foreground">[{p.ci[0]},{p.ci[1]}]</span></td>
                    <td className="px-1 text-center">{p.candidate ? <span className="font-bold text-risk">★ CANDIDATE</span> : p.piyasaKaynakli ? <span className="text-brand">CONTEXT</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">★ CANDIDATE = piyasa-kaynaklı DEĞİL VE missN≥5 VE enrichment-CI alt sınırı&gt;1 VE katkı-CI sıfırı dışlıyor. agfSirasi/agfPayi/agfPayi2 (piyasa) otomatik CONTEXT&apos;tir, asla MODEL/FEATURE adayı olamaz.</p>
      </div>

      {rapor.olaylar.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <th className="px-2 py-2 text-left font-medium">Tarih</th>
                  <th className="px-2 py-2 text-left font-medium">Hipodrom/Koşu</th>
                  <th className="px-2 py-2 text-left font-medium">Kazanan</th>
                  <th className="px-2 py-2 text-center font-medium">Model Sırası</th>
                  <th className="px-2 py-2 text-center font-medium">Hypothesis</th>
                </tr>
              </thead>
              <tbody>
                {rapor.olaylar.map((o) => (
                  <tr key={o.y.raceId} className={cn("border-b last:border-0 hover:bg-muted/30", secili?.y.raceId === o.y.raceId && "bg-muted/40")}>
                    <td className="px-2 py-2"><Link href={`?gun=${gun}&raceId=${o.y.raceId}`} className="block">{o.y.tarih}</Link></td>
                    <td className="px-2 py-2">{o.y.hipodrom} #{o.y.raceNo}</td>
                    <td className="px-2 py-2 font-medium">{o.y.kazananNo} {o.y.kazananAd}</td>
                    <td className="px-2 py-2 text-center tabular-nums font-bold text-risk">{o.y.modelSira}.</td>
                    <td className={cn("px-2 py-2 text-center font-medium", o.rootCauseHypothesis ? KATEGORI_RENK[o.rootCauseHypothesis.category] : "text-muted-foreground")}>
                      {o.rootCauseHypothesis ? o.rootCauseHypothesis.category : "UNCERTAINTY"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rapor.olculemeyenSayisi > 0 && (
              <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                + {rapor.olculemeyenSayisi} yarış ölçülemedi (featureSnapshot yok) — pattern istatistiğine katılmadı. Tek tek detaylı bakmak için canlı V5.46.1 fallback gerekir (bu sürümde listelenmiyor, performans nedeniyle).
              </div>
            )}
          </div>

          {secili && (
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-bold">{secili.y.hipodrom} #{secili.y.raceNo} · {secili.y.tarih}</h3>
              <RcaAdim etiket="EVENT" renk="text-foreground">
                Kazanan: <b>{secili.y.kazananNo} {secili.y.kazananAd}</b> — model sırası <b className="text-risk">{secili.y.modelSira}.</b> (yayınlanan sıra: {secili.y.yayinlananSira ?? "—"})
              </RcaAdim>
              <RcaAdim etiket="MISS TYPE" renk={missSiniflandirma ? MISS_TYPE_RENK[missSiniflandirma.missType] : "text-muted-foreground"}>
                {missSiniflandirma ? (
                  <>
                    <b>{missSiniflandirma.missType}</b> — {missSiniflandirma.not}
                    {missSiniflandirma.missType === "DATA_ISSUE" && <span className="block text-[11px] text-muted-foreground mt-0.5">Precedence: veri sorunu varsa aynı olaya model/allocator hatası etiketi YAPIŞTIRILMAZ.</span>}
                    {missSiniflandirma.missType === "PUBLISH_OVERRIDE_MISS" && <span className="block text-[11px] text-muted-foreground mt-0.5">Sorun allocator matematiğinde değil — publish-süreci/elle-düzenleme araştırılır.</span>}
                    {missSiniflandirma.missType === "ALLOCATOR_MISS" && <span className="block text-[11px] text-muted-foreground mt-0.5">Sorun modelde değil — bütçe/allocator ayarı (farklı genişlik yakalardı) araştırılır.</span>}
                    {missSiniflandirma.missType === "ANALYSIS_MISS" && <span className="block text-[11px] text-muted-foreground mt-0.5">Hiçbir makul bütçe yakalamazdı — model/feature/kalibrasyon araştırılır.</span>}
                    <span className="block text-[10px] text-amber-600 dark:text-amber-400 mt-1">⚠ {missSiniflandirma.liveStateUyarisi}</span>
                  </>
                ) : "—"}
              </RcaAdim>
              <RcaAdim etiket="DIRECT_CAUSE (score explanation — ROOT CAUSE DEĞİL)" renk="text-risk">
                En negatif 3 katkı: <span className="font-mono">{secili.directCause}</span>
              </RcaAdim>
              <RcaAdim etiket="CONTRIBUTING_FACTORS (vs 6.lık)" renk="text-muted-foreground">
                <div className="overflow-x-auto mt-1">
                  <table className="w-full text-[11px]">
                    <tbody>
                      {secili.y.otopsi?.farkVs6.slice(0, 8).map((f) => (
                        <tr key={f.kod} className="border-b last:border-0">
                          <td className="py-0.5 font-mono">{f.kod}</td>
                          <td className="py-0.5 text-right tabular-nums text-muted-foreground">kazanan {f.kazananKatki.toFixed(3)} / 6.lık {f.altinciKatki.toFixed(3)}</td>
                          <td className={cn("py-0.5 text-right tabular-nums font-medium", f.fark < 0 ? "text-risk" : "text-hit")}>{f.fark.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </RcaAdim>
              <RcaAdim etiket="PATTERN_EVIDENCE" renk="text-muted-foreground">
                {secili.patternEvidence.length === 0 ? "Bu yarışın bottom-3 kod'ları için global pattern verisi yok." : (
                  <ul className="space-y-0.5 mt-1">
                    {secili.patternEvidence.map((p) => (
                      <li key={p.kod} className="font-mono text-[11px]">
                        {p.kod}{p.piyasaKaynakli && " (piyasa)"}: miss %{Math.round(p.missFreq * 100)} vs control %{Math.round(p.controlFreq * 100)} → enrichment {Number.isFinite(p.enrichment) ? `${p.enrichment}x` : "∞"} CI=[{p.enrichmentCi[0]},{p.enrichmentCi[1]}], Δkatkı={p.meanDiff} CI=[{p.ci[0]},{p.ci[1]}] {p.candidate && <b className="text-risk">★ CANDIDATE</b>}
                      </li>
                    ))}
                  </ul>
                )}
              </RcaAdim>
              <RcaAdim etiket="ROOT_CAUSE_HYPOTHESIS" renk={secili.rootCauseHypothesis ? KATEGORI_RENK[secili.rootCauseHypothesis.category] : "text-muted-foreground"}>
                {secili.rootCauseHypothesis ? `${secili.rootCauseHypothesis.category} (${secili.rootCauseHypothesis.kod}) — ${secili.rootCauseHypothesis.kanit}` : "UNCERTAINTY — bu olayın bottom-3 sinyallerinden hiçbiri control grubuna göre zenginleşmiş/tekrarlayan desen eşiğini geçmiyor. Tek olay kanıt sayılmaz."}
              </RcaAdim>
              <RcaAdim etiket="CORRECTIVE_ACTION (öneri)" renk="text-foreground">{secili.correctiveAction}</RcaAdim>
              <RcaAdim etiket="OOS_TEST" renk="text-muted-foreground">Henüz çalıştırılmadı — KEEP/DROP/MONITOR kararından önce walk-forward OOS + race/day bootstrap CI zorunlu (bkz. jokey Son30/JOCKEY_PERF challenger&apos;larındaki disiplin).</RcaAdim>
              <RcaAdim etiket="EFFECTIVENESS" renk="text-muted-foreground">—</RcaAdim>
              <RcaAdim etiket="STATUS" renk="text-muted-foreground">TEŞHİS (salt-okuma) — henüz karar/deploy/refit yok.</RcaAdim>
            </div>
          )}
        </div>
      )}

      {/* CorrectionCandidate registry — CLOSED-LOOP: DETECTED→OOS→SHADOW→READY_FOR_APPROVAL→
          ACTIVE. Aktivasyon/rollback YALNIZ admin onayıyla (bu sayfa onaylamaz, yalnız gösterir —
          2026-10-09 kullanıcı kararı: production'ı etkileyen hiçbir şey otomatik aktive edilmez). */}
      <div className="rounded-lg border p-3 space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Correction Candidates (closed-loop kayıt defteri)</h2>
        {adaylar.length === 0 ? (
          <p className="text-xs text-muted-foreground">Henüz aday yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-1 px-1">Tarih</th>
                  <th className="text-left px-1">Tip</th>
                  <th className="text-left px-1">Kök Neden</th>
                  <th className="text-left px-1">Kapsam</th>
                  <th className="px-1">Durum</th>
                </tr>
              </thead>
              <tbody>
                {adaylar.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-1 px-1">{new Date(a.createdAt).toISOString().slice(0, 10)}</td>
                    <td className="px-1 font-mono">{a.type}</td>
                    <td className="px-1">{a.rootCauseCategory}</td>
                    <td className="px-1">{a.scope}</td>
                    <td className={cn("px-1 text-center font-medium", STATUS_RENK[a.status])}>{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Durum zinciri: DETECTED → OOS_TESTING → OOS_PASS/FAIL → SHADOW_TESTING → SHADOW_FAIL/READY_FOR_APPROVAL → (yalnız insan onayıyla) ACTIVE → (yalnız insan onayıyla) ROLLBACK_CANDIDATE → ROLLED_BACK.</p>
      </div>

      <p className="text-[11px] text-muted-foreground border-t pt-2">{rapor.not}</p>
    </div>
  );
}

function RcaAdim({ etiket, renk, children }: { etiket: string; renk: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 pl-3" style={{ borderColor: "currentColor" }}>
      <div className={cn("text-[10px] font-bold uppercase tracking-wide", renk)}>{etiket}</div>
      <div className="text-xs mt-0.5">{children}</div>
    </div>
  );
}
