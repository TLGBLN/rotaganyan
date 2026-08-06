"use server";

import { db } from "@/lib/db";
import { startOfDay } from "date-fns";
import { fetchTjkAtKosuBilgileri } from "@/server/services/ingest/tjk-at-performans.adapter";
import { zeminKatsayisi, zeminDetayiSatirdanCikar, zeminDetayiBul } from "@/lib/methodology/mekanik-puanlama";
import { tjkTarihOncesiMi } from "@/lib/tjk-date";
import { finishPos } from "@/lib/race-result";

const SURFACE_PREFIX: Record<string, string> = { CIM: "Ç", KUM: "K", SENTETIK: "S" };

export type ZeminGecmisiSonuc = { ozet: string | null; toplamKayit: number };
export type SinifBaglamliFormSonuc = { ozet: string | null };
export type AtJokeyGecmisiSonuc = { ozet: string | null };

/**
 * İki ayrı, ama aynı TJK geçmişinden (fetchTjkAtKosuBilgileri, kendi TTL cache'i sayesinde
 * bu at için zaten yapılmış başka bir çağrıdan bedavaya gelir) türeyen sinyal:
 *
 * 1. ZEMİN GEÇMİŞİ (kullanıcı talebi 2026-07-27): "Yalnız bugünkü zemin katsayısı vardı,
 *    bu atın geçmişte AYNI zemin koşulunda (ıslak/ağır vb.) nasıl gittiği hiç bakılmıyordu
 *    — bu çok önemli." Aynı Pist/Mesafe panelinden FARKLI: hipodrom/mesafe/yıl sınırı YOK,
 *    yalnız PİST TÜRÜ + ZEMİN SINIFI (bugünkünle aynı) eşleşen TÜM geçmiş aranır — ıslak/ağır
 *    zemin nadiren tekrar ettiği için örneklemi daraltmamak amacıyla.
 *
 * 2. SINIF-BAĞLAMLI FORM (kullanıcı talebi 2026-07-27): "recentForm" yalnız çıplak bitiş
 *    sırası dizisiydi ("618..." gibi) — bir KV-8'de 6. olmakla bir Şartlı 4'te 6. olmak
 *    aynı rakamla gösterilirdi ama ikisi çok farklı zorluk seviyesi. Son starların HER
 *    BİRİNİN sınıfını (classType) da yanına ekleyerek Claude'un kendi zorluk sıralamasıyla
 *    (bkz. metodoloji §VII yarış tipi hiyerarşisi) doğru yorumlamasını sağlar.
 *
 * İkisi de kendi kendine leke sürmez: bugünün kendi tarihi (henüz koşulmamışsa zaten yok,
 * koşulduysa dışlanır) hariç tutulur — bkz. tjk-date.ts.
 */
export async function getGecmisBaglamForRace(
  raceId: string
): Promise<{ zemin: (ZeminGecmisiSonuc & { no: number })[]; sinifBaglamliForm: (SinifBaglamliFormSonuc & { no: number })[] }> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      surface: true,
      raceDay: { select: { date: true, surfaceConditions: true } },
      runners: { select: { no: true, name: true, tjkAtId: true }, orderBy: { no: "asc" } },
    },
  });
  if (!race) return { zemin: [], sinifBaglamliForm: [] };

  const surfaceConditions = (race.raceDay.surfaceConditions as { label: string; detail: string }[] | null) ?? null;
  const bugunkuZeminDetay = zeminDetayiBul(surfaceConditions, race.surface);
  const bugunkuZeminEtiket = zeminKatsayisi(bugunkuZeminDetay).etiket;
  const surfacePrefix = SURFACE_PREFIX[race.surface] ?? "";

  const results = await Promise.all(
    race.runners.map(async (r): Promise<{ zemin: ZeminGecmisiSonuc; sinifBaglamliForm: SinifBaglamliFormSonuc; no: number }> => {
      if (!r.tjkAtId) return { zemin: { ozet: null, toplamKayit: 0 }, sinifBaglamliForm: { ozet: null }, no: r.no };
      try {
        const history = (await fetchTjkAtKosuBilgileri(r.tjkAtId)).filter((row) => tjkTarihOncesiMi(row.date, race.raceDay.date));

        // ── Zemin geçmişi ──
        const zeminEslesenler = history.filter((row) => {
          if (surfacePrefix && !row.surface.startsWith(surfacePrefix)) return false;
          const rowZeminDetay = zeminDetayiSatirdanCikar(row.surface);
          return zeminKatsayisi(rowZeminDetay).etiket === bugunkuZeminEtiket;
        });
        let zemin: ZeminGecmisiSonuc = { ozet: null, toplamKayit: 0 };
        if (zeminEslesenler.length > 0) {
          const kazandiMi = zeminEslesenler.some((m) => m.finishPos === "1");
          const satirlar = zeminEslesenler
            .slice(0, 3)
            .map((m) => `${m.date} ${m.finishPos}. ${m.city} ${m.distance}m derece:${m.time}`)
            .join(" | ");
          zemin = {
            ozet: `[${bugunkuZeminEtiket}] ${satirlar}${kazandiMi ? " [BU ZEMİN SINIFINDA KAZANDI]" : ""}`,
            toplamKayit: zeminEslesenler.length,
          };
        }

        // ── Sınıf-bağlamlı form (son 5 start, sıra + sınıf birlikte) ──
        const sorted = [...history].sort((a, b) => {
          const [da, ma, ya] = a.date.split(".").map(Number);
          const [db_, mb, yb] = b.date.split(".").map(Number);
          return new Date(yb, mb - 1, db_).getTime() - new Date(ya, ma - 1, da).getTime();
        });
        const sonBesi = sorted.slice(0, 5);
        const sinifBaglamliForm: SinifBaglamliFormSonuc = {
          ozet: sonBesi.length > 0 ? sonBesi.map((row) => `${row.finishPos}.(${row.classType || "?"})`).join(" ") : null,
        };

        return { zemin, sinifBaglamliForm, no: r.no };
      } catch {
        return { zemin: { ozet: null, toplamKayit: 0 }, sinifBaglamliForm: { ozet: null }, no: r.no };
      }
    })
  );

  return {
    zemin: results.map((r) => ({ ...r.zemin, no: r.no })),
    sinifBaglamliForm: results.map((r) => ({ ...r.sinifBaglamliForm, no: r.no })),
  };
}

