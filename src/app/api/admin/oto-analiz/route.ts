import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { gatherFaz1 } from "@/lib/methodology/veri-toplama";
import { degerlendir, metin, veriDenetimi, type AtGirdisi } from "@/lib/methodology/gecit-motoru";
import { logClaudeUsage } from "@/lib/claude-cost";
import type { Role } from "@prisma/client";

const client = new Anthropic();

// Claude'un cevabını YALNIZCA prompt talimatıyla JSON'a zorlamak yerine, API'nin kendi
// şema doğrulamasını (output_config.format) kullanıyoruz — "geçerli JSON döndür" gibi
// bir talimata güvenmek yerine sunucu tarafında zorunlu kılınıyor. Bu, önceki halde
// görülen "yanıtı parse edilemedi" hatalarının (Claude'un JSON dışına metin eklemesi,
// virgül/tırnak hatası vb.) tamamını ortadan kaldırır — model="claude-sonnet-5" bu
// özelliği destekliyor.
const FAZ2_SCHEMA = {
  type: "object",
  properties: {
    atlar: {
      type: "array",
      items: {
        type: "object",
        properties: {
          no: { type: "integer" },
          ad: { type: "string" },
          aPuani: { type: "number" },
          bcPuani: { type: "number" },
          teknikSira: { type: "integer" },
          notlar: { type: "string" },
        },
        required: ["no", "ad", "aPuani", "bcPuani", "teknikSira", "notlar"],
        additionalProperties: false,
      },
    },
  },
  required: ["atlar"],
  additionalProperties: false,
} as const;

const FAZ4_SCHEMA = {
  type: "object",
  properties: {
    picks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rank: { type: "integer" },
          no: { type: "integer" },
          name: { type: "string" },
          score: { type: "number" },
          pedigreeRating: {
            type: "string",
            enum: ["COK_YUKSEK", "YUKSEK", "GUCLU", "ORTA", "DUSUK", "ZAYIF", "SORU", "BILINMIYOR"],
          },
          isTarget: { type: "boolean" },
          details: { type: "array", items: { type: "string" } },
          note: { type: "string" },
        },
        required: ["rank", "no", "name", "score", "pedigreeRating", "isTarget", "details", "note"],
        additionalProperties: false,
      },
    },
    confidence: { type: "string", enum: ["DUSUK", "ORTA", "YUKSEK"] },
    isBanko: { type: "boolean" },
    bankoNote: { type: "string" },
    notes: { type: "string" },
    tempo: { type: "string" },
    couponNarrow: { type: "string" },
    couponNormal: { type: "string" },
    couponWide: { type: "string" },
  },
  required: [
    "picks", "confidence", "isBanko", "bankoNote", "notes", "tempo",
    "couponNarrow", "couponNormal", "couponWide",
  ],
  additionalProperties: false,
} as const;

