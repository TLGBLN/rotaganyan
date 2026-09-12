/**
 * "Altılı Ne Verir?"nin AGF-tabanlı tahmini ikramiyesi, gerçek TJK ikramiyesinden büyük
 * sapma gösterebiliyor (24 örnekte medyan %61-76, varyans %30-116) — kullanıcı 2026-09-12'de
 * "Dağıtılacak Tutar"ı (havuz büyüklüğü) da girdi olarak kullanan daha iyi bir kalibrasyon
 * istedi. TEK günün 2 gerçek örneğiyle (havuz+katsayı+gerçek-ikramiye) denendi, STABİL bir
 * ilişki bulunamadı (gerçek×katsayı÷havuz oranı iki örnek arasında ~500 kat farklı çıktı) —
 * n=2 ile güvenilir bir sabit kurulamaz. TJK'nın "Dağıtılacak Tutar"ı yalnız BUGÜN için
 * sorgulanabiliyor (geçmişe dönük çekilemiyor), bu yüzden geriye dönük veri toplanamaz.
 *
 * Karar: bundan sonra sonuçlanan HER Altılı için bu üçlüyü (havuzBuyuklugu, katsayi,
 * gercekIkramiye) kaydet — yeterli örnek (20-30+) birikince GERÇEK bir regresyon kurulacak.
 * Bu dosya YALNIZ veri toplar, hiçbir canlı hesaplamayı DEĞİŞTİRMEZ.
 */
import { db } from "@/lib/db";
import { fetchGunlukTevziTutarlariByHipodrom, fetchTodaysAltiliResults } from "./ingest/tjk-altili.adapter";
import { turkeyDateString } from "@/lib/tz";

/** race.service.ts'teki parseIkramiyeTutar ile AYNI mantık (ayrı kopya, kod tekrarı kabul edilebilir). */
function parseIkramiyeTutar(ikramiye: string | null | undefined): number | null {
  if (!ikramiye) return null;
  const m = ikramiye.match(/([\d.]+,\d+)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function effectiveAgf(agf: number | null, ekuriGroup: number | null, allInRace: { agf: number | null; ekuriGroup: number | null }[]): number {
  if (agf == null) return 0;
  if (ekuriGroup == null || ekuriGroup < 1) return agf;
  const total = allInRace.filter((r) => r.ekuriGroup === ekuriGroup && r.agf != null).reduce((s, r) => s + r.agf!, 0);
  return total > 0 ? total : agf;
}

/** AltiliView.tsx'teki chunkAltili ile AYNI pencereleme mantığı (ayrı kopya — server tarafında). */
async function hesaplaKatsayi(hippodromeName: string, date: Date, slot: number): Promise<number | null> {
  const raceDay = await db.raceDay.findFirst({
    where: { date, hippodrome: { name: hippodromeName } },
    select: {
      races: {
        orderBy: { raceNo: "asc" },
        select: {
          raceNo: true,
          result: { select: { winnerNo: true } },
          runners: { where: { scratched: false }, select: { no: true, agf: true, ekuriGroup: true } },
        },
      },
    },
  });
  if (!raceDay) return null;
  const allRaces = raceDay.races;
  const chunk = allRaces.length <= 6 ? allRaces : slot === 1 ? allRaces.slice(0, 6) : allRaces.slice(allRaces.length - 6);
  if (chunk.length !== 6 || chunk.some((r) => r.result?.winnerNo == null)) return null;

  let katsayi = 1;
  for (const race of chunk) {
    const winner = race.runners.find((r) => r.no === race.result!.winnerNo);
    if (!winner) return null;
    const eAgf = effectiveAgf(winner.agf, winner.ekuriGroup, race.runners);
    if (eAgf <= 0) return null;
    katsayi *= 100 / eAgf;
  }
  return katsayi;
}

/**
 * Bugün aktif hipodromların her Altılı grubu için: HENÜZ sonuçlanmadıysa güncel havuz
 * büyüklüğünü kaydeder; SONUÇLANDIYSA (TJK "X vermiştir" cümlesi geldiyse) gerçek ikramiyeyi
 * + kendi verimizden hesaplanan katsayıyı kaydedip bir daha güncellemez (finalize).
 */
export async function syncAltiliIkramiyeLog(): Promise<void> {
  const todayStr = turkeyDateString();
  const todayDate = new Date(todayStr + "T00:00:00.000Z");

  const [tevziMap, sonuclar] = await Promise.all([fetchGunlukTevziTutarlariByHipodrom(), fetchTodaysAltiliResults()]);

  for (const sonuc of sonuclar) {
    for (let i = 0; i < sonuc.groups.length; i++) {
      const group = sonuc.groups[i];
      const slot = i + 1;
      const gercekIkramiye = parseIkramiyeTutar(group.ikramiye);

      const existing = await db.altiliIkramiyeLog.findUnique({
        where: { hippodromeName_date_slot: { hippodromeName: sonuc.sehirAdi, date: todayDate, slot } },
      });
      if (existing?.gercekIkramiye != null) continue; // zaten finalize edilmiş, bir daha dokunma

      if (gercekIkramiye != null) {
        const katsayi = await hesaplaKatsayi(sonuc.sehirAdi, todayDate, slot);
        await db.altiliIkramiyeLog.upsert({
          where: { hippodromeName_date_slot: { hippodromeName: sonuc.sehirAdi, date: todayDate, slot } },
          create: { hippodromeName: sonuc.sehirAdi, date: todayDate, slot, gercekIkramiye, katsayi, havuzBuyuklugu: existing?.havuzBuyuklugu ?? null },
          update: { gercekIkramiye, katsayi },
        });
      } else {
        const havuz = tevziMap.get(sonuc.sehirAdi)?.altili[i] ?? null;
        if (havuz != null) {
          await db.altiliIkramiyeLog.upsert({
            where: { hippodromeName_date_slot: { hippodromeName: sonuc.sehirAdi, date: todayDate, slot } },
            create: { hippodromeName: sonuc.sehirAdi, date: todayDate, slot, havuzBuyuklugu: havuz },
            update: { havuzBuyuklugu: havuz },
          });
        }
      }
    }
  }
}
