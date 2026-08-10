import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { gatherFaz1 } from "@/lib/methodology/veri-toplama";
import type { Anthropic } from "@anthropic-ai/sdk";
import { createWithTruncationRetry, extractText } from "@/lib/methodology/claude-analiz-helpers";
import { getRecentCachedResult } from "@/lib/claude-cost";
import type { Role } from "@prisma/client";
import { kategoriTespit, KATEGORI_KODLARI, KATEGORI_ADI, V_LEGEND, atSatirlariUret, hamVeriOzetiUret, kosuBaslikUret, faz1VeriKapsami, faz2MuhakemeDenetle, faz2KaliteDenetimi, faz2BankoAdayiTespit, faz2SiralamaTutarlilikDenetimi, faz2SinifGecisEtiketiEkle, faz2KiloKarsilastirmaEtiketiEkle, faz2HpIvmeEtiketiEkle, faz2KullanilmayanVeriTespiti, faz2StilPopulasyonEtiketiEkle, faz2AyniJokeyEtiketiEkle, faz2PedigriKarsilastirmaEtiketiEkle, faz2Top3Garantisi, faz2SonYarisKazandiEtiketiEkle, faz2KararSiraTutarsizlikDenetimi, faz2KararHiyerarsisiUygula, faz2H2HEtiketiEkle, faz2ZeminKazanmaEtiketiEkle, faz2AgfTrend456Garantisi, faz2GucluKombinasyonTop3Garantisi, faz2AgfFavorisiDususeRagmenGarantisi } from "@/lib/methodology/v2-engine";

// v6.53 — kullanıcı bulgusu 2026-08-04 (Kocaeli 5.Koşu): tüm sahayı TEK bir Claude
// çağrısında analiz etmek, zengin kategorilerde (3/4/5) + 8+ atlı sahalarda GERÇEKTEN
// 800sn'yi aşabiliyor — bu bir platform hatası DEĞİL, "her şeyi tek seferde" mimarisinin
// doğal sınırı (eski sistem bunu Faz2+Faz3 diye İKİYE bölerek önlüyordu). Kullanıcı Faz3'ü
// TAM OLARAK bu yüzden kaldırmıştı ("2 kere fiyat çekmeden yapman gerek").
//
// v6.54 — kullanıcı bulgusu 2026-08-04 (2. tur, farklı koşu): v6.53 grupları sunucu
// İÇİNDE tek bir istek boyunca sırayla döngüledi — loglar TÜM grupların+sıralamanın
// başarıyla bittiğini kanıtladı ("toplam parsed atlar sayısı: 9") ama tarayıcı YİNE
// "Failed to fetch" gördü. Yani mesele artık tek bir Claude çağrısının süresi değil —
// TEK BİR HTTP isteğinin dakikalarca (birden fazla Claude çağrısı boyunca) hiç veri
// akışı olmadan açık kalması: kullanıcının kendi tarayıcısı/ağı hiç kopmasa bile,
// aradaki herhangi bir ağ katmanı (edge/proxy/NAT) böyle "sessiz" bağlantıları kapatma
// hakkını saklı tutar. Eski sistem bunu hiç yaşamaz çünkü Faz1/Faz2/Faz3 tarayıcıdan 3
// AYRI fetch() ile çağrılır — hiçbiri diğerini beklerken "açık" kalmaz. Çözüm: bu rota
// artık grup grup DEĞİL, TEK bir grup/sıralama işleyip dönüyor; hangi adımı çalıştıracağı
// `step`+`batchIndex` ile tarayıcıdan (V2AnalysisPanel.tsx) yönetiliyor — tıpkı eski
// sistemin 3 ayrı adımı gibi. Hiçbir tek istek artık bir Claude çağrısından uzun sürmez.
// v6.90 — kullanıcı talimatı 2026-08-10 ("her şeyi en son sınırına çek"): 800, bu
// Vercel planında doğrulanmış (test-v3-engine'de zaten kullanılıyor) üst sınır — 30f3169
// revertinde 300'e geri düşmüştü (62fa1dd kaybolmuştu), yeniden 800'e çekildi.
export const maxDuration = 800;

// v6.93 — kullanıcı talimatı 2026-08-10 ("1.2 dolar kabul edilemez, 30-50 cente çek"):
// 4'ten 6'ya çıkarıldı — artık placeholder-muhakeme tespiti (eksik-at döngüsüne dahil)
// ve boş-yanıt tespiti (createWithTruncationRetry) olduğu için büyük grupların asıl
// riski (sessizce bozuk veri) artık YAKALANIP otomatik düzeltiliyor, eskisi kadar
// tehlikeli değil. 20 atlık koşu 5 gruptan 4 gruba iniyor (1 çağrı tasarrufu).
const BATCH_SIZE = 6;

export type TestV2Pick = {
  no: number;
  ad: string;
  teknikSira: number;
  karar: string;
  muhakeme: string;
};

export type BatchAt = { no: number; ad: string; karar: string; muhakeme: string };

// v6.68 — kullanıcı bulgusu 2026-08-08 (Ankara 2.Koşu, #3/#4 iki denemede de yanıttan
// düşmüştü): loglardan çıkan ham kanıt, Claude'un HER İKİ denemede de "atlar" dizisini
// TAM OLARAK aynı 2 atla (istenen 4'ün ilk ikisi) "bitirdiğini" gösterdi — rastgele değil,
// sistematik. Önce dizi UZUNLUĞUNU minItems/maxItems ile sabitlemeyi denedik ama
// Anthropic'in yapılandırılmış çıktı API'si "array" için minItems'ı YALNIZ 0/1 destekliyor
// (2+ değer 400 hatası verdi, canlıda TÜM analiz akışını kırdı — hemen geri alındı).
// KÖKTEN ÇÖZÜM: dizi yerine, HER at için "at_{no}" adlı AYRI BİR ZORUNLU ALAN kullanan bir
// obje şeması — "required" (zorunlu alan) standart, evrensel bir JSON Schema özelliği ve
// bu şemada zaten başka yerde (ör. her at objesinin kendi required'ı) kullanılıyor, minItems
// gibi Anthropic-özel bir kısıtlamaya bağımlı değil. Bir alan eksikse yanıtın kendisi şema
// ihlali sayılır — model artık "eksik ama geçerli" bir yanıt ÜRETEMEZ, yapısal olarak kapalı.
function batchSchemaFor(nolar: number[]) {
  const atSchema = {
    type: "object",
    properties: {
      no: { type: "integer" },
      ad: { type: "string" },
      karar: { type: "string", enum: ["Güçlü Aday", "Düşük Risk", "Orta Risk", "Yüksek Risk"] },
      muhakeme: { type: "string" },
    },
    required: ["no", "ad", "karar", "muhakeme"],
    additionalProperties: false,
  } as const;
  const alanAdi = (no: number) => `at_${no}`;
  return {
    type: "object",
    properties: Object.fromEntries(nolar.map((no) => [alanAdi(no), atSchema])),
    required: nolar.map(alanAdi),
    additionalProperties: false,
  } as const;
}

