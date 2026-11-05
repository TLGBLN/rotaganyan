// ROTAGANYAN ANALİZ MOTORU v1.0 — HorseRaceHistoryCache'ten geçmiş yarış satırlarını
// GÜVENLİ (point-in-time, tarih-titiz) şekilde okuyan ortak katman. FORM, SINIF,
// PİST-MESAFE-ZEMİN, KİLO (geçmiş kısmı) ve JOKEY_03 (çift-geçmişi) bu dosyayı paylaşır.
//
// KRİTİK (proje kuralı: Tarih Ayrıştırma Titizliği) — TJK tarihleri "GG.AA.YYYY" (Türkçe
// gün-ay-yıl) formatındadır, ASLA AA.GG.YYYY (Amerikan) olarak OKUNMAZ. Bu dosyadaki
// parseTjkDate() round-trip doğrulamasıyla (ayrıştırılan tarihin BİLEŞENLERİ geri okununca
// AYNI çıkıyor mu) sessiz yanlış-ayrıştırmayı engeller.

import { db } from "@/lib/db";
import type { RaceOutcome } from "./common";

export type HistoryRow = {
  date: string;
  year: string;
  city: string;
  distance: number;
  surface: string;
  finishPos: string;
  time: string;
  weight: string;
  equipment: string;
  jockey: string;
  raceNo: string;
  classType: string;
  trainer: string;
  owner: string;
  hp: string;
  ganyan: string;
  group: string;
};

/** "GG.AA.YYYY" → UTC Date. Round-trip doğrulamalı — bileşenler geri okunduğunda
 *  UYUŞMUYORSA (ör. 31. gün gibi geçersiz bir tarih) null döner, SESSİZCE yanlış bir
 *  tarihe YUVARLANMAZ (JS Date constructor'ının "32 Ocak → 1 Şubat" gibi taşma davranışı
 *  burada KASITLI OLARAK reddediliyor). */
export function parseTjkDate(date: string): Date | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(date.trim());
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (d.getUTCFullYear() !== yyyy || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return null;
  return d;
}

/**
 * Bir TJK geçmiş satırını RaceOutcome'a çevirir — field size BURADA BİLİNMEZ (tek bir atın
 * geçmiş satırı, o yarışın toplam saha büyüklüğünü taşımıyor, bkz. resolveFieldSize).
 * finishPos boşsa (gerçek veri örneğinde GÖZLENEN TEK non-numeric değer boş string) —
 * TJK bu hücrede DNF/DQ/koşmadı ayrımını YAPMIYOR, hepsini boş bırakıyor. Dürüstçe TEK bir
 * "no-time" kategorisine düşer; sahte bir ayrım İCAT EDİLMEZ.
 */
