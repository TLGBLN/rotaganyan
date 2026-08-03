import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { gatherFaz1 } from "@/lib/methodology/veri-toplama";
import type { Anthropic } from "@anthropic-ai/sdk";
import { createWithTruncationRetry, extractText } from "@/lib/methodology/claude-analiz-helpers";
import type { Role } from "@prisma/client";
import { kategoriTespit, KATEGORI_KODLARI, KATEGORI_ADI, V_LEGEND, atSatirlariUret, kosuBaslikUret, faz1VeriKapsami, faz2MuhakemeDenetle } from "@/lib/methodology/v2-engine";

// v6.44 — YENİ MOTOR, TÜM KATEGORİLER (kullanıcı: "inşa et"). Bu rota TAMAMEN İZOLE —
// mevcut oto-analiz-faz2/faz3 rotalarına HİÇ dokunmuyor, hiçbir DB yazma/publish işlemi
// yapmıyor, yalnız ham Claude çıktısını JSON olarak döndürüyor. Eski sistem bu dosyadan
// etkilenmez. V-kodu referans metni + kategori→kod eşlemesi artık paylaşılan
// v2-engine.ts'te (v2-faz3-engine rotasıyla da paylaşılacak).
export const maxDuration = 800;

// v6.47 — kullanıcı denetimi (2026-08-03): "22-23 maddeye indirmemize rağmen hala neden
// maliyet bu kadar" sorusu üzerine ölçüldü — madde/talimat kısalığı GİRDİYİ düşürüyordu
// (21460 vs eski ~30-41000) ama ÇIKTI düşmüyordu (34690, eski aralığın üst ucunda), çünkü
// eski şema 5 ayrı serbest-metin alanına (tempoSenaryosu/dogrulananCiftler/riskliCiftler/
// sinifFormKontrolu/karar) bölünmüştü — her alan kendi bağlamını tekrar tekrar yazıyordu.
// Üretim Faz2'sindeki KANITLANMIŞ kompakt notasyon deseni (v6.40: "Etiket:değer(bağlam)|...")
// buraya AYNEN taşındı — TEK bir "muhakeme" alanı, çıktı hacmini talimat sayısından değil
// gerçekten neyin yazıldığından küçültüyor.
export type TestV2Pick = {
  no: number;
  ad: string;
  teknikSira: number;
  karar: string;
  muhakeme: string;
};

const TEST_V2_SCHEMA = {
  type: "object",
  properties: {
    atlar: {
      type: "array",
      items: {
        type: "object",
        properties: {
          no: { type: "integer" },
          ad: { type: "string" },
          teknikSira: { type: "integer" },
          karar: { type: "string" },
          muhakeme: { type: "string" },
        },
        required: ["no", "ad", "teknikSira", "karar", "muhakeme"],
        additionalProperties: false,
      },
    },
  },
  required: ["atlar"],
  additionalProperties: false,
} as const;