type Faz2Atlar = {
  atlar: { no: number; ad: string; aPuani: number; bcPuani: number; teknikSira: number | null; notlar?: string }[];
};

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

  // Faz 2'yi (ücretli Claude çağrısı) çağırmadan ÖNCE veri yeterliliğini kontrol et — AGF/HP
  // henüz yayınlanmadıysa (örn. AGF sabah 9'da açıklanıyor) burada ücretsiz olarak durur,
  // Claude'a hiç istek atılmaz.
  const onKontrol: AtGirdisi[] = faz1.runners.map((r) => ({
    ad: r.ad, bc: 0, agfSirasi: r.agfSirasi, hpBugun: r.hpBugun, hpOnceki: r.hpOnceki, tempoVeriN: r.tempoVeriN,
    ilkStart: r.ilkStart, bitirisGeriliyor: r.bitirisGeriliyor, bitirisIyilesiyor: r.bitirisIyilesiyor,
  }));
  const onVeriDenetimi = veriDenetimi(onKontrol);
  if (!onVeriDenetimi.yeterli) {
    return NextResponse.json({
      error:
        "Bu koşu için veri yetersiz, otomatik analiz üretilemedi (Claude'a hiç istek atılmadı, ücret harcanmadı):\n" +
        onVeriDenetimi.eksikler.join("\n") +
        "\n\nBu genelde AGF/HP verisinin henüz yayınlanmadığı durumlarda olur (AGF genelde koşu günü sabahı yayınlanır). Veri yayınlandıktan sonra tekrar deneyin.",
    }, { status: 422 });
  }

  const methodology = await db.methodologyVersion.findFirst({ where: { isCurrent: true } });
  const methodologyText = methodology?.content ?? "";

  const faz1Tablo = faz1.runners
    .map((r) => {
      const kiloStr = r.weightChange != null ? `${r.weightChange >= 0 ? "+" : ""}${r.weightChange}kg` : "—";
      return [
        `#${r.no} ${r.ad}`,
        `  Kilo:${r.weight ?? "—"}(${kiloStr}) Jokey:${r.jockey ?? "—"}(%${r.jockeyWinPct ?? "?"}) Antrenör:${r.trainer ?? "—"}(%${r.trainerWinPct ?? "?"})`,
        `  Pedigri: ${r.sire ?? "—"} — ${r.dam ?? "—"} (${r.damSire ?? "—"}) ${r.pedigreeNote ?? ""}`.trim(),
        `  Aygır İtibarı: baba=${r.sireTier ? `${r.sireTier.tier}${r.sireTier.note ? ` (${r.sireTier.note})` : ""}` : "kayıt yok"} · anne babası=${r.damSireTier ? `${r.damSireTier.tier}${r.damSireTier.note ? ` (${r.damSireTier.note})` : ""}` : "kayıt yok"}`,
        ...(r.adminNote ? [`  Admin Notu (elle girildi, güvenilir kanıt kabul et): ${r.adminNote}`] : []),
        `  HP bugün:${r.hpBugun}${r.hpBugunResmiYok ? " (resmi HP yok — Şartlı1/Maiden/henüz atanmamış, 0 varsayıldı, olumsuz kanıt DEĞİL)" : ""} önceki:${r.ilkStart ? "İLK START" : `${r.hpOnceki}${r.hpOncekiResmiYok ? " (resmi yok, 0 varsayıldı)" : ""}`} ivme:${r.hpIvmesi ?? "?"}`,
        `  AGF:%${r.agf ?? "?"} sıra:${r.agfSirasi ?? "?"} | Form dizisi:${r.recentForm ?? "—"} (geriliyor=${r.bitirisGeriliyor} iyileşiyor=${r.bitirisIyilesiyor} son sonuç zayıf=${r.sonSonucZayif})`,
        `  Tempo örneklem n:${r.tempoVeriN ?? "?"} stil:${r.raceStyleEtiket ?? "?"} kaçak:${r.kacak}`,
        `  Sınıf: ${r.sinifOnceki ?? "?"} (SKK ${r.sinifSkkOnceki ?? "?"}) -> bugün ${faz1.race.classType} (SKK ${r.sinifSkkBugun ?? "?"}) düşüş=${r.sinifDususu}`,
        `  Takı: ${r.equipment ?? "—"} (eklenen:${r.equipmentAdded ?? "—"} çıkarılan:${r.equipmentRemoved ?? "—"})`,
        `  Galop: ${r.galopOzet} | kondisyon zinciri var=${r.kondisyonZinciriVar} keskin=${r.keskinGalopZinciri}`,
        `  Son800 benzer koşu n=${r.son800BenzerKosuN} medyan fark=${r.son800Medyan ?? "—"}`,
      ].join("\n");
    })
    .join("\n\n");

  // ── FAZ 2 — CLAUDE: koşu tipine göre A/B+C skorlama + ön teknik sıra ──
  const faz2Prompt = `Sen ROTAGANYAN v4.1 at yarışı analistisin. FAZ 2 — SKORLAMA aşamasındasın (henüz final sıralama/kupon yazma, sadece puanla).

## KOŞU
${faz1.race.hippodromeName} — ${faz1.race.raceNo}. Koşu | ${faz1.race.classType} | ${faz1.race.breed} | ${faz1.race.distance}m ${faz1.race.surface} | ${faz1.runners.length} at

## ATLAR (FAZ 1 — otomatik toplanmış ham veri, sitenin kendi TJK kaynağından)
${faz1Tablo}

## METODOLOJİ
${methodologyText}

## GÖREVİN
1. Koşu tipini belirle (Ansiklopedi Bölüm IV) ve o tipin A/B+C ağırlık matrisini uygula.
2. Her at için A (0-60) ve B+C (0-40, Son800 bonusu HARİÇ — o ayrıca koddan eklenecek) puanı ver.
3. Toplam puana göre ön teknik sıra belirle (1 = en iyi). Bu sıra FAZ 3'te geçit motoruna girdi olacak.
4. "Kanıt yokluğu olumsuz kanıt değildir" ilkesine uy — eksik veriyi ceza sebebi yapma.

Yanıtı YALNIZCA geçerli JSON olarak ver, başka metin ekleme:
{
  "atlar": [
    { "no": 0, "ad": "...", "aPuani": 0, "bcPuani": 0, "teknikSira": 1, "notlar": "kısa iç not" }
  ]
}`;

  const faz2Msg = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 6000,
    // Sonnet 5'te "thinking" alanı hiç verilmezse model varsayılan olarak sessizce
    // "adaptive thinking" (görünmeyen iç muhakeme) çalıştırıyor ve bu da max_tokens'ten
    // pay alıyor — kalabalık sahalarda görünür JSON çıktısına yer kalmayıp yanıt yarıda
    // kesiliyordu. Bu iş (skorlama matrisini uygulamak) derin serbest muhakeme
    // gerektirmiyor; kapatmak hem kesilmeyi önlüyor hem de ücreti düşürüyor.
    thinking: { type: "disabled" },
    output_config: { format: { type: "json_schema", schema: FAZ2_SCHEMA } },
    messages: [{ role: "user", content: faz2Prompt }],
  });
  await logClaudeUsage({
    raceId, phase: "faz2", model: "claude-sonnet-5",
    inputTokens: faz2Msg.usage.input_tokens, outputTokens: faz2Msg.usage.output_tokens,
  });
  const faz2Raw = faz2Msg.content[0].type === "text" ? faz2Msg.content[0].text.trim() : "";
  let faz2: Faz2Atlar;
  try {
    faz2 = JSON.parse(faz2Raw);
  } catch {
    const sebep = faz2Msg.stop_reason === "max_tokens"
      ? " (yanıt token sınırına takılıp yarıda kesildi — bu genelde çok kalabalık sahalarda olur, tekrar deneyin)"
      : "";
    return NextResponse.json({ error: `Faz 2 (skorlama) yanıtı parse edilemedi${sebep}`, raw: faz2Raw }, { status: 500 });
  }

  // ── FAZ 3 — GEÇİT MOTORU: KOD İLE ÇALIŞIR, LLM DEĞİL ──
  const teknikSiraByNo = new Map(faz2.atlar.map((a) => [a.no, a.teknikSira]));
  const bcPuaniByNo = new Map(faz2.atlar.map((a) => [a.no, a.bcPuani]));

  const kacakSayisi = faz1.runners.filter((r) => r.kacak).length;
  const atGirdileri: AtGirdisi[] = faz1.runners.map((r) => ({
    ad: r.ad,
    teknikSira: teknikSiraByNo.get(r.no) ?? null,
    agfSirasi: r.agfSirasi,
    bc: bcPuaniByNo.get(r.no) ?? 0,
    hpBugun: r.hpBugun,
    hpOnceki: r.hpOnceki,
    ilkStart: r.ilkStart,
    bitirisGeriliyor: r.bitirisGeriliyor,
    bitirisIyilesiyor: r.bitirisIyilesiyor,
    tempoVeriN: r.tempoVeriN,
    kacak: r.kacak,
    atomicForce: {
      kiloAvantaji: r.kiloAvantaji,
      takiUygun: r.takiDegisikligiVar,
      startTempoUygun: r.tempoVeriN != null && r.tempoVeriN >= 5 && !!r.raceStyleEtiket,
      exactVeyaPedigri: r.exactVeyaPedigri,
      kondisyonZinciri: r.kondisyonZinciriVar,
      sinifJokeyAntrenor: r.sinifJokeyAntrenor,
    },
    sinifDususu: r.sinifDususu,
    hpAlanIciUst: r.hpAlanIciUst,
    sonSonucZayif: r.sonSonucZayif,
    keskinGalopZinciri: r.keskinGalopZinciri,
    son800Farki: r.son800Medyan,
    son800BenzerKosuN: r.son800BenzerKosuN,
    son800Medyan: r.son800Medyan,
  }));

  const gecitSonuc = degerlendir({
    kosu: { ad: `${faz1.race.hippodromeName} ${faz1.race.raceNo}.Koşu`, kuponDerinligi: 6, sahadakiKacakSayisi: kacakSayisi },
    atlar: atGirdileri,
  });
  const gecitMetin = metin(gecitSonuc, `${faz1.race.hippodromeName} ${faz1.race.raceNo}.Koşu`);

  // Veri yetersizse sessizce devam ETME — admin'e açıkça bildir (metodolojinin
  // "motor aç karnına çalışmaz" ilkesi). Not: tempoVeriN bu kontrolden hariç tutulur
  // (bkz. gecit-motoru.ts veriDenetimi yorumu) — yapısal bir sınır, HP/AGF gibi değil.
  if (gecitSonuc.durum === "VERI_YETERSIZ") {
    return NextResponse.json({
      error:
        "Bu koşu için veri yetersiz, otomatik analiz üretilemedi:\n" +
        gecitSonuc.veriDenetimi.eksikler.join("\n") +
        "\n\nBu genelde atların TJK geçmişine erişilemediği ya da AGF/HP verisinin henüz yayınlanmadığı durumlarda olur. Biraz sonra tekrar deneyin ya da Markdown Giriş / Ekran Görüntüsü ile devam edin.",
    }, { status: 422 });
  }

  // ── FAZ 4 — CLAUDE: geçit çıktısını işleyip final sıralama + kupon + yazım ──
  const faz4Prompt = `Sen ROTAGANYAN v4.1 at yarışı analistisin. FAZ 4 — SIRALAMA ve KUPON aşamasındasın.

## FAZ 2 SKORLARIN
${faz2.atlar.map((a) => `#${a.no} ${a.ad}: A=${a.aPuani} B+C=${a.bcPuani} (ön teknik sıra ${a.teknikSira})`).join("\n")}

