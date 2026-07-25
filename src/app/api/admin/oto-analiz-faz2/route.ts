import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { gatherFaz1, type Faz1Sonuc } from "@/lib/methodology/veri-toplama";
import { veriDenetimi, type AtGirdisi } from "@/lib/methodology/gecit-motoru";
import {
  createWithTruncationRetry, extractText, daraltilmisMetodoloji,
  FAZ2_SCHEMA, type Faz2Atlar,
} from "@/lib/methodology/claude-analiz-helpers";
import { getRecentCachedResult } from "@/lib/claude-cost";
import type { Anthropic } from "@anthropic-ai/sdk";
import type { Role } from "@prisma/client";

// Faz 2 ve Faz 4, tek bir istekte art arda çalıştığında (eski hal) ikisinin toplam
// süresi bazı koşularda 300s'i aşıp fonksiyonu ortadan kesiyordu (Faz 2 tamamlanıp
// Faz 4'e hiç geçilemeden). Çözüm: AYRI istekler — admin paneli önce /oto-analiz-faz1'i
// (ücretsiz veri toplama) çağırır, sonra bu isteği (yalnız Claude çağrısı), sonucu
// /oto-analiz-faz4'e taşır. 2026-07-24: Fluid Compute Vercel proje ayarından açıldı
// (daha önce 800 denenmişti, Fluid Compute kapalıyken deploy'un kendisini kırıyordu) —
// artık 300s'lik eski platform tavanı da kalkmış durumda, aşağıdaki maxDuration=800
// gerçekten geçerli. Bu, max_tokens artırma yamalarının (bkz. aşağıdaki not) asla tam
// çözemediği kök sorunu (Claude'un thinking süresi saha büyüdükçe öngörülemez biçimde
// uzuyor) kalıcı olarak ortadan kaldırıyor.
export const maxDuration = 300;

