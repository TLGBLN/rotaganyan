import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { degerlendir, metin, type AtGirdisi } from "@/lib/methodology/gecit-motoru";
import type { Faz1Sonuc } from "@/lib/methodology/veri-toplama";
import {
  createWithTruncationRetry, extractText,
  FAZ4_RANK_SCHEMA, FAZ_SHARED_SCHEMA, type Faz2Atlar, type Faz4DecisionPick, type Faz4RankResult,
} from "@/lib/methodology/claude-analiz-helpers";

const METODOLOJI_V2 = process.env.METODOLOJI_V2 === "1";
import { getRecentCachedResult } from "@/lib/claude-cost";
import type { Anthropic } from "@anthropic-ai/sdk";
import type { Role } from "@prisma/client";

// bkz. /api/admin/oto-analiz-faz2 route'undaki not — bu ikisi eskiden tek bir istekte
// çalışıyordu, toplam süreleri bazı koşularda 300s'i aşıp fonksiyonu ortadan kesiyordu.
// v4.1: Faz 4'ün KENDİSİ de (sıralama/kupon KARARI + her pick için gerekçe birlikte)
// bazı kalabalık/karmaşık koşularda tek başına 300s'i aşmaya başladı — gerekçe metinleri
// ayrı bir çağrıya taşındı. 2026-07-24: İstanbul 7.Koşu (13 atlı Handikap) gösterdi ki
// KARAR çağrısının KENDİSİ de (geçit triyajı + tüm sahayı sıralama + banko/kupon/tempo
// prose birlikte) tek başına 300s'i aşabiliyor — bu yüzden bu route artık YALNIZ
// SIRALAMA KARARINI üretir (FAZ4_RANK_SCHEMA: rank/skor/pedigree/detay). Banko/kupon/
// tempo/genel-yorum + gerekçe metinleri, karar zaten belliyken çalışan ayrı ve daha dar
// bir çağrıda üretiliyor (/api/admin/oto-analiz-faz4-final — bkz. claude-analiz-
// helpers.ts'teki FAZ4_RANK_SCHEMA/FAZ4_FINAL_SCHEMA yorumu). 2026-07-24: Fluid Compute
// açıldıktan sonra 300s'lik eski platform tavanı da kalktı — bkz. oto-analiz-faz2/
// route.ts'teki not. Bölme (split) yine de korunuyor çünkü thinking süresini gerçekten
// azaltıyor (daha hızlı sonuç, daha az kesinti riski) — 800s bir güvenlik ağı, ilk tercih değil.
export const maxDuration = 300;

type Body = { raceId: string; faz1: Faz1Sonuc; faz2: Faz2Atlar; sharedContext: string };

