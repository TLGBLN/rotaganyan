import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { gatherFaz1 } from "@/lib/methodology/veri-toplama";
import { veriDenetimi, type AtGirdisi } from "@/lib/methodology/gecit-motoru";
import {
  createWithTruncationRetry, extractText, daraltilmisMetodoloji,
  FAZ2_SCHEMA, type Faz2Atlar,
} from "@/lib/methodology/claude-analiz-helpers";
import type { Anthropic } from "@anthropic-ai/sdk";
import type { Role } from "@prisma/client";

// Faz 2 ve Faz 4, tek bir istekte art arda çalıştığında (eski hal) ikisinin toplam
// süresi bazı koşularda 300s'i (bu hesabın gerçek Vercel üst tavanı — 800 denendi,
// deploy'un kendisini kırdı, Fluid Compute açık değil) aşıp fonksiyonu ortadan
// kesiyordu (Faz 2 tamamlanıp Faz 4'e hiç geçilemeden). Çözüm: iki AYRI istek —
// admin paneli önce bunu çağırır, sonucu /oto-analiz-faz4'e taşır. Her istek artık
// tek bir Claude çağrısı bekliyor, rahatça 300s altında kalıyor.
export const maxDuration = 300;

async function handlePost(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { raceId } = (await req.json()) as { raceId: string };
  if (!raceId) return NextResponse.json({ error: "raceId gerekli" }, { status: 400 });

  // ── FAZ 1 — TAMAMEN OTOMATİK VERİ TOPLAMA (admin girdisi yok) ──
  const faz1 = await gatherFaz1(raceId);
  if (!faz1) return NextResponse.json({ error: "Koşu verisi bulunamadı" }, { status: 404 });

  // Veri yeterliliğini kontrol et — AMA artık BLOKE ETMEZ (v4.10 düzeltmesi: "eksik veri
  // varsa açıkça yaz, düşük güvenle devam et" ilkesiyle çelişen katı blokaj kaldırıldı).
  // Admin zaten Faz1VeriDurumu panelinde eksikleri görüp kendi kararını verebiliyor; burada
  // eksik varsa yalnız Claude'a açık bir uyarı enjekte edilir (Veri Güveni C'ye çeksin,
  // eksikliği ceza sebebi yapmasın) — "analiz yok" çıktısı hiçbir zaman verilmez.
  const onKontrol: AtGirdisi[] = faz1.runners.map((r) => ({
    ad: r.ad, bc: 0, agfSirasi: r.agfSirasi, hpBugun: r.hpBugun, hpOnceki: r.hpOnceki, tempoVeriN: r.tempoVeriN,
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
        `  Son800 benzer koşu n=${r.son800BenzerKosuN} medyan fark=${r.son800Medyan ?? "—"}`,
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

  const sharedContextBlock: Anthropic.TextBlockParam = {
    type: "text",
    text: sharedContext,
    cache_control: { type: "ephemeral" },
  };

  // ── FAZ 2 — CLAUDE: koşu tipine göre A/B+C skorlama + ön teknik sıra ──
  const faz2Tail = `Sen ROTAGANYAN v4.1 at yarışı analistisin. FAZ 2 — SKORLAMA aşamasındasın (henüz final sıralama/kupon yazma, sadece puanla). Yukarıdaki KOŞU/ATLAR/METODOLOJİ bağlamını kullan.

## GÖREVİN
1. Koşu tipini belirle (Ansiklopedi Bölüm IV) ve o tipin A/B+C ağırlık matrisini uygula.
2. Her atın satırındaki "Ön-hesaplanmış (kod, YENİDEN HESAPLAMA)" değerleri (HP Kalitesi yıldızı, Sınıf Geçiş puanı, Galop zinciri sınıflandırması, Tempo Güven seviyesi) ve KOŞU başlığındaki Zemin/Kaçak haritası zaten doğru hesaplandı — bunları TEKRAR HESAPLAMA, olduğu gibi kabul edip ilgili A/B+C bileşenine göm. Senin işin bu mekanik parçaları + pedigri notu/admin notu gibi serbest metin kanıtlarını, koşu tipinin ağırlık matrisine göre TOPLAM A(0-60)/B+C(0-40) puanına SENTEZLEMEK.
3. Her at için A (0-60) ve B+C (0-40) puanı ver. Bir yarışın kalbi tempodur: satırdaki "Son800 benzer koşu n=... medyan fark=..." verisini A puanına DAHİL ET — n≥3 ve medyan ≤ -0.5s ise güçlü kapanış (yetenek göstergesi, A'yı yükselt), n≥3 ve medyan ≥ +0.7s ise düşük tempo (A'yı düşür), n<3 ise örneklem güvenilir değil — cezalandırma/ödüllendirme, yalnız nötr bilgi olarak kaydet.
4. Toplam puana göre ön teknik sıra belirle (1 = en iyi). Bu sıra FAZ 3'te geçit motoruna girdi olacak.
5. "Kanıt yokluğu olumsuz kanıt değildir" ilkesine uy — eksik veriyi ceza sebebi yapma. "Tabloda tanımsız" olarak işaretlenmiş Ön-hesaplanmış alanlar (örn. HP Kalitesi) da bu ilkeye tabidir — boş/tanımsız olması ceza değildir, serbestçe değerlendir.
6. Veri Çifti Doktrini'ni (§I.4) uygula: puanlama kalem kalem yapılır ama her kalemin YORUMU izole değil, eşleştiği veriyle BİRLİKTE okunarak yazılır (ör. "kaçak" etiketi tempo+son800 birlikte okunmadan konmaz; "form yükseliyor" HP ivmesiyle birlikte doğrulanmadan yazılmaz). Çiftlendiği veri yoksa (ör. ilk start) o veri tek başına sınırlı kanıt sayılır — ceza değil, yalnız ek güven kaybı.

Yanıtı YALNIZCA geçerli JSON olarak ver, başka metin ekleme:
{
  "atlar": [
    { "no": 0, "ad": "...", "aPuani": 0, "bcPuani": 0, "teknikSira": 1 }
  ]
}`;

  const faz2Msg = await createWithTruncationRetry(
    {
      model: "claude-sonnet-5",
      // GEÇİCİ DENEY 2 sonucu: thinking kapalıyken bir kez daha (mekanik ön-hesaplama
      // sonrası) benzer bir kalite şüphesi görüldü (pedigri-mesafe uyumsuzluğu metinde
      // doğru tespit edilmiş ama puana orantılı yansıyıp yansımadığı belirsiz). Karşılaştırma
      // için thinking geri açıldı — bkz. [[thinking-acik-kalmali]].
      thinking: { type: "adaptive" },
      max_tokens: 20000,
      output_config: { format: { type: "json_schema", schema: FAZ2_SCHEMA } },
      messages: [{ role: "user", content: [sharedContextBlock, { type: "text", text: faz2Tail }] }],
    },
    raceId, "faz2", 28000
  );
  const faz2Raw = extractText(faz2Msg);
  let faz2: Faz2Atlar;
  try {
    faz2 = JSON.parse(faz2Raw);
  } catch {
    const sebep = faz2Msg.stop_reason === "max_tokens"
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