async function handlePost(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const body = (await req.json()) as { raceId: string; faz1?: Faz1Sonuc };
  const { raceId } = body;
  if (!raceId) return NextResponse.json({ error: "raceId gerekli" }, { status: 400 });

  // ── FAZ 1 — TAMAMEN OTOMATİK VERİ TOPLAMA (admin girdisi yok) ──
  // İstemci bunu önceden ayrı (ücretsiz, Claude'a gitmeyen) /oto-analiz-faz1 isteğiyle
  // topladıysa onu kullan — bu isteğin süresinden veri toplamayı çıkarır, 300sn'lik
  // pencerenin tamamı Claude çağrısına kalır. Sağlanmadıysa (geriye uyumluluk) burada topla.
  const faz1 = body.faz1 ?? await gatherFaz1(raceId);
  if (!faz1) return NextResponse.json({ error: "Koşu verisi bulunamadı" }, { status: 404 });

  // Veri yeterliliğini kontrol et — AMA artık BLOKE ETMEZ (v4.10 düzeltmesi: "eksik veri
  // varsa açıkça yaz, düşük güvenle devam et" ilkesiyle çelişen katı blokaj kaldırıldı).
  // Admin zaten Faz1VeriDurumu panelinde eksikleri görüp kendi kararını verebiliyor; burada
  // eksik varsa yalnız Claude'a açık bir uyarı enjekte edilir (Veri Güveni C'ye çeksin,
  // eksikliği ceza sebebi yapmasın) — "analiz yok" çıktısı hiçbir zaman verilmez.
  const onKontrol: AtGirdisi[] = faz1.runners.map((r) => ({
    ad: r.ad, puan: 0, agfSirasi: r.agfSirasi, hpBugun: r.hpBugun, hpOnceki: r.hpOnceki, tempoVeriN: r.tempoVeriN,
    ilkStart: r.ilkStart, bitirisGeriliyor: r.bitirisGeriliyor, bitirisIyilesiyor: r.bitirisIyilesiyor,
  }));
  const onVeriDenetimi = veriDenetimi(onKontrol);
  const veriYeterliligiUyarisi = onVeriDenetimi.yeterli
    ? ""
    : `\nVERİ YETERLİLİĞİ UYARISI (blokaj değil, güven ayarı): ${onVeriDenetimi.eksikler.join(" · ")} — bu genelde AGF/HP'nin henüz yayınlanmadığı durumlarda olur. Eksik alanları OLUMSUZ KANIT SAYMA; etkilenen atlarda Veri Güveni'ni C'ye çek ve gerekçede eksikliği açıkça belirt.\n`;

  const methodology = await db.methodologyVersion.findFirst({ where: { isCurrent: true } });
  const methodologyText = daraltilmisMetodoloji(
    methodology?.content ?? "",
    faz1.race.classType,
    faz1.runners[0]?.sinifSkkBugun ?? null,
    faz1.race.distance,
    faz1.race.surface,
    faz1.runners.length
  );

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
        `  Accurace tempo/pozisyon eğilimi (GPS/sektörel, geçmiş yarışlardan, Veri Çifti Doktrini §I.4): ${r.accuraceEgilim ? `${r.accuraceEgilim.stil} %${r.accuraceEgilim.percent} (${r.accuraceEgilim.n} yarış)` : "veri yok (henüz Accurace kaydı birikmedi veya n<3, ceza değil)"}`,
        `  Sınıf: ${r.sinifOnceki ?? "?"} (SKK ${r.sinifSkkOnceki ?? "?"}) -> bugün ${faz1.race.classType} (SKK ${r.sinifSkkBugun ?? "?"}) düşüş=${r.sinifDususu}`,
        `  Takı: ${r.equipment ?? "—"} (eklenen:${r.equipmentAdded ?? "—"} çıkarılan:${r.equipmentRemoved ?? "—"})`,
        `  Galop: ${r.galopOzet} | kondisyon zinciri var=${r.kondisyonZinciriVar} keskin=${r.keskinGalopZinciri}`,
        `  Son800 benzer koşu (KESİN — pist zorunlu+mesafe≤200m) n=${r.son800BenzerKosuN} medyan fark=${r.son800Medyan ?? "—"}`,
        `  Son800 TÜM kayıtlar (bu yıl, en güncel 8): ${r.son800TumOzet ?? "Accurace kaydı yok"}`,
        `  Aynı Pist/Mesafe/Hipodrom geçmişi: ${r.aynıPistMesafeOzet ?? "kayıt yok"}`,
        ...(r.h2hOzet ? [`  H2H (zayıf kanıt, sahadaki diğer atlarla geçmiş karşılaşma): ${r.h2hOzet}`] : []),
        `  Ön-hesaplanmış (kod, YENİDEN HESAPLAMA): HP Kalitesi ${r.hpKalitesiYildizi != null ? `⭐${r.hpKalitesiYildizi}/5` : "tabloda tanımsız (serbest değerlendir)"} · Sınıf Geçiş ${r.sinifGecisBonusuPuan != null ? (r.sinifGecisBonusuPuan >= 0 ? `+${r.sinifGecisBonusuPuan}` : `${r.sinifGecisBonusuPuan}`) : "?"} · Galop zinciri ${r.galopSiniflandirma.ozet} · Tempo Güven: ${r.tempoGuven ?? "?"}`,
      ].join("\n");
    })
    .join("\n\n");

  // ── PAYLAŞILAN BAĞLAM (Faz 2 ve Faz 4'te BİREBİR AYNI metin — Faz 4'e olduğu gibi
  // taşınacak, cache_control eşleşmesi bu byte-birebir eşitliğe bağlı) ──
  const sharedContext = `## KOŞU
${faz1.race.hippodromeName} — ${faz1.race.raceNo}. Koşu | ${faz1.race.classType} | ${faz1.race.breed} | ${faz1.race.distance}m ${faz1.race.surface} | ${faz1.runners.length} at
Zemin: ${faz1.race.zeminEtiketi}${faz1.race.zeminDetayi ? ` (${faz1.race.zeminDetayi})` : ""} — kilo katsayısı ×${faz1.race.zeminKatsayisi} (Göreli kilo/zemin puanına dahil et)
Saha kaçak haritası: ${faz1.race.sahadakiKacakSayisi} kaçak → tempo "${faz1.race.kacakTempoEtiketi}" — avantajlı: ${faz1.race.kacakAvantajliStil}
${veriYeterliligiUyarisi}
## ATLAR (FAZ 1 — otomatik toplanmış ham veri, sitenin kendi TJK kaynağından)
${faz1Tablo}

## METODOLOJİ
${methodologyText}`;

  // 2026-07-24: gerçek 7 günlük ölçümde cache hit oranı yalnız %6 çıktı — Faz2 burada
  // yazıyor ama Faz4/Faz4notes'a ulaşana kadar (Faz1 ağ toplama + Faz2'nin kendi
  // thinking süresi + olası tekrar denemeler) 5dk'lık varsayılan pencere çoğunlukla
  // dolmuş oluyordu, bu yüzden Faz4/Faz4notes kendi (tam fiyatlı) cache yazımını
  // yapıyordu. 1 saatlik TTL'e çıkarmak yazma maliyetini artırıyor (1.25x→2x) ama
  // 3 çağrının aynı pencerede kalma ihtimalini pratikte kesinliğe yaklaştırıyor —
  // net etki düşüş yönünde (bkz. shared/prompt-caching.md ekonomi tablosu).
  //
  // 2026-07-25: %6'lık oranın ASIL sebebi TTL değil, her fazın farklı output_config.
  // format şeması kullanması imiş (Anthropic cache'i hiyerarşik hash'liyor — şema
  // farklıysa sonrası geçersiz). Faz2'yi de Faz4/Faz4-final'in paylaştığı şemaya
  // katmayı denedik ama şema büyüyünce ("atlar" alanı eklenince) gerçek bir koşuda
  // "Grammar compilation timed out" 400 hatası aldık — geri alındı. Faz2 kendi
  // (FAZ2_SCHEMA) şemasında kalıyor, Faz4/Faz4-final ARALARINDA (Faz2'siz) cache
  // paylaşıyor — bkz. claude-analiz-helpers.ts'teki FAZ_SHARED_SCHEMA yorumu.
  const sharedContextBlock: Anthropic.TextBlockParam = {
    type: "text",
    text: sharedContext,
    cache_control: { type: "ephemeral", ttl: "1h" },
  };

  // ── FAZ 2 — CLAUDE: koşu tipine göre TEK HAVUZ skorlama + ön teknik sıra ──
  // v5.0: kullanıcının "Harmanlama / Tek Puanlama Deneyi" bulgularına göre A(0-60)/B+C(0-40)
  // katman ayrımı kaldırıldı — harmanlama artık yalnız metin/gerekçe seviyesinde değil,
  // PUANIN KENDİSİNDE (Çapraz Doğrulama Katsayısı ile) gerçekleşiyor. Bkz. metodoloji §II.
  const faz2Tail = `Sen ROTAGANYAN v5.0 at yarışı analistisin. FAZ 2 — SKORLAMA aşamasındasın (henüz final sıralama/kupon yazma, sadece puanla). Yukarıdaki KOŞU/ATLAR/METODOLOJİ bağlamını kullan (özellikle §II Tek Puan Sistemi ve §I.4 Veri Çifti Doktrini).

## GÖREVİN
1. Koşu tipini belirle (Ansiklopedi Bölüm IV) ve o tipin ağırlık matrisini uygula — kartlar hâlâ "A = ..." / "B+C = ..." etiketiyle yazılı ama bu ayrım artık yalnız kavramsal bir kalıntı, TÜM kalemler TEK bir 100 puanlık havuzda toplanır (öncelik zinciri yok).
2. Her atın satırındaki "Ön-hesaplanmış (kod, YENİDEN HESAPLAMA)" değerleri (HP Kalitesi yıldızı, Sınıf Geçiş puanı, Galop zinciri sınıflandırması, Tempo Güven seviyesi) ve KOŞU başlığındaki Zemin/Kaçak haritası zaten doğru hesaplandı — bunları TEKRAR HESAPLAMA, olduğu gibi kabul edip ilgili kaleme göm.
3. Her at için TEK bir "puan" (0-100) ver — formül: HAM TOPLAM (§IV ağırlıklarının toplamı) × ÇAPRAZ DOĞRULAMA KATSAYISI (§II.3). Bir yarışın kalbi tempodur: "Son800 benzer koşu (KESİN)" satırındaki n/medyan ANA dayanaktır — n≥3 ve medyan ≤ -0.5s ise güçlü kapanış (yetenek göstergesi, puanı yükselt), n≥3 ve medyan ≥ +0.7s ise düşük tempo (puanı düşür), n<3 ise bu KESİN sayı tek başına güvenilir değil. Bu durumda (veya ek doğrulama için her zaman) "Son800 TÜM kayıtlar" satırına bak: [TAM UYGUN] etiketli satırlar KESİN sayıyla aynı anlamda güvenilir; [PİST FARKLI]/[MESAFE UZAK] etiketli satırlar birebir kıyaslanamaz ama atın GENEL kapanış karakteri hakkında zayıf ama sıfır olmayan bir ipucu verir — düşük ağırlıkla, KESİN sayının YERİNE değil YANINA bir gözlem olarak kullan.
4. ÇAPRAZ DOĞRULAMA KATSAYISI (§II.3) — puanı yazmadan önce §I.4'teki veri çiftlerini kontrol et: iki veri birbirini güçlü destekliyorsa ×1.05-1.10, nötr/bağımsızsa ×1.00, hafif çelişiyorsa ×0.90-0.95, doğrudan çelişiyor/biri diğerini geçersiz kılıyorsa ×0.70-0.80. Birden fazla çift varsa çarpma, EN GÜÇLÜ çelişki/destek esas alınır. Bu katsayı yalnız GERÇEK/SOMUT çelişkiler içindir — küçük örneklem, veri eksikliği, farklı bağlam bu kapsama GİRMEZ (bkz. madde 7).
5. KİLO-GEÇMİŞ ÇAPRAZ KONTROLÜ (§VII.3, zorunlu): "Aynı Pist/Mesafe/Hipodrom geçmişi" satırındaki geçmiş kilo bugünküyle karşılaştırılır — geçmişte iyi sonuç aldığı kilodan bugün daha hafifse +3/+5, geçmişte zaten yetersiz kaldığı kilodan bugün daha ağırsa −4/−6 (bu aynı zamanda madde 4'teki en güçlü çelişki örneğidir — örn. yüksek HP + bu olumsuz kilo-geçmiş sinyali).
6. YAŞ-KİLO AYRIŞTIRMASI (karma yaş grubu koşularında, §IV): genç atın (alt yaş) yaş-skala kaynaklı düşük kilosu, düşük HP'siyle AYNI kalemde eritilip cezalandırılmaz — ayrı ve pozitif bir alt-kalem olarak işlenir.
7. "Kanıt yokluğu olumsuz kanıt değildir" ilkesine uy. Örneklem küçüklüğü (jokey/antrenör dahil), veri eksikliği, farklı bağlamdan gelen kanıt yalnız Veri Güveni notunda ("küçük örneklem ama X" gibi) yansır — puanı veya çapraz doğrulama katsayısını İKİNCİ KEZ ASLA düşürme/yükseltme (bkz. WHIZBANG/KARAKTERLİ dersleri, §XII/§XI). Aygır/Kısrak istatistiklerinde "[DÜŞÜK ÖRNEKLEM]" etiketli bir yüzde tesadüfi olabilir, "[geniş örneklem]" daha güvenilirdir — 5 yarışta %100 ile 200 yarışta %25 ASLA eşit güvenilirlikte değildir.
8. TAKI DEĞİŞİKLİĞİ BAYRAĞI (§XIII): bir atta takı eklendi/çıkarıldıysa bunu "details" etiketine ekle (örn. "Takı değişti") — otomatik puan vermez, ama gerekçede değerlendirildiği belli olmalı.
9. Veri Çifti Doktrini'ni (§I.4) uygula: her kalemin YORUMU izole değil, eşleştiği veriyle BİRLİKTE okunarak yazılır. Çiftlendiği veri yoksa (ör. ilk start) o veri tek başına sınırlı kanıt sayılır — ceza değil, yalnız ek güven kaybı.
10. KURAL DENETİM PROTOKOLÜ (§II.4, ZORUNLU SON ADIM): puanları yazdıktan sonra, ayrı bir turda her düşük puanı geri kontrol et — bu puanı düşüren şey somut bir çelişki mi (madde 4'e göre katsayı hakkı var), yoksa örneklem küçüklüğü/bağlam farkı/kanıt yokluğu mu (madde 7'ye göre puanı DEĞİL, yalnız notu etkilemeli)? §III'teki "Güçlü Jokey + İyi Pedigri Tabanı" gibi zorunlu taban kuralları bu atı ilgilendiriyor mu? Bu adım atlanmaz.

Yanıtı YALNIZCA geçerli JSON olarak ver, başka metin ekleme:
{
  "atlar": [
    { "no": 0, "ad": "...", "puan": 0, "teknikSira": 1 }
  ]
}`;

  // "Boşa ödeme" koruması: Vercel platform zaman aşımı Claude'u ücretlendirdikten SONRA
  // ama yanıt istemciye ulaşmadan ÖNCE fonksiyonu kesebiliyor — admin "tekrar dene" dediğinde
  // aynı raceId için 20dk içinde zaten üretilmiş bir sonuç varsa, Claude'u YENİDEN ÇAĞIRMADAN
  // onu kullan (bkz. claude-cost.ts getRecentCachedResult).
  const cachedFaz2 = await getRecentCachedResult(raceId, "faz2");
  let faz2Raw: string;
  let faz2StopReasonMaxTokens = false;
  if (cachedFaz2) {
    faz2Raw = cachedFaz2;
  } else {
    const faz2Msg = await createWithTruncationRetry(
      {
        model: "claude-sonnet-5",
        // GEÇİCİ DENEY 2 sonucu: thinking kapalıyken bir kez daha (mekanik ön-hesaplama
        // sonrası) benzer bir kalite şüphesi görüldü (pedigri-mesafe uyumsuzluğu metinde
        // doğru tespit edilmiş ama puana orantılı yansıyıp yansımadığı belirsiz). Karşılaştırma
        // için thinking geri açıldı — bkz. [[thinking-acik-kalmali]].
        thinking: { type: "adaptive" },
        // 2026-07-24: İstanbul 10.Koşu'nda (16 at, Handikap) bu tavan İLK KEZ tamamen
        // görünmeyen thinking'le tüketildi (out=20000, resultText=0kar — Faz4'ün daha önce
        // 16000'de yaşadığıyla BİREBİR AYNI belirti). Kritik olan: createWithTruncationRetry
        // aynı 300sn'lik Vercel penceresini paylaşıyor — ilk deneme tavanı tüketip onlarca
        // saniye harcadıktan SONRA tekrar denemek, ikinci denemenin bitmesi için yeterli süre
        // bırakmayabiliyor (nitekim burada 2. deneme hiç loglanmadı, fonksiyon muhtemelen
        // süre dolmadan öldü). Çözüm Faz 4'te de aynıydı: tavanı İLK denemede yetecek kadar
        // yükselt ki tekrar denemeye hiç gerek kalmasın. Faz 2'nin görevi (yalnız skorlama,
        // Faz 4'teki geçit triyajı/sıralama/banko gibi ek karar yükü yok) daha hafif olduğu
        // için Faz 4'ün nihai tavanıyla (32000/40000) aynı değere çıkarmak güvenli marj bırakıyor.
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

  return NextResponse.json({ ok: true, faz1, faz2, sharedContext, veriDenetimi: onVeriDenetimi });
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[oto-analiz-faz2]", e);
    return NextResponse.json({ error: "Beklenmeyen hata: " + String(e) }, { status: 500 });
  }
}