// v6.68 — kullanıcı kararı 2026-08-09 (GOLDEN BEE dersi): "karar" (Güçlü Aday/Düşük
// Risk/Orta Risk/Yüksek Risk) batch aşamasında, kod-garantili etiketler (V1/V4/V19/V22
// vb.) muhakemeye eklenmeden ÖNCE veriliyordu — bu yüzden bir at güçlü, doğrulanmış
// kanıtlara sahip olsa bile "karar" bunu hiç yansıtmayabiliyordu. Artık sıralama çağrısı
// (atların TAM, garanti-etiketli muhakemesini zaten görüyor) HER at için "karar"ı da
// YENİDEN veriyor — eski (batch aşamasındaki) karar tamamen bırakılıyor, yalnız bu YENİ
// karar kullanılıyor. Bu, "karar ne zaman kararlaştırılıyor" sırasındaki asıl yapısal
// açığı kapatıyor (bir formülle DEĞİL, Claude'un TAM bilgiyle yeniden muhakemesiyle).
const SIRALAMA_SCHEMA = {
  type: "object",
  properties: {
    siralama: {
      type: "array",
      items: {
        type: "object",
        properties: {
          no: { type: "integer" },
          teknikSira: { type: "integer" },
          karar: { type: "string", enum: ["Güçlü Aday", "Düşük Risk", "Orta Risk", "Yüksek Risk"] },
        },
        required: ["no", "teknikSira", "karar"],
        additionalProperties: false,
      },
    },
  },
  required: ["siralama"],
  additionalProperties: false,
} as const;

function batchReminder(kategori: string, batchNo: number, toplamBatch: number, nolar: number[]): string {
  return `Şimdi yukarıdaki V-kodu tanımlarını, muhakeme matrisini ve AŞAĞIDAKİ AT GRUBUNU (bu, sahadaki atların yalnız bir kısmı — grup ${batchNo}/${toplamBatch}) kullanarak HER at için "muhakeme" üret. Bu koşu ${kategori} kategorisinde — yalnız KOŞU/AT verisinde GÖRÜNEN V-kodlarını kullan, görünmeyen bir kod hakkında veri uydurma. Bu aşamada teknikSira/karşılaştırmalı sıra İSTEMİYORUM (sahadaki diğer atları henüz görmüyorsun) — yalnız "karar" (Güçlü Aday / Düşük Risk / Orta Risk / Yüksek Risk, bu atın KENDİ verisine göre) ve "muhakeme" üret.

**FORMAT — KOMPAKT ETİKET NOTASYONU:** "muhakeme" alanında TAM CÜMLE DEĞİL, kısa "Etiket:değer(bağlam)" parçaları yaz, "|" ile ayır. Fiil/bağlaç/özne YASAK. Muhakeme Matrisi'nde çapraz sorguladığın HER çift için "[Vx+Vy]:destek" veya "[Vx+Vy]:risk" etiketi ekle (bağlamı parantez içinde 1-3 kelime). Örnek: 'V10:KaçakAt | V18:3(iç) | [V10+V18]:destek(iç kulvar+kaçak avantajlı) | V9:n=4,med-0.6(güçlü) | [V2+V9]:destek(idman+kapanış örtüşüyor) | V13:56(-2kg) | [V13+V10]:risk(ağır kilo erken enerji riski)'.

**ÖNEMLİ OLANI YAZ, DOLDURMA YAPMA:** Yalnız gerçekten anlamlı/karar etkileyici bulduğun V-kodu çiftlerini ve sinyalleri yaz — önemsiz bulduğun her kodu "yok/etkisiz" diye tek tek sıralamak ZORUNLU DEĞİL (v6.66 kullanıcı bulgusu: bu, 15 atlı sahalarda muhakemeyi anlamsız doldurmayla şişirip sıralama çağrısının asıl sinyali (karar: Güçlü Aday vb.) gürültü içinde kaybetmesine yol açtı — TAM TIME/İSPANOZ tarzı gerçekten önemli, geniş örneklemli sinyalleri (n≥5) ASLA atlama, ama sıradan/önemsiz her kodu doldurma amacıyla yazma).

**KRİTİK — HİÇBİR ALANI ATLAMA:** Yanıt şeması bu gruptaki HER at için AYRI, ZORUNLU bir alan içeriyor (${nolar.map((no) => `"at_${no}"`).join(", ")}) — bunlardan biri bile eksik kalırsa yanıt GEÇERSİZ sayılır. Aşağıdaki ${nolar.length} atın HEPSİ için bir alan doldurmalısın, hiçbirini atlama.

Yanıtı YALNIZCA geçerli JSON olarak ver, örnek (alan adları "at_" + o atın numarası):
{ ${nolar.map((no) => `"at_${no}": { "no": ${no}, "ad": "...", "karar": "Güçlü Aday / Düşük Risk / Orta Risk / Yüksek Risk", "muhakeme": "Etiket:değer(bağlam) | [Vx+Vy]:destek(...) | ..." }`).join(", ")} }`;
}

