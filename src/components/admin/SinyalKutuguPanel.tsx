import { CURRENT_ENGINE_LABEL } from "@/lib/methodology/v5-engine-label";
import safWeightsJson from "@/lib/methodology/weights/v546-1-saf-weights.json";
import handikapJson from "@/lib/methodology/weights/v546-1-saf-segment-handikap.json";
import sartli1Json from "@/lib/methodology/weights/v546-1-saf-segment-dusuk-deneyim.json";

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
const HANDIKAP_W = handikapJson as unknown as SafWeights;
const SARTLI1_W = sartli1Json as unknown as SafWeights;

const SINYAL_AD: Record<string, string> = {
  idmJokey: "İdman Jokeyi Uyumu", h2hNetSkor: "H2H Net Skor", hizDerecesi: "Hız Derecesi",
  zeminToleransi: "Zemin Toleransı", zeminMesafeDeneyim: "Zemin+Mesafe Deneyimi",
  sonIdmanSprint: "Son İdman Sprint", takiDegisikligi: "Takı Değişikliği",
  yarisGidisatiSkoru: "Yarış Gidişatı Skoru (Tempo)", sireOrani: "Pedigri (Baba)", sireOraniBirlesik: "Pedigri (Baba+Anne+Anne Babası)",
  hpRel: "Handikap Puanı (sahaya göre)", kiloRel: "Taşınan Kilo (sahaya göre)",
  fMean: "Son 6 Yarış Derece Ortalaması (düşük = iyi form)", kgsLog: "Koşmadığı Gün Sayısı (KGS, log)", sexE: "Cins (e)", dususDelta: "Sınıf Düşüşü (önceki yarış sınıfı − bugünkü; + = düşüş)",
  jokeyPIT: "Jokey Seviyesi (son 365 gün)", antrenorPIT: "Antrenör Seviyesi (son 365 gün)", lastWon: "Son Yarışını Kazandı",
  ACC_CLOSE_RES: "Kapanış Artığı (Accurace)", ACC_LATE: "Geç Segment Hızı (Accurace)",
  ACC_SPEED: "Hız Artığı (Accurace)", PS_front: "Öne Çıkma Uyumu", PS_lone: "Yalnız Kaçak Uyumu",
  PS_closerFit: "Kapanışçı Uyumu (NEGATİF katsayı: geriden gelen profil geçmişte daha az kazandı)", antrenorOraniGenel: "Antrenör Oranı",
  jokeyFormuGenel: "Jokey Formu (Son 30 Gün)", galopKalite: "Galop Kalitesi",
};
function sinyalAdi(kod: string): string { return SINYAL_AD[kod] ?? kod; }

