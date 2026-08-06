"use server";

import { db } from "@/lib/db";

export type GecCikisOzet = {
  toplamStart: number;
  gecCikisSayisi: number;
  sonFark: string | null;
};

const MIN_ORNEK = 3;

/**
 * "Geç Çıkış" (start sorunu) geçmişi — TJK'nın kendi resmi tespiti (kullanıcı talebi
 * 2026-08-01: "Start Sorunu olan atları tespit edebilir miyiz"). Result.gecCikanlar
 * (bkz. tjk-result.adapter.ts + result-sync.ts) her koşuda geç kalkan at(lar)ı
 * {no, name, fark} olarak taşır — burada bir atın TÜM geçmiş sonuçlu starlarını tarayıp
 * kaç kez bu listede göründüğünü sayıyoruz. Örneklem küçükse (MIN_ORNEK altı) hiç
 * gösterilmez — 1 start'ta 1 geç çıkış "%100 geç çıkıyor" gibi yanıltıcı bir izlenim verir.
 */
export async function getGecCikisOzetleriForRace(horseNames: string[], beforeDate: Date): Promise<Map<string, GecCikisOzet>> {
  const uniqueNames = [...new Set(horseNames.filter(Boolean))];
  if (uniqueNames.length === 0) return new Map();

  // v6.59 — kullanıcı bulgusu 2026-08-04: raceId/tarih parametresi olmadan bir atın
  // TÜM sonuçlu starları (geçmiş VEYA GELECEK, hedef yarışa göre) sayılıyordu — bir
  // yarış geçmişte backtest edilirken hedef yarıştan SONRAKİ geç-çıkış kayıtları da
  // "geçmiş sicil" gibi karışıyordu. Artık yalnız hedef tarihten KESİN önceki
  // koşu günleri sayılıyor.
  const runnerRows = await db.runner.findMany({
    where: { name: { in: uniqueNames }, race: { result: { isNot: null }, raceDay: { date: { lt: beforeDate } } } },
    select: {
      name: true,
      race: { select: { result: { select: { gecCikanlar: true } } } },
    },
  });

  type Acc = { total: number; late: number; lastFark: string | null };
  const byName = new Map<string, Acc>();

  for (const r of runnerRows) {
    const key = r.name.toLowerCase();
    const acc = byName.get(key) ?? { total: 0, late: 0, lastFark: null };
    acc.total++;
    const gecCikanlar = r.race.result?.gecCikanlar as { no: number; name: string; fark: string }[] | null;
    const match = gecCikanlar?.find((g) => g.name.toLowerCase() === key);
    if (match) {
      acc.late++;
      acc.lastFark = match.fark;
    }
    byName.set(key, acc);
  }

  const result = new Map<string, GecCikisOzet>();
  for (const name of uniqueNames) {
    const acc = byName.get(name.toLowerCase());
    if (acc && acc.total >= MIN_ORNEK) {
      result.set(name, { toplamStart: acc.total, gecCikisSayisi: acc.late, sonFark: acc.lastFark });
    }
  }
  return result;
}