async function handlePost(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { raceId, faz1, faz2, sharedContext } = (await req.json()) as Body;
  if (!raceId || !faz1 || !faz2 || !sharedContext) {
    return NextResponse.json({ error: "raceId/faz1/faz2/sharedContext gerekli" }, { status: 400 });
  }

  // sharedContext, /oto-analiz-faz2'de üretilip cache_control ile işaretlenmişti — burada
  // BİREBİR AYNI metni tekrar göndermek Anthropic'in ~%90 indirimli "cache read"
  // fiyatından okumasını sağlıyor, analiz kalitesini etkilemiyor. 1 saatlik TTL
  // (Faz2'deki ile eşleşmeli) — bkz. o dosyadaki not: 5dk'lık varsayılan pencere
  // gerçek ölçümde çoğunlukla dolmuş çıkıyordu. NOT: Anthropic'in cache'i hiyerarşik
  // hash'leniyor (tools/output_config.format → system → messages) — output_config.format
  // farklıysa ondan SONRAKİ her şey (metodoloji+veri birebir aynı olsa bile) geçersiz
  // sayılıyor. 2026-07-25: METODOLOJI_V2=1 iken Faz2/Faz4/Faz4-final ÜÇÜ DE aynı
  // (FAZ_SHARED_SCHEMA, tek paylaşılan sabit) şemayı kullanıyor VE metin hiç
  // kısaltılmıyor — yani üçü de birebir aynı prefix'i paylaşıyor. Faz2 cache'i yazar,
  // Faz4/Faz4-final ucuza okur (gerçek loglarda doğrulandı — bkz. proje notu).
  const effectiveSharedContext = sharedContext;
  const sharedContextBlock: Anthropic.TextBlockParam = {
    type: "text",
    text: effectiveSharedContext,
    cache_control: { type: "ephemeral", ttl: "1h" },
  };

  // ── FAZ 3 — GEÇİT MOTORU: KOD İLE ÇALIŞIR, LLM DEĞİL ──
  const teknikSiraByNo = new Map(faz2.atlar.map((a) => [a.no, a.teknikSira]));
  const puanByNo = new Map(faz2.atlar.map((a) => [a.no, a.puan]));

  const kacakSayisi = faz1.runners.filter((r) => r.kacak).length;
  const atGirdileri: AtGirdisi[] = faz1.runners.map((r) => ({
    ad: r.ad,
    teknikSira: teknikSiraByNo.get(r.no) ?? null,
    agfSirasi: r.agfSirasi,
    puan: puanByNo.get(r.no) ?? 0,
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
  const faz4Tail = `Sen ROTAGANYAN v5.0 at yarışı analistisin. FAZ 4 — SIRALAMA ve KUPON aşamasındasın. Yukarıdaki KOŞU/ATLAR/METODOLOJİ bağlamını kullan (metodolojinin "Çözüm Rejimi" ve "Çıktı JSON Şeması" bölümlerine özellikle bak).

## FAZ 2 SKORLARIN (v5.0 — tek puan, A/B+C ayrımı yok)
${faz2.atlar.map((a) => `#${a.no} ${a.ad}: Puan=${a.puan} (ön teknik sıra ${a.teknikSira})`).join("\n")}

## FAZ 3 — GEÇİT MOTORU ÇIKTISI (koddan gerçekten üretildi, sinyaller DEĞİŞTİRİLEMEZ)
\`\`\`
${gecitMetin}
\`\`\`

## GÖREVİN
1. Geçit motoru çıktısındaki her tetiklenen atı işle: "Çözüm Rejimi" tablosuna göre TAŞI (varsayılan zorunlu eylem) ya da — yalnız gerçekten güçlü, somut exact-dışı bir olumsuz kanıt FAZ 1 verisinde açıkça varsa — yerinde bırak ve nedenini yaz.
2. AGF_AYRIŞMA yalnız gerçek taşımayla çözülür, gerekçeyle ASLA.
3. Bu otomatik pipeline'da admin'in elle çözüm girmesi mümkün değildir — bu yüzden varsayılan davranış her zaman "taşı"dır.
4. FAZ 2 puanlarına ve geçit sonuçlarına göre FİNAL sıralamayı belirle — **en iyi 8 at için** (saha 8'den küçükse sahadaki TÜM atlar için) tek tek "picks" girdisi üret, rank 1'den başlayarak. ZORUNLU TUTARLILIK: "score" alanı rank sırasıyla ÇELİŞMEMELİ — rank 1'in score'u rank 2'ninkinden düşük OLAMAZ. Bir at geçit tetiklemesiyle öne taşındıysa (ham FAZ 2 puanı daha düşük olsa bile), score alanını bu yeni konumu yansıtacak şekilde YUKARI güncelle (örn. gecitSkoru bonusunu ekle) — gösterilen puan ile sıralama asla çelişmemeli, yarışseverin "neden düşük puanlı at daha üstte" diye sorması YASAK.
4b. ZORUNLU: Sahadaki EN YÜKSEK AGF'ye sahip at (piyasa favorisi) "picks" listesine HER ZAMAN dahil edilmeli — sıralaması ne olursa olsun (en iyi 8'e girmese bile açıkça ekle, gerekirse 9. pick olarak). Bu atı gerçekten düşük sıraya koyuyorsan bunu bilerek yap ve "details" alanında somut nedenini kısaca belirt (örn. "AGF yüksek ama HP yok/form zayıf/veri yetersiz") — piyasanın güçlü desteklediği bir atın hiç değerlendirilmeden (details boş, mekanik puanla) listeye düşmesi YASAK.
5. "details" alanına yalnızca kısa iç etiketler yaz (örn. "AGF1", "Galop K1", "Sınıf düşüşü") — admin önizlemesinde ayrı rozet olarak gösterilir, kullanıcıya gitmez.

Not: Bu adımda ne kullanıcıya giden "Kilit Gerekçe" gerekçe metnini, ne de banko/kupon/tempo/genel-yorum kararını YAZMA — bunlar, sıralama KARARIN belli olduktan sonra ayrı ve daha dar bir çağrıda üretiliyor (bkz. /oto-analiz-faz4-final). Burada yalnız SIRALAMA KARARINI ver.

Yanıtı YALNIZCA geçerli JSON olarak ver, başka metin ekleme:
{
  "picks": [
    { "rank": 1, "no": 0, "name": "...", "score": 0, "pedigreeRating": "BILINMIYOR", "isTarget": false, "details": [] }
  ]
}
pedigreeRating değerleri: COK_YUKSEK, YUKSEK, GUCLU, ORTA, DUSUK, ZAYIF, SORU, BILINMIYOR
details örnekleri: AGF1, Galop K1, Kilo düştü, Sicil, Sınıf düşüşü, Jokey devam, HP İvmesi +12, Son800 güçlü kapanış`;

  // "Boşa ödeme" koruması — bkz. oto-analiz-faz2/route.ts'teki aynı desen.
  const cachedFaz4 = await getRecentCachedResult(raceId, "faz4");
  let faz4Raw: string;
  let faz4StopReasonMaxTokens = false;
  if (cachedFaz4) {
    faz4Raw = cachedFaz4;
  } else {
    const faz4Msg = await createWithTruncationRetry(
      {
        model: "claude-sonnet-5",
        // Adaptive thinking AÇIK (bkz. Faz 2'deki not) — GEÇİCİ DENEY 2 sonrası tekrar açıldı.
        thinking: { type: "adaptive" },
        // v4.1: "note" (Kilit Gerekçe düzyazısı) artık bu çağrıda üretilmiyor (bkz.
        // FAZ4_DECISION_SCHEMA yorumu) — çıktı metni küçüldü. AMA thinking süresi çıktı
        // şemasının küçülmesiyle ORANTILI küçülmüyor, koşunun karmaşıklığına göre
        // değişiyor (kalabalık saha + çok geçit-tetiklenen at = daha çok "düşünme").
        // 2026-07-24'te canlıda İKİ KEZ kanıtlandı: önce 16000'e düşürülünce (İstanbul
        // 5.Koşu, 9 at) tavanın TAMAMI görünmeyen düşünmeyle tükeniyordu; 24000'e
        // çıkarılınca bu sefer 13 atlı bir Handikap (İstanbul 7.Koşu) yine aynı şekilde
        // kesildi — gerçek geçmiş veride (ClaudeUsageLog) bazı zor koşularda çıktı
        // 26000+ token'a çıkmış. Tavan, geçmişteki gerçek maksimumun üstüne, split-
        // öncesi (32000/40000) orijinal güvenli değere geri çıkarıldı.
        max_tokens: 32000,
        output_config: { format: { type: "json_schema", schema: METODOLOJI_V2 ? FAZ_SHARED_SCHEMA : FAZ4_RANK_SCHEMA } },
        messages: [{ role: "user", content: [sharedContextBlock, { type: "text", text: faz4Tail }] }],
      },
      raceId, "faz4", 40000
    );
    faz4Raw = extractText(faz4Msg);
    faz4StopReasonMaxTokens = faz4Msg.stop_reason === "max_tokens";
  }
  let result: Faz4RankResult;
  try {
    result = JSON.parse(faz4Raw);
  } catch {
    const sebep = faz4StopReasonMaxTokens
      ? " (yanıt otomatik yüksek limitli tekrar denemede de token sınırına takıldı, tekrar deneyin)"
      : "";
    return NextResponse.json({ error: `Faz 4 (sıralama) yanıtı parse edilemedi${sebep}`, raw: faz4Raw }, { status: 500 });
  }

  // ── gecitSonuc.uyari, Faz 4 çalışmadan ÖNCEKİ ham durumu anlatıyordu (örn. "GEÇİT ALARMI
  // ... ANALİZ TAMAMLANMADI") — Faz 4 bu atları gerçekten öne taşıyıp sorunu çözmüş olsa
  // bile ekranda hep aynı (yanıltıcı) uyarı gösteriliyordu. Burada Faz 4'ün KENDİ ürettiği
  // pick listesini (aşağıdaki tam-saha tamamlamasından ÖNCE, yani gerçekten Claude'un
  // seçtiği atlar) kontrol edip, alarmlı atlar gerçekten çözülmüşse net bir mesaja çeviriyoruz.
  const faz4OnlyNos = new Set(result.picks.map((p) => p.no));
  const cozulmemisAlarmlar = gecitSonuc.alarmlar
    .map((a) => faz1.runners.find((r) => r.ad === a.at))
    .filter((r): r is (typeof faz1.runners)[number] => !!r && !faz4OnlyNos.has(r.no));

  let gecitUyariGuncel = gecitSonuc.uyari;
  if (gecitSonuc.durum === "ALARM") {
    // Çözüldüyse (Faz 4 gerçekten öne taşıdıysa) admin'e sarı "dikkat" kutusunda korkutucu
    // bir mesaj göstermeye gerek yok — sessizce null, sanki hiç alarm olmamış gibi (ki artık
    // çözülmüş durumda). Yalnız GERÇEKTEN hâlâ çözülmemişse net isimlerle uyarı gösterilir.
    gecitUyariGuncel = cozulmemisAlarmlar.length === 0
      ? null
      : `GEÇİT ALARMI ÇÖZÜLEMEDİ: ${cozulmemisAlarmlar.map((r) => r.ad).join(", ")} geçit tetikliyor ama Faz 4 hâlâ kupon dışında bıraktı — kontrol edilmeli.`;
  }

  // Faz 4 yalnız en iyi 3-6 atı sıralıyor. Kalan atlar için YENİ bir AI çağrısı yapmadan —
  // Faz 2'nin (ücreti zaten ödenmiş) her at için hesapladığı puanı kullanarak devamı
  // tamamla, böylece admin ve public sayfa TÜM sahayı sıralı/puanlı görür, ek maliyet sıfır.
  const pickedNos = new Set(result.picks.map((p) => p.no));
  const enDusukPuan = result.picks.length > 0 ? Math.min(...result.picks.map((p) => p.score)) : 100;
  const kalanlar = faz1.runners
    .filter((r) => !pickedNos.has(r.no))
    .map((r) => {
      const a = faz2.atlar.find((x) => x.no === r.no);
      const hamPuan = a ? Math.round(a.puan) : 0;
      // ZORUNLU TUTARLILIK: Faz 4'ün taşıdığı atların skoru rank sırasını hiç bozmamalı —
      // kalan atların ham Faz 2 puanı en düşük "pick"i geçemez.
      return { no: r.no, name: r.ad, score: Math.min(hamPuan, enDusukPuan) };
    })
    .sort((a, b) => b.score - a.score);

  // İstemci, gerekçe metnini yalnız Claude'un GERÇEKTEN sıraladığı bu kadar pick için
  // isteyecek (bkz. AIAnalysisPanel.tsx) — mekanik olarak eklenen kalanlar için değil.
  const claudePickCount = result.picks.length;

  let sonrakiRank = result.picks.length > 0 ? Math.max(...result.picks.map((p) => p.rank)) + 1 : 1;
  const ekPicks: Faz4DecisionPick[] = kalanlar.map((r) => ({
    rank: sonrakiRank++, no: r.no, name: r.name, score: r.score,
    pedigreeRating: "BILINMIYOR", isTarget: false, details: [],
  }));
  result.picks = [...result.picks, ...ekPicks];

  // Gerekçe metni, banko/kupon/tempo/genel-yorum bu fazda üretilmiyor artık (bkz.
  // yukarıdaki not) — istemci, kararı gösterdikten sonra /oto-analiz-faz4-final'i
  // ayrıca çağırıp bunları TÜM (Claude-kararlı + mekanik tamamlanan) "picks" listesiyle
  // birlikte üretiyor.
  return NextResponse.json({
    ok: true,
    result,
    claudePickCount,
    runners: faz1.runners.map((r) => ({ id: r.id, no: r.no, name: r.ad })),
    debug: { faz1VeriDoluluk: faz1.veriDoluluk, gecitDurum: gecitSonuc.durum, gecitUyari: gecitUyariGuncel },
  });
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[oto-analiz-faz4]", e);
    return NextResponse.json({ error: "Beklenmeyen hata: " + String(e) }, { status: 500 });
  }
}