## FAZ 3 — GEÇİT MOTORU ÇIKTISI (koddan gerçekten üretildi, sinyaller DEĞİŞTİRİLEMEZ)
\`\`\`
${gecitMetin}
\`\`\`

## METODOLOJİ (çözüm rejimi ve çıktı formatı için — dosyanın "Çözüm Rejimi" ve "Çıktı JSON Şeması" bölümlerine bak)
${methodologyText}

## GÖREVİN
1. Geçit motoru çıktısındaki her tetiklenen atı işle: "Çözüm Rejimi" tablosuna göre TAŞI (varsayılan zorunlu eylem) ya da — yalnız gerçekten güçlü, somut exact-dışı bir olumsuz kanıt FAZ 1 verisinde açıkça varsa — yerinde bırak ve nedenini yaz.
2. AGF_AYRIŞMA yalnız gerçek taşımayla çözülür, gerekçeyle ASLA.
3. Bu otomatik pipeline'da admin'in elle çözüm girmesi mümkün değildir — bu yüzden varsayılan davranış her zaman "taşı"dır.
4. FAZ 2 puanlarına ve geçit sonuçlarına göre FİNAL sıralamayı belirle (en iyi 3-5 at, rank 1'den başlayarak).
5. Banko şartlarını kontrol et (dördü birden: puan≥75, rakibe fark≥5, Veri Güveni A, somut risk yok — Handikap/Grup'ta ekstra dikkatli ol, aşırı piyasa konsensüsü varsa banko yapma).
6. Ekonomik/Normal/Geniş kupon önerisi üret — sahadaki atları üç gruba böl (kupon numaraları at numarasıdır):
   - Ekonomik: final sıralamandaki en iyi 3 at.
   - Normal: sıralamada onları izleyen 3 at (Ekonomik'te olmayan farklı 3 at).
   - Geniş: sahada kalan TÜM diğer atlar (Ekonomik ve Normal'de olmayanların hepsi — koşulmayan/çekilen atlar hariç).
   Alanları "X-Y-Z" formatında, at numaralarıyla doldur. Saha 6 attan azsa Normal'i mevcut atlarla doldur, Geniş boş kalabilir.
7. Her pick için "note" alanına, yarışseverin okuyacağı bir YAZI yaz — teknik rapor değil, MAKALE tadında:
   - Yayına hazır, akıcı bir dille anlat: atın adını (BÜYÜK HARF, örn. GÜLALP KIZI) doğal biçimde cümle içinde geçir.
   - Kendi kanaatini yansıt: "çok beğeniyorum", "inanıyorum", "ihtimali yüksek" gibi kişisel/yorumlayıcı bir ton kullan — kuru istatistik listesi DEĞİL.
   - Yarışın nasıl geçebileceğini SENARYOLAŞTIR: rakip atların (varsa) bilinen eğilimlerinden bahset (örn. "son metrelerde durma ihtimali", "ekürisinin varlığından rehavete kapılıp sprint'e geç girme ihtimali", "temposunu bir anda yükseltip mücadeleye girme" gibi), bu diğer atların FAZ 1 verisinden (form yönü, HP ivmesi, tempo/kaçak durumu, sınıf geçişi vb.) çıkarılmalı — uydurma değil.
   - "A puanı", "B+C", "Atomic Force", "geçit skoru", "SKK", "HP ivmesi" gibi TEKNİK TERİMLER asla geçmesin — bunların ardındaki GERÇEK ANLAMI günlük dille anlat (örn. "HP ivmesi +12" yerine "resmi puanı son formunun gerisinde kalmış, aslında koştuğundan daha güçlü").
   - En az 3-4 cümle, gerekirse daha uzun — kısa/telegrafik değil, bir spor yazarının yazacağı gibi.
   - Uygunsa net bir tavsiyeyle bitir: "ekonomik kuponlarda banko olarak öneriyorum", "geniş kupona yazılabilir" gibi.
   - Örnek ton (uzunluk ve üslup referansı, kelimesi kelimesine kopyalama):
     "İkinci koşuda mücadele edecek olan GÜLALP KIZI'nın İstanbul çim pist performansını çok beğeniyorum. Son koşusunda da temposunu bir anda yükselterek birincilik mücadelesinin içerisine girmiş ve son anda mağlup kalarak ikinci olmuştu. Bugün YEŞİLKAYA'nın son metrelerde durma ihtimali yüksek olduğu gibi, SEMRAKAYA'nın da ekürisinin varlığından rehavete kapılarak sprintine geçikme ihtimali yüksek. Bu durumdan da en fazla istifade edebilecek isim GÜLALP KIZI olduğu için kazanmaya çok yakın olduğuna inanıyorum ve ekonomik kuponlar için banko olarak öneriyorum."

Yanıtı YALNIZCA geçerli JSON olarak ver, başka metin ekleme:
{
  "picks": [
    { "rank": 1, "no": 0, "name": "...", "score": 0, "pedigreeRating": "BILINMIYOR", "isTarget": false, "details": [], "note": "Yukarıdaki örnek uzunlukta/üslupta, makale tadında gerekçe yazısı" }
  ],
  "confidence": "ORTA",
  "isBanko": false,
  "bankoNote": "",
  "notes": "Genel koşu değerlendirmesi + geçit motorunun uyarılarının sade özeti",
  "tempo": "Tempo beklentisi (sade dil)",
  "couponNarrow": "1-3-7",
  "couponNormal": "9-11-14",
  "couponWide": "2-4-5-6-8-10"
}
pedigreeRating değerleri: COK_YUKSEK, YUKSEK, GUCLU, ORTA, DUSUK, ZAYIF, SORU, BILINMIYOR
details örnekleri: AGF1, Galop K1, Kilo düştü, Sicil, Sınıf düşüşü, Jokey devam, HP İvmesi +12, Son800 güçlü kapanış`;

  const faz4Msg = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8000,
    thinking: { type: "disabled" },
    output_config: { format: { type: "json_schema", schema: FAZ4_SCHEMA } },
    messages: [{ role: "user", content: faz4Prompt }],
  });
  await logClaudeUsage({
    raceId, phase: "faz4", model: "claude-sonnet-5",
    inputTokens: faz4Msg.usage.input_tokens, outputTokens: faz4Msg.usage.output_tokens,
  });
  const faz4Raw = faz4Msg.content[0].type === "text" ? faz4Msg.content[0].text.trim() : "";
  let result: unknown;
  try {
    result = JSON.parse(faz4Raw);
  } catch {
    const sebep = faz4Msg.stop_reason === "max_tokens"
      ? " (yanıt token sınırına takılıp yarıda kesildi — makale tadındaki gerekçe yazıları uzun sürebilir, tekrar deneyin)"
      : "";
    return NextResponse.json({ error: `Faz 4 (sıralama) yanıtı parse edilemedi${sebep}`, raw: faz4Raw }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    result,
    runners: faz1.runners.map((r) => ({ id: r.id, no: r.no, name: r.ad })),
    debug: { faz1VeriDoluluk: faz1.veriDoluluk, gecitDurum: gecitSonuc.durum, gecitUyari: gecitSonuc.uyari },
  });
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[oto-analiz]", e);
    return NextResponse.json({ error: "Beklenmeyen hata: " + String(e) }, { status: 500 });
  }
}
