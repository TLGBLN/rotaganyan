import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { gatherFaz1V5, faz2V5Sirala, muhakemeUretV5, v5BankoAdayiTespit, tumOzellikleriListele, tumOzellikleriAnlasilirListele, CURRENT_ENGINE_LABEL, hibritMaidenSatisMi } from "@/lib/methodology/v5-engine";
import { kategoriTespit } from "@/lib/methodology/v2-engine";
import { hesaplaAnormalPistRiski } from "@/lib/methodology/anormal-pist-risk";
import { db } from "@/lib/db";
import { syncRaceProgramContext } from "@/server/services/race-context-sync.service";
import { fetchCriticalContextInput, criticalContextHash } from "@/lib/methodology/race-context-hash";

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

  // Race Context Invalidation Faz 1 (bkz. plan, Düzeltme #1) — "Analiz Et" gerçek T-60/T-45
  // operasyonunda BUGÜNKÜ, AZ ÖNCESİ TJK verisiyle çalışmalı; gatherFaz1V5 kendi içinde
  // yalnız AGF'yi tazeliyordu (syncAgfForRace), pist/yüzey/mesafe/koşan-koşmayan/jokey/kilo
  // gibi kritik alanlar DB'deki (olası eski) veriyle kalıyordu. Hata sessizce yutulur —
  // TJK erişilemezse analiz DB'deki mevcut veriyle devam eder, hiçbir zaman BLOKE ETMEZ.
  await syncRaceProgramContext(raceId).catch(() => {});

  const faz1 = await gatherFaz1V5(raceId);
  if (!faz1) return NextResponse.json({ error: "Koşu verisi bulunamadı" }, { status: 404 });
  if (faz1.runners.length === 0) return NextResponse.json({ error: "Sahada koşacak at yok" }, { status: 400 });

  const sirali = faz2V5Sirala(faz1);
  const sahaBuyuklugu = sirali.length;

  const atlar = sirali.map((r) => ({
    no: r.no,
    ad: r.ad,
    teknikSira: r.teknikSira,
    karar: r.karar,
    olasilik: r.olasilik,
    probTop2: r.probTop2,
    probTop3: r.probTop3,
    marketBlindProb1: r.marketBlindProb1,
    agfPayi: r.agfPayi,
    agfSirasi: r.agfSirasi,
    degerTerfisi: r.degerTerfisi,
    bKatmaniUygulandiMi: r.bKatmaniUygulandiMi,
    sireOrani: r.sireOrani,
    bSireKatkisi: r.bSireKatkisi,
    zeminMesafeBKatmaniUygulandiMi: r.zeminMesafeBKatmaniUygulandiMi,
    bZeminMesafeKatkisi: r.bZeminMesafeKatkisi,
    zeminMesafeDeneyim: r.zeminMesafeDeneyim,
    zeminMesafeDeneyimSeviyesi: r.zeminMesafeDeneyimSeviyesi,
    details: muhakemeUretV5(r, sahaBuyuklugu),
    tumSinyaller: tumOzellikleriListele(r),
    // 2026-10-02 kullanıcı talebi: ham teknik tablonun OKUNUR karşılığı — tüm 15 sinyal
    // (eşik yok) anlaşılır Türkçe cümle + kanıt durumuyla.
    anlasilirSinyaller: tumOzellikleriAnlasilirListele(r),
  }));

  const bankoAdayiHam = v5BankoAdayiTespit(sirali);

  // 2026-09-16 — Anormal Pist Modu v1 (bkz. anormal-pist-risk.ts): V5.46'nın kendi
  // banko/skor mantığına HİÇ dokunmadan, yalnız pist anormalse (Çim/Kum Normal-dışı)
  // ek bir risk değerlendirmesi. v5BankoAdayiTespit'in SONUCU, yalnız bu değerlendirme
  // "banko verilmesin" derse EZİLİR — kendi eşiği/mantığı değişmez.
  const raceDayIcin = await db.race.findUnique({
    where: { id: raceId },
    select: { raceDay: { select: { surfaceConditions: true } } },
  });
  const anormalPistRiski = hesaplaAnormalPistRiski(
    faz1,
    raceDayIcin?.raceDay.surfaceConditions as { label: string; detail: string }[] | null
  );
  const bankoAdayi = anormalPistRiski.operasyon.bankoIzinVer
    ? bankoAdayiHam
    : { bankoAdayi: false, sebep: anormalPistRiski.operasyon.uyariMesaji || bankoAdayiHam.sebep };

  const nolar = sirali.map((r) => r.no);
  const couponNarrow = nolar.slice(0, 3).join("-");
  const couponNormal = nolar.slice(3, 6).join("-");
  const couponWide = nolar.slice(6).join("-");

  // Fresh-sync SONRASI DB durumundan hesaplanan başlangıç hash'i — "Kaydet" anında TEKRAR
  // hesaplanıp bununla karşılaştırılacak (bkz. upsertPrediction'daki race-condition kilidi,
  // plan PİVOT-3 madde 3). Hesaplanamazsa (olağandışı) undefined kalır — Kaydet o zaman
  // eski (guard'sız) davranışa düşer, analiz BLOKE OLMAZ.
  const ctxForHash = await fetchCriticalContextInput(raceId);
  const contextStartHash = ctxForHash ? criticalContextHash(ctxForHash) : undefined;

  return NextResponse.json({
    ok: true,
    contextStartHash,
    motorEtiketi: CURRENT_ENGINE_LABEL,
    // 2026-08-26 kullanıcı bulgusu: "Maiden/Satış" hibrit koşularda panel yalnız
    // kategoriTespit'in ("MAIDEN" önce yakalayan) sonucunu ("1b") gösteriyordu — admin
    // ekranda "Düşük-şart" yazıyordu ama gerçek skorlama (agirlikSetleriSec/harmanliSkorla)
    // düşük-şart+diğer'i HARMANLIYORDU. Skorlama hep doğruydu, yalnız etiket yanıltıcıydı.
    kategori: hibritMaidenSatisMi(faz1.race.classType) ? "hibrit" : kategoriTespit(faz1.race.classType),
    kosuBaslik: `${faz1.race.hippodromeName} — ${faz1.race.raceNo}.Koşu | ${faz1.race.classType} | ${faz1.race.breed} | ${faz1.race.distance}m ${faz1.race.surface} | ${faz1.runners.length} at`,
    atlar,
    runners: faz1.runners.map((r) => ({ id: r.id, no: r.no, name: r.ad })),
    bankoAdayi,
    anormalPistRiski,
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