export function finishPosToPosition(finishPos: string): number | null {
  const trimmed = finishPos.trim();
  if (trimmed === "") return null;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * GERÇEK, ÖLÇÜLMÜŞ KISIT: HorseRaceHistoryCache satırları o geçmiş yarışın TOPLAM saha
 * büyüklüğünü (N) içermiyor — yalnız BİZİM kendi ingest ettiğimiz (Race/RaceDay/Runner)
 * veride o spesifik yarış varsa oradan çapraz-sorgulanabilir. Bu fonksiyon bu çapraz-sorguyu
 * yapar; BULAMAZSA null döner (tahmin ETMEZ). Kapsam oranı küçük olabilir — bkz.
 * ölçülmüş gerçek oran (measureFieldSizeCoverage ile test edilmeli).
 */
export type FieldSizeResolution = { fieldSize: number; confidence: "high" | "low"; raceId: string };

/**
 * 2026-10-17 — DÜZELTME (kullanıcı uyarısı + gerçek veri testiyle doğrulandı): İlk
 * denemem Result.actualOrder.length'i N olarak ÖNCELİKLENDİRİYORDU — bu YANLIŞ çıktı.
 * 500 gerçek yarışlık taramada %29'unda (145/500) actualOrder.length, scratched-olmayan
 * Runner sayısından DAHA AZ bulundu — çünkü actualOrder yalnız RESMİ BİR BİTİRİŞ SIRASI
 * ALAN atları listeliyor (bkz. src/lib/race-result.ts finishPos() — AYNI sözleşmeyi
 * kullanan, production'da kanıtlanmış kod); DNF/DQ/derecesiz atlar (gerçekten start aldı
 * ama bitiş sırası yok) haklı olarak DIŞARIDA kalıyor. Bir uç örnekte (Ankara, 9 at
 * start aldı, yalnız 1'i actualOrder'da) bu fark açıkça görüldü.
 *
 * Yeni öncelik: Runner(scratched=false) sayımı BİRİNCİL N kaynağıdır (gerçek start alan
 * at tanımına daha yakın). Result.actualOrder yalnız ÇAPRAZ DOĞRULAMA için kullanılır —
 * ikisi UYUŞUYORSA güven="high", UYUŞMUYORSA (DNF/DQ olasılığı VEYA scratch-işaretleme
 * tutarsızlığı — ikisi ayırt edilemiyor) güven="low" ile işaretlenir, çağıran taraf
 * (FORM/SINIF) bu düşük-güvenli satırları isteğe bağlı olarak dışlayabilir/ağırlıklandırabilir.
 */
export async function resolveFieldSize(row: HistoryRow): Promise<FieldSizeResolution | null> {
  const date = parseTjkDate(row.date);
  if (!date) return null;
  const raceNo = parseInt(row.raceNo, 10);
  if (!Number.isFinite(raceNo)) return null;

  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

  const race = await db.race.findFirst({
    where: {
      raceNo,
      raceDay: {
        date: { gte: dayStart, lt: dayEnd },
        hippodrome: { name: row.city },
      },
    },
    select: {
      id: true,
      result: { select: { actualOrder: true } },
      runners: { where: { scratched: false }, select: { id: true } },
    },
  });
  if (!race) return null;
  const runnerCount = race.runners.length;
  if (runnerCount === 0) return null;

  const actualOrder = race.result?.actualOrder;
  if (Array.isArray(actualOrder) && actualOrder.length > 0) {
    const confidence = actualOrder.length === runnerCount ? "high" : "low";
    return { fieldSize: runnerCount, confidence, raceId: race.id };
  }
  return { fieldSize: runnerCount, confidence: "low", raceId: race.id }; // çapraz-doğrulama kaynağı yok
}

/** HorseRaceHistoryCache.rowsJson'u tip-güvenli şekilde okur — şekli beklenmedikse boş dizi
 *  döner (hata fırlatıp tüm hesaplamayı durdurmak yerine, tek bir atın bozuk önbelleği
 *  diğer tüm hesaplamayı KİLİTLEMESİN). */
export function parseHistoryRows(rowsJson: unknown): HistoryRow[] {
  if (!Array.isArray(rowsJson)) return [];
  return rowsJson.filter(
    (r): r is HistoryRow =>
      !!r && typeof r === "object" && typeof (r as HistoryRow).date === "string" && typeof (r as HistoryRow).finishPos === "string"
  );
}

/** Yalnız hedef tarihten (point-in-time cutoff) ÖNCEKİ satırları döndürür — tarih
 *  ayrıştırılamıyorsa (bozuk/beklenmedik format) o satır GÜVENLİ TARAFTA kalınarak
 *  ATLANIR (geleceğe sızıntı riskini sıfıra indirmek, bir satırı kaybetmekten daha önemli). */
export function rowsBeforeCutoff(rows: HistoryRow[], cutoff: Date): HistoryRow[] {
  return rows.filter((r) => {
    const d = parseTjkDate(r.date);
    return d != null && d.getTime() < cutoff.getTime();
  });
}

/**
 * 2026-10-17 — kullanıcı talimatı: "aynı yarışın saha büyüklüğünü her at için tekrar
 * tekrar sorgulamaya gerek yok" (N+1 sorgu sorunu). Bir hesaplama turu (ör. bir atın 50
 * satırlık geçmişi, ya da bir eğitim partisindeki yüzlerce at) boyunca AYNI (hipodrom,
 * tarih, koşu no) anahtarına sahip satırlar için resolveFieldSize YALNIZ BİR KEZ
 * sorgulanır. Çağıran taraf (FORM/SINIF) bir tur başında createFieldSizeResolver()
 * çağırıp aynı resolver'ı tüm o turda yeniden kullanmalı.
 */
/**
 * Varsayılan davranış: her anahtar için mevcut findFirst çağrısı (production ile aynı).
 * RCA komutu `batchSize` verirse yalnız kendi resolver ömrü boyunca farklı tarih/
 * hipodrom/koşu anahtarlarını findMany OR sorgusunda toplar. Model sinyalleri değişmez.
 * Aynı tarih/hipodrom/koşu için birden çok eşleşmede mevcut findFirst'e geri döner;
 * belirsiz kayıtta farklı bir yarış seçilmez.
 */
export function createFieldSizeResolver(options: { batchSize?: number } = {}): FieldSizeResolverFn {
  const cache = new Map<string, Promise<FieldSizeResolution | null>>();
  const batchSize = options.batchSize != null && Number.isInteger(options.batchSize) && options.batchSize >= 2
    ? Math.min(options.batchSize, 50)
    : null;

  type Request = {
    row: HistoryRow;
    raceNo: number;
    dayStart: Date;
    dayEnd: Date;
    resolve: (value: FieldSizeResolution | null) => void;
    reject: (error: unknown) => void;
  };
  const queue: Request[] = [];
  let scheduled = false;

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { void flush(); });
  };

  const flush = async () => {
    scheduled = false;
    const batch = queue.splice(0, batchSize ?? 1);
    if (queue.length > 0) schedule();
    if (batch.length === 0) return;

    try {
      // Her koşu tanımı, tekli resolveFieldSize ile BİREBİR aynı filtreyi kullanır.
      const races = await db.race.findMany({
        where: {
          OR: batch.map(({ row, raceNo, dayStart, dayEnd }) => ({
            raceNo,
            raceDay: {
              date: { gte: dayStart, lt: dayEnd },
              hippodrome: { name: row.city },
            },
          })),
        },
        select: {
          id: true,
          raceNo: true,
          raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
          result: { select: { actualOrder: true } },
          runners: { where: { scratched: false }, select: { id: true } },
        },
      });

      // Birleştirilmiş OR sonucu farklı filtrelerin eşleşmelerini de taşır:
      // her isteği KENDİ şehir/tarih/koşu anahtarıyla kesin olarak eşleştir.
      await Promise.all(batch.map(async (request) => {
        try {
          const candidates = races.filter((race) =>
            race.raceNo === request.raceNo &&
            race.raceDay.hippodrome.name === request.row.city &&
            race.raceDay.date.getTime() >= request.dayStart.getTime() &&
            race.raceDay.date.getTime() < request.dayEnd.getTime()
          );
          if (candidates.length > 1) {
            // Önceki findFirst davranışını koru; findMany sırası seçimi etkilemesin.
            request.resolve(await resolveFieldSize(request.row));
            return;
          }
          const race = candidates[0];
          if (!race || race.runners.length === 0) {
            request.resolve(null);
            return;
          }
          const runnerCount = race.runners.length;
          const actualOrder = race.result?.actualOrder;
          request.resolve({
            fieldSize: runnerCount,
            confidence: Array.isArray(actualOrder) && actualOrder.length > 0 && actualOrder.length === runnerCount ? "high" : "low",
            raceId: race.id,
          });
        } catch (error) {
          request.reject(error);
        }
      }));
    } catch (error) {
      for (const request of batch) request.reject(error);
    }
  };

  const resolver: FieldSizeResolverFn = (row: HistoryRow): Promise<FieldSizeResolution | null> => {
    const key = `${row.city}|${row.date}|${row.raceNo}`;
    let pending = cache.get(key);
    if (!pending) {
      if (batchSize == null) {
        // Var olan bütün çağıranlar için production davranışı aynen korunur.
        pending = resolveFieldSize(row);
      } else {
        const date = parseTjkDate(row.date);
        const raceNo = parseInt(row.raceNo, 10);
        if (!date || !Number.isFinite(raceNo)) {
          pending = Promise.resolve(null);
        } else {
          const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
          const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
          pending = new Promise<FieldSizeResolution | null>((resolve, reject) => {
            queue.push({ row, raceNo, dayStart, dayEnd, resolve, reject });
            schedule();
          });
        }
      }
      cache.set(key, pending);
    }
    return pending;
  };

  // Yalnız RCA batch resolver: geçmiş yarışlar eşzamanlı kuyruğa alınır.
  // Promise sonuçları önceden çözülse de tüketici döngülerinin sırası değişmez.
  if (batchSize != null) {
    resolver.prefetch = (rows: readonly HistoryRow[]) => {
      const pending = rows.slice(0, 24).map((row) => resolver(row));
      // Önceden çağrılıp daha sonra tüketilmeyen bir satırın sorgusu hata verirse
      // unhandled rejection üretme; gerçekten tüketilen satırda aynı hata iletilir.
      void Promise.allSettled(pending);
    };
  }
  return resolver;
}

