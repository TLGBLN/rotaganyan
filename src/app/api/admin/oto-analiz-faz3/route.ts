import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Faz1Sonuc } from "@/lib/methodology/veri-toplama";
import {
  createWithTruncationRetry, extractText,
  FAZ3_SCHEMA, type Faz2Atlar, type Faz3Pick, type Faz3Result,
} from "@/lib/methodology/claude-analiz-helpers";
import { getRecentCachedResult } from "@/lib/claude-cost";
import type { Anthropic } from "@anthropic-ai/sdk";
import type { PedigreeRating, Role } from "@prisma/client";

// v6.0: eski Faz4 (sıralama kararı, geçit motoru triyajı dahil) + Faz4-final (banko/
// kupon/tempo/gerekçe) TEK bu çağrıda birleşti, geçit motoru tamamen kaldırıldı.
// KRİTİK: NİHAİ SIRALAMA Claude'un muhakemesinin ürünüdür — Faz 2'nin puanı yalnız bir
// BAŞLANGIÇ NOKTASI, kod bunu asla mekanik olarak yeniden sıralamaz (kullanıcı talimatı:
// "Faz2 puanlama, Faz3 muhakeme'nin işi son nihai sıralamayı belirlemek" — Claude'un işi
// en önemli iş, bu çağrı motorun "son kontrol"ü). Kod yalnız (a) Claude'un ürettiği
// sıraya göre kupon dilimlemesini (Ekonomik/Normal/Geniş) ve (b) mekanik banko eşiğini
// (puan≥80+fark≥5+risk-yok) uygular — sıranın kendisine dokunmaz.
export const maxDuration = 300;

type Body = { raceId: string; faz1: Faz1Sonuc; faz2: Faz2Atlar; sharedContext: string };

export type FinalPick = {
  rank: number; no: number; name: string; score: number;
  pedigreeRating: PedigreeRating; isTarget: boolean; details: string[]; note: string;
};

/**
 * v6.3 — kullanıcı talimatı: "güçlü ve gerçekten çalışan bir kontrol mekanizması
 * kurulmalı ama yayın öncesi değil son sıralama oluşturulmadan önce... sonrasında
 * düzeltilmek üzere bana not olarak ver sadece. analiz gerçekleşsin. ama gerçek bir
 * kontrol olsun, gerçek bir eksikliği göstersin." Yani: analizi ASLA durdurmaz/
 * engellemez, yalnız Faz3'ün KENDİ kurallarını (§XVI AGF asimetri, §X/§XI Son800+
 * galop, §XX.27 HP-tek-başına, §XIX.0a Hedef) gerçekten uygulayıp uygulamadığını
 * HAM VERİYE bakarak (metin taraması değil) kontrol eder — sahte pozitif üretmemesi
 * için yalnız somut, ölçülebilir eşiklerle çalışır.
 */