async function handlePost(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { raceId } = (await req.json()) as { raceId: string };
  if (!raceId) return NextResponse.json({ error: "raceId gerekli" }, { status: 400 });

  const faz1 = await gatherFaz1(raceId);
  if (!faz1) return NextResponse.json({ error: "Koşu verisi bulunamadı" }, { status: 404 });

  const kategori = kategoriTespit(faz1.race.classType);
  if (kategori === "bilinmiyor") {
    return NextResponse.json({ error: `Bu koşu tipi henüz hiçbir kategoriye eşleşmiyor: ${faz1.race.classType}` }, { status: 400 });
  }

  const izinliKodlar = KATEGORI_KODLARI[kategori];
  const kosuBaslik = kosuBaslikUret(faz1, izinliKodlar);
  const atlarMetin = faz1.runners.map((r) => atSatirlariUret(r, izinliKodlar)).join("\n\n");

  const reminder = `Şimdi yukarıdaki V-kodu tanımlarını, muhakeme matrisini ve KOŞU/AT verisini kullanarak HER at için "muhakeme" üret. Bu koşu ${KATEGORI_ADI[kategori]} kategorisinde — yalnız KOŞU/AT verisinde GÖRÜNEN V-kodlarını kullan, görünmeyen bir kod hakkında veri uydurma.

**FORMAT — KOMPAKT ETİKET NOTASYONU (maliyet verimliliği — bu metin yalnız Faz 3'e girdi, kullanıcıya GİTMEZ, doğal dil/cümle gerekmez):** "muhakeme" alanında TAM CÜMLE DEĞİL, kısa "Etiket:değer(bağlam)" parçaları yaz, "|" ile ayır. Fiil/bağlaç/özne YASAK ("...olduğu görülüyor" gibi ifadeler yazma) — yalnız kanıtın kendisi. Muhakeme Matrisi'nde çapraz sorguladığın HER çift için mutlaka "[Vx+Vy]:destek" (doğrulanan/uyumlu) veya "[Vx+Vy]:risk" (çelişen/riskli) etiketi ekle (bağlamı parantez içinde 1-3 kelimeyle ver). Örnek gerçek bir at için: 'V10:KaçakAt | V18:3(iç) | [V10+V18]:destek(iç kulvar+kaçak avantajlı) | V9:n=4,med-0.6(güçlü) | V2:3idman,keskin | [V2+V9]:destek(idman+kapanış örtüşüyor) | V13:56(-2kg) | [V13+V10]:risk(ağır kilo erken enerji riski) | V20:68→72(ivme+4) | V21:%12,sıra2(trend+3)'. Bu notasyon eksiksizliği AZALTMAZ (hangi V-kodları bu atta veri taşıyorsa hepsi değerlendirilir) — yalnız YAZIM BİÇİMİNİ sıkıştırır, kısalık için veri asla atlanmaz.

Yanıtı YALNIZCA geçerli JSON olarak ver:
{
  "atlar": [
    { "no": 0, "ad": "...", "teknikSira": 1, "karar": "Güçlü Aday / Düşük Risk / Orta Risk / Yüksek Risk", "muhakeme": "Etiket:değer(bağlam) | [Vx+Vy]:destek(...) | ..." }
  ]
}`;

  console.log("[test-v2-engine] Claude çağrısı başlıyor (streaming), raceId:", raceId, "kategori:", kategori);
  // v6.46 canlı bulgu (Elazığ 4.Koşu, 13 at): max_tokens:16000 yetersizdi — adaptive
  // thinking'in max_tokens'ten görünmeyen payı yüzünden hiç text bloğu üretilmeden
  // kesildi (stop_reason=max_tokens, content'te yalnız thinking bloğu vardı, raw="").
  // oto-analiz-faz2/route.ts'teki AYNI, canlıda tekrar tekrar doğrulanmış çözüm: tavanı
  // doğrudan modelin kabul ettiği gerçek üst sınıra (64000) çek — max_tokens yalnız bir
  // TAVAN, gerçek ücret üretilen token kadar, düşük tutmanın maliyet faydası yok.
  const msg = await createWithTruncationRetry(
    {
      model: "claude-sonnet-5",
      thinking: { type: "adaptive" },
      max_tokens: 64000,
      output_config: { format: { type: "json_schema", schema: TEST_V2_SCHEMA } },
      messages: [{ role: "user", content: [
        { type: "text", text: V_LEGEND, cache_control: { type: "ephemeral", ttl: "1h" } } as Anthropic.TextBlockParam,
        { type: "text", text: kosuBaslik + "\n\n## ATLAR\n" + atlarMetin },
        { type: "text", text: reminder },
      ] }],
    },
    raceId, "faz2v2", 64000
  );

  console.log("[test-v2-engine] Claude çağrısı bitti, usage:", JSON.stringify(msg.usage), "stop_reason:", msg.stop_reason);
  const raw = extractText(msg);
  let parsed: { atlar: TestV2Pick[] } | null = null;
  try { parsed = JSON.parse(raw); } catch { /* aşağıda raw dönecek */ }
  console.log("[test-v2-engine] parsed atlar sayısı:", parsed?.atlar?.length ?? "PARSE HATASI");

  // v6.45 — kullanıcı talebi: "faz1'in neleri çektiğini ve faz2'nin neleri muhakeme
  // ettiğini tikli olarak görmek istiyorum. Muhakeme edilmediği halde edilmiş gibi
  // göstermemeli." İkisi de ek Claude çağrısı yapmaz, tamamen mekanik/koddur.
  const faz1VeriDenetimi = faz1VeriKapsami(faz1, izinliKodlar);
  const faz2Denetim = parsed ? faz2MuhakemeDenetle(faz1, izinliKodlar, parsed.atlar) : null;

  return NextResponse.json({
    ok: true,
    kategori,
    usage: msg.usage,
    stopReason: msg.stop_reason,
    parsed,
    raw: parsed ? undefined : raw,
    faz1VeriDenetimi,
    faz2Denetim,
  });
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[test-v2-engine]", e);
    return NextResponse.json({ error: "Beklenmeyen hata: " + String(e) }, { status: 500 });
  }
}
