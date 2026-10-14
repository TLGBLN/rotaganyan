import { cn } from "@/lib/utils";
import Link from "next/link";
import { getRootCauseRaporu, type RootCauseCategory } from "@/server/services/root-cause.service";
import { sonRcaTaramalari } from "@/server/services/rca-scan.service";
import { siniflandirMiss, type MissType } from "@/server/services/miss-classification.service";
import { belirleEventCause, type EventCause, type CorrectionStatusOzet } from "@/server/services/event-cause.service";
import { tumAdaylarGuvenli, type CorrectionStatus, type CorrectionType } from "@/server/services/correction-candidate.service";
import { KACAN_TOP_N, type Gun } from "@/server/services/kosu-sonuc-degerlendirme.service";

// Gösterim katmanı (iç kod/DB değerleri İNGİLİZCE kalır — CorrectionCandidate.status gibi
// alanlar zaten veritabanında bu değerlerle saklı, değiştirmek geçmiş kayıtları bozar).
// Burada yalnız EKRANDA görünen Türkçe karşılıkları tanımlanıyor.
const MISS_TYPE_AD: Record<MissType, string> = {
  DATA_ISSUE: "Veri Sorunu",
  PUBLISH_OVERRIDE_MISS: "Yayın Aşaması Kaçırması",
  ALLOCATOR_MISS: "Kupon Dağıtım Hatası",
  ANALYSIS_MISS: "Model Kazananı Düşük Sıraladı",
  UNCERTAINTY: "Belirsizlik (Normal Varyans)",
};
const MISS_TYPE_RENK: Record<MissType, string> = {
  ANALYSIS_MISS: "text-risk",
  ALLOCATOR_MISS: "text-violet-600 dark:text-violet-400",
  PUBLISH_OVERRIDE_MISS: "text-blue-600 dark:text-blue-400",
  DATA_ISSUE: "text-amber-600 dark:text-amber-400",
  UNCERTAINTY: "text-muted-foreground",
};
const EVENT_CAUSE_AD: Record<EventCause, string> = {
  MARKET_DRIVEN_MISS: "Piyasa da Kaçırdı (Gerçek Sürpriz)",
  MARKET_SUPPRESSION_MISS: "Piyasa Modelin Görüşünü Bastırdı",
  MODEL_BLIND_MISS: "Model Piyasadan Daha Kötü Gördü",
  FEATURE_DRIVEN_MISS: "Bağımsız Sinyal Sorunu",
  CONTEXT_MISMATCH: "Segment Uyumsuzluğu (ör. Maiden)",
  DATA_ISSUE: "Veri Sorunu", ALLOCATOR_MISS: "Kupon Dağıtım Hatası", PUBLISH_OVERRIDE_MISS: "Yayın Aşaması Kaçırması",
  UNRESOLVED: "Açıklanamadı (son çare)",
};
const EVENT_CAUSE_RENK: Record<EventCause, string> = {
  MARKET_DRIVEN_MISS: "text-brand", MARKET_SUPPRESSION_MISS: "text-violet-600 dark:text-violet-400",
  MODEL_BLIND_MISS: "text-risk", FEATURE_DRIVEN_MISS: "text-risk",
  CONTEXT_MISMATCH: "text-blue-600 dark:text-blue-400",
  DATA_ISSUE: "text-amber-600 dark:text-amber-400", ALLOCATOR_MISS: "text-violet-600 dark:text-violet-400", PUBLISH_OVERRIDE_MISS: "text-blue-600 dark:text-blue-400",
  UNRESOLVED: "text-muted-foreground",
};
const CORRECTION_STATUS_OZET_AD: Record<CorrectionStatusOzet, string> = { NO_ACTION: "Aksiyon Yok", MONITOR: "İzlemede", CANDIDATE: "Düzeltme Adayı" };
const DURUM_AD: Record<CorrectionStatus, string> = {
  DETECTED: "Tespit Edildi", NEEDS_TEST_DESIGN: "Test Tasarımı Bekliyor",
  OOS_TESTING: "Saha-Dışı Test Sürüyor", OOS_FAIL: "Saha-Dışı Test Başarısız", OOS_PASS: "Saha-Dışı Test Geçti",
  SHADOW_TESTING: "Gölge Test Sürüyor", SHADOW_FAIL: "Gölge Test Başarısız", READY_FOR_APPROVAL: "Onay Bekliyor",
  ACTIVE: "Aktif", ROLLBACK_CANDIDATE: "Geri Alma Adayı", ROLLED_BACK: "Geri Alındı",
};
const STATUS_RENK: Record<CorrectionStatus, string> = {
  DETECTED: "text-muted-foreground", NEEDS_TEST_DESIGN: "text-amber-600 dark:text-amber-400",
  OOS_TESTING: "text-brand", OOS_FAIL: "text-risk", OOS_PASS: "text-hit",
  SHADOW_TESTING: "text-brand", SHADOW_FAIL: "text-risk", READY_FOR_APPROVAL: "text-amber-600 dark:text-amber-400 font-bold",
  ACTIVE: "text-hit font-bold", ROLLBACK_CANDIDATE: "text-risk font-bold", ROLLED_BACK: "text-muted-foreground",
};
const TIP_AD: Record<CorrectionType, string> = {
  DATA_FIX: "Veri Düzeltmesi", FEATURE_CHALLENGER: "Yeni Sinyal Adayı",
  CALIBRATION_CHALLENGER: "Kalibrasyon Adayı", ALLOCATOR_CHALLENGER: "Kupon Dağıtım Adayı",
};
const KATEGORI_AD: Record<RootCauseCategory, string> = {
  DATA: "Veri", PRODUCER: "Üretici Fonksiyon", FEATURE: "Eksik Sinyal",
  MODEL: "Model/Katsayı", CONTEXT: "Bağlam (Piyasa)", UNCERTAINTY: "Belirsizlik",
};
const KATEGORI_RENK: Record<RootCauseCategory, string> = {
  DATA: "text-amber-600 dark:text-amber-400",
  PRODUCER: "text-violet-600 dark:text-violet-400",
  FEATURE: "text-blue-600 dark:text-blue-400",
  MODEL: "text-risk",
  CONTEXT: "text-brand",
  UNCERTAINTY: "text-muted-foreground",
};
// Sinyal kodu → okunur Türkçe ad (yalnız gösterim; hesaplamalarda kod birebir kullanılmaya devam eder).
const SINYAL_AD: Record<string, string> = {
  agfSirasi: "AGF Sırası", agfPayi: "AGF Payı", agfPayi2: "AGF Payı² (kare terimi)",
  idmJokey: "İdman Jokeyi Uyumu", jokeyOrani: "Jokey Oranı", antrenorOrani: "Antrenör Oranı",
  h2hNetSkor: "H2H Net Skor", hizDerecesi: "Hız Derecesi", zeminToleransi: "Zemin Toleransı",
  zeminMesafeDeneyim: "Zemin+Mesafe Deneyimi",
  // 2026-10-11 — bkz. v5-engine.ts SINYAL_ACIKLAMA'daki AYNI tarihli not: production'da
  // hâlâ aktif (19 sinyal), ama audit/yeni mimaride DROP_BY_AUDIT_DESIGN — etiket admin'i
  // yanıltmasın diye bilerek işaretlendi.
  yakinsama2Plus: "yakinsama2Plus — LEGACY PRODUCTION ONLY (yeni analiz mimarisinde kullanılmıyor)",
  sonIdmanSprint: "Son İdman Sprint",
  takiEklendiMi: "Takı Eklendi mi", takiCikarildiMi: "Takı Çıkarıldı mı", takiDegisikligi: "Takı Değişikliği",
  yarisGidisatiSkoru: "Yarış Gidişatı Skoru", sireOrani: "Sire Oranı", kgsVarMi: "KGS Verisi Var mı",
  "B:sireKatkisi": "Sire Katkısı (B Katmanı)", "B:zeminMesafeKatkisi": "Zemin+Mesafe Katkısı (B Katmanı)",
  ACC_CLOSE_RES: "Kapanış Artığı (Accurace)", ACC_LATE: "Geç Segment Hızı (Accurace)", ACC_SPEED: "Hız Artığı (Accurace)",
  PS_front: "Öne Çıkma Uyumu", PS_lone: "Yalnız Kaçak Uyumu", PS_closerFit: "Kapanışçı Uyumu",
};
function sinyalAdi(kod: string): string { return SINYAL_AD[kod] ?? kod; }

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ gun?: string; raceId?: string }> };

