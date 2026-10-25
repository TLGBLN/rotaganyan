// Accurace veri yükleyici: DB → AccuraceRun listesi (tjkAtId anahtarlı). Yalnız okuma.
import { db } from "@/lib/db";
import { AYAR, lateSegmentLength } from "./features";
import type { AccuraceRun, Breed, Checkpoint, LateReason, Surface } from "./types";

const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const med = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mad = (a: number[]) => { const m = med(a); return m == null ? null : med(a.map((x) => Math.abs(x - m))); };
const gunAnahtari = (d: Date) => d.toISOString().slice(0, 10);

export function yuzeyKodu(raw: string | null | undefined): Surface | null {
  if (!raw) return null;
  if (raw.startsWith("Ç") || raw.startsWith("C")) return "CIM";
  if (raw.startsWith("K")) return "KUM";
  if (raw.startsWith("S")) return "SENTETIK";
  return null;
}

// Stil kovası: ilk çeyrek checkpoint'indeki sıra. 0 = lider, 5 = geride.
export function earlyBinOf(place: number, n: number, cps: Checkpoint[], L: number): number | null {
  if (n < 2 || !cps.length) return null;
  const hedef = L * AYAR.stilErkenOran;
  const yakin = cps.reduce((b, c) => (Math.abs(c.checkpoint - hedef) < Math.abs(b.checkpoint - hedef) ? c : b));
  if (Math.abs(yakin.checkpoint - hedef) > 200) return null;
  if (yakin.place === 1) return 0;
  const r = (yakin.place - 1) / (n - 1);
  if (r <= 0.2) return 1;
  if (r <= 0.4) return 2;
  if (r <= 0.6) return 3;
  if (r <= 0.8) return 4;
  return 5;
}

// Tüm Accurace yarışları → AccuraceRun (tjkAtId'li olanlar).
// LateSegment: yarışın TÜM atları için ortak checkpoint CP_r (aralarındaki kesişim) seçilir;
// hedef = L − min(800, 0.5L)'ye en yakın ortak nokta. Ortak nokta yoksa geç skor yok (NO_COMMON_CHECKPOINT).
export async function accuraceKosulari(options: { fromDate?: Date } = {}): Promise<AccuraceRun[]> {
  // Varsayılan tam-arşiv okuyucu birebir korunur. RCA yenilemesi yalnız eski
  // snapshot gününden sonraki yarışları yeniden oluşturmak için filtre verir.
  const arsiv = await db.accuraceRace.findMany({
    ...(options.fromDate ? { where: { date: { gte: options.fromDate } } } : {}),
    select: {
      id: true, date: true, length: true, ground: true, hippodrome: true,
      race: { select: { breed: true } },
      splits: { where: { runnerId: { not: null } }, select: { runnerId: true, horseName: true, place: true, finishTimeReal: true, checkpoints: true } },
    },
  });
  const runnerIds = [...new Set(arsiv.flatMap((a) => a.splits.map((s) => s.runnerId!)))];
  const tjkOf = new Map<string, number>();
  for (const c of chunk(runnerIds, 1000)) for (const x of await db.runner.findMany({ where: { id: { in: c } }, select: { id: true, tjkAtId: true } })) if (x.tjkAtId != null) tjkOf.set(x.id, x.tjkAtId);

  // Pist durumu: TJK detaylı derece kaydı (at adı + tarih). Yarış düzeyinde en sık değer.
  const tarihler = arsiv.map((a) => a.date.getTime());
  const goingMap = new Map<string, string>(); // "gün|atAdi" → pistDurumu
  if (tarihler.length) {
    const kayit = await db.tjkDereceKaydi.findMany({
      where: { tarih: { gte: new Date(Math.min(...tarihler)), lte: new Date(Math.max(...tarihler)) } },
      select: { atAdi: true, tarih: true, pistDurumu: true },
    });
    for (const k of kayit) if (k.tarih) goingMap.set(`${gunAnahtari(k.tarih)}|${k.atAdi}`, k.pistDurumu);
  }

  const out: AccuraceRun[] = [];
  for (const a of arsiv) {
    const L = a.length ?? 0;
    if (!L || !a.splits.length) continue;
    const n = a.splits.length;
    const gun = gunAnahtari(a.date);

    // Tjk-eşleşmiş ve checkpoint'i olan splitler
    const adaylar = a.splits
      .map((s) => {
        const tjk = tjkOf.get(s.runnerId!);
        const cps = ((s.checkpoints as unknown) as Checkpoint[]) ?? [];
        if (tjk == null || !Array.isArray(cps) || !cps.length) return null;
        return { s, tjk, cps: [...cps].sort((x, y) => x.checkpoint - y.checkpoint) };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    // Ortak checkpoint kümesi (kesişim)
    let ortak: number[] = [];
    adaylar.forEach((c, i) => {
      const set = new Set(c.cps.map((x) => x.checkpoint));
      ortak = i === 0 ? [...set] : ortak.filter((x) => set.has(x));
    });
    const hedefSeg = L - lateSegmentLength(L);
    let cpR: number | null = null;
    if (ortak.length) {
      cpR = ortak.reduce((b, c) => (Math.abs(c - hedefSeg) < Math.abs(b - hedefSeg) ? c : b));
    }

    // Geç segment ham süreleri (yalnız ortak CP_r'de gözlemli olanlar)
    const lateHam = adaylar.map((c) => {
      if (cpR == null) return null;
      const t = c.cps.find((x) => x.checkpoint === cpR);
      return t ? c.s.finishTimeReal - t.timeReal : null;
    });
    const gozlemliler = lateHam.filter((x): x is number => x != null);
    const m = med(gozlemliler), md = mad(gozlemliler);
    let reason: LateReason | null = null;
    if (cpR == null) reason = "NO_COMMON_CHECKPOINT";
    else if (gozlemliler.length < AYAR.lateMinN || md == null || md <= AYAR.lateMadMinMs) reason = "NO_LATE_SCALE";

    const breed: Breed | null = (a.race?.breed as Breed | undefined) ?? null;
    const yuz = yuzeyKodu(a.ground);

    adaylar.forEach((c, i) => {
      const ms = lateHam[i];
      const skor = reason == null && ms != null && m != null && md != null ? (m - ms) / (1.4826 * md) : null;
      const goingDeger = goingMap.get(`${gun}|${c.s.horseName}`) ?? null;
      const cps = c.cps;
      out.push({
        tjk: c.tjk,
        date: a.date,
        length: L,
        surface: yuz,
        breed,
        hippodrome: a.hippodrome ?? null,
        going: goingDeger,
        place: c.s.place,
        fieldSize: n,
        finishMs: c.s.finishTimeReal,
        checkpoints: cps,
        lateSegMs: ms,
        lateSegScore: skor,
        lateSegReason: ms == null ? reason ?? "NO_COMMON_CHECKPOINT" : reason,
        earlyBin: earlyBinOf(c.s.place, n, cps, L),
      });
    });
  }
  return out;
}

// Atın tjkAtId'si: yarış girişinden
export async function tjkAtIdOf(runnerIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const c of chunk(runnerIds, 1000)) for (const x of await db.runner.findMany({ where: { id: { in: c } }, select: { id: true, tjkAtId: true } })) if (x.tjkAtId != null) out.set(x.id, x.tjkAtId);
  return out;
}