function kontrolNotlariUret(faz1: Faz1Sonuc, faz2: Faz2Atlar, tumSira: Faz3Pick[]): string[] {
  const notlar: string[] = [];
  const runnerByNo = new Map(faz1.runners.map((r) => [r.no, r]));
  const rankByNo = new Map(tumSira.map((p) => [p.no, p.rank]));
  const sahaBuyuklugu = faz1.runners.length;

  // A) ★ Hedef kuralı (§XIX.0a): ilk 3'ün hemen altına getirilmesi gerekiyordu.
  for (const p of tumSira) {
    if (!p.isTarget) continue;
    if (p.rank > 5) {
      notlar.push(`★ Hedef işaretlenen #${p.no} ${p.name}, ilk 3'ün hemen altına getirilmemiş (şu an ${p.rank}. sıra) — §XIX.0a kuralı tam uygulanmamış olabilir.`);
    }
  }

  // B) AGF favorisi (%25+) gerekçesiz/detaysız mı kalmış.
  const agfSirali = [...faz1.runners].filter((r) => r.agf != null).sort((a, b) => b.agf! - a.agf!);
  const agfFavori = agfSirali[0];
  if (agfFavori && agfFavori.agf! >= 25) {
    const pick = tumSira.find((p) => p.no === agfFavori.no);
    if (!pick || pick.details.length === 0) {
      notlar.push(`AGF favorisi #${agfFavori.no} ${agfFavori.ad} (%${agfFavori.agf}) için hiç detay/gerekçe üretilmemiş — gerçekten değerlendirildiğinden emin olun.`);
    }
  }

  // C) Son800 (n≥3, medyan≤-0.5) + keskin galop zinciri birlikte varken alt yarıda mı.
  for (const r of faz1.runners) {
    const guclu800 = r.son800BenzerKosuN >= 3 && r.son800Medyan != null && r.son800Medyan <= -0.5;
    if (!guclu800 || !r.keskinGalopZinciri) continue;
    const rank = rankByNo.get(r.no);
    if (rank != null && rank > Math.ceil(sahaBuyuklugu / 2)) {
      notlar.push(`#${r.no} ${r.ad}: güçlü Son800 (n=${r.son800BenzerKosuN}, medyan ${r.son800Medyan}) + keskin galop zinciri birlikte var ama ${rank}. sırada (saha ${sahaBuyuklugu}) — §X/§XI/§XX.28 destekleyici kombinasyonu göz ardı edilmiş olabilir.`);
    }
  }

  // D) Faz2'de teknik ilk 3'teyken Faz3'te belirgin düşürülmüş + AGF düşük — asimetri ihlali şüphesi.
  const teknikSiraByNo = new Map(faz2.atlar.map((a) => [a.no, a.teknikSira]));
  for (const p of tumSira) {
    const teknikSira = teknikSiraByNo.get(p.no);
    const r = runnerByNo.get(p.no);
    if (teknikSira != null && teknikSira <= 3 && p.rank > teknikSira + 2 && r && (r.agf ?? 100) < 10) {
      notlar.push(`#${p.no} ${p.name}: Faz2'de teknik ${teknikSira}. sıradaydı, Faz3'te ${p.rank}. sıraya düşürülmüş; AGF'si düşük (%${r.agf ?? "?"}) — düşük AGF'nin geriye çekme gerekçesi OLMADIĞINDAN emin olun (§XVI asimetrik kural, §XX.26).`);
    }
  }

  // E) En yüksek ham HP'ye sahip at 1. sıradaysa ve neredeyse hiç başka gerekçesi yoksa.
  const enYuksekHp = [...faz1.runners].filter((r) => r.hpBugun != null).sort((a, b) => b.hpBugun! - a.hpBugun!)[0];
  if (enYuksekHp) {
    const rank1 = tumSira.find((p) => p.rank === 1);
    if (rank1 && rank1.no === enYuksekHp.no && rank1.details.length <= 1) {
      notlar.push(`#${rank1.no} ${rank1.name} en yüksek ham HP'ye (${enYuksekHp.hpBugun}) sahip olduğu için 1. sıraya konmuş görünüyor (yalnız ${rank1.details.length} detay var) — form/tempo uyumunun da gerçekten değerlendirildiğinden emin olun (§XX.27).`);
    }
  }

  return notlar;
}

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
  // BİREBİR AYNI metni tekrar göndermek Anthropic'in ~%90 indirimli "cache read" fiyatından
  // okumasını sağlıyor. NOT: Anthropic'in cache'i hiyerarşik hash'leniyor (tools/
  // output_config.format → system → messages) — Faz2 (FAZ2_SCHEMA) ile Faz3 (FAZ3_SCHEMA)
  // farklı şema kullandığı için aralarında cache PAYLAŞILAMAZ (bu, daha önce iki farklı
  // fazı aynı şemaya zorlayıp "Grammar compilation timed out" hatası almış, geri alınmış
  // bir denemenin sonucu — bilinçli bir sınır, eksiklik değil). Eski Faz4/Faz4-final'in
  // birbiriyle paylaştığı FAZ_SHARED_SCHEMA mekanizması de bu yüzden artık gereksiz:
  // o iki çağrı zaten TEK çağrıda birleşti, paylaşacak ikinci bir çağrı kalmadı.
  const sharedContextBlock: Anthropic.TextBlockParam = {
    type: "text",
    text: sharedContext,
    cache_control: { type: "ephemeral", ttl: "1h" },
  };

  const sahaBuyuklugu = faz1.runners.length;
  const enIyiN = Math.min(8, sahaBuyuklugu);

  const faz3Tail = `Sen ROTAGANYAN v6.5 at yarışı analistisin. FAZ 3 — MUHAKEME ve NİHAİ SIRALAMA aşamasındasın (motorun "son kontrol"ü — bu senin işin, en önemli iş). Yukarıdaki KOŞU/ATLAR/METODOLOJİ bağlamını kullan (özellikle §II.4 Kural Denetim Protokolü, §XVIII Tek Puan Sistemi, §XIX Kilit Gerekçe standardı, §VII.0 Kalabalık Saha kuralı).

## FAZ 2 PUANLARIN (yalnız BAŞLANGIÇ NOKTASI — nihai sıralamayı SEN belirleyeceksin)
${faz2.atlar.map((a) => `#${a.no} ${a.ad}: Puan=${a.puan} (ön teknik sıra ${a.teknikSira})`).join("\n")}