/**
 * AT-JOKEY GEÇMİŞİ (kullanıcı doktrini 2026-07-27, jokey önceliği madde 4): bu at, bugünkü
 * jokeyle daha önce ortak start yapmış mı, o zaman nasıl gitmiş — rotaganyan'ın KENDİ
 * Runner/Race/Result verisinden (TJK'ya ayrıca gitmeye gerek yok, kullanıcı tespiti: "bu
 * veriler zaten rotaganyan'dan çekilmiyor mu"). Bugünkü koşu hariç tutulur.
 *
 * 2026-07-27 canlı bulgu (Bursa 9./Karma 2.Koşu): yalnız `raceId: { not: raceId }` yeterli
 * DEĞİL — aynı fiziksel yarış, farklı bir programda (Karma) FARKLI bir raceId ile mirror'lanmış
 * olabiliyor. Bu at+jokey ikilisi o mirror'da da aynı sonuçla göründüğü için, koşu kendi post
 * saatinden sonra analiz edilirse (sonuç zaten girilmişse) at kendi az önceki yarışını
 * "geçmiş ortak başarı" olarak görebiliyordu. Artık TARİHE göre de hariç tutuluyor — bugünün
 * kendi günü hiçbir zaman "geçmiş" sayılmaz (bkz. veri-toplama.ts'teki aynı desenin Accurace
 * karşılığı).
 */
export async function getAtJokeyGecmisiForRace(raceId: string): Promise<AtJokeyGecmisiSonuc[]> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: { raceDay: { select: { date: true } }, runners: { select: { name: true, jockey: true } } },
  });
  if (!race) return [];
  const bugunBaslangici = startOfDay(race.raceDay.date);

  return Promise.all(
    race.runners.map(async (r): Promise<AtJokeyGecmisiSonuc> => {
      if (!r.jockey) return { ozet: null };
      const gecmisStartlar = await db.runner.findMany({
        where: {
          name: r.name,
          jockey: r.jockey,
          raceId: { not: raceId },
          race: { result: { isNot: null }, raceDay: { date: { lt: bugunBaslangici } } },
        },
        select: {
          no: true,
          race: {
            select: {
              raceNo: true,
              raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
              result: { select: { actualOrder: true, winnerNos: true } },
            },
          },
        },
        orderBy: { race: { raceDay: { date: "desc" } } },
        take: 5,
      });
      if (gecmisStartlar.length === 0) return { ozet: null };
      const kazandiMi = gecmisStartlar.some(
        (s) => finishPos(s.race.result!.actualOrder, s.no, s.race.result!.winnerNos) === 1
      );
      const satirlar = gecmisStartlar
        .map((s) => {
          const pos = finishPos(s.race.result!.actualOrder, s.no, s.race.result!.winnerNos);
          return `${s.race.raceDay.date.toISOString().slice(0, 10)} ${s.race.raceDay.hippodrome.name} ${pos ?? "?"}.`;
        })
        .join(" | ");
      return { ozet: `${satirlar}${kazandiMi ? " [BU İKİLİ DAHA ÖNCE KAZANDI]" : ""}` };
    })
  );
}