function SinyalTablosu({ w }: { w: SafWeights }) {
  const satirlar = w.featureNames.map((ad, i) => ({ ad, katsayi: w.weights[i] })).sort((x, y) => Math.abs(y.katsayi) - Math.abs(x.katsayi));
  return (
    <div className="overflow-x-auto rounded-lg border border-brand/20">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-brand/20 bg-[#0d0d14] text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2">Sinyal</th><th className="px-3 py-2">Kod</th><th className="px-3 py-2">Katsayı (β)</th>
          </tr>
        </thead>
        <tbody>
          {satirlar.map((s) => (
            <tr key={s.ad} className="border-b border-brand/10 last:border-0 hover:bg-[#0d0d14]/60">
              <td className="px-3 py-2.5 align-top font-semibold text-foreground">{sinyalAdi(s.ad)}</td>
              <td className="px-3 py-2.5 align-top font-mono text-[10.5px] text-muted-foreground">{s.ad}</td>
              <td className={"px-3 py-2.5 align-top font-mono text-sm font-bold tabular-nums " + (s.katsayi >= 0 ? "text-hit" : "text-[#e57368]")}>{s.katsayi >= 0 ? "+" : ""}{s.katsayi.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Denenip ALINMAYAN / çıkarılan sinyaller — gerekçeli kayıt (arac-*.mts CV sonuçları; protokol: 5 kat zaman-CV, eşik ΔLL ≤ −0.003, ayrı sınama katları).
const DENENEN: { ad: string; sonuc: string; durum: "cikarildi" | "reddedildi" }[] = [
  { ad: "sonIdmanSprint, idmJokey, takiDegisikligi, PS_lone", sonuc: "Fiilen ölü (%91–99 sıfır); canlı modellerden çıkarıldı (14 Kas).", durum: "cikarildi" },
  { ad: "hpRel, kiloRel (yalnız Handikap)", sonuc: "Handikap'ta zararlı (ΔLL +0.004 ✘); Handikap segmentinden çıkarıldı. Diğer tiplerde duruyor.", durum: "cikarildi" },
  { ad: "Maiden/ŞARTLI 19 ayrı segment modeli", sonuc: "334 yarış blok-CV: varsayılan 21'e göre log-loss +0.071 kötü; segment kaldırıldı (15 Kas).", durum: "cikarildi" },
  { ad: "ACC_LATE → Maiden segmenti", sonuc: "ΔLL −0.005, anlamsız; alınmadı.", durum: "reddedildi" },
  { ad: "Accurace terimi, 13+ atlı sahada", sonuc: "ΔLL −0.019 ama GA sıfırı içeriyor, isabet değişmedi (Top1 %19→%19, Top3 %50.6→%51.8); alınmadı.", durum: "reddedildi" },
  { ad: "Önceki yarışla aynı jokey, sınıf düşüşü/yükselişi, bu sınıfta kazandı", sonuc: "Eşiği geçen yok.", durum: "reddedildi" },
  { ad: "HP / kilo / mesafe değişimi, ekipman değişimi, dinlenme düzeni", sonuc: "Eşiği geçen yok (ΔLL ±0.003 içinde).", durum: "reddedildi" },
  { ad: "Sınıf-ayarlı form (TJK 13 basamaklı sınıf hiyerarşisiyle: sınıf yükselişi, form×yükseliş, bu seviyede deneyim, fMean yerine ayarlı sürüm, zayıf-form+büyük-yükseliş bayrağı)", sonuc: "14 aday, hiçbiri geçmedi (ΔLL ±0.01 içinde, güven aralıkları sıfırı içeriyor, DEV/SINAMA işaretleri tutarsız); ayarlı formu fMean yerine koymak zararlı (+0.005…+0.007). Kalibrasyon: iyi dereceli + büyük yükseliş (≥4 basamak) 184 atta model %15.2, gerçek %15.8 (iyi kalibre); ≤4 yarışlı 79 atta %17.8 → %21.5 (hafif düşük tahmin). Tek sapma: zayıf form + büyük yükseliş 235 atta model %5.7, gerçek %2.6 (düşük olasılıklı atlar, üst sıralamayı etkilemez; bayrak olarak denendi, geçmedi). Maiden/Şartlı→üst sınıf SIÇRAMASI (geçmişi yalnız Maiden/Şartlı1-2/Satış olan at, ilk kez G1-3 veya KV-8/9): modelin test verisinde yalnız 26 at (1 kazanan) — modeli sınamaya yetmez; 7220 atlık geçmiş arşivinde ise G1-3'te sıçrama yapan 96 at %4.2 kazanıyor (deneyimli %10.9), KV-8/9'da 112 at %6.3 (deneyimli %16.2); piyasa bunları zaten iskontolu fiyatlıyor (G1-3'te gerçek/piyasa oranı 0.65 ≈ genel 0.67; KV-8/9'da 0.45 ↔ 0.72, n küçük). 15 Kas.", durum: "reddedildi" },
  { ad: "Sınıf × form etkileşimleri (çok basamaklı sıçramada derece/son yarış/hız etkisi azalsın), sınıf değişimi kademe bayrakları (1 / 2-3 / 4+), kırpılmamış fark, bugünkü sınıf × form", sonuc: "Canlı 22 sinyalli tabana 13 aday: hiçbiri anlamlı değil (güven aralıkları sıfırı içeriyor). En yakını ≥4 basamak sıçramada form sinyallerini sıfırlayan 3'lü grup: geliştirme katlarında ΔLL −0.0040, sınama katlarında −0.0024 (aynı yön), tüm katlarda −0.0034 [−0.0084,+0.0020]; 13 adaydan 2'si geliştirme eşiğini geçti (şans payı ~1). Canlıya alınmadı, aday olarak izlemede. 15 Kas.", durum: "reddedildi" },
  { ad: "Antrenör değişimi", sonuc: "Hafif zararlı (+0.0015 ✘).", durum: "reddedildi" },
  { ad: "Önceki yarışların ganyanı (piyasa türevi)", sonuc: "ΔLL −0.005, eşiği geçmedi; ayrıca AGF'siz ilkesi gereği motora girmez.", durum: "reddedildi" },
];

export default function SinyalKutuguPanel() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Sinyal Kütüğü</h2>
        <p className="mt-1 text-sm text-muted-foreground">{CURRENT_ENGINE_LABEL}</p>
        <p className="mt-1 text-xs text-muted-foreground">{SAF_W.note}</p>
      </div>
      <div>
        <h3 className="mb-1 text-sm font-bold">Varsayılan model — {SAF_W.featureNames.length} sinyal <span className="font-normal text-muted-foreground">(ŞARTLI 2-5, KV/Satış/Grup/Diğer, Maiden, ŞARTLI 19)</span></h3>
        <SinyalTablosu w={SAF_W} />
      </div>
      <div>
        <h3 className="mb-1 text-sm font-bold">Handikap segmenti — {HANDIKAP_W.featureNames.length} sinyal <span className="font-normal text-muted-foreground">(hpRel/kiloRel yok)</span></h3>
        <SinyalTablosu w={HANDIKAP_W} />
      </div>
      <div>
        <h3 className="mb-1 text-sm font-bold">ŞARTLI 1/27 segmenti — {SARTLI1_W.featureNames.length} sinyal</h3>
        <SinyalTablosu w={SARTLI1_W} />
      </div>
      <div>
        <h3 className="mb-1 text-sm font-bold">Çıkarılan ve denenip alınmayan sinyaller</h3>
        <ul className="space-y-1 text-xs">
          {DENENEN.map((d) => (
            <li key={d.ad} className="rounded border border-brand/10 px-2 py-1.5">
              <span className={d.durum === "cikarildi" ? "font-semibold text-[#e57368]" : "font-semibold text-muted-foreground"}>{d.durum === "cikarildi" ? "Çıkarıldı" : "Alınmadı"}</span>{" · "}
              <span className="font-semibold text-foreground">{d.ad}</span> — <span className="text-muted-foreground">{d.sonuc}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Tüm sinyaller AGF&apos;siz, tek doğrusal skor + softmax ile birleştirilir. Handikap ve ŞARTLI 1/27 için ayrı segment katsayı seti vardır; diğer tiplerde (Maiden dahil) varsayılan β&apos;lar kullanılır.
        Sinyal sağlığı sayfasındaki &quot;kayıtlı sinyal&quot; sayısı bu üç modelin birleşiminden (24) büyük olabilir: kayıtlı olup canlı modelde olmayanlar yalnız analiz/emekli sinyallerdir.
        Üretildi: {new Date(SAF_W.generatedAt).toLocaleString("tr-TR")}.
      </p>
    </section>
  );
}