// v6.55 — kullanıcı bulgusu (WOLF SEYFO, Kocaeli 7.Koşu): sıralama çağrısı yalnız
// grupların yazdığı KELİMELERİ görüyordu (ör. iki ata da "ağır kilo" yazılmış olması),
// gerçek sayıları (kaç kg, HP kaç) hiç görmüyordu — bu yüzden iki farklı ağırlıktaki atı
// aynı "ağır kilo" etiketiyle özdeş sanıp tutarsız sıralayabiliyordu. Çözüm: her atın
// Faz1 ham veri satırını (atSatirlariUret — zaten grup çağrısında üretilen, kategoriye
// göre filtrelenmiş aynı metin) muhakemenin YANINA ekliyoruz; V_LEGEND tekrar
// gönderilmiyor (ucuz kalır), ama artık sıralama sözlerin altındaki sayıyı görüp
// kelimeyle sayı çelişirse sayıyı esas alabilir.
function siralamaReminder(atlar: (BatchAt & { hamVeri?: string })[]): string {
  const liste = atlar.map((a) =>
    `#${a.no} ${a.ad} — İLK karar (grup aşamasında, aşağıdaki etiketlerin bir kısmı henüz eklenmeden önce verildi — bkz. KARARI YENİDEN VER talimatı): ${a.karar}\nGrup analiz metni: ${a.muhakeme}${a.hamVeri ? `\nHam veri: ${a.hamVeri}` : ""}`
  ).join("\n\n");
  return `Aşağıda bu koşudaki HER at için ZATEN üretilmiş muhakeme metinleri VE o atın ham Faz1 verisi var — sen yeni bir analiz YAPMIYORSUN, yalnız bunları birbirine göre KARŞILAŞTIRIP nihai teknik sıralamayı (1'den sahadaki at sayısına kadar, hiç atlama/tekrar yok) belirliyorsun. En güçlü kanıta/karara sahip at 1, en zayıf en yüksek sıra numarasını alır.

**KRİTİK — KARARI YENİDEN VER (v6.68, GOLDEN BEE dersi):** Her atın yanındaki "İLK karar" ESKİ ve GÜVENİLMEZ olabilir — o karar, muhakeme metnindeki "(KOD-GARANTİSİ: ...)" ile işaretli etiketler eklenmeden ÖNCE verilmişti. KOD-GARANTİSİ etiketleri Claude'un tahmini DEĞİL, koddan gelen DOĞRULANMIŞ GERÇEKLERDİR (ör. "aygırın sahadaki EN İYİ kazanma yüzdesi", "bugünküyle eşleşen zeminde kazandı", "son yarışını kazandı") — bunları TAM AĞIRLIĞIYLA say. Yanıtındaki "karar" alanı İLK kararı kopyalamak DEĞİL, TÜM muhakemeyi (KOD-GARANTİSİ etiketleri dahil) şimdi bir bütün olarak yeniden değerlendirip vereceğin NİHAİ karardır. Somut kural: bir atın muhakemesinde 2 veya daha fazla KOD-GARANTİSİ:destek etiketi varsa ve ciddi bir KOD-GARANTİSİ:risk/güçlü risk kanıtı yoksa, o at "Orta Risk" veya "Yüksek Risk"te KALAMAZ — en az "Düşük Risk" olmalı. GOLDEN BEE örneği: yalnız "1.3kg ağır" notu varken, iki KOD-GARANTİSİ:destek etiketi (aynı jokey + bugünküyle eşleşen zeminde galibiyet) görmezden gelinip "Yüksek Risk" verilmişti — bu YANLIŞTI, "Düşük Risk" olmalıydı.

ÖNEMLİ — HAM VERİYİ ÇAPA OLARAK KULLAN: Grup analiz metinlerinde "ağır kilo", "düşük HP" gibi benzer sözel etiketler görsen bile, atları birbirine göre kıyaslarken MUTLAKA "Ham veri" satırındaki sayıları kontrol et. Örneğin iki ata da "ağır kilo" yazılmışsa, ham veride kilosu daha hafif olan atın kilo dezavantajını daha küçük bir risk say. Grup metninin tonlaması ile ham verideki sayı bariz çelişiyorsa (ör. sahadaki en hafif ata "ağır kilo" denmişse), sayısal gerçeği esas al, kelimeyi değil.

ÖNEMLİ — SINIF DÜŞÜŞÜ/YÜKSELİŞİ HER ZAMAN DİKKATE ALINIR: Bazı atların muhakeme metninde sonda "[V14]:destek(sınıf düşüşü...)" veya "[V14]:nötr(sınıf yükselişi...)" etiketi bulacaksın — bu KOD TARAFINDAN eklenmiştir, Claude'un kendi tercihi değildir, ASLA yok sayma. Sınıf düşüşü olan bir at (önceki yarışı bugünkünden yüksek sınıftaysa) bu koşuda daha zayıf rakiplerle karşılaşıyor demektir — SKK farkı 1 kademe bile olsa bu gerçek bir avantajdır, sıralamada mutlaka lehine say.

ÖNEMLİ — GENEL TUTARLILIK, YALNIZ İKİLİ KIYASLAR DEĞİL: Yeniden verdiğin "karar" (Güçlü Aday / Orta Risk / Düşük Risk / Yüksek Risk) o atın GENEL profilinin özetidir — sıralamayı yalnız kod-çiftlerini ikili ikili karşılaştırarak değil, bu genel resmi de gözeterek oluştur. Geniş sahalarda (10+ at) atları yalnız birbirine yakın çiftler halinde kıyaslayıp kalanı gözden kaçırma; bitmiş sıralamaya bütün olarak bak — aynı "karar" etiketine sahip atlar birbirine yakın sıralarda kümelenmeli, "Güçlü Aday" bir at hiçbir güçlü gerekçe olmadan çok sayıda "Orta/Yüksek Risk" atın gerisine düşmemeli. Böyle bir çelişki varsa ya gerekçeni gözden geçir ya da sıralamayı düzelt.

## ATLAR (muhakeme + ham veri)
${liste}

Yanıtı YALNIZCA geçerli JSON olarak ver — "karar" alanı ZORUNLU ve YENİDEN DEĞERLENDİRİLMİŞ olmalı:
{ "siralama": [ { "no": 0, "teknikSira": 1, "karar": "Güçlü Aday / Düşük Risk / Orta Risk / Yüksek Risk" } ] }`;
}

// v6.92 — kullanıcı bulgusu 2026-08-10 (Bursa 9.Koşu): TEK sıralama çağrısıyla büyük
// sahalarda (20+ at) adaptive thinking TÜM token bütçesini tüketip hiç cevap üretmeden
// kesilebiliyor (kanıtlı: 166sn, 16000 token, boş sonuç). Çözüm ELEME değil BİRLEŞTİRME
// (merge) — Arnavutkızı dersi: yüzeysel sinyali zayıf ama gerçek kanıtı güçlü bir at,
// kaba bir ön-sıralamayla "zayıf grup"a düşüp bir daha üst gruptaki atlarla hiç
// karşılaştırılmadan kalabilirdi. Bunun yerine saha ARALIKLI (iş paylaşımı amaçlı,
// güçle İLGİSİZ) ikiye bölünüyor, HER GRUP KENDİ İÇİNDE TAM sıralanıyor (küçük çağrı,
// hiçbir at grubundan dışlanmıyor), sonra bu fonksiyon iki ZATEN sıralı listeyi klasik
// "merge" mantığıyla TEK nihai sıralamada birleştiriyor — her at diğer gruptakilerle
// gerçekten karşılaştırılıyor, hiçbiri atlanmıyor.
// v6.94 — kullanıcı kararı 2026-08-10: 12'den 17'ye çıkarıldı (BATCH_SIZE=6 ile 16 ata
// kadar zaten tek ucuz sıralama çağrısı yeterli oluyor, yalnız GERÇEKTEN büyük sahalar
// böl+birleştirin ek maliyetini öder).
const SIRALAMA_BOLME_ESIGI = 17;

