import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { gatherFaz1, type Faz1Sonuc } from "@/lib/methodology/veri-toplama";
import {
  createWithTruncationRetry, extractText,
  FAZ2_SCHEMA, type Faz2Atlar,
} from "@/lib/methodology/claude-analiz-helpers";
import { getRecentCachedResult } from "@/lib/claude-cost";
import type { Anthropic } from "@anthropic-ai/sdk";
import type { Role } from "@prisma/client";

// Faz 2 ve Faz 3 ayrı isteklerde çalışıyor (bkz. AIAnalysisPanel.tsx) — büyük/karmaşık
// koşularda toplam süreleri 300s'lik Vercel sınırını aşabiliyordu. Fluid Compute açık
// olsa da Hobby planda maxDuration üst sınırı 300 (doğrulandı, denendi) — bu tavan kalıyor.
export const maxDuration = 300;

type Body = { raceId: string; faz1?: Faz1Sonuc };

async function handlePost(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const body = (await req.json()) as Body;
  const { raceId } = body;
  if (!raceId) return NextResponse.json({ error: "raceId gerekli" }, { status: 400 });

  // ── FAZ 1 — TAMAMEN OTOMATİK VERİ TOPLAMA (admin girdisi yok) ──
  const faz1 = body.faz1 ?? await gatherFaz1(raceId);
  if (!faz1) return NextResponse.json({ error: "Koşu verisi bulunamadı" }, { status: 404 });

  // v6.0: Geçit motoru (ve onun ayrı, bloke edici veri yeterliliği kontrolü) tamamen
  // kaldırıldı — yeni metodolojinin §XVII/§XXI ilkesi: veri yetersizliği ASLA analiz
  // sürecini durdurmaz, yalnız ilgili kalemi nötr sayar. Admin'e bilgi amaçlı, bloke
  // ETMEYEN bir doluluk özeti Faz1'in kendi veriDoluluk alanından zaten geliyor
  // (bkz. AIAnalysisPanel.tsx debug paneli) — burada ayrıca bir kontrol gerekmiyor.

  const methodology = await db.methodologyVersion.findFirst({ where: { isCurrent: true } });
  // v6.0: yeni metodoloji zaten ~10K karakter (eskiden 74K'lık §IV koşu-tipi-kartı
  // daraltma mantığına ihtiyaç kalmadı) — tam metin gönderiliyor, ekstra karmaşıklık
  // eklemeye değmiyor (bkz. claude-analiz-helpers.ts'te kaldırılan daraltilmisMetodoloji).
  const methodologyText = methodology?.content ?? "";

  const faz1Tablo = faz1.runners
    .map((r) => {
      const kiloStr = r.weightChange != null ? `${r.weightChange >= 0 ? "+" : ""}${r.weightChange}kg` : "—";
      return [
        `#${r.no} ${r.ad}${r.disaridanStart ? "  [⚠ DS — KENDİ TERCİHİYLE DIŞTAN START, olumlu bir etken olabilir, dikkate al]" : ""}`,
        `  Kilo:${r.weight ?? "—"}(${kiloStr}) Jokey:${r.jockey ?? "—"}(%${r.jockeyWinPct ?? "?"})${r.apprentice ? ` [ÇIRAK jokey, kalan kilo indirim hakkı:${r.apprenticeRemaining ?? "?"}]` : ""}${r.jockeyChanged ? ` [JOKEY DEĞİŞTİ, önceki jokey:${r.previousJockey ?? "?"}]` : ""} Antrenör:${r.trainer ?? "—"}(%${r.trainerWinPct ?? "?"})`,
        ...(r.ekuriMateleri.length > 0 ? [`  Eküri: aynı sahiplikten bu koşuda da koşan diğer at(lar): ${r.ekuriMateleri.join(", ")} — pacemaker/rehavet etkisi olası, göz ardı etme`] : []),
        `  Pedigri: ${r.sire ?? "—"} — ${r.dam ?? "—"} (${r.damSire ?? "—"})`,
        ...(r.sireStatOzet
          ? [`  Aygır İstatistiği (otomatik, hipodromx.com — babanın BU pist/mesafe kombinasyonundaki yavru performansı, K/K%=galibiyet oranı, AEI=1.0 ortalama): ${r.sireStatOzet}`]
          : []),
        ...(r.damStatOzet
          ? [`  Kısrak İstatistiği (otomatik, hipodromx.com — anne+anne babası kombinasyonunun BU pist/mesafedeki yavru performansı): ${r.damStatOzet}`]
          : []),
        ...(r.adminNote ? [`  Admin Notu (elle girildi, güvenilir kanıt kabul et): ${r.adminNote}`] : []),
        `  HP bugün:${r.hpBugun}${r.hpBugunResmiYok ? " (resmi HP yok — Şartlı1/Maiden/henüz atanmamış; 0 KABUL EDİLİR, HP karşılaştırmasında/sıralamasında bu at 0 puanlı sayılır — bkz. metodoloji istisna kuralı)" : ""} önceki:${
          r.ilkStart ? "İLK START"
          : r.hpOncekiFetchBasarisiz ? "BİLİNMİYOR (TJK verisine bu seferlik ulaşılamadı — veri toplama hatası, olumsuz kanıt DEĞİL, ivme hesaplanamaz)"
          : `${r.hpOnceki}${r.hpOncekiResmiYok ? " (resmi yok, 0 KABUL EDİLİR — HP karşılaştırmasında bu at 0 puanlı sayılır)" : ""}`
        } ivme:${r.hpIvmesi ?? "?"}`,
        `  AGF:%${r.agf ?? "?"} sıra:${r.agfSirasi ?? "?"} | Form dizisi:${r.recentForm ?? "—"} (geriliyor=${r.bitirisGeriliyor} iyileşiyor=${r.bitirisIyilesiyor} son sonuç zayıf=${r.sonSonucZayif}) | En iyi derece:${r.bestTime ?? "—"}`,
        `  Tempo örneklem n:${r.tempoVeriN ?? "?"} stil:${r.raceStyleEtiket ?? "?"} kaçak:${r.kacak}`,
        `  Accurace tempo/pozisyon eğilimi (GPS/sektörel, geçmiş yarışlardan): ${r.accuraceEgilim ? `${r.accuraceEgilim.stil} %${r.accuraceEgilim.percent} (${r.accuraceEgilim.n} yarış)` : "veri yok (henüz Accurace kaydı birikmedi veya n<3, ceza değil)"}`,
        `  Sınıf: ${r.sinifOnceki ?? "?"} (SKK ${r.sinifSkkOnceki ?? "?"}) -> bugün ${faz1.race.classType} (SKK ${r.sinifSkkBugun ?? "?"}) düşüş=${r.sinifDususu}`,
        `  Takı: ${r.equipment ?? "—"} (eklenen:${r.equipmentAdded ?? "—"} çıkarılan:${r.equipmentRemoved ?? "—"})`,
        `  Galop: ${r.galopOzet} | kondisyon zinciri var=${r.kondisyonZinciriVar} keskin=${r.keskinGalopZinciri}`,
        `  Son800 benzer koşu (KESİN — pist zorunlu+mesafe≤200m) n=${r.son800BenzerKosuN} medyan fark=${r.son800Medyan ?? "—"}`,
        `  Son800 TÜM kayıtlar (bu yıl, en fazla 4, TAM UYGUN öncelikli): ${r.son800TumOzet ?? "Accurace kaydı yok"}`,
        `  Aynı Pist/Mesafe/Hipodrom geçmişi: ${r.aynıPistMesafeOzet ?? "kayıt yok"}`,
        ...(r.h2hOzet ? [`  H2H (zayıf kanıt, sahadaki diğer atlarla geçmiş karşılaşma): ${r.h2hOzet}`] : []),
        `  Ön-hesaplanmış (kod, YENİDEN HESAPLAMA): HP Kalitesi ${r.hpKalitesiYildizi != null ? `⭐${r.hpKalitesiYildizi}/5` : "tabloda tanımsız (serbest değerlendir)"} · Sınıf Geçiş ${r.sinifGecisBonusuPuan != null ? (r.sinifGecisBonusuPuan >= 0 ? `+${r.sinifGecisBonusuPuan}` : `${r.sinifGecisBonusuPuan}`) : "?"} · Galop zinciri ${r.galopSiniflandirma.ozet} · Tempo Güven: ${r.tempoGuven ?? "?"}`,
      ].join("\n");
    })
    .join("\n\n");

  // ── PAYLAŞILAN BAĞLAM — yalnız bu istek içinde (retry/20dk tekrar-koruma penceresi
  // için) cache_control ile işaretleniyor. Faz2 ve Faz3 farklı şemalar kullandığı için
  // (bkz. claude-analiz-helpers.ts) ARALARINDA cache paylaşamazlar — bu, daha önce
  // denenip "Grammar compilation timed out" hatasına yol açan şema-birleştirme
  // girişiminden kasıtlı olarak kaçınmanın sonucu, ek bir eksiklik değil.
  const sharedContext = `## KOŞU
${faz1.race.hippodromeName} — ${faz1.race.raceNo}. Koşu | ${faz1.race.classType} | ${faz1.race.breed} | ${faz1.race.distance}m ${faz1.race.surface} | ${faz1.runners.length} at
Zemin: ${faz1.race.zeminEtiketi}${faz1.race.zeminDetayi ? ` (${faz1.race.zeminDetayi})` : ""} — kilo katsayısı ×${faz1.race.zeminKatsayisi} (§III.3, Katman 4'e uygulanır)
Saha kaçak haritası: ${faz1.race.sahadakiKacakSayisi} kaçak → tempo "${faz1.race.kacakTempoEtiketi}" — avantajlı: ${faz1.race.kacakAvantajliStil}

## ATLAR (FAZ 1 — otomatik toplanmış ham veri, sitenin kendi TJK kaynağından)
${faz1Tablo}

## METODOLOJİ
${methodologyText}`;

  const sharedContextBlock: Anthropic.TextBlockParam = {
    type: "text",
    text: sharedContext,
    cache_control: { type: "ephemeral", ttl: "1h" },
  };

  // ── FAZ 2 — CLAUDE: TEK HAVUZ (0-100) puanlama + ön teknik sıra ──
  const faz2Tail = `Sen ROTAGANYAN v6.1 at yarışı analistisin. FAZ 2 — PUANLAMA aşamasındasın. Yukarıdaki KOŞU/ATLAR/METODOLOJİ bağlamını kullan (özellikle §VII.0 Sabit 5 Katmanlı Puan Havuzu, ilgili §VII.1-10 kartı, ve §XVIII Tek Puan Sistemi).

## GÖREVİN
1. Koşu tipini belirle, ilgili §VII kartını (§VII.1-10) uygula — o kartın 5 katmanına (Katman 1: 22-30, Katman 2: 16-22, Katman 3: 12-16, Katman 4: 8-12, Katman 5: 5-8 puan) hangi veri paketinin girdiğini kartın kendisi söylüyor.
2. 10+ atlı sahada §VII.0 "Kalabalık Saha Katman Yükseltmesi"ni uygula — Tempo+Stil+Accurace otomatik Katman 1-2'ye yükselir.
3. Her atın satırındaki "Ön-hesaplanmış (kod, YENİDEN HESAPLAMA)" değerleri (HP Kalitesi yıldızı, Sınıf Geçiş puanı, Galop zinciri sınıflandırması, Tempo Güven seviyesi) ve KOŞU başlığındaki Zemin/Kaçak haritası zaten doğru hesaplandı — bunları TEKRAR HESAPLAMA, olduğu gibi kabul edip ilgili katmana göm.
4. Her at için TEK bir "puan" (0-100) ver — formül (§XVIII.1): HAM TOPLAM (katman 1-5 toplamı, ≈100'e normalize) × ÇAPRAZ DOĞRULAMA KATSAYISI (§XVIII.3). Bir yarışın kalbi tempodur: "Son800 benzer koşu (KESİN)" satırındaki n/medyan ANA dayanaktır — n≥3 ve medyan ≤ -0.5s ise güçlü kapanış (puanı yükselt), n≥3 ve medyan ≥ +0.7s ise düşük tempo (puanı düşür), n<3 ise bu KESİN sayı tek başına güvenilir değil, "Son800 TÜM kayıtlar" satırına (TAM UYGUN öncelikli, düşük ağırlıkla) bak.
4b. SON800+GALOP KOMBİNASYONU (§X/§XI, v6.1 — ÖNEMLİ): yeterli örneklemli güçlü Son800 (n≥3, medyan≤-0.5s) İLE keskin/iyi bir galop zinciri AYNI ANDA varsa, bunu gerçek ve güçlü bir destekleyici çift say — Çapraz Doğrulama Katsayısı'nda artı yönde (×1.05-1.10) değerlendir, gerekirse puanı belirgin biçimde yukarı taşı. Bu ikiliyi görüp de başka bir kaleme (düşük AGF, sınıf vb.) dayanarak geride bırakma.
4c. HP TEK BAŞINA ÜSTÜNLÜK DEĞİLDİR (§XX.27, v6.1): sahadaki en yüksek ham HP'ye sahip at, formu zayıf/gerilemişse veya tempo-stiliyle bugünkü yarış uyumsuzsa, otomatik olarak üst sıraya konmaz — madde 4b'deki gibi güçlü bir destekleyici kombinasyon taşıyan başka bir at HP'si daha düşük olsa bile önüne geçebilir.
5. ÇAPRAZ DOĞRULAMA KATSAYISI (§XVIII.3) — puanı yazmadan önce §IV'teki veri çiftlerini kontrol et: iki veri birbirini güçlü destekliyorsa ×1.05-1.10, nötr/bağımsızsa ×1.00, hafif çelişiyorsa ×0.90-0.95, doğrudan çelişiyor/biri diğerini geçersiz kılıyorsa ×0.70-0.80. Birden fazla çift varsa çarpma, EN GÜÇLÜ çelişki/destek esas alınır. Küçük örneklem/veri eksikliği/farklı bağlam bu kapsama GİRMEZ (bkz. madde 8) — yalnız GERÇEK/SOMUT çelişkiler.
6. KİLO-GEÇMİŞ ÇAPRAZ KONTROLÜ: "Aynı Pist/Mesafe/Hipodrom geçmişi" satırındaki geçmiş kilo bugünküyle karşılaştırılır — geçmişte iyi sonuç aldığı kilodan bugün daha hafifse Katman 4'e +3/+5, geçmişte zaten yetersiz kaldığı kilodan bugün daha ağırsa −4/−6.
7. ZEMİN ÇAPRAZ KONTROLÜ: "Aynı Pist/Mesafe/Hipodrom geçmişi" satırındaki her kayıt "[Zemin: ...]" etiketi taşıyorsa, bunu bugünkü KOŞU başlığındaki Zemin ile karşılaştır — uyuşmazsa geçmiş sonucu ham haliyle güçlü kanıt sayma, Çapraz Doğrulama Katsayısı'na yansıt (madde 5).
8. AGF (§XVI, v6.1 ASİMETRİK KURAL): AGF YÜKSEK + teknik görüş güçlüyse katsayıyı yukarı çeker; AGF YÜKSEK + teknik görüş zayıfsa GERÇEK bir çelişkidir, katsayıyı aşağı çekebilir. AMA AGF DÜŞÜK + teknik görüş güçlüyse bu ÇELİŞKİ SAYILMAZ — düşük AGF yalnızca piyasa ilgisizliğidir, teknik açıdan güçlü bir atı ASLA geriye çekme/katsayıyı düşürme gerekçesi yapma (§XX.26). Yön tek taraflı işler: düşük AGF yalnız "destek yok" demektir, "ceza" değil.
9. YAŞ-KİLO AYRIŞTIRMASI (karma yaş grubu koşularında): genç atın yaş-skala kaynaklı düşük kilosu, düşük HP'siyle AYNI kalemde eritilip cezalandırılmaz — ayrı ve pozitif bir alt-kalem.
10. "Kanıt yokluğu olumsuz kanıt değildir" ilkesine uy (§II.1) — örneklem küçüklüğü/veri eksikliği/farklı bağlam yalnız notta yansır, puanı veya çapraz doğrulama katsayısını İKİNCİ KEZ ASLA düşürme/yükseltme. §XXI: sabit örneklem eşiği yok, kendi muhakemenle karar ver.
11. TAKI DEĞİŞİKLİĞİ (§XIII): eklendi/çıkarıldıysa gerekçede belirt, otomatik puan vermez.
12. Veri Çifti Doktrini'ni (§IV) uygula: her kalemin YORUMU izole değil, eşleştiği veriyle BİRLİKTE okunarak yazılır.
13. KURAL DENETİM PROTOKOLÜ (§II.4, ZORUNLU SON ADIM): puanları yazdıktan sonra, ayrı bir turda her düşük puanı geri kontrol et — bu puanı düşüren şey somut bir çelişki mi (madde 5'e göre katsayı hakkı var), yoksa örneklem küçüklüğü/bağlam farkı/kanıt yokluğu mu (madde 10'a göre puanı DEĞİL, yalnız notu etkilemeli)?

Yanıtı YALNIZCA geçerli JSON olarak ver, başka metin ekleme:
{
  "atlar": [
    { "no": 0, "ad": "...", "puan": 0, "teknikSira": 1 }
  ]
}`;

  // "Boşa ödeme" koruması: Vercel platform zaman aşımı Claude'u ücretlendirdikten SONRA
  // ama yanıt istemciye ulaşmadan ÖNCE fonksiyonu kesebiliyor — admin "tekrar dene"
  // dediğinde aynı raceId için 20dk içinde zaten üretilmiş bir sonuç varsa, Claude'u
  // YENİDEN ÇAĞIRMADAN onu kullan.
  const cachedFaz2 = await getRecentCachedResult(raceId, "faz2");
  let faz2Raw: string;
  let faz2StopReasonMaxTokens = false;
  if (cachedFaz2) {
    faz2Raw = cachedFaz2;
  } else {
    const faz2Msg = await createWithTruncationRetry(
      {
        model: "claude-sonnet-5",
        thinking: { type: "adaptive" },
        max_tokens: 32000,
        output_config: { format: { type: "json_schema", schema: FAZ2_SCHEMA } },
        messages: [{ role: "user", content: [sharedContextBlock, { type: "text", text: faz2Tail }] }],
      },
      raceId, "faz2", 40000
    );
    faz2Raw = extractText(faz2Msg);
    faz2StopReasonMaxTokens = faz2Msg.stop_reason === "max_tokens";
  }
  let faz2: Faz2Atlar;
  try {
    faz2 = JSON.parse(faz2Raw);
  } catch {
    const sebep = faz2StopReasonMaxTokens
      ? " (yanıt otomatik yüksek limitli tekrar denemede de token sınırına takıldı — bu koşu olağanüstü kalabalık, tekrar deneyin)"
      : "";
    return NextResponse.json({ error: `Faz 2 (skorlama) yanıtı parse edilemedi${sebep}`, raw: faz2Raw }, { status: 500 });
  }

  return NextResponse.json({ ok: true, faz1, faz2, sharedContext });
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[oto-analiz-faz2]", e);
    return NextResponse.json({ error: "Beklenmeyen hata: " + String(e) }, { status: 500 });
  }
}