## GÖREVİN
1. KURAL DENETİM PROTOKOLÜ (§II.4, SON KONTROL — motorun en önemli adımı burası): Faz 2'nin her puanını geri kontrol et — bir atı düşüren şey somut/gerçek bir çelişki mi (Çapraz Doğrulama Katsayısı §XVIII.3'e göre haklı), yoksa yalnız örneklem küçüklüğü/veri eksikliği/farklı bağlam mı (§II.1 — bu yalnız notu etkilemeli, puanı İKİNCİ KEZ düşürmemeli)? Özellikle şu iki noktayı özenle kontrol et (v6.1 canlı yarış geri bildirimiyle eklendi):
   a) AGF ASİMETRİSİ (§XVI/§XX.26): bir at yalnızca DÜŞÜK AGF'si yüzünden geride mi bırakılmış? Düşük AGF asla tek başına bir atı geriye çekme gerekçesi değildir (yalnız piyasa ilgisizliği) — teknik açıdan güçlü bir at düşük AGF'ye rağmen üst sıraya çıkarılmalı.
   b) SON800+GALOP KOMBİNASYONU (§X/§XI/§XX.28): yeterli örneklemli güçlü Son800 (n≥3, medyan≤-0.5s) İLE keskin/iyi galop zinciri birlikte olan bir at, bu güçlü destekleyici çift göz ardı edilerek geride mi bırakılmış? Varsa yukarı taşı.
   c) HP TEK BAŞINA ÜSTÜNLÜK DEĞİLDİR (§XX.27): yalnız yüksek ham HP'ye dayanarak, formu zayıf/gerilemiş ya da tempo-stili bugüne uymayan bir at otomatik olarak en üste mi konmuş? Değilse düzelt.
   d) YENİ OLUMLU KOMBİNASYONLAR (v6.4, kullanıcı talimatı — dördü de yalnız OLUMLU yönde işler, hiçbiri tek başına bir atı cezalandırma gerekçesi değildir): (i) yağışlı/ıslak hava + KAÇAK AT stili → olumlu (§IX.6); (ii) kalabalık sahada (10+ at) kaçak stiller dezavantajlı, az atlı sahada (≤6 at) sprinter/kapanışa güvenen atlar avantajlı → olumlu (§IX.5); (iii) Şartlı 1/27 gibi giriş seviyeli koşularda TAKISIZ taylar takılı olanlara göre → KESİNLİKLE olumlu (§XIII.1); (iv) 30+ gün ([UZUN ARA] etiketli) aradan dönen atta galop/kondisyon vasat olsa bile jokeyin kazanma yüzdesi yüksekse → olumlu (§XX.29). Bu dört durumdan biri sahada varken göz ardı edilmiş bir at olup olmadığını kontrol et, varsa yukarı taşı.
   e) AYGIR/KISRAK AYRI DEĞERLENDİRME (§XII.1, v6.5, canlı yarış geri bildirimiyle eklendi): "pedigri zayıf" diye tek bir hükme indirgenip, aslında Aygır İstatistiği'nin (K/K≥%15 veya AEI>1 gibi) kendi eşiğini geçen olumlu bir sinyali Kısrak tarafının zayıflığı yüzünden gölgelenmiş bir at var mı? (Ya da tersi — kısrak güçlü, aygır zayıfken pedigri toptan "zayıf" denmiş olabilir.) Varsa "details"/gerekçede iki tarafı AYRI AYRI belirt, puanı buna göre düzelt.
   Gerekirse puanı/sırayı düzelt.
