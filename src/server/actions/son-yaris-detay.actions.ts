"use server";

import { db } from "@/lib/db";
import { fetchTjkAtKosuBilgileri, type TjkAtKosuRow } from "@/server/services/ingest/tjk-at-performans.adapter";
import { isSameJockey } from "@/components/program/panels/galop-helpers";

// bkz. equipment.actions.ts — aynı kod tablosu ve K/SK aile mantığı (kulaklığın koşu boyunca
// vs. yalnız starta kadar kullanımı, ayrı ayrı eklenen/çıkarılan sayılmamalı).
const EQUIPMENT_LABELS: Record<string, string> = {
  K: "Kulaklık",
  KG: "Kapalı Gözlük",
  DB: "Dil Bağı",
  SK: "Starta Kadar Kulaklık",
  GKR: "Göz Koruyucu",
};
const EQUIPMENT_FAMILY: Record<string, string> = { K: "KULAKLIK", SK: "KULAKLIK" };
function familyOf(code: string): string {
  return EQUIPMENT_FAMILY[code] ?? code;
}
function labelFor(code: string): string {
  return EQUIPMENT_LABELS[code] ?? code;
}
function toCodes(raw: string | null): string[] {
  return (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function parseTjkDate(d: string): number {
  const [dd, mm, yyyy] = d.split(".").map(Number);
  return new Date(yyyy, mm - 1, dd).getTime();
}
function mostRecent(rows: TjkAtKosuRow[]): TjkAtKosuRow | undefined {
  return [...rows].sort((a, b) => parseTjkDate(b.date) - parseTjkDate(a.date))[0];
}

// TJK kilo alanı virgüllü ondalık kullanır ("56,5").
function parseWeight(raw: string): number | null {
  const n = parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// "1.24.13" (dk.sn.yüzde) veya "58.13" (sn.yüzde) → karşılaştırılabilir sayı (küçük=iyi).
function parseTime(raw: string): number | null {
  const nums = raw.trim().split(".").map(Number);
  if (nums.length === 3 && nums.every((n) => Number.isFinite(n))) {
    const [min, sec, hs] = nums;
    return min * 6000 + sec * 100 + hs;
  }
  if (nums.length === 2 && nums.every((n) => Number.isFinite(n))) {
    const [sec, hs] = nums;
    return sec * 100 + hs;
  }
  return null;
}

const SURFACE_PREFIX: Record<string, string> = { CIM: "Ç", KUM: "K", SENTETIK: "S" };

export type EquipmentItem = { code: string; label: string };

export type SonYarisDetay = {
  runnerNo: number;
  horseName: string;
  hasTjkId: boolean;
  eklenenTaki: EquipmentItem[];
  cikarilanTaki: EquipmentItem[];
  kiloDegisimi: number | null;
  ayniJokey: boolean | null;
  hipodromMesafeEtiket: string;
  kazandi: "EVET" | "HAYIR" | "KOSMADI";
  enIyiDerecesi: string | null;
};

/**
 * "Son Yarış Detayları" paneli — TÜMÜ TJK'nın resmi at profilinden (AtKosuBilgileri) tek
 * kaynaktan hesaplanır, sitenin kendi DB alanlarına (Runner.weightChange/sameJockey/equipment
 * added-removed) GÜVENİLMEZ — kullanıcı talebiyle: "takıları çektiğin yerden çekeceksin, kilo
 * değişimini son yarısındaki kilodan, aynı jokey mi de yine oradan bak."
 *
 * - Takı: bugünkü program (Runner.equipment) vs atın TJK'daki EN SON koşusundaki takı.
 * - Kilo Değişimi: bugünkü kilo − TJK'daki en son koşudaki kilo.
 * - Aynı Jokey: bugünkü jokey === TJK'daki en son koşudaki jokey (soyadı bazlı, bkz. isSameJockey).
 * - Kazandı / En İyi Derecesi: atın bu hipodrom + bu mesafe + bu pist tipinde (TÜM yıllar,
 *   kullanıcı onayı) TJK'daki tüm geçmişinden — Karşılaştır panelinden farklı olarak yıl
 *   sınırı YOK (kullanıcı: "bu hipodrom+mesafe+pist bugünküyle birebir aynı" — yıl belirtmedi).
 */
export async function getSonYarisDetaylariForRace(raceId: string): Promise<SonYarisDetay[]> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      distance: true,
      surface: true,
      raceDay: { select: { hippodrome: { select: { name: true } } } },
      runners: { select: { no: true, name: true, weight: true, jockey: true, equipment: true, tjkAtId: true } },
    },
  });
  if (!race) return [];

  const hippodromeName = race.raceDay.hippodrome.name.trim();
  const surfacePrefix = SURFACE_PREFIX[race.surface] ?? "";
  const hipodromMesafeEtiket = `${hippodromeName} ${race.distance}m`;

  return Promise.all(
    race.runners.map(async (r): Promise<SonYarisDetay> => {
      const currentCodes = toCodes(r.equipment);

      if (!r.tjkAtId) {
        return {
          runnerNo: r.no, horseName: r.name, hasTjkId: false,
          eklenenTaki: [], cikarilanTaki: [], kiloDegisimi: null, ayniJokey: null,
          hipodromMesafeEtiket, kazandi: "KOSMADI", enIyiDerecesi: null,
        };
      }

      try {
        const history = await fetchTjkAtKosuBilgileri(r.tjkAtId);
        const last = mostRecent(history);

        let eklenenTaki: EquipmentItem[] = [];
        let cikarilanTaki: EquipmentItem[] = [];
        let kiloDegisimi: number | null = null;
        let ayniJokey: boolean | null = null;

        if (last) {
          const pastCodes = toCodes(last.equipment);
          const currentFamilies = new Set(currentCodes.map(familyOf));
          const pastFamilies = new Set(pastCodes.map(familyOf));
          eklenenTaki = currentCodes.filter((c) => !pastFamilies.has(familyOf(c))).map((code) => ({ code, label: labelFor(code) }));
          cikarilanTaki = pastCodes.filter((c) => !currentFamilies.has(familyOf(c))).map((code) => ({ code, label: labelFor(code) }));

          const lastWeight = parseWeight(last.weight);
          if (r.weight != null && lastWeight != null) {
            kiloDegisimi = Math.round((r.weight - lastWeight) * 10) / 10;
          }
          ayniJokey = isSameJockey(last.jockey, r.jockey);
        }

        const exact = history.filter(
          (row) =>
            row.city.includes(hippodromeName) &&
            row.distance === race.distance &&
            (surfacePrefix === "" || row.surface.startsWith(surfacePrefix))
        );
        const kazandi: SonYarisDetay["kazandi"] =
          exact.length === 0 ? "KOSMADI" : exact.some((row) => row.finishPos === "1") ? "EVET" : "HAYIR";
        let enIyiDerecesi: string | null = null;
        let enIyiSayisal = Infinity;
        for (const row of exact) {
          const t = parseTime(row.time);
          if (t != null && t < enIyiSayisal) {
            enIyiSayisal = t;
            enIyiDerecesi = row.time;
          }
        }

        return {
          runnerNo: r.no, horseName: r.name, hasTjkId: true,
          eklenenTaki, cikarilanTaki, kiloDegisimi, ayniJokey,
          hipodromMesafeEtiket, kazandi, enIyiDerecesi,
        };
      } catch {
        return {
          runnerNo: r.no, horseName: r.name, hasTjkId: true,
          eklenenTaki: [], cikarilanTaki: [], kiloDegisimi: null, ayniJokey: null,
          hipodromMesafeEtiket, kazandi: "KOSMADI", enIyiDerecesi: null,
        };
      }
    })
  );
}