function mergeReminder(
  siraliA: (BatchAt & { hamVeri?: string })[],
  siraliB: (BatchAt & { hamVeri?: string })[]
): string {
  const blok = (etiket: string, liste: (BatchAt & { hamVeri?: string })[]) =>
    liste.map((a, i) =>
      `${etiket}${i + 1}. #${a.no} ${a.ad} — Karar: ${a.karar}\nMuhakeme: ${a.muhakeme}${a.hamVeri ? `\nHam veri: ${a.hamVeri}` : ""}`
    ).join("\n\n");
  const toplam = siraliA.length + siraliB.length;
  return `Aşağıda İKİ AYRI liste var — Grup A ve Grup B, HER BİRİ KENDİ İÇİNDE ZATEN ayrıca analiz edilip en güçlüden en zayıfa doğru sıralanmış. Senin işin bu iki listeyi YENİDEN SIRALAMAK DEĞİL — TEK bir nihai sıralamada BİRLEŞTİRMEK (klasik "merge" işlemi): iki listeyi karşılıklı okuyup, hangi attan sonra hangi atın geleceğine, o atların muhakeme+ham veri kanıtlarını gerçekten karşılaştırarak karar veriyorsun.

KESİN KURAL — HER GRUBUN KENDİ İÇİNDEKİ SIRASI ASLA BOZULMAZ: Grup A'da 3. olan at, Grup A'da 2. olan attan ASLA daha yükseğe (daha iyi bir nihai sıraya) çıkamaz — aynı kural Grup B için de geçerli. Yalnızca İKİ GRUP ARASINDA hangi atın diğerinden daha güçlü olduğuna karar veriyorsun — bu, iki sıralı deste kağıdı harmanlamaya benzer.

Grup A (kendi içinde sıralı, 1=en güçlü):
${blok("A", siraliA)}

Grup B (kendi içinde sıralı, 1=en güçlü):
${blok("B", siraliB)}

Yanıtı YALNIZCA geçerli JSON olarak ver — TÜM ${toplam} at dahil olmalı, hiçbiri atlanamaz, "karar" alanı ZORUNLU:
{ "siralama": [ { "no": 0, "teknikSira": 1, "karar": "Güçlü Aday / Düşük Risk / Orta Risk / Yüksek Risk" } ] }`;
}

async function prepareRaceContext(raceId: string) {
  const faz1 = await gatherFaz1(raceId);
  if (!faz1) return null;
  const kategori = kategoriTespit(faz1.race.classType);
  if (kategori === "bilinmiyor") {
    return { faz1, kategori: "bilinmiyor" as const, izinliKodlar: [] as string[], kosuBaslik: "", batches: [] as (typeof faz1.runners)[] };
  }
  const izinliKodlar = KATEGORI_KODLARI[kategori];
  const kosuBaslik = kosuBaslikUret(faz1, izinliKodlar);
  const batches: (typeof faz1.runners)[] = [];
  for (let i = 0; i < faz1.runners.length; i += BATCH_SIZE) batches.push(faz1.runners.slice(i, i + BATCH_SIZE));
  return { faz1, kategori, izinliKodlar, kosuBaslik, batches };
}