2. Bu düzeltilmiş puanları ve tüm ATLAR verisini (galop, form, tempo/stil, sınıf, kilo, AGF, pedigri) birlikte değerlendirerek NİHAİ SIRALAMAYI SEN belirle — mekanik puan sırasını kopyalamak ZORUNDA değilsin, ama §XVIII.2 "puan sırası ile nihai sıralama çelişemez" ilkesine uy: bir atı puanından farklı konuma taşıyorsan "score" alanını bu yeni konumu yansıtacak şekilde güncelle (rank1'in score'u rank2'ninkinden düşük OLAMAZ) ve nedenini "details"e kısaca yaz.
3. Kalabalık sahada (10+ at, §VII.0) tempo/stil/pozisyon önceliğini sıralamana açıkça yansıt.
4. En iyi ${enIyiN} at için${sahaBuyuklugu > enIyiN ? "" : " (saha küçük, TÜM saha için)"} "picks" dizisine rank 1'den başlayarak gir.
5. Her pick için "pedigreeRating"/"isTarget"/"details" üret (§IX: uydurma bilgi yasak — yalnız KOŞU/ATLAR verisinde verilen ham pedigri/aygır-kısrak istatistiğiyle sınırlı kal). details: kısa iç etiketler (örn. "AGF1", "Galop K1", "Sınıf düşüşü") — admin rozeti, kullanıcıya gitmez.
5b. ★ HEDEF (isTarget) KURALI (v6.2, kullanıcı talimatı): isTarget=true işaretlediğin bir at yalnız pasif bir rozet almaz — sıralamada İLK 3'ÜN HEMEN ALTINA (4. sıra civarına) getirilir ve "score"u 3. sıradaki atınkine YAKIN/EŞİT verilir (rank1-3'ün score'undan düşük olmalı, madde 2'deki tutarlılık kuralına uy). Yani Hedef ataması sıralamayı GERÇEKTEN etkiler — yalnız "ilginç ama etkisiz" bir not değildir. Bunu yalnız gerçekten güçlü bir sürpriz/değer sinyali olduğuna inandığın at(lar) için kullan, gelişigüzel dağıtma (en fazla 1-2 at).
6. Kendi sıraladığın picks listesinin İLK 6'sı için "gerekceler" dizisine bir "note" yaz — §XIX.2: EN FAZLA 2 CÜMLE, sade dil, iç terim (puan/katsayı/katman) GEÇMEZ, doğrudan kullanıcıya (public "Kilit Gerekçe") gidiyor.
7. "confidence" (DUSUK/ORTA/YUKSEK): sıralamanın netliğine (1.-2. arası fark, çelişkili sinyal sayısı) göre.
8. "bankoNote": banko kararının KENDİSİNİ kod ayrıca mekanik olarak hesaplayacak (puan≥80+fark≥5+piyasa riski yok) — sen yalnız 1.-2. arası farkı ve genel netliği 1-2 cümleyle sade dilde yorumla.
9. "notes": genel koşu değerlendirmesi, sade özet. "tempo": tempo beklentisi (sade dil).

