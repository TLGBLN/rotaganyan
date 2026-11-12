import { CURRENT_ENGINE_LABEL } from "@/lib/methodology/v5-engine-label";
import safWeightsJson from "@/lib/methodology/weights/v546-1-saf-weights.json";

// 2026-11-10 kullanıcı talebi ("v5.46.1 kalksın mevcut motor yansıtılsın sadece") — bu panel
// eskiden sinyal-kutugu.service.ts'teki EL İLE BAKIMLANAN CANLI_SINYALLER kataloğunu
// gösteriyordu (A/B Katmanı, Düşük-şart/Diğer segment katsayıları) — o mimari (segment-bazlı
// iki ağırlık seti) Ekim'de TAMAMEN kaldırıldı, bugün de V5.46.1'in kendisi (19 özellik, AGF
// dahil) tamamen kaldırıldı. Panel artık CANLI ağırlık dosyasından (v546-1-saf-weights.json)
// DOĞRUDAN okuyor — featureNames/weights/means/stds değiştikçe bu panel KENDİLİĞİNDEN
// güncellenir, elle senkronize edilen ikinci bir kopya YOK (bugün üçüncü kez yaşanan
// "stale catalog" hatasının bir daha olmaması için — bkz. v5-engine-label.ts'teki aynı ilke).
type SafWeights = { featureNames: string[]; weights: number[]; means: number[]; stds: number[]; generatedAt: string; note: string };
const SAF_W = safWeightsJson as unknown as SafWeights;

const SINYAL_AD: Record<string, string> = {
  idmJokey: "İdman Jokeyi Uyumu", h2hNetSkor: "H2H Net Skor", hizDerecesi: "Hız Derecesi",
  zeminToleransi: "Zemin Toleransı", zeminMesafeDeneyim: "Zemin+Mesafe Deneyimi",
  sonIdmanSprint: "Son İdman Sprint", takiDegisikligi: "Takı Değişikliği",
  yarisGidisatiSkoru: "Yarış Gidişatı Skoru (Tempo)", sireOrani: "Pedigri (Baba)", sireOraniBirlesik: "Pedigri (Baba+Anne+Anne Babası)",
  hpRel: "Handikap Puanı (sahaya göre)", kiloRel: "Taşınan Kilo (sahaya göre)",
  jokeyPIT: "Jokey Seviyesi (son 365 gün)", antrenorPIT: "Antrenör Seviyesi (son 365 gün)", lastWon: "Son Yarışını Kazandı",
  ACC_CLOSE_RES: "Kapanış Artığı (Accurace)", ACC_LATE: "Geç Segment Hızı (Accurace)",
  ACC_SPEED: "Hız Artığı (Accurace)", PS_front: "Öne Çıkma Uyumu", PS_lone: "Yalnız Kaçak Uyumu",
  PS_closerFit: "Kapanışçı Uyumu", antrenorOraniGenel: "Antrenör Oranı",
  jokeyFormuGenel: "Jokey Formu (Son 30 Gün)", galopKalite: "Galop Kalitesi",
};
function sinyalAdi(kod: string): string { return SINYAL_AD[kod] ?? kod; }

export default function SinyalKutuguPanel() {
  const satirlar = SAF_W.featureNames.map((ad, i) => ({ ad, katsayi: SAF_W.weights[i], mean: SAF_W.means[i], std: SAF_W.stds[i] }))
    .sort((a, b) => Math.abs(b.katsayi) - Math.abs(a.katsayi));
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Sinyal Kütüğü</h2>
        <p className="mt-1 text-sm text-muted-foreground">{CURRENT_ENGINE_LABEL}</p>
        <p className="mt-1 text-xs text-muted-foreground">{SAF_W.note}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-brand/20">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand/20 bg-[#0d0d14] text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Sinyal</th>
              <th className="px-3 py-2">Kod</th>
              <th className="px-3 py-2">Katsayı (β)</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s) => (
              <tr key={s.ad} className="border-b border-brand/10 last:border-0 hover:bg-[#0d0d14]/60">
                <td className="px-3 py-2.5 align-top font-semibold text-foreground">{sinyalAdi(s.ad)}</td>
                <td className="px-3 py-2.5 align-top font-mono text-[10.5px] text-muted-foreground">{s.ad}</td>
                <td className={`px-3 py-2.5 align-top font-mono text-sm font-bold tabular-nums ${s.katsayi >= 0 ? "text-hit" : "text-[#e57368]"}`}>
                  {s.katsayi >= 0 ? "+" : ""}{s.katsayi.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Tüm sinyaller AGF&apos;siz, tek doğrusal skor + softmax ile birleştirilir — segment-bazlı ayrı katsayı seti YOK, her koşuda aynı β&apos;lar kullanılır.
        Üretildi: {new Date(SAF_W.generatedAt).toLocaleString("tr-TR")}.
      </p>
    </section>
  );
}