export default async function AdminRootCausePage({ searchParams }: PageProps) {
  const { gun: gunRaw, raceId } = await searchParams;
  const gun: Gun = gunRaw === "bugun" || gunRaw === "7" ? gunRaw : "tum";

  const rapor = await getRootCauseRaporu({ gun }); // snapshot-tabanlı — hızlı, scoreV461 ÇAĞIRMAZ
  const secili = raceId ? rapor.olaylar.find((o) => o.y.raceId === raceId) ?? rapor.olaylar[0] : rapor.olaylar[0];
  const taramalar = await sonRcaTaramalari(); // günlük otomatik tarama (RcaScanSnapshot) — tablo yoksa []

  // 2026-10-10 kullanıcı bulgusu: EVENT_CAUSE yalnız SEÇİLİ olayın detay panelinde
  // hesaplanıyordu — sol taraftaki LİSTE hâlâ eski "Olası Neden" mantığını (çoğu olayda
  // "Belirsizlik") gösteriyordu. Şimdi TÜM listelenen olaylar için (sınırlı eşzamanlılıkla,
  // DB havuzunu boğmamak için 8'li gruplar halinde) hesaplanıp Map'e toplanıyor.
  const eventCauseMap = new Map<string, Awaited<ReturnType<typeof belirleEventCause>>>();
  const missTypeMap = new Map<string, Awaited<ReturnType<typeof siniflandirMiss>>>();
  const PARALELLIK = 24; // ölçüldü: 67 olayda ~7s (8'de ~15s) — DB havuzunu zorlamadan makul denge
  for (let i = 0; i < rapor.olaylar.length; i += PARALELLIK) {
    const dilim = rapor.olaylar.slice(i, i + PARALELLIK);
    await Promise.all(dilim.map(async (o) => {
      const ms = await siniflandirMiss(o.y.raceId, o.y.otopsi?.sifirKatki.length ?? 0, o.y.kuponGenislik);
      missTypeMap.set(o.y.raceId, ms);
      const ec = await belirleEventCause({ raceId: o.y.raceId, winnerNo: o.y.kazananNo, missType: ms.missType, featureDrivenAday: o.rootCauseHypothesis, piyasaDeseniVarMi: o.piyasaBaskin });
      eventCauseMap.set(o.y.raceId, ec);
    }));
  }
  const missSiniflandirma = secili ? missTypeMap.get(secili.y.raceId) ?? null : null;
  const eventCauseSonucu = secili ? eventCauseMap.get(secili.y.raceId) ?? null : null;
  // FAZ 2E — sayfa yüklemesi ARTIK DDL çalıştırmıyor (bkz. correction-candidate.service.ts
  // başı notu); tablo kurulmadıysa bunu AÇIKÇA (ayrı bir banner ile) gösteriyoruz, "0 aday
  // var" ile KARIŞTIRMIYORUZ.
  const adaylarSonuc = await tumAdaylarGuvenli(); // Düzeltme Adayları kayıt defteri
  const adaylar = adaylarSonuc.ok ? adaylarSonuc.rows : [];
  const adaylarTablosuKurulmamis = !adaylarSonuc.ok;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">Kök Neden Analizi (RCA)</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          SALT OKUMA · kaynak: kaydedilmiş tahmin/pick verisi (hızlı) · V5.46.1 ile canlı yeniden hesaplama yalnız kaydı olmayan tek bir yarışın detayı açıldığında yedek olarak çalışır ·
          {" "}{rapor.missSayisi} kaçırılan (model kazananı ilk {KACAN_TOP_N} dışına attı) · {rapor.controlSayisi} isabetli kontrol · {rapor.olculemeyenSayisi} ölçülemeyen (kayıt yok)
        </p>
      </div>

      {/* Günlük otomatik tarama (cron, RcaScanSnapshot) — bu bölüm salt bilgi amaçlı, aşağıdaki
          canlı-hesaplanan rapor ile AYNI anda farklı anlarda üretilmiş olabilir. */}
      <div className="rounded-lg border p-3 text-xs flex flex-wrap gap-4">
        {taramalar.length === 0 ? (
          <span className="text-muted-foreground">Henüz otomatik tarama çalışmadı (dağıtım sonrası ilk çalıştığında burada görünür).</span>
        ) : (
          taramalar.map((t) => (
            <span key={t.pencere}>
              <b>{t.pencere}</b> son tarama: {new Date(t.scanDate).toISOString().slice(0, 10)} ({t.modelVersion}/{t.rcaVersion}, eşik&gt;{t.missThreshold}) —
              {" "}{t.candidateKodlar.length} aday
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

      {/* Güvenlik kontrolü #1: kayıt kapsama yanlılığı */}
      <div className={cn("rounded-lg border p-3 text-xs", rapor.snapshotBias.uyari ? "border-risk/50 bg-risk/5" : "")}>
        <b className={rapor.snapshotBias.uyari ? "text-risk" : "text-muted-foreground"}>{rapor.snapshotBias.uyari ? "⚠ Kayıt Kapsama Yanlılığı" : "Kayıt Kapsamı"}:</b>{" "}
        {rapor.snapshotBias.not} (yayınlanan ilk 6 içinde eksik oranı %{Math.round(rapor.snapshotBias.yayinTop6IcindeOran * 100)}, dışında %{Math.round(rapor.snapshotBias.yayinTop6DisindaOran * 100)}, fark {(rapor.snapshotBias.fark * 100).toFixed(1)}pp)
      </div>

      {/* Desen kanıtı özeti — kaçırılan vs kontrol, zenginleşme + güven aralığı (GA) */}
      <div className="rounded-lg border p-3 space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Desen Kanıtı (Kaçırılan vs Kontrol, toplu)</h2>
        {rapor.patternler.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ölçülebilir veri yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-1 px-1">Sinyal</th>
                  <th className="px-1">Kategori</th>
                  <th className="px-1">Kaçırılanda%</th>
                  <th className="px-1">Kontrolde%</th>
                  <th className="px-1">Zenginleşme (GA)</th>
                  <th className="px-1">Δ Katkı (GA)</th>
                  <th className="px-1">Aday mı</th>
                </tr>
              </thead>
              <tbody>
                {rapor.patternler.slice(0, 15).map((p) => (
                  <tr key={p.kod} className={cn("border-b last:border-0", p.candidate && "bg-risk/5")}>
                    <td className="py-1 px-1" title={p.kod}>{sinyalAdi(p.kod)}{p.piyasaKaynakli && <span className="text-muted-foreground"> (piyasa)</span>}</td>
                    <td className={cn("px-1 text-center", KATEGORI_RENK[p.category])}>{KATEGORI_AD[p.category]}</td>
                    <td className="px-1 text-center tabular-nums">%{Math.round(p.missFreq * 100)}</td>
                    <td className="px-1 text-center tabular-nums">%{Math.round(p.controlFreq * 100)} <span className="text-muted-foreground">(Δ[{p.freqDiffCi[0]},{p.freqDiffCi[1]}])</span></td>
                    <td className="px-1 text-center tabular-nums font-medium">{Number.isFinite(p.enrichment) ? `${p.enrichment}x` : "∞"} <span className="text-muted-foreground">[{p.enrichmentCi[0]},{p.enrichmentCi[1]}]</span></td>
                    <td className={cn("px-1 text-center tabular-nums", p.meanDiff < 0 ? "text-risk" : "text-hit")}>{p.meanDiff} <span className="text-muted-foreground">[{p.ci[0]},{p.ci[1]}]</span></td>
                    <td className="px-1 text-center">{p.candidate ? <span className="font-bold text-risk">★ ADAY</span> : p.piyasaKaynakli ? <span className="text-brand">Bağlam</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">★ ADAY = piyasa-kaynaklı DEĞİL VE kaçırılan sayısı≥5 VE zenginleşme güven aralığının alt sınırı&gt;1 VE katkı güven aralığı sıfırı dışlıyor. AGF Sırası/AGF Payı/AGF Payı² (piyasa) otomatik Bağlam sayılır, asla Model/Sinyal adayı olamaz.</p>
      </div>

      {rapor.olaylar.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50 text-muted-foreground">
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Tarih</th>
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Hipodrom/Koşu</th>
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Kazanan</th>
                    <th className="px-2 py-2 text-center font-medium whitespace-nowrap">Model Sırası</th>
                    <th className="px-2 py-2 text-center font-medium whitespace-nowrap">Olay Nedeni</th>
                  </tr>
                </thead>
                <tbody>
                  {rapor.olaylar.map((o) => {
                    const ec = eventCauseMap.get(o.y.raceId);
                    return (
                    <tr key={o.y.raceId} className={cn("border-b last:border-0 hover:bg-muted/30", secili?.y.raceId === o.y.raceId && "bg-muted/40")}>
                      <td className="px-2 py-2 whitespace-nowrap"><Link href={`?gun=${gun}&raceId=${o.y.raceId}`} className="block">{o.y.tarih}</Link></td>
                      <td className="px-2 py-2 whitespace-nowrap">{o.y.hipodrom} #{o.y.raceNo}</td>
                      <td className="px-2 py-2 font-medium whitespace-nowrap">{o.y.kazananNo} {o.y.kazananAd}</td>
                      <td className="px-2 py-2 text-center tabular-nums font-bold text-risk whitespace-nowrap">{o.y.modelSira}.</td>
                      <td className={cn("px-2 py-2 text-center font-medium whitespace-nowrap", ec ? EVENT_CAUSE_RENK[ec.eventCause] : "text-muted-foreground")}>
                        {ec ? EVENT_CAUSE_AD[ec.eventCause] : "—"}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rapor.olculemeyenSayisi > 0 && (
              <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                + {rapor.olculemeyenSayisi} yarış ölçülemedi (kayıt yok) — desen istatistiğine katılmadı. Tek tek detaylı bakmak için canlı V5.46.1 yedek hesabı gerekir (bu sürümde listelenmiyor, performans nedeniyle).
              </div>
            )}
          </div>

          {secili && (
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-bold">{secili.y.hipodrom} #{secili.y.raceNo} · {secili.y.tarih}</h3>
              <RcaAdim etiket="OLAY" renk="text-foreground">
                Kazanan: <b>{secili.y.kazananNo} {secili.y.kazananAd}</b> — model sırası <b className="text-risk">{secili.y.modelSira}.</b> (yayınlanan sıra: {secili.y.yayinlananSira ?? "—"})
              </RcaAdim>
              <RcaAdim etiket="KAÇIRMA TÜRÜ" renk={missSiniflandirma ? MISS_TYPE_RENK[missSiniflandirma.missType] : "text-muted-foreground"}>
                {missSiniflandirma ? (
                  <>
                    <b>{MISS_TYPE_AD[missSiniflandirma.missType]}</b> — {missSiniflandirma.not}
                    {missSiniflandirma.missType === "DATA_ISSUE" && <span className="block text-[11px] text-muted-foreground mt-0.5">Öncelik kuralı: veri sorunu varsa aynı olaya model/kupon-dağıtım hatası etiketi YAPIŞTIRILMAZ.</span>}
                    {missSiniflandirma.missType === "PUBLISH_OVERRIDE_MISS" && <span className="block text-[11px] text-muted-foreground mt-0.5">Sorun kupon dağıtım hesabında değil — yayın süreci/elle düzenleme araştırılır.</span>}
                    {missSiniflandirma.missType === "ALLOCATOR_MISS" && <span className="block text-[11px] text-muted-foreground mt-0.5">Sorun modelde değil — bütçe/kupon genişliği ayarı (farklı genişlik yakalardı) araştırılır.</span>}
                    {missSiniflandirma.missType === "ANALYSIS_MISS" && <span className="block text-[11px] text-muted-foreground mt-0.5">Hiçbir makul bütçe yakalamazdı — model/sinyal/kalibrasyon araştırılır.</span>}
                    <span className="block text-[10px] text-amber-600 dark:text-amber-400 mt-1">⚠ {missSiniflandirma.liveStateUyarisi}</span>
                  </>
                ) : "—"}
              </RcaAdim>
              {/* 2026-10-10 kullanıcı düzeltmesi — semantik hata: "kanıtlanmış düzeltme adayı
                  yok" ile "belirsizlik/bilmiyoruz" AYNI ŞEY DEĞİL. Bu aşama HER ZAMAN mümkün
                  olan en spesifik nedeni verir — UNRESOLVED yalnız gerçekten hiçbir ipucu
                  yoksa, son çare olarak kullanılır. */}
              {eventCauseSonucu && (
                <RcaAdim etiket="OLAY NEDENİ" renk={EVENT_CAUSE_RENK[eventCauseSonucu.eventCause]}>
                  <b>{EVENT_CAUSE_AD[eventCauseSonucu.eventCause]}</b>
                  <span className="ml-2 rounded-sm bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold">{CORRECTION_STATUS_OZET_AD[eventCauseSonucu.correctionStatus]}</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">{eventCauseSonucu.kanit}</span>
                  {!eventCauseSonucu.marketBlindVeriVarMi && (eventCauseSonucu.eventCause === "MARKET_DRIVEN_MISS" || eventCauseSonucu.eventCause === "MODEL_BLIND_MISS") && (
                    <span className="block text-[10px] text-amber-600 dark:text-amber-400 mt-1">⚠ Market-blind olasılık verisi bu yarışta yok (2026-10-09 V5.46.1 geçişinden beri doldurulmuyor) — bu sonuç yalnız AGF-sırası proxy&apos;sine dayanıyor, tam market-blind testi değil.</span>
                  )}
                </RcaAdim>
              )}
              <RcaAdim etiket="DOĞRUDAN NEDEN (skor açıklaması — kök neden DEĞİL)" renk="text-risk">
                En negatif 3 katkı: <span className="font-mono">{secili.directCause.split(", ").map((parca) => { const [k, deger] = parca.split("("); return `${sinyalAdi(k)}(${deger ?? ""}`; }).join(", ")}</span>
              </RcaAdim>
              <RcaAdim etiket="KATKIDA BULUNAN FAKTÖRLER (6. ata göre)" renk="text-muted-foreground">
                <div className="overflow-x-auto mt-1">
                  <table className="w-full text-[11px]">
                    <tbody>
                      {secili.y.otopsi?.farkVs6.slice(0, 8).map((f) => (
                        <tr key={f.kod} className="border-b last:border-0">
                          <td className="py-0.5">{sinyalAdi(f.kod)}</td>
                          <td className="py-0.5 text-right tabular-nums text-muted-foreground">kazanan {f.kazananKatki.toFixed(3)} / 6.lık {f.altinciKatki.toFixed(3)}</td>
                          <td className={cn("py-0.5 text-right tabular-nums font-medium", f.fark < 0 ? "text-risk" : "text-hit")}>{f.fark.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </RcaAdim>
              <RcaAdim etiket="DESEN KANITI" renk="text-muted-foreground">
                {secili.patternEvidence.length === 0 ? "Bu yarışın en kötü 3 sinyali için genel desen verisi yok." : (
                  <ul className="space-y-0.5 mt-1">
                    {secili.patternEvidence.map((p) => (
                      <li key={p.kod} className="text-[11px]">
                        {sinyalAdi(p.kod)}{p.piyasaKaynakli && " (piyasa)"}: kaçırılanda %{Math.round(p.missFreq * 100)}, kontrolde %{Math.round(p.controlFreq * 100)} → zenginleşme {Number.isFinite(p.enrichment) ? `${p.enrichment}x` : "∞"} GA=[{p.enrichmentCi[0]},{p.enrichmentCi[1]}], Δkatkı={p.meanDiff} GA=[{p.ci[0]},{p.ci[1]}] {p.candidate && <b className="text-risk">★ ADAY</b>}
                      </li>
                    ))}
                  </ul>
                )}
              </RcaAdim>
              <RcaAdim etiket="KÖK NEDEN HİPOTEZİ" renk={secili.rootCauseHypothesis ? KATEGORI_RENK[secili.rootCauseHypothesis.category] : "text-muted-foreground"}>
                {secili.rootCauseHypothesis
                  ? `${KATEGORI_AD[secili.rootCauseHypothesis.category]} (${sinyalAdi(secili.rootCauseHypothesis.kod)}) — ${secili.rootCauseHypothesis.kanit}`
                  : secili.piyasaBaskin
                  // 2026-10-10 kullanıcı düzeltmesi: bu durumda desen YOK değil, desen VAR ama
                  // piyasa-kaynaklı (AGF) — kural gereği candidate sayılmıyor. "Hiçbir sinyal
                  // eşiği geçmiyor" demek YANLIŞ olur; AGF Sırası/Payı çoğu zaman güçlü geçiyor.
                  ? "Tekrarlayan desen VAR, ancak desen piyasa-kaynaklı (AGF Sırası/Payı) — piyasa da bu tip kazananları düşük değerlendiriyor; bağımsız bir model/sinyal arızası KANITLANMIŞ değil (MARKET_SURPRISE_PATTERN)."
                  : "Belirsizlik — bu olayın en kötü 3 sinyalinden hiçbiri (piyasa-dışı) kontrol grubuna göre zenginleşmiş/tekrarlayan desen eşiğini geçmiyor. Tek olay kanıt sayılmaz."}
              </RcaAdim>
              <RcaAdim etiket="DÜZELTİCİ AKSİYON (öneri)" renk="text-foreground">{secili.correctiveAction}</RcaAdim>
              <RcaAdim etiket="SAHA-DIŞI TEST" renk="text-muted-foreground">Henüz çalıştırılmadı — Tut/Bırak/İzle kararından önce geriye-dönük test + yarış/gün bazlı güven aralığı zorunlu (bkz. jokey Son30/JOCKEY_PERF adaylarındaki disiplin).</RcaAdim>
              <RcaAdim etiket="ETKİNLİK" renk="text-muted-foreground">—</RcaAdim>
              <RcaAdim etiket="DURUM" renk="text-muted-foreground">TEŞHİS (salt-okuma) — henüz karar/dağıtım/yeniden-eğitim yok.</RcaAdim>
            </div>
          )}
        </div>
      )}

      {/* Düzeltme Adayları kayıt defteri — kapalı-döngü: Tespit→Saha-Dışı Test→Gölge Test→
          Onay Bekliyor→Aktif. Aktivasyon/geri-alma YALNIZ admin onayıyla (bu sayfa onaylamaz,
          yalnız gösterir — 2026-10-09 kullanıcı kararı: production'ı etkileyen hiçbir şey
          otomatik aktive edilmez). */}
      <div className="rounded-lg border p-3 space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Düzeltme Adayları (kapalı-döngü kayıt defteri)</h2>
        {adaylarTablosuKurulmamis ? (
          <p className="text-xs text-amber-600">
            Tablo henüz kurulmadı — bu bir hata değil, kurulum adımı henüz çalıştırılmadı
            (bkz. prisma/manual-sql/2026-10-14_correction_candidate_setup.sql).
          </p>
        ) : adaylar.length === 0 ? (
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
                    <td className="px-1">{TIP_AD[a.type]}</td>
                    <td className="px-1">{a.rootCauseCategory}</td>
                    <td className="px-1">{a.scope}</td>
                    <td className={cn("px-1 text-center font-medium", STATUS_RENK[a.status])}>{DURUM_AD[a.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Durum zinciri: Tespit Edildi → Saha-Dışı Test Sürüyor → Geçti/Başarısız → Gölge Test Sürüyor → Başarısız/Onay Bekliyor → (yalnız insan onayıyla) Aktif → (yalnız insan onayıyla) Geri Alma Adayı → Geri Alındı.</p>
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
