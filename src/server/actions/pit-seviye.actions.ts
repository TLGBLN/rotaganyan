"use server";
// Jokey/antrenör SEVİYESİ ve "son yarışını kazandı mı" — 2026-11-12 kullanıcı kararı ("tüm
// eksiklerimizi belirle ve ortadan kaldır"). Saf Model (AGF'siz) bu üç bilgiyi hiç taşımıyordu;
// 5 zaman katlı genişleyen-pencereli ölçümde (827 test yarışı) jokey seviyesi tek başına
// ΔLogLoss=-0.069 [-0.090,-0.048], antrenör seviyesi -0.028 [-0.038,-0.018] verdi (5/5 kat).
//
// POINT-IN-TIME: yalnız asOfDate'ten KESİNLİKLE önceki, kendi Runner/Result kayıtlarımızdan
// hesaplanır. TrainerStatSync/JockeyStatSync KULLANILMAZ — onlar üzerine yazılan anlık görüntü
// (geçmiş yarışlar için bugünkü sezon toplamı = hindsight sızıntısı; ölçümde sızıntılı antrenör
// sürümü -0.086 gösterip PIT sürümünün -0.028'ini şişirdi). "karma"/"perak-malezya" hariç
// (karma, gerçek yarışların AYNI sonucunu tekrar sayan mirror — jokey-form.actions.ts ile aynı).
// Supabase'i zorlamamak için jokey-form.actions.ts'teki 30 dakikalık "bir kere çek, bellekte
// filtrele" deseninin aynısı.
import { db } from "@/lib/db";

type Ev = { t: number[]; cum: number[] };
type Endeks = { jEv: Map<string, Ev>; tEv: Map<string, Ev>; hEv: Map<number, Ev>; genelOran: number };

const TTL_MS = 30 * 60 * 1000;
const PENCERE_GUN = 365;
const SHRINK_K = 20;
let onbellek: { endeks: Endeks; zaman: number } | null = null;

function evKur(list: { t: number; won: number }[]): Ev {
  list.sort((a, b) => a.t - b.t);
  const cum: number[] = [0];
  for (const x of list) cum.push(cum[cum.length - 1] + x.won);
  return { t: list.map((x) => x.t), cum };
}

function bisect(a: number[], x: number): number {
  let lo = 0, hi = a.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m; }
  return lo;
}

async function endeksGetir(): Promise<Endeks> {
  if (onbellek && Date.now() - onbellek.zaman < TTL_MS) return onbellek.endeks;
  const jL = new Map<string, { t: number; won: number }[]>();
  const tL = new Map<string, { t: number; won: number }[]>();
  const hL = new Map<number, { t: number; won: number }[]>();
  let toplam = 0, kazanan = 0;
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.runner.findMany({
      where: { scratched: false, race: { result: { isNot: null }, raceDay: { hippodrome: { slug: { notIn: ["karma", "perak-malezya"] } } } } },
      select: { id: true, no: true, jockey: true, trainer: true, tjkAtId: true, race: { select: { raceDay: { select: { date: true } }, result: { select: { winnerNos: true } } } } },
      orderBy: { id: "asc" }, take: 10000, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!batch.length) break;
    for (const b of batch) {
      const t = b.race.raceDay.date.getTime();
      const won = b.race.result?.winnerNos.includes(b.no) ? 1 : 0;
      toplam++; kazanan += won;
      if (b.jockey) (jL.get(b.jockey) ?? jL.set(b.jockey, []).get(b.jockey)!).push({ t, won });
      if (b.trainer) (tL.get(b.trainer) ?? tL.set(b.trainer, []).get(b.trainer)!).push({ t, won });
      if (b.tjkAtId != null) (hL.get(b.tjkAtId) ?? hL.set(b.tjkAtId, []).get(b.tjkAtId)!).push({ t, won });
    }
    cursor = batch[batch.length - 1].id;
  }
  const endeks: Endeks = {
    jEv: new Map([...jL].map(([k, v]) => [k, evKur(v)])),
    tEv: new Map([...tL].map(([k, v]) => [k, evKur(v)])),
    hEv: new Map([...hL].map(([k, v]) => [k, evKur(v)])),
    genelOran: toplam > 0 ? kazanan / toplam : 0.1,
  };
  onbellek = { endeks, zaman: Date.now() };
  return endeks;
}

function seviye(ev: Ev | undefined, t: number, genelOran: number): number | null {
  if (!ev) return null;
  const hi = bisect(ev.t, t);
  const lo = bisect(ev.t, t - PENCERE_GUN * 86400000);
  const rides = hi - lo;
  if (rides <= 0) return null;
  const wins = ev.cum[hi] - ev.cum[lo];
  return ((wins + SHRINK_K * genelOran) / (rides + SHRINK_K)) * 100;
}

export type PitSeviye = { jokeyPIT: number | null; antrenorPIT: number | null; lastWon: 0 | 1 | null };

export async function getPitSeviyeSinyalleri(asOfDate: Date, runnerIds: string[]): Promise<Map<string, PitSeviye>> {
  const out = new Map<string, PitSeviye>();
  if (runnerIds.length === 0) return out;
  const [endeks, meta] = await Promise.all([
    endeksGetir(),
    db.runner.findMany({ where: { id: { in: runnerIds } }, select: { id: true, jockey: true, trainer: true, tjkAtId: true } }),
  ]);
  const t = asOfDate.getTime();
  for (const m of meta) {
    let lastWon: 0 | 1 | null = null;
    const hev = m.tjkAtId != null ? endeks.hEv.get(m.tjkAtId) : undefined;
    if (hev) {
      const hi = bisect(hev.t, t);
      if (hi > 0) lastWon = (hev.cum[hi] - hev.cum[hi - 1]) as 0 | 1;
    }
    out.set(m.id, {
      jokeyPIT: seviye(m.jockey ? endeks.jEv.get(m.jockey) : undefined, t, endeks.genelOran),
      antrenorPIT: seviye(m.trainer ? endeks.tEv.get(m.trainer) : undefined, t, endeks.genelOran),
      lastWon,
    });
  }
  return out;
}
