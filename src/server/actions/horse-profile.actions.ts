"use server";

import { db } from "@/lib/db";
import { fetchHorseProfile, fetchHorseDetailedStats } from "@/server/services/ingest/tjk-at-profil.adapter";
import type { HorseProfile, HorseDetailStatSection } from "@/server/services/ingest/tjk-at-profil.adapter";
import { fetchYurtDisiAtProfil } from "@/server/services/ingest/tjk-at-yurtdisi.adapter";

async function resolveTjkAtId(name: string): Promise<number | null> {
  const runner = await db.runner.findFirst({
    where: { name, tjkAtId: { not: null } },
    select: { tjkAtId: true },
    orderBy: { race: { raceDay: { date: "desc" } } },
  });
  return runner?.tjkAtId ?? null;
}

async function resolveYurtDisiAtId(name: string): Promise<number | null> {
  const runner = await db.runner.findFirst({
    where: { name, yurtDisiAtId: { not: null } },
    select: { yurtDisiAtId: true },
    orderBy: { race: { raceDay: { date: "desc" } } },
  });
  return runner?.yurtDisiAtId ?? null;
}

/**
 * 2026-09-29 kullanıcı bulgusu ("hani hiçbir veri yok") — TR'nin HorseProfile şekli
 * (İkramiye/At Sahibi Primi/Yetiştiricilik Primi gibi TR'ye özgü kazanç kategorileri) yurt
 * dışında KARŞILIĞI OLMAYAN alanlar — bunları 0 olarak doldurmak "bu at 0 ikramiye kazandı"
 * gibi YANLIŞ bir izlenim verir. Bu yüzden financials TAMAMEN sıfır bırakılıyor (hasFinancials
 * false olur, o kartlar hiç render edilmez) — GERÇEK kazanç yalnız summaryStats tablosunda
 * (TJK'nın kendi TOPLAM/yıl/pist kırılımıyla, doğru para birimiyle) gösteriliyor.
 */
function yurtDisiProfilToHorseProfile(p: NonNullable<Awaited<ReturnType<typeof fetchYurtDisiAtProfil>>>): HorseProfile {
  // summaryStats BİLEREK boş — HorseProfileSummary o tabloyu sabit "₺" ile formatlıyor,
  // yurt dışı kazancı YANLIŞ para biriminde göstermemek için asıl kırılım tablosu yalnız
  // "Detaylı İstatistikler" panelinde (yurtDisiProfilToDetailStats, doğru sembolle) veriliyor.
  return {
    identity: { gercekSahip: null, uzerineKosanSahip: p.sahip || null, yetistirici: null },
    financials: { ikramiye: 0, atSahibiPrimi: 0, yurtdisiIkramiye: 0, kazanc: 0, yetistiricilikPrimi: 0, sponsorlukGeliri: 0 },
    summaryStats: [],
  };
}

function yurtDisiProfilToDetailStats(p: NonNullable<Awaited<ReturnType<typeof fetchYurtDisiAtProfil>>>): HorseDetailStatSection[] {
  const rows = Object.entries(p.ozet).map(([label, s]) => [
    label, String(s.starts), String(s.wins), String(s.places), String(s.shows), `${s.earnings.toLocaleString("tr-TR")} ${p.paraBirimi}`,
  ]);
  if (rows.length === 0) return [];
  return [{ title: "Kariyer Özeti (TJK — Toplam / Yıl / Pist Bazlı)", headers: ["Kırılım", "Koşu", "1.", "2.", "3.", "Kazanç"], rows }];
}

/**
 * Bir atın (isme göre) sahiplik/kazanç/özet istatistik profili VE Zaman/Hipodrom/Jokey/Pist/
 * Mesafe kırılımlı detaylı istatistikleri — kalıcı HorseStatsCache'ten (arka plandaki
 * sync-horse-stats-cache cron'u tüm atları periyodik tazeler), yalnız cache henüz o at için
 * hiç oluşmadıysa (yeni at / cron henüz sırası gelmedi) TJK'dan anlık çekip cache'e yazar —
 * kullanıcı hiçbir zaman TJK'yı beklemez, önbellek arkadan dolar (kullanıcı talebi 2026-07-30).
 */
async function getHorseStats(name: string): Promise<{ profile: HorseProfile | null; detailedStats: HorseDetailStatSection[] }> {
  const tjkAtId = await resolveTjkAtId(name);
  if (tjkAtId == null) {
    // TR akışına HİÇ girmeyen erken dönüş — bkz. yurtDisiProfilToHorseProfile üstündeki not.
    const yurtDisiAtId = await resolveYurtDisiAtId(name);
    if (yurtDisiAtId == null) return { profile: null, detailedStats: [] };
    const profile = await fetchYurtDisiAtProfil(yurtDisiAtId).catch(() => null);
    if (!profile) return { profile: null, detailedStats: [] };
    // Sahip bilgisi boşsa (TJK bazen bunu vermiyor, bkz. CAPT JAX PARROW örneği) "Sahiplik &
    // Kazanç" panelinde boş bir kutu yerine mevcut "bulunamadı" mesajı görünsün — gerçek
    // kariyer verisi (detailedStats) buna bakmaksızın HER ZAMAN döner.
    return {
      profile: profile.sahip ? yurtDisiProfilToHorseProfile(profile) : null,
      detailedStats: yurtDisiProfilToDetailStats(profile),
    };
  }

  const cached = await db.horseStatsCache.findUnique({ where: { tjkAtId } });
  if (cached) {
    return {
      profile: cached.profileJson as unknown as HorseProfile,
      detailedStats: cached.detailedStatsJson as unknown as HorseDetailStatSection[],
    };
  }

  const [profile, detailedStats] = await Promise.all([
    fetchHorseProfile(tjkAtId),
    fetchHorseDetailedStats(tjkAtId),
  ]);
  if (profile) {
    await db.horseStatsCache
      .upsert({
        where: { tjkAtId },
        create: { tjkAtId, profileJson: profile, detailedStatsJson: detailedStats },
        update: { profileJson: profile, detailedStatsJson: detailedStats },
      })
      .catch(() => {});
  }
  return { profile, detailedStats };
}

export async function getHorseProfileByName(name: string): Promise<HorseProfile | null> {
  return (await getHorseStats(name)).profile;
}

export async function getHorseDetailedStatsByName(name: string): Promise<HorseDetailStatSection[]> {
  return (await getHorseStats(name)).detailedStats;
}
