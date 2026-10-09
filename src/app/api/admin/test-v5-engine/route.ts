import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { gatherFaz1V5, hibritMaidenSatisMi } from "@/lib/methodology/v5-engine";
import { scoreV461 } from "@/lib/methodology/v546-1-engine";
import { kategoriTespit } from "@/lib/methodology/v2-engine";

// 2026-08-16 — V5 motoru: Claude çağrısı YOK (yalnız DB okuma + koşullu logit skoru),
// V4 ile aynı sebeple maxDuration/batching gerekmiyor — tek istekte döner.

type Body = { raceId: string };

async function handlePost(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { raceId } = (await req.json()) as Body;
  if (!raceId) return NextResponse.json({ error: "raceId gerekli" }, { status: 400 });

  const faz1 = await gatherFaz1V5(raceId);
  if (!faz1) return NextResponse.json({ error: "Kosu verisi bulunamadi" }, { status: 404 });
  if (faz1.runners.length === 0) return NextResponse.json({ error: "Sahada kosacak at yok" }, { status: 400 });

  const sonuc = await scoreV461(raceId);
  if (!sonuc) return NextResponse.json({ error: "V5.46.1 skor sonucu uretilemedi" }, { status: 500 });

  const sirali = [...sonuc.picks].sort((a, b) => a.rank - b.rank);
  const featureRaw = (p: (typeof sirali)[number], ad: string): number | null => p.features.find((f) => f.ad === ad)?.raw ?? null;

  const atlar = sirali.map((p) => {
    const sinyaller = p.features.map((f) => ({
      kod: f.ad,
      etiket: f.ad,
      hamDeger: f.raw,
      standartDeger: f.z,
      katki: f.contribution,
      observed: f.observed,
      reliability: f.reliability,
      beta: f.beta,
    }));
    const enGuclu = [...p.features].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 3);
    const zmd = featureRaw(p, "zeminMesafeDeneyim") ?? 0;
    return {
      no: p.no,
      ad: p.ad,
      teknikSira: p.rank,
      karar: p.rank === 1 ? "ANA ADAY" : p.rank <= 3 ? "CIDDI RAKIP" : "ALTERNATIF",
      olasilik: p.probability,
      probTop2: undefined,
      probTop3: undefined,
      marketBlindProb1: undefined,
      agfPayi: featureRaw(p, "agfPayi") ?? 0,
      agfSirasi: featureRaw(p, "agfSirasi") ?? 999,
      degerTerfisi: false,
      bKatmaniUygulandiMi: false,
      sireOrani: featureRaw(p, "sireOrani") ?? 0,
      bSireKatkisi: 0,
      zeminMesafeBKatmaniUygulandiMi: false,
      bZeminMesafeKatkisi: 0,
      zeminMesafeDeneyim: zmd,
      zeminMesafeDeneyimSeviyesi: Math.abs(zmd) > 1e-12 ? "var" : "yok",
      details: {
        versiyon: 2,
        karar: p.rank === 1 ? "ANA ADAY" : p.rank <= 3 ? "CIDDI RAKIP" : "ALTERNATIF",
        satirlar: [
          {
            kod: ["V461"],
            tip: "notr",
            guven: "tam",
            kodGarantili: true,
            aciklama: `V5.46.1 teknik sira: ${p.rank}`,
          },
          {
            kod: ["OLASILIK"],
            tip: "notr",
            guven: "tam",
            kodGarantili: true,
            aciklama: `Kazanma olasiligi: %${(p.probability * 100).toFixed(2)}`,
          },
          {
            kod: ["MODEL_SKORU"],
            tip: "notr",
            guven: "tam",
            kodGarantili: true,
            aciklama: `Model skoru: ${p.score.toFixed(5)}`,
          },
          ...enGuclu.map((f) => ({
            kod: [f.ad],
            tip: f.contribution >= 0 ? "destek" : "risk",
            guven: "tam",
            kodGarantili: true,
            aciklama: `${f.ad}: ${f.contribution >= 0 ? "+" : ""}${f.contribution.toFixed(4)}`,
          })),
        ],
      },
      tumSinyaller: sinyaller,
    };
  });

  const bankoAdayi = null;
  const nolar = sirali.map((r) => r.no);
  const couponNarrow = nolar.slice(0, 3).join("-");
  const couponNormal = nolar.slice(3, 6).join("-");
  const couponWide = nolar.slice(6).join("-");

  return NextResponse.json({
    ok: true,
    motorEtiketi: sonuc.engineVersion,
    // 2026-08-26 kullanıcı bulgusu: "Maiden/Satış" hibrit koşularda panel yalnız
    // kategoriTespit'in ("MAIDEN" önce yakalayan) sonucunu ("1b") gösteriyordu — admin
    // ekranda "Düşük-şart" yazıyordu ama gerçek skorlama (agirlikSetleriSec/harmanliSkorla)
    // düşük-şart+diğer'i HARMANLIYORDU. Skorlama hep doğruydu, yalnız etiket yanıltıcıydı.
    kategori: hibritMaidenSatisMi(faz1.race.classType) ? "hibrit" : kategoriTespit(faz1.race.classType),
    kosuBaslik: `${faz1.race.hippodromeName} — ${faz1.race.raceNo}.Koşu | ${faz1.race.classType} | ${faz1.race.breed} | ${faz1.race.distance}m ${faz1.race.surface} | ${faz1.runners.length} at`,
    atlar,
    runners: faz1.runners.map((r) => ({ id: r.id, no: r.no, name: r.ad })),
    bankoAdayi,
    couponNarrow,
    couponNormal,
    couponWide,
  });
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[test-v5-engine]", e);
    return NextResponse.json({ error: "Beklenmeyen hata: " + String(e) }, { status: 500 });
  }
}