async function handleBatch(raceId: string, batchIndex: number) {
  const ctx = await prepareRaceContext(raceId);
  if (!ctx) return NextResponse.json({ error: "Koşu verisi bulunamadı" }, { status: 404 });
  if (ctx.kategori === "bilinmiyor") {
    return NextResponse.json({ error: `Bu koşu tipi henüz hiçbir kategoriye eşleşmiyor: ${ctx.faz1.race.classType}` }, { status: 400 });
  }
  const { kategori, izinliKodlar, kosuBaslik, batches } = ctx;
  if (batchIndex < 0 || batchIndex >= batches.length) {
    return NextResponse.json({ error: "Geçersiz grup index" }, { status: 400 });
  }

  const batch = batches[batchIndex];
  const atlarMetin = batch.map((r) => atSatirlariUret(r, izinliKodlar)).join("\n\n");
  const legendBlock: Anthropic.TextBlockParam = { type: "text", text: V_LEGEND, cache_control: { type: "ephemeral", ttl: "1h" } };
  const usage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

  // v6.53 boşa ödeme koruması: bu grup zaten üretilmişse (ör. önceki denemede
  // tamamlanmış ama bağlantı sonradan kesilmişse) Claude tekrar ÇAĞRILMAZ.
  const grupRaceKey = `${raceId}__g${batchIndex}`;
  async function grubuCagir(onbellegiAtla: boolean): Promise<string> {
    const cachedBatch = onbellegiAtla ? null : await getRecentCachedResult(grupRaceKey, "faz2v2");
    if (cachedBatch) {
      console.log(`[test-v2-engine] grup ${batchIndex + 1}/${batches.length} önbellekten bulundu, atlanıyor.`);
      return cachedBatch;
    }
    console.log(`[test-v2-engine] grup ${batchIndex + 1}/${batches.length} çalışıyor (${batch.length} at), raceId:`, raceId);
    const msg = await createWithTruncationRetry(
      {
        model: "claude-sonnet-5",
        thinking: { type: "adaptive" },
        max_tokens: 64000,
        output_config: { format: { type: "json_schema", schema: batchSchemaFor(batch.map((r) => r.no)) } },
        messages: [{ role: "user", content: [
          legendBlock,
          { type: "text", text: kosuBaslik + "\n\n## ATLAR (bu grup)\n" + atlarMetin },
          { type: "text", text: batchReminder(KATEGORI_ADI[kategori], batchIndex + 1, batches.length, batch.map((r) => r.no)) },
        ] }],
      },
      grupRaceKey, "faz2v2", 64000
    );
    console.log(`[test-v2-engine] grup ${batchIndex + 1}/${batches.length} bitti, usage:`, JSON.stringify(msg.usage), "stop_reason:", msg.stop_reason);
    if (msg.usage) {
      usage.input_tokens = msg.usage.input_tokens ?? 0;
      usage.output_tokens = msg.usage.output_tokens ?? 0;
      usage.cache_creation_input_tokens = msg.usage.cache_creation_input_tokens ?? 0;
      usage.cache_read_input_tokens = msg.usage.cache_read_input_tokens ?? 0;
    }
    return extractText(msg);
  }

  // Şema artık { "at_3": {...}, "at_4": {...} } biçiminde (bkz. batchSchemaFor yorumu) —
  // her anahtarın değerini alıp düz bir diziye çeviriyoruz.
  function parseAtlar(raw: string): BatchAt[] | null {
    try {
      const obj = JSON.parse(raw) as Record<string, BatchAt>;
      return Object.values(obj);
    } catch {
      return null;
    }
  }

  // v6.68 — kullanıcı bulgusu 2026-08-08 (Ankara 2.Koşu: #3 GOLDEN BEE ve #4 TESCİL,
  // piyasanın en çok bahis alan iki atı, "Ön Teknik Sıra"dan TAMAMEN kaybolmuştu):
  // Claude'un şema-kısıtlı JSON çıktısı istenen attan bir/ikisini sessizce atlayabiliyor —
  // hiçbir kontrol bunu yakalamıyordu. Artık istenen HER "no" gelene kadar (en fazla
  // MAX_DENEME kez, önbelleği atlayarak) otomatik tekrar dener; son denemede de eksikse
  // admin'e AÇIK bir hata gösterilir — kullanıcı talimatı: "hiçbir detayı atlamayacak" —
  // hiçbir koşulda sessizce eksik bir liste ile devam edilmez.
  // v6.90 — kullanıcı talimatı 2026-08-10 ("her şeyi en son sınırına çek"): maxDuration
  // 800'e çıkınca 3+ deneme için yeterli pay oluştu, 2'den 3'e çıkarıldı.
  const MAX_DENEME = 3;
  const istenenNolar = batch.map((r) => r.no);
  let raw = "";
  let atlar: BatchAt[] | null = null;
  let eksikNolar: number[] = istenenNolar;
  for (let deneme = 1; deneme <= MAX_DENEME && eksikNolar.length > 0; deneme++) {
    raw = await grubuCagir(deneme > 1);
    const parsedAttempt = parseAtlar(raw);
    if (parsedAttempt === null) {
      if (deneme === MAX_DENEME) {
        return NextResponse.json({ error: `Grup ${batchIndex + 1}/${batches.length} yanıtı ${MAX_DENEME} denemede de parse edilemedi.`, raw }, { status: 500 });
      }
      console.error(`[test-v2-engine] grup ${batchIndex + 1}/${batches.length}: deneme ${deneme} parse edilemedi, tekrar deneniyor.`);
      continue;
    }
    atlar = parsedAttempt;
    // v6.91 — kullanıcı bulgusu 2026-08-10 (Bursa 9.Koşu, "muhakeme":"placeholder" olarak
    // döndü): "ad" alanı için zaten güvenmiyorduk (bkz. aşağıdaki ad:r.ad), ama "muhakeme"
    // alanı için aynı koruma yoktu — büyük gruplarda Claude bazen bu alana da anlamsız
    // "placeholder" metni koyuyor. Böyle bir at, "no" gelmiş olsa bile GERÇEKTEN eksik
    // sayılır — aynı otomatik tekrar deneme döngüsüne (MAX_DENEME) dahil edilir.
    const muhakemeGecerliMi = (m: string) => m.trim().length > 0 && m.trim().toLowerCase() !== "placeholder";
    const gecerliNolar = new Set(atlar.filter((a) => muhakemeGecerliMi(a.muhakeme)).map((a) => a.no));
    eksikNolar = istenenNolar.filter((no) => !gecerliNolar.has(no));
    if (eksikNolar.length > 0 && deneme < MAX_DENEME) {
      console.error(`[test-v2-engine] grup ${batchIndex + 1}/${batches.length}: deneme ${deneme}/${MAX_DENEME}, ${eksikNolar.join(",")} numaralı at(lar) yanıtta yok, tekrar deneniyor.`);
    }
  }
  if (atlar === null || eksikNolar.length > 0) {
    const eksikAdlar = eksikNolar.map((no) => `#${no} ${batch.find((r) => r.no === no)?.ad ?? ""}`).join(", ");
    return NextResponse.json(
      { error: `Grup ${batchIndex + 1}/${batches.length}: ${eksikAdlar} ${MAX_DENEME} denemede de yanıtta yer almadı — analiz eksik kalmasın diye durduruldu, tekrar deneyin.` },
      { status: 500 }
    );
  }

  // v6.56/v6.57 — kullanıcı kararı: sayısal/objektif V-kodları (V13 kilo, V14 sınıf,
  // V20 HP ivmesi) Claude'un kendi seçimine bırakılmıyor, kod GARANTİLİ olarak
  // muhakemeye ekliyor (bkz. v2-engine.ts fonksiyon yorumları). Çok-sinyalli sentez
  // gerektiren V-kodları (V2/V9/V16/V19 vb.) buna dahil değil, Claude'un muhakemesinde
  // kalıyor — [[Sert Koşul Yasak]] ilkesi gereği.
  const runnerByNo = new Map(batch.map((r) => [r.no, r]));
  const agirlıklar = ctx.faz1.runners.map((r) => r.weight).filter((w): w is number => w != null);
  const ortKilo = agirlıklar.length > 0 ? agirlıklar.reduce((a, b) => a + b, 0) / agirlıklar.length : null;
  // v6.63 — ANSHBA SKY dersi: sahadaki EN İYİ (gerçek örneklemli, n≥20) aygır kazanma
  // yüzdesini bir kez hesaplayıp, o değere ulaşan HER ata garantili [V1] etiketi ekliyoruz.
  const gecerliKYuzdeler = ctx.faz1.runners
    .filter((r) => r.sireOrneklemKendiVeri != null && r.sireOrneklemKendiVeri >= 20 && r.sireKazanmaOrani != null)
    .map((r) => r.sireKazanmaOrani as number);
  const sahaEnIyiKYuzde = gecerliKYuzdeler.length > 0 ? Math.max(...gecerliKYuzdeler) : null;
  atlar = atlar.map((a) => {
    const r = runnerByNo.get(a.no);
    if (!r) return a;
    let muhakeme = a.muhakeme;
    if (izinliKodlar.includes("V14")) muhakeme = faz2SinifGecisEtiketiEkle(muhakeme, r);
    if (izinliKodlar.includes("V13")) muhakeme = faz2KiloKarsilastirmaEtiketiEkle(muhakeme, r, ortKilo);
    if (izinliKodlar.includes("V20")) muhakeme = faz2HpIvmeEtiketiEkle(muhakeme, r);
    if (izinliKodlar.includes("V10") && izinliKodlar.includes("V12")) {
      muhakeme = faz2StilPopulasyonEtiketiEkle(muhakeme, r, ctx.faz1.race.pistMesafeStilBreakdown);
    }
    if (izinliKodlar.includes("V4")) muhakeme = faz2AyniJokeyEtiketiEkle(muhakeme, r);
    if (izinliKodlar.includes("V1")) muhakeme = faz2PedigriKarsilastirmaEtiketiEkle(muhakeme, r, sahaEnIyiKYuzde);
    if (izinliKodlar.includes("V19")) muhakeme = faz2SonYarisKazandiEtiketiEkle(muhakeme, r);
    if (izinliKodlar.includes("V5")) muhakeme = faz2H2HEtiketiEkle(muhakeme, r);
    if (izinliKodlar.includes("V22")) muhakeme = faz2ZeminKazanmaEtiketiEkle(muhakeme, r);
    // v6.87 — kullanıcı kararı 2026-08-10 (V_LEGEND_final.md): V3 kod-garantisi (v6.86)
    // tek koşuda (n=10) SHADOW MASTER tarafından çürütüldü (takı çıkarıldı, 8. oldu) VE
    // "çoklu takı değişimi = yüksek belirsizlik" notuyla doğrudan çelişiyordu — iki kural
    // aynı anda doğru olamaz. Statü "aday"a düşürüldü: enjeksiyon KALDIRILDI, V3 yeniden
    // yalnız Claude'un kendi muhakemesine (V_LEGEND'deki "yön fark etmez" rehberliğiyle)
    // bırakıldı. 3-5 sonuçlanmış koşuda tutarlı çıkarsa kod-garantiye geri yükseltilir.
    // v6.82 — kullanıcı bulgusu 2026-08-10 (Bursa 5.Koşu, 15 atlı büyük grup, motor
    // revizyonundan BAĞIMSIZ bir hata): Claude'un JSON yanıtındaki "ad" alanı bazı
    // atlarda gerçek isim yerine "placeholder" dönmüştü — büyük gruplarda model kaynaklı
    // bir hata. İsme HİÇ güvenilmiyor, her zaman kendi kesin verimizden (r.ad) alınıyor.
    return { ...a, ad: r.ad, muhakeme };
  });

  return NextResponse.json({ ok: true, atlar, totalBatches: batches.length, kategori, usage });
}