export type FieldSizeResolverFn = ((row: HistoryRow) => Promise<FieldSizeResolution | null>) & {
  prefetch?: (rows: readonly HistoryRow[]) => void;
};

/** Yalnız RCA batch resolver için erken, sınırlı ve PIT-safe veri ön yükleme.
 * Normal resolverda prefetch yoktur ve ekstra ayrıştırma / SQL yapılmaz.
 * Son 24 bitiriş kaydı tercih edilir; hesaplama döngüleri eski sırayla devam eder.
 */
export function prefetchRecentFieldSizes(resolver: FieldSizeResolverFn, rowsJson: unknown, cutoff: Date): void {
  if (!resolver.prefetch) return;
  const rows = rowsBeforeCutoff(parseHistoryRows(rowsJson), cutoff)
    .filter((row) => finishPosToPosition(row.finishPos) != null)
    .sort((a, b) => parseTjkDate(b.date)!.getTime() - parseTjkDate(a.date)!.getTime());
  resolver.prefetch(rows);
}

export async function rowToOutcome(row: HistoryRow, resolver: FieldSizeResolverFn = resolveFieldSize): Promise<RaceOutcome> {
  const position = finishPosToPosition(row.finishPos);
  if (position == null) return { kind: "no-time" };
  const resolved = await resolver(row);
  if (resolved == null) return { kind: "finished-unknown-field-size", position };
  return { kind: "finished", position, fieldSize: resolved.fieldSize, confidence: resolved.confidence };
}
