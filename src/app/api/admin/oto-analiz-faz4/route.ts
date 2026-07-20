import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { degerlendir, metin, type AtGirdisi } from "@/lib/methodology/gecit-motoru";
import type { Faz1Sonuc } from "@/lib/methodology/veri-toplama";
import {
  createWithTruncationRetry, extractText,
  FAZ4_SCHEMA, type Faz2Atlar, type Faz4Pick, type Faz4Result,
} from "@/lib/methodology/claude-analiz-helpers";
import type { Anthropic } from "@anthropic-ai/sdk";
import type { Role } from "@prisma/client";

// bkz. /api/admin/oto-analiz-faz2 route'undaki not — bu ikisi eskiden tek bir istekte
// çalışıyordu, toplam süreleri bazı koşularda 300s'i aşıp fonksiyonu ortadan kesiyordu.
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
  // BİREBİR AYNI metni tekrar göndermek (5dk'lık ephemeral pencere içindeyse) Anthropic'in
  // ~%90 indirimli "cache read" fiyatından okumasını sağlıyor, analiz kalitesini etkilemiyor.
  const sharedContextBlock: Anthropic.TextBlockParam = {
    type: "text",
    text: sharedContext,
    cache_control: { type: "ephemeral" },
  };

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
  const faz4Tail = `Sen ROTAGANYAN v4.1 at yarışı analistisin. FAZ 4 — SIRALAMA ve KUPON aşamasındasın. Yukarıdaki KOŞU/ATLAR/METODOLOJİ bağlamını kullan (metodolojinin "Çözüm Rejimi" ve "Çıktı JSON Şeması" bölümlerine özellikle bak).

## FAZ 2 SKORLARIN
${faz2.atlar.map((a) => `#${a.no} ${a.ad}: A=${a.aPuani} B+C=${a.bcPuani} (ön teknik sıra ${a.teknikSira})`).join("\n")}

## FAZ 3 — GEÇİT MOTORU ÇIKTISI (koddan gerçekten üretildi, sinyaller DEĞİŞTİRİLEMEZ)
\`\`\`
${gecitMetin}
\`\`\`

## GÖREVİN
1. Geçit motoru çıktısındaki her tetiklenen atı işle: "Çözüm Rejimi" tablosuna göre TAŞI (varsayılan zorunlu eylem) ya da — yalnız gerçekten güçlü, somut exact-dışı bir olumsuz kanıt FAZ 1 verisinde açıkça varsa — yerinde bırak ve nedenini yaz.
2. AGF_AYRIŞMA yalnız gerçek taşımayla çözülür, gerekçeyle ASLA.
3. Bu otomatik pipeline'da admin'in elle çözüm girmesi mümkün değildir — bu yüzden varsayılan davranış her zaman "taşı"dır.
4. FAZ 2 puanlarına ve geçit sonuçlarına göre FİNAL sıralamayı belirle (en iyi 3-5 at, rank 1'den başlayarak). ZORUNLU TUTARLILIK: "score" alanı rank sırasıyla ÇELİŞMEMELİ — rank 1'in score'u rank 2'ninkinden düşük OLAMAZ. Bir at geçit tetiklemesiyle öne taşındıysa (ham FAZ 2 puanı daha düşük olsa bile), score alanını bu yeni konumu yansıtacak şekilde YUKARI güncelle (örn. gecitSkoru bonusunu ekle) — gösterilen puan ile sıralama asla çelişmemeli, yarışseverin "neden düşük puanlı at daha üstte" diye sorması YASAK.
5. Banko şartlarını kontrol et (dördü birden: puan≥75, rakibe fark≥5, Veri Güveni A, somut risk yok — Handikap/Grup'ta ekstra dikkatli ol, aşırı piyasa konsensüsü varsa banko yapma).
6. Ekonomik/Normal/Geniş kupon önerisi üret — sahadaki atları üç gruba böl (kupon numaraları at numarasıdır):
   - Ekonomik: final sıralamandaki en iyi 3 at.
   - Normal: sıralamada onları izleyen 3 at (Ekonomik'te olmayan farklı 3 at).
   - Geniş: sahada kalan TÜM diğer atlar (Ekonomik ve Normal'de olmayanların hepsi — koşulmayan/çekilen atlar hariç).
   Alanları "X-Y-Z" formatında, at numaralarıyla doldur. Saha 6 attan azsa Normal'i mevcut atlarla doldur, Geniş boş kalabilir.
7. "details" alanına yalnızca kısa iç etiketler yaz (örn. "AGF1", "Galop K1", "Sınıf düşüşü") — uzun yazı YAZMA, makale/gerekçe metni İSTENMİYOR.

Yanıtı YALNIZCA geçerli JSON olarak ver, başka metin ekleme:
{
  "picks": [
    { "rank": 1, "no": 0, "name": "...", "score": 0, "pedigreeRating": "BILINMIYOR", "isTarget": false, "details": [] }
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

  const faz4Msg = await createWithTruncationRetry(
    {
      model: "claude-sonnet-5",
      // Adaptive thinking AÇIK (bkz. Faz 2'deki not) — kullanıcı deneyip kaliteyi
      // maliyete tercih etti.
      thinking: { type: "adaptive" },
      max_tokens: 24000,
      output_config: { format: { type: "json_schema", schema: FAZ4_SCHEMA } },
      messages: [{ role: "user", content: [sharedContextBlock, { type: "text", text: faz4Tail }] }],
    },
    raceId, "faz4", 32000
  );
  const faz4Raw = extractText(faz4Msg);
  let result: Faz4Result;
  try {
    result = JSON.parse(faz4Raw);
  } catch {
    const sebep = faz4Msg.stop_reason === "max_tokens"
      ? " (yanıt otomatik yüksek limitli tekrar denemede de token sınırına takıldı — makale tadındaki gerekçe yazıları uzun sürebilir, tekrar deneyin)"
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
  // Faz 2'nin (ücreti zaten ödenmiş) her at için hesapladığı A+B+C puanını kullanarak devamı
  // tamamla, böylece admin ve public sayfa TÜM sahayı sıralı/puanlı görür, ek maliyet sıfır.
  const pickedNos = new Set(result.picks.map((p) => p.no));
  const enDusukPuan = result.picks.length > 0 ? Math.min(...result.picks.map((p) => p.score)) : 100;
  const kalanlar = faz1.runners
    .filter((r) => !pickedNos.has(r.no))
    .map((r) => {
      const a = faz2.atlar.find((x) => x.no === r.no);
      const hamPuan = a ? Math.round(a.aPuani + a.bcPuani) : 0;
      // ZORUNLU TUTARLILIK: Faz 4'ün taşıdığı atların skoru rank sırasını hiç bozmamalı —
      // kalan atların ham Faz 2 puanı en düşük "pick"i geçemez.
      return { no: r.no, name: r.ad, score: Math.min(hamPuan, enDusukPuan) };
    })
    .sort((a, b) => b.score - a.score);

  let sonrakiRank = result.picks.length > 0 ? Math.max(...result.picks.map((p) => p.rank)) + 1 : 1;
  const ekPicks: Faz4Pick[] = kalanlar.map((r) => ({
    rank: sonrakiRank++, no: r.no, name: r.name, score: r.score,
    pedigreeRating: "BILINMIYOR", isTarget: false, details: [],
  }));
  result.picks = [...result.picks, ...ekPicks];

  return NextResponse.json({
    ok: true,
    result,
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