async function handleRank(raceId: string, allAtlar: BatchAt[]) {
  const ctx = await prepareRaceContext(raceId);
  if (!ctx) return NextResponse.json({ error: "Koşu verisi bulunamadı" }, { status: 404 });
  if (ctx.kategori === "bilinmiyor") {
    return NextResponse.json({ error: `Bu koşu tipi henüz hiçbir kategoriye eşleşmiyor: ${ctx.faz1.race.classType}` }, { status: 400 });
  }
  const { faz1, izinliKodlar } = ctx;
  const usage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

  // v6.55/v6.66 — her atın ham veri ÖZETİNİ (TAM V1-V22 dökümü değil — bkz. v6.66 notu,
  // büyük sahalarda bu tam döküm sıralama çağrısını 37K+ tokena şişirip zaman aşımına
  // yol açmıştı) sıralama promptuna ekliyoruz.
  const runnerByNo = new Map(faz1.runners.map((r) => [r.no, r]));
  const atlarWithRaw = allAtlar.map((a) => {
    const r = runnerByNo.get(a.no);
    return { ...a, hamVeri: r ? hamVeriOzetiUret(r) : undefined };
  });

  type HamAt = BatchAt & { hamVeri?: string };
  type SiraSonuc = { no: number; teknikSira: number; karar?: string };

  // Tek bir sıralama/birleştirme çağrısı — önbellek+otomatik tekrar deneme (ETIMEDOUT,
  // boş yanıt) createWithTruncationRetry üzerinden zaten geliyor. usage'a EKLENİR
  // (toplam), tek çağrıda olduğu gibi ÜZERİNE YAZILMAZ — artık 1-3 çağrı olabiliyor.
  async function siralamaCagir(prompt: string, cacheAnahtari: string, atSayisi: number): Promise<SiraSonuc[]> {
    const cached = await getRecentCachedResult(cacheAnahtari, "faz2v2");
    let raw: string;
    if (cached) {
      console.log(`[test-v2-engine] sıralama (${cacheAnahtari}) önbellekten bulundu, atlanıyor.`);
      raw = cached;
    } else {
      console.log(`[test-v2-engine] sıralama (${cacheAnahtari}) başlıyor, ${atSayisi} at`);
      const msg = await createWithTruncationRetry(
        {
          model: "claude-sonnet-5",
          thinking: { type: "adaptive" },
          max_tokens: 64000,
          output_config: { format: { type: "json_schema", schema: SIRALAMA_SCHEMA } },
          messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        },
        cacheAnahtari, "faz2v2", 64000
      );
      console.log(`[test-v2-engine] sıralama (${cacheAnahtari}) bitti, usage:`, JSON.stringify(msg.usage), "stop_reason:", msg.stop_reason);
      raw = extractText(msg);
      if (msg.usage) {
        usage.input_tokens += msg.usage.input_tokens ?? 0;
        usage.output_tokens += msg.usage.output_tokens ?? 0;
        usage.cache_creation_input_tokens += msg.usage.cache_creation_input_tokens ?? 0;
        usage.cache_read_input_tokens += msg.usage.cache_read_input_tokens ?? 0;
      }
    }
    const { siralama } = JSON.parse(raw) as { siralama: SiraSonuc[] };
    return siralama;
  }

  const sirRaceKey = `${raceId}__sira`;
  let siralamaSonuc: SiraSonuc[];
  try {
    // v6.94 — kullanıcı kararı 2026-08-10: "önce dene, başarısız olursa düş" yöntemi
    // matematiksel olarak YANLIŞTI — başarısızlık durumunda hem başarısız denemenin
    // (~$0.20-0.30, iki iç deneme hakkı) HEM böl+birleştirin tam maliyeti üst üste
    // biniyordu, yani başarısızlıkta doğrudan böl+birleştirmekten DAHA PAHALIYA
    // geliyordu. Ayrıca 20 atlık sahada gözlenen gerçek oran (1 başarılı, 1 başarısız,
    // ~%50) "nadir" denemeyecek kadar yüksek çıktı. Geri dönüldü: eşik VE ÜSTÜ HER ZAMAN
    // öngörülebilir şekilde böl+birleştir kullanır — eşik 12'den 17'ye çıkarıldı
    // (BATCH_SIZE 6'ya çıktığı için 16 ata kadar zaten tek ucuz sıralama çağrısı yeterli).
    if (allAtlar.length < SIRALAMA_BOLME_ESIGI) {
      siralamaSonuc = await siralamaCagir(siralamaReminder(atlarWithRaw), sirRaceKey, allAtlar.length);
    } else {
      const grupA = atlarWithRaw.filter((_, i) => i % 2 === 0);
      const grupB = atlarWithRaw.filter((_, i) => i % 2 === 1);
      const [sonucA, sonucB] = await Promise.all([
        siralamaCagir(siralamaReminder(grupA), `${sirRaceKey}_a`, grupA.length),
        siralamaCagir(siralamaReminder(grupB), `${sirRaceKey}_b`, grupB.length),
      ]);
      const sirala = (grup: HamAt[], sonuc: SiraSonuc[]): HamAt[] => {
        const kararByNo = new Map(sonuc.filter((s) => s.karar).map((s) => [s.no, s.karar!]));
        const siraByNo = new Map(sonuc.map((s) => [s.no, s.teknikSira]));
        return [...grup]
          .map((a) => ({ ...a, karar: kararByNo.get(a.no) ?? a.karar }))
          .sort((x, y) => (siraByNo.get(x.no) ?? 999) - (siraByNo.get(y.no) ?? 999));
      };
      const siraliA = sirala(grupA, sonucA);
      const siraliB = sirala(grupB, sonucB);
      siralamaSonuc = await siralamaCagir(mergeReminder(siraliA, siraliB), `${sirRaceKey}_merge`, allAtlar.length);
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sıralama başarısız oldu." }, { status: 500 });
  }

  let parsed: { atlar: TestV2Pick[] } | null = null;
  try {
    const siraByNo = new Map(siralamaSonuc.map((s) => [s.no, s.teknikSira]));
    // v6.68 — "karar" artık burada, TAM garanti-etiketli muhakemeyle YENİDEN veriliyor;
    // eski (batch aşamasındaki, garantilerden önceki) karar yalnız yanıt bir şekilde
    // eksik gelirse (şema "required" olsa da ekstra güvenlik) yedek olarak kullanılır.
    const kararByNo = new Map(siralamaSonuc.filter((s) => s.karar).map((s) => [s.no, s.karar!]));
    const atlar: TestV2Pick[] = allAtlar.map((a, i) => ({
      no: a.no, ad: a.ad, karar: kararByNo.get(a.no) ?? a.karar, muhakeme: a.muhakeme,
      teknikSira: siraByNo.get(a.no) ?? i + 1,
    }));
    parsed = { atlar };
  } catch {
    return NextResponse.json({ error: "Sıralama yanıtı parse edilemedi." }, { status: 500 });
  }
  console.log("[test-v2-engine] toplam parsed atlar sayısı:", parsed.atlar.length);

  // v6.64 — kullanıcı kararı 2026-08-05 (DAELLA): en sıkı koşulda (sahanın #1 stili +
  // n≥10 + "Yüksek Risk" değil) ilk 3'e girmesi GEREKEN bir at, sıralama çağrısı
  // yanılmış olsa bile koda gömülü olarak terfi ettirilir — bkz. v2-engine.ts yorumu.
  const top3Sonuc = faz2Top3Garantisi(parsed.atlar, faz1);
  parsed = { atlar: top3Sonuc.atlar };
  const faz2Top3Terfileri = top3Sonuc.terfiler;
  if (faz2Top3Terfileri.length > 0) {
    console.log("[test-v2-engine] Top3 garantisi tetiklendi:", JSON.stringify(faz2Top3Terfileri));
  }

  // v6.69 — kullanıcı kararı 2026-08-09 (İstanbul 1.Altılı kritiği): AGF trend'de (yükselen
  // VEYA düşen) belirgin hareket + birden çok güçlü kod-garantili sinyal (V1/V19/V22)
  // birlikte varsa ilk 3'e koşulsuz terfi — bkz. v2-engine.ts'deki
  // faz2GucluKombinasyonTop3Garantisi yorumu. 4-6 garantisinden ÖNCE çalışır.
  const top3KombinasyonSonuc = faz2GucluKombinasyonTop3Garantisi(parsed.atlar, faz1);
  parsed = { atlar: top3KombinasyonSonuc.atlar };
  const faz2GucluTop3Terfileri = top3KombinasyonSonuc.terfiler;
  if (faz2GucluTop3Terfileri.length > 0) {
    console.log("[test-v2-engine] Güçlü kombinasyon top3 garantisi tetiklendi:", JSON.stringify(faz2GucluTop3Terfileri));
  }

  // v6.69 — kullanıcı kararı 2026-08-09 (TÜRKÖREN, İstanbul 3.Koşu): sahadaki GERÇEK AGF
  // lideri gün içinde belirgin düşse bile hâlâ favori kaldığı sürece ilk 3'e terfi eder —
  // bkz. v2-engine.ts'deki faz2AgfFavorisiDususeRagmenGarantisi yorumu (2026-07-29'da
  // reddedilen KOŞULSUZ "AGF top-3" kuralından FARKLI, dar kapsamlı bir istisna).
  const agfFavoriSonuc = faz2AgfFavorisiDususeRagmenGarantisi(parsed.atlar, faz1);
  parsed = { atlar: agfFavoriSonuc.atlar };
  const faz2AgfFavoriTerfileri = agfFavoriSonuc.terfiler;
  if (faz2AgfFavoriTerfileri.length > 0) {
    console.log("[test-v2-engine] AGF favorisi düşüşe rağmen ilk3 garantisi tetiklendi:", JSON.stringify(faz2AgfFavoriTerfileri));
  }

  // v6.69 — kullanıcı kararı 2026-08-09: AGF trend'de (yükselen VEYA düşen) belirgin
  // hareket gösteren, yukarıdaki güçlü kombinasyon şartını karşılamayan diğer atlar
  // analiz gücüne göre 4-5-6 penceresine terfi ettirilir — bkz. v2-engine.ts'deki
  // faz2AgfTrend456Garantisi yorumu.
  const agf456Sonuc = faz2AgfTrend456Garantisi(parsed.atlar, faz1);
  parsed = { atlar: agf456Sonuc.atlar };
  const faz2Agf456Terfileri = agf456Sonuc.terfiler;
  if (faz2Agf456Terfileri.length > 0) {
    console.log("[test-v2-engine] AGF trend 4-6 garantisi tetiklendi:", JSON.stringify(faz2Agf456Terfileri));
  }

  // v6.67 — kullanıcı kararı 2026-08-07 (İstanbul 1.Koşu dersi): karar hiyerarşisi
  // (Güçlü Aday > Düşük Risk > Orta Risk > Yüksek Risk) KOŞULSUZ olarak zorunlu kılınır —
  // bkz. v2-engine.ts'deki faz2KararHiyerarsisiUygula yorumu.
  const hiyerarsiSonuc = faz2KararHiyerarsisiUygula(parsed.atlar);
  parsed = { atlar: hiyerarsiSonuc.atlar };
  const faz2KararHiyerarsiDegisiklikleri = hiyerarsiSonuc.degisiklikler;
  if (faz2KararHiyerarsiDegisiklikleri.length > 0) {
    console.log("[test-v2-engine] Karar hiyerarşisi düzeltmesi:", JSON.stringify(faz2KararHiyerarsiDegisiklikleri));
  }

  // v6.45 — kullanıcı talebi: "faz1'in neleri çektiğini ve faz2'nin neleri muhakeme
  // ettiğini tikli olarak görmek istiyorum. Muhakeme edilmediği halde edilmiş gibi
  // göstermemeli." İkisi de ek Claude çağrısı yapmaz, tamamen mekanik/koddur.
  const faz1VeriDenetimi = faz1VeriKapsami(faz1, izinliKodlar);
  const faz2Denetim = faz2MuhakemeDenetle(faz1, izinliKodlar, parsed.atlar);
  // v6.50 — kullanıcı kararı: Faz3 kullanılmayacak (ek maliyet), bu yüzden Elazığ 8
  // dersini (güçlü/geniş örneklemli sinyal tek risk yüzünden son sıraya düşmesin) Faz2
  // promptuna EKLEMEK yerine (bu da maliyet demek) tamamen ücretsiz mekanik bir
  // son-kontrol olarak burada uyguluyoruz.
  const faz2KaliteUyarilari = faz2KaliteDenetimi(parsed.atlar);
  const faz2BankoAdayi = faz2BankoAdayiTespit(parsed.atlar);
  // v6.55 — kullanıcı bulgusu (WOLF SEYFO, Kocaeli 7.Koşu): aynı V-kodu çifti için
  // "destek" etiketli bir at, "destek olmayan" etiketli başka bir attan daha kötü
  // sıraya konmuşsa uyarır — bkz. v2-engine.ts'deki fonksiyon yorumu.
  const faz2SiralamaUyarilari = faz2SiralamaTutarlilikDenetimi(parsed.atlar);
  // v6.66 — kullanıcı bulgusu (15 atlı saha): "karar" (Güçlü Aday vb.) ile teknikSira
  // arasında büyük tutarsızlık varsa mekanik olarak uyar — büyük sahalarda (24 at)
  // otomatik ölçeklenir, prompt talimatına güvenmez.
  const faz2KararSiraUyarilari = faz2KararSiraTutarsizlikDenetimi(parsed.atlar);
  // v6.58 — kullanıcı kararı: rank 1-2'de veri var ama muhakemede hiç kullanılmamışsa
  // yalnız bilgilendirme değil, admin panelinde kaydı bilinçli onay olmadan engeller.
  const faz2KullanilmayanVeri = faz2KullanilmayanVeriTespiti(faz1, izinliKodlar, parsed.atlar).filter((k) => k.kullanilmayanKodlar.length > 0);

  // v6.51 — kullanıcı kararı 2026-08-03 ("hepsini hayata sok"): bu rota artık yalnız
  // izole test değil, GERÇEK admin akışının (V2AnalysisPanel → upsertPrediction) veri
  // kaynağı da. runners: no→runnerId eşlemesi için (AIAnalysisPanel'deki aynı desen).
  // tempoOzeti/kupon dilimleri: Faz3 yokken bile assertPublishSafe'in "2+ kaçak → tempo
  // zorunlu" kuralını mekanik olarak karşılamak ve kupon dilimlemesini merkezi tutmak için.
  const runners = faz1.runners.map((r) => ({ id: r.id, no: r.no, name: r.ad }));
  // v6.61 — kullanıcı bulgusu 2026-08-05: raceStyleEtiket'in ham değeri "KACAK_AT"
  // (enum), "Kaçak At" (görünen Türkçe etiket) DEĞİL — bu karşılaştırma HER ZAMAN false
  // dönüyordu, yani tempoOzeti (yayınlanan Prediction.tempo alanı) HER koşuda "net kaçak
  // stilli at yok" diyordu, saha gerçek durumundan bağımsız olarak.
  const kacakSayisi = faz1.runners.filter((r) => r.raceStyleEtiket === "KACAK_AT").length;
  const tempoOzeti = kacakSayisi >= 2
    ? `Sahada ${kacakSayisi} kaçak stilli at var — erken tempo baskısı olası, kapanış gücü güçlü atlar avantajlı olabilir.`
    : kacakSayisi === 1
    ? "Sahada 1 kaçak stilli at var — belirgin bir erken tempo baskısı beklenmiyor."
    : "Sahada net kaçak stilli at yok — tempo dağınık olabilir.";
  const sirali = [...parsed.atlar].sort((a, b) => a.teknikSira - b.teknikSira).map((a) => a.no);
  const couponNarrow = sirali.slice(0, 3).join("-");
  const couponNormal = sirali.slice(3, 6).join("-");
  const couponWide = sirali.slice(6).join("-");

  return NextResponse.json({
    ok: true,
    usage,
    parsed,
    faz1VeriDenetimi,
    faz2Denetim,
    faz2KaliteUyarilari,
    faz2SiralamaUyarilari,
    faz2KararSiraUyarilari,
    faz2KullanilmayanVeri,
    faz2Top3Terfileri,
    faz2GucluTop3Terfileri,
    faz2AgfFavoriTerfileri,
    faz2Agf456Terfileri,
    faz2KararHiyerarsiDegisiklikleri,
    faz2BankoAdayi,
    runners,
    tempoOzeti,
    couponNarrow, couponNormal, couponWide,
  });
}

async function handlePost(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const body = (await req.json()) as { raceId: string; step?: "batch" | "rank"; batchIndex?: number; atlar?: BatchAt[] };
  const { raceId, step, batchIndex, atlar } = body;
  if (!raceId) return NextResponse.json({ error: "raceId gerekli" }, { status: 400 });

  if (step === "rank") {
    if (!atlar?.length) return NextResponse.json({ error: "atlar gerekli" }, { status: 400 });
    return handleRank(raceId, atlar);
  }
  return handleBatch(raceId, batchIndex ?? 0);
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[test-v2-engine]", e);
    return NextResponse.json({ error: "Beklenmeyen hata: " + String(e) }, { status: 500 });
  }
}