Yanıtı YALNIZCA geçerli JSON olarak ver, başka metin ekleme:
{
  "picks": [
    { "rank": 1, "no": 0, "name": "...", "score": 0, "pedigreeRating": "BILINMIYOR", "isTarget": false, "details": [] }
  ],
  "gerekceler": [ { "no": 0, "note": "en fazla 2 cümlelik gerekçe" } ],
  "confidence": "ORTA",
  "bankoNote": "",
  "notes": "Genel koşu değerlendirmesi",
  "tempo": "Tempo beklentisi (sade dil)"
}
pedigreeRating değerleri: COK_YUKSEK, YUKSEK, GUCLU, ORTA, DUSUK, ZAYIF, SORU, BILINMIYOR`;

  // "Boşa ödeme" koruması — bkz. oto-analiz-faz2/route.ts'teki aynı desen.
  const cachedFaz3 = await getRecentCachedResult(raceId, "faz3");
  let faz3Raw: string;
  let faz3StopReasonMaxTokens = false;
  if (cachedFaz3) {
    faz3Raw = cachedFaz3;
  } else {
    const faz3Msg = await createWithTruncationRetry(
      {
        model: "claude-sonnet-5",
        thinking: { type: "adaptive" },
        // Eski Faz4'ün kanıtlanmış güvenli tavanı (bkz. o dosyadaki not: canlıda iki kez
        // 16000/24000 yetersiz çıkmıştı, 32000/40000'e çıkarılınca sorun kalmadı). Bu
        // çağrı artık gerekçe/banko-yorumu/notes/tempo'yu da içeriyor (eskiden ayrı
        // Faz4-final'de üretiliyordu) — tavanı düşürmek yeni bir kesinti riski doğurur.
        max_tokens: 32000,
        output_config: { format: { type: "json_schema", schema: FAZ3_SCHEMA } },
        messages: [{ role: "user", content: [sharedContextBlock, { type: "text", text: faz3Tail }] }],
      },
      raceId, "faz3", 40000
    );
    faz3Raw = extractText(faz3Msg);
    faz3StopReasonMaxTokens = faz3Msg.stop_reason === "max_tokens";
  }
  let result: Faz3Result;
  try {
    result = JSON.parse(faz3Raw);
  } catch {
    const sebep = faz3StopReasonMaxTokens
      ? " (yanıt otomatik yüksek limitli tekrar denemede de token sınırına takıldı, tekrar deneyin)"
      : "";
    return NextResponse.json({ error: `Faz 3 (muhakeme) yanıtı parse edilemedi${sebep}`, raw: faz3Raw }, { status: 500 });
  }

  // Claude yalnız en iyi ~8 atı sıralıyor. Kalan atlar için YENİ bir AI çağrısı yapmadan —
  // Faz 2'nin (ücreti zaten ödenmiş) her at için hesapladığı ham puanı kullanarak devamı
  // tamamla, böylece admin ve public sayfa TÜM sahayı sıralı/puanlı görür, ek maliyet sıfır.
  const puanByNo = new Map(faz2.atlar.map((a) => [a.no, a.puan]));
  const pickedNos = new Set(result.picks.map((p) => p.no));
  const enDusukPuan = result.picks.length > 0 ? Math.min(...result.picks.map((p) => p.score)) : 100;
  const kalanlar = faz1.runners
    .filter((r) => !pickedNos.has(r.no))
    .map((r) => {
      const hamPuan = Math.round(puanByNo.get(r.no) ?? 0);
      // ZORUNLU TUTARLILIK: Claude'un sıraladığı atların skoru rank sırasını hiç bozmamalı —
      // kalan atların ham Faz 2 puanı en düşük "pick"i geçemez.
      return { no: r.no, name: r.ad, score: Math.min(hamPuan, enDusukPuan) };
    })
    .sort((a, b) => b.score - a.score);

  let sonrakiRank = result.picks.length > 0 ? Math.max(...result.picks.map((p) => p.rank)) + 1 : 1;
  const ekPicks: Faz3Pick[] = kalanlar.map((r) => ({
    rank: sonrakiRank++, no: r.no, name: r.name, score: r.score,
    pedigreeRating: "BILINMIYOR", isTarget: false, details: [],
  }));
  const tumSira = [...result.picks, ...ekPicks].sort((a, b) => a.rank - b.rank);

  const noteByNo = new Map(result.gerekceler.map((g) => [g.no, g.note]));
  const picks: FinalPick[] = tumSira.map((p) => ({
    rank: p.rank, no: p.no, name: p.name, score: p.score,
    pedigreeRating: p.pedigreeRating as PedigreeRating, isTarget: p.isTarget, details: p.details,
    note: noteByNo.get(p.no) ?? "",
  }));

  // Kupon dilimlemesi — Claude'un ÜRETTİĞİ sıraya göre KOD mekanik uyguluyor (§XVIII.4/
  // önceki tur kararı: Ekonomik=ilk3, Normal=4-6, Geniş=7+). Sıranın kendisi değişmiyor.
  const couponNarrow = tumSira.slice(0, 3).map((p) => p.no).join("-");
  const couponNormal = tumSira.slice(3, 6).map((p) => p.no).join("-");
  const couponWide = tumSira.slice(6).map((p) => p.no).join("-");

  // Banko — mekanik eşik (puan≥80 + fark≥5 + risk yok), Claude'un ÜRETTİĞİ nihai sıradaki
  // 1.-2.ye göre. Risk = piyasanın (AGF) 1. DIŞINDA bir atı %50'nin üzerinde desteklemesi.
  // Canlı veride "ganyan" alanı yalnız yarış SONRASI Result modelinde var, Runner'da yok —
  // bu yüzden risk kontrolü yalnız AGF'ye dayanıyor.
  const agfByNo = new Map(faz1.runners.map((r) => [r.no, r.agf]));
  const top1 = tumSira[0];
  const top2 = tumSira[1];
  const piyasaRiski = tumSira.slice(1).some((p) => (agfByNo.get(p.no) ?? 0) > 50);
  const isBanko = !!top1 && top1.score >= 80 && (top1.score - (top2?.score ?? 0)) >= 5 && !piyasaRiski;

  // Analizi ASLA durdurmaz/engellemez — yalnız admin'e sonradan düzeltilmek üzere
  // gösterilecek, veriye dayalı gerçek kontrol notları (bkz. kontrolNotlariUret yorumu).
  const kontrolNotlari = kontrolNotlariUret(faz1, faz2, tumSira);

  return NextResponse.json({
    ok: true,
    picks,
    confidence: result.confidence,
    isBanko,
    bankoNote: result.bankoNote,
    notes: result.notes,
    tempo: result.tempo,
    couponNarrow, couponNormal, couponWide,
    runners: faz1.runners.map((r) => ({ id: r.id, no: r.no, name: r.ad })),
    debug: { faz1VeriDoluluk: faz1.veriDoluluk },
    kontrolNotlari,
  });
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[oto-analiz-faz3]", e);
    return NextResponse.json({ error: "Beklenmeyen hata: " + String(e) }, { status: 500 });
  }
}
