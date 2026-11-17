// KALICI ARAÇ — HAM VERİ ENVANTERİ (SALT-OKUMA). Kullanıcı talimatı 2026-11-17: YALNIZ envanter; SİNYAL, PUAN, KATSAYI, MODEL EĞİTİMİ, OTOMATİK ÖZELLİK SEÇİMİ YOK.
// Kapsam: /admin/kosu-tipleri sayfasındaki yarışlar (sonuçlanmış, yayınlanmış tahminli, createdAt ≥ GUNCEL_MOTOR_BASLANGIC, conditions=null). Her veri için: kaynak, tarihsel kapsam, eksiklik oranı, yarış öncesi kullanılabilirlik.
// AGF yalnız "var/yok" doluluk olarak raporlanır (kullanıcı kararı 2026-11-14: AGF modele/analize girmez). Çıktı: HAM-VERI-ENVANTERI-2026-11-17.md
import fs from "node:fs";
import { db } from "./src/lib/db";
import { GUNCEL_MOTOR_BASLANGIC, normalizeClassType } from "./src/server/services/admin.service";

const out: string[] = []; const P = (s = "") => { out.push(s); };
const yuz = (a: number, b: number) => (b ? (a / b * 100).toFixed(1) + "%" : "—");
const tStr = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? "—" : String(v).slice(0, 10));
const dolu = (v: unknown) => v != null && !(typeof v === "string" && v.trim() === "") && !(Array.isArray(v) && v.length === 0);
const kaba = (t: string) => { const u = t.toUpperCase(); return u.includes("MAIDEN") ? "Maiden" : u.includes("ŞARTLI") ? "Şartlı" : u.includes("HANDIKAP") ? "Handikap" : u.startsWith("KV") ? "KV" : /^G \d/.test(u) ? "Grup" : u.includes("SATIŞ") ? "Satış" : "Diğer"; };
const KABA = ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış", "Diğer"];
const pct = (a: number[], q: number) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]!; };
const trTarih = (d: string) => { const [g, a, y] = String(d).split("."); return Date.UTC(+y, +a - 1, +g); };
const gunBasi = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

async function main() {
  // ── Popülasyon ──
  const sonuc = await db.result.findMany({ where: { race: { prediction: { published: true, createdAt: { gte: GUNCEL_MOTOR_BASLANGIC } }, conditions: null } }, select: { race: { select: { id: true } } } });
  const ids = sonuc.map((r) => r.race.id);
  type R = Awaited<ReturnType<typeof yukle>>[number]; async function yukle(parca: string[]) { return db.race.findMany({ where: { id: { in: parca } }, select: { id: true, raceNo: true, classType: true, breed: true, surface: true, distance: true, ageWeight: true, time: true, raceDay: { select: { date: true, hippodrome: { select: { slug: true, name: true } } } },
    result: { select: { actualOrder: true, winnerNos: true, ganyan: true, time: true, farklar: true, gecCikanlar: true, cikan: true } },
    runners: { select: { id: true, no: true, name: true, sire: true, dam: true, damSire: true, jockey: true, trainer: true, startNo: true, disaridanStart: true, weight: true, weightChange: true, equipment: true, equipmentAdded: true, equipmentRemoved: true, sameJockey: true, agf: true, raceStyle: true, recentForm: true, jockeyChanged: true, previousJockey: true, age: true, owner: true, hp: true, bestTime: true, recentFormSurfaces: true, scratched: true, ekuriGroup: true, apprentice: true, tjkAtId: true, tjkKgs: true } } } }); }
  const races: R[] = []; for (let i = 0; i < ids.length; i += 150) races.push(...(await yukle(ids.slice(i, i + 150))));
  const tarihOf = (r: R) => gunBasi(r.raceDay.date); const tip = (r: R) => normalizeClassType(r.classType);
  const kosanlar = races.flatMap((r) => r.runners.filter((x) => !x.scratched).map((x) => ({ r, x })));

  P("# HAM VERİ ENVANTERİ — " + new Date().toISOString().slice(0, 10));
  P("**Yalnız envanter.** Sinyal, puan, katsayı, model eğitimi ve otomatik özellik seçimi YOKTUR. Kapsam: `/admin/kosu-tipleri` sayfasındaki yarışlar. AGF yalnız doluluk olarak sayılır (modele/analize girmez).");
  P("Üretim: " + new Date().toISOString() + " | Popülasyon filtresi: sonuçlanmış + yayınlanmış tahmin (createdAt ≥ " + GUNCEL_MOTOR_BASLANGIC.toISOString().slice(0, 10) + ") + conditions=null.\n");

  // ── 1. Toplam kayıtlı yarış ──
  const [nRace, nRaceDay, nResult, nRunner] = await Promise.all([db.race.count(), db.raceDay.count(), db.result.count(), db.runner.count()]);
  const rdAgg = await db.raceDay.aggregate({ _min: { date: true }, _max: { date: true } });
  const tarihler = races.map((r) => r.raceDay.date.toISOString().slice(0, 10)).sort();
  P("## 1. Toplam kayıtlı yarış");
  P("| Kapsam | Sayı | Tarih aralığı |"); P("|---|---|---|");
  P("| Veritabanında tüm yarış (Race) | " + nRace + " | " + rdAgg._min.date?.toISOString().slice(0, 10) + " → " + rdAgg._max.date?.toISOString().slice(0, 10) + " |");
  P("| Sonucu girilmiş (Result) | " + nResult + " | |"); P("| Tüm at kaydı (Runner) | " + nRunner + " | |");
  P("| **Sayfa popülasyonu (bu envanterin kapsamı)** | **" + races.length + "** | " + tarihler[0] + " → " + tarihler[tarihler.length - 1] + " |");
  P("| Sayfa: çekilmeyen (non-scratched) at sayısı | " + kosanlar.length + " | |\n");
  const say = (f: (r: R) => string) => { const m = new Map<string, number>(); for (const r of races) { const k = f(r); m.set(k, (m.get(k) ?? 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]); };
  P("**Koşu türüne göre (normalize):** " + say(tip).map(([k, v]) => k + " " + v).join(" · "));
  P("\n**Kaba gruba göre:** " + KABA.map((k) => k + " " + races.filter((r) => kaba(tip(r)) === k).length).join(" · "));
  P("\n**Hipodrom:** " + say((r) => r.raceDay.hippodrome.name).map(([k, v]) => k + " " + v).join(" · "));
  P("\n**Yüzey:** " + say((r) => r.surface).map(([k, v]) => k + " " + v).join(" · ") + " | **Irk:** " + say((r) => r.breed).map(([k, v]) => k + " " + v).join(" · "));
  P("\n**Mesafe kovası:** " + say((r) => (r.distance < 1200 ? "<1200" : r.distance <= 1400 ? "1200-1400" : r.distance <= 1800 ? "1500-1800" : r.distance <= 2200 ? "1900-2200" : ">2200")).map(([k, v]) => k + " " + v).join(" · "));
  const saha = races.map((r) => r.runners.filter((x) => !x.scratched).length); P("\n**Saha büyüklüğü (çekilmeyen at):** min " + Math.min(...saha) + ", medyan " + pct(saha, 0.5) + ", maks " + Math.max(...saha) + ", ort. " + (saha.reduce((p, q) => p + q, 0) / saha.length).toFixed(1));
  P("\n**Aylık yarış sayısı:** " + [...new Set(tarihler.map((t) => t.slice(0, 7)))].map((m) => m + ": " + tarihler.filter((t) => t.startsWith(m)).length).join(" · ") + "\n");

  // ── 2. At bazlı program alanları (Runner) ──
  P("## 2. At bazlı kayıt alanları (Runner) — doluluk (çekilmeyen atlar, N=" + kosanlar.length + ")");
  const ALAN: [string, (x: R["runners"][number]) => unknown, string][] = [
    ["name (at adı)", (x) => x.name, "program"], ["tjkAtId (TJK at kimliği)", (x) => x.tjkAtId, "program/eşleştirme"], ["age (yaş-renk-cins metni)", (x) => x.age, "program"], ["jockey", (x) => x.jockey, "program"], ["trainer", (x) => x.trainer, "program"], ["owner", (x) => x.owner, "program"],
    ["startNo (kulvar/start sırası)", (x) => x.startNo, "program"], ["weight (kilo)", (x) => x.weight, "program"], ["weightChange", (x) => x.weightChange, "program"], ["hp (handikap puanı)", (x) => x.hp, "program (yalnız handikap)"], ["equipment (takı)", (x) => x.equipment, "program"], ["recentForm (son derece dizisi)", (x) => x.recentForm, "program"], ["recentFormSurfaces", (x) => x.recentFormSurfaces, "program"],
    ["tjkKgs (son koşudan gün)", (x) => x.tjkKgs, "program"], ["bestTime (en iyi derece)", (x) => x.bestTime, "program"], ["sire", (x) => x.sire, "program"], ["dam", (x) => x.dam, "program"], ["damSire", (x) => x.damSire, "program"], ["previousJockey", (x) => x.previousJockey, "program"], ["ekuriGroup", (x) => x.ekuriGroup, "program"], ["raceStyle (koşu stili önbelleği)", (x) => x.raceStyle, "TÜRETİLMİŞ (analiz sonucu)"], ["agf (yalnız doluluk)", (x) => x.agf, "piyasa — modele/analize girmez"],
  ];
  P("| Alan | Genel doluluk | " + KABA.join(" | ") + " | Not |"); P("|---|---|" + KABA.map(() => "---").join("|") + "|---|");
  for (const [ad, f, not] of ALAN) P("| " + ad + " | " + yuz(kosanlar.filter((k) => dolu(f(k.x))).length, kosanlar.length) + " | " + KABA.map((g) => { const s = kosanlar.filter((k) => kaba(tip(k.r)) === g); return s.length ? yuz(s.filter((k) => dolu(f(k.x))).length, s.length) : "—"; }).join(" | ") + " | " + not + " |");
  P("\nBoolean alanlar (true oranı): jockeyChanged " + yuz(kosanlar.filter((k) => k.x.jockeyChanged).length, kosanlar.length) + " · sameJockey " + yuz(kosanlar.filter((k) => k.x.sameJockey).length, kosanlar.length) + " · apprentice " + yuz(kosanlar.filter((k) => k.x.apprentice).length, kosanlar.length) + " · disaridanStart " + yuz(kosanlar.filter((k) => k.x.disaridanStart).length, kosanlar.length) + " · çekilen at (scratched) " + yuz(races.flatMap((r) => r.runners).filter((x) => x.scratched).length, races.flatMap((r) => r.runners).length));
  P("\n**Not:** `Runner` tablosunda güncellenme zamanı alanı YOKTUR; program alanlarının yarış öncesi ilk haliyle mi yoksa sonradan değişmiş haliyle mi saklandığı kayıttan doğrulanamaz (bkz. bölüm 9).\n");

  // ── 3. Yarış sonuçları / dereceler ──
  P("## 3. Yarış sonuçları ve dereceler (Result)");
  const rr = races.filter((r) => r.result); const sahaOf = (r: R) => r.runners.filter((x) => !x.scratched).length;
  const alen = rr.map((r) => (Array.isArray(r.result!.actualOrder) ? (r.result!.actualOrder as unknown[]).length : 0));
  P("| Alan | Dolu yarış | Oran |"); P("|---|---|---|");
  P("| Sonuç kaydı | " + rr.length + " / " + races.length + " | " + yuz(rr.length, races.length) + " |");
  P("| actualOrder (bitiş sırası) boş değil | " + alen.filter((n) => n > 0).length + " | " + yuz(alen.filter((n) => n > 0).length, races.length) + " |");
  P("| actualOrder TÜM çekilmeyen atları kapsıyor | " + rr.filter((r, i) => alen[i]! >= sahaOf(r)).length + " | " + yuz(rr.filter((r, i) => alen[i]! >= sahaOf(r)).length, rr.length) + " |");
  P("| winnerNos | " + rr.filter((r) => r.result!.winnerNos.length > 0).length + " | " + yuz(rr.filter((r) => r.result!.winnerNos.length > 0).length, rr.length) + " |");
  P("| ganyan ikramiyesi | " + rr.filter((r) => r.result!.ganyan != null).length + " | " + yuz(rr.filter((r) => r.result!.ganyan != null).length, rr.length) + " |");
  P("| time (kazanan derecesi) | " + rr.filter((r) => dolu(r.result!.time)).length + " | " + yuz(rr.filter((r) => dolu(r.result!.time)).length, rr.length) + " |");
  P("| farklar (aralar) | " + rr.filter((r) => dolu(r.result!.farklar)).length + " | " + yuz(rr.filter((r) => dolu(r.result!.farklar)).length, rr.length) + " |");
  P("| gecCikanlar | " + rr.filter((r) => dolu(r.result!.gecCikanlar)).length + " | " + yuz(rr.filter((r) => dolu(r.result!.gecCikanlar)).length, rr.length) + " |");
  P("| Çok kazananlı (ölü yarış) yarış | " + rr.filter((r) => r.result!.winnerNos.length > 1).length + " | " + yuz(rr.filter((r) => r.result!.winnerNos.length > 1).length, rr.length) + " |");
  P("\n**At bazında bitiş sırası:** `actualOrder` yalnız at NUMARALARININ bitiş sırasıdır; at başına bitiş SÜRESİ bu tabloda YOK (yalnız kazanan derecesi `time`). At başına süre kaynakları: Accurace (`finishTimeReal`, bölüm 5), TJK geçmiş satırları (`HorseRaceHistoryCache.rowsJson`, bölüm 4) ve `TjkDereceKaydi` (bölüm 7).\n");

  // ── 4. At geçmişi önbelleği ──
  P("## 4. At geçmişi (HorseRaceHistoryCache — TJK \"At Koşu Bilgileri\")");
  const atIds = [...new Set(kosanlar.map((k) => k.x.tjkAtId).filter((v): v is number => v != null))];
  const tarihByAt = new Map<number, number[]>(); for (const k of kosanlar) if (k.x.tjkAtId != null) (tarihByAt.get(k.x.tjkAtId) ?? tarihByAt.set(k.x.tjkAtId, []).get(k.x.tjkAtId)!).push(tarihOf(k.r));
  const anahtar = new Map<string, number>(); let satirToplam = 0; const onceki: number[] = []; const onceki365: number[] = []; let cacheVar = 0, cacheSonra = 0, enEski = Infinity, enYeni = 0; const cacheUpd = new Map<number, number>(); const hasHistory = new Set<string>();
  const histAtByRace = new Map<string, number>(); // raceId|no -> önceki satır sayısı
  for (let i = 0; i < atIds.length; i += 120) { const c = await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: atIds.slice(i, i + 120) } }, select: { tjkAtId: true, rowsJson: true, updatedAt: true } });
    for (const h of c) { cacheVar++; cacheUpd.set(h.tjkAtId, h.updatedAt.getTime()); const rows = (h.rowsJson as Record<string, unknown>[]) ?? []; satirToplam += rows.length;
      for (const row of rows) { for (const [k, v] of Object.entries(row)) if (dolu(v)) anahtar.set(k, (anahtar.get(k) ?? 0) + 1); const t = row.date ? trTarih(String(row.date)) : NaN; if (Number.isFinite(t)) { enEski = Math.min(enEski, t); enYeni = Math.max(enYeni, t); } }
      for (const t of tarihByAt.get(h.tjkAtId) ?? []) { const once = rows.filter((row) => row.date && trTarih(String(row.date)) < t); onceki.push(once.length); onceki365.push(once.filter((row) => trTarih(String(row.date)) >= t - 365 * 86400000).length); } } }
  for (const [, ts] of tarihByAt) void ts;
  for (const k of kosanlar) { const u = k.x.tjkAtId != null ? cacheUpd.get(k.x.tjkAtId) : undefined; if (u != null && u > tarihOf(k.r) + 86400000) cacheSonra++; }
  P("| Ölçü | Değer |"); P("|---|---|");
  P("| Sayfadaki atlarda `tjkAtId` dolu olan benzersiz at | " + atIds.length + " |"); P("| Bunlardan geçmiş önbelleği olan | " + cacheVar + " (" + yuz(cacheVar, atIds.length) + ") |");
  P("| Toplam geçmiş satırı | " + satirToplam + " (en eski " + new Date(enEski).toISOString().slice(0, 10) + ", en yeni " + new Date(enYeni).toISOString().slice(0, 10) + ") |");
  P("| Yarış gününden ÖNCEKİ geçmiş satırı (at-yarış başına): medyan / %25 / %75 / maks | " + pct(onceki, 0.5) + " / " + pct(onceki, 0.25) + " / " + pct(onceki, 0.75) + " / " + Math.max(...onceki) + " |");
  P("| Önceki satırı HİÇ olmayan (at-yarış) | " + yuz(onceki.filter((n) => n === 0).length, onceki.length) + " |"); P("| Son 365 günde ≥1 önceki satır olan | " + yuz(onceki365.filter((n) => n > 0).length, onceki365.length) + " |");
  P("| Önbelleği yarış gününden SONRA güncellenmiş at-yarış (önbellek yarışın kendisini/sonrasını içerebilir; tarih filtresi şart) | " + yuz(cacheSonra, kosanlar.filter((k) => k.x.tjkAtId != null).length) + " |");
  P("\n**Satır alanları ve doluluk** (toplam " + satirToplam + " satır): " + [...anahtar].sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + yuz(v, satirToplam)).join(" · ") + "\n");
  const tjkIdli = kosanlar.filter((k) => k.x.tjkAtId != null).length; P("Sayfa at-yarışlarında `tjkAtId` dolu: " + yuz(tjkIdli, kosanlar.length) + " (eşleşmeyen atların TJK geçmişi/pedigri/at istatistiği bağlanamaz).\n");

  // ── 5. Accurace ──
  P("## 5. Accurace (sektörel/ara zamanlar)");
  const acc: { raceId: string; fetchedAt: Date; length: number | null; ground: string | null; splits: { horseNumber: number; finishTimeReal: number; checkpoints: unknown }[] }[] = [];
  for (let i = 0; i < ids.length; i += 150) acc.push(...(await db.accuraceRace.findMany({ where: { raceId: { in: ids.slice(i, i + 150) } }, select: { raceId: true, fetchedAt: true, length: true, ground: true, splits: { select: { horseNumber: true, finishTimeReal: true, checkpoints: true } } } })) as never);
  const accBy = new Map(acc.map((a) => [a.raceId!, a])); const cpSay: number[] = []; const cpMesafe = new Map<string, number>(); let finishDolu = 0, splitToplam = 0, atAcc = 0;
  for (const a of acc) for (const s of a.splits) { splitToplam++; if (s.finishTimeReal > 0) finishDolu++; const cps = (s.checkpoints as { checkpoint?: number }[]) ?? []; cpSay.push(cps.length); for (const c of cps) { const k = String(c.checkpoint ?? "?"); cpMesafe.set(k, (cpMesafe.get(k) ?? 0) + 1); } }
  for (const k of kosanlar) { const a = accBy.get(k.r.id); if (a && a.splits.some((s) => s.horseNumber === k.x.no)) atAcc++; }
  P("| Ölçü | Değer |"); P("|---|---|"); P("| Accurace kaydı olan sayfa yarışı | " + acc.length + " / " + races.length + " (" + yuz(acc.length, races.length) + ") |"); P("| At bazında split olan (at-yarış) | " + atAcc + " / " + kosanlar.length + " (" + yuz(atAcc, kosanlar.length) + ") |");
  P("| Toplam at-split | " + splitToplam + " | | `finishTimeReal` > 0 | " + yuz(finishDolu, splitToplam) + " |"); P("| At başına checkpoint sayısı: medyan / min / maks | " + pct(cpSay, 0.5) + " / " + Math.min(...cpSay) + " / " + Math.max(...cpSay) + " |");
  P("| Checkpoint mesafeleri (en sık 14) | " + [...cpMesafe].sort((a, b) => b[1] - a[1]).slice(0, 14).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k]) => k).join(", ") + " |");
  P("| Kayıt alınma zamanı (fetchedAt) yarış gününden sonra olan yarış | " + yuz(acc.filter((a) => { const r = races.find((x) => x.id === a.raceId); return r && a.fetchedAt.getTime() > tarihOf(r) + 86400000; }).length, acc.length) + " (Accurace yarış BİTTİKTEN sonra yayınlanır; geçmiş yarış için kullanılabilir, o yarışın KENDİ ara zamanları o yarış için kullanılamaz) |");
  P("\n**Hipodrom bazında Accurace kapsamı:** " + [...new Set(races.map((r) => r.raceDay.hippodrome.name))].map((h) => { const rs = races.filter((r) => r.raceDay.hippodrome.name === h); return h + " " + yuz(rs.filter((r) => accBy.has(r.id)).length, rs.length); }).join(" · "));
  P("\n**Koşu türü (kaba) bazında:** " + KABA.map((g) => { const rs = races.filter((r) => kaba(tip(r)) === g); return rs.length ? g + " " + yuz(rs.filter((r) => accBy.has(r.id)).length, rs.length) : ""; }).filter(Boolean).join(" · ") + "\n");

  // ── 6. Jokey / antrenör ──
  P("## 6. Jokey ve antrenör geçmişi");
  const tumRunner: { j: string | null; t: string | null; a: number | null; d: number }[] = []; let cursor: string | undefined;
  for (;;) { const b = await db.runner.findMany({ where: { scratched: false, race: { result: { isNot: null }, raceDay: { hippodrome: { slug: { notIn: ["karma", "perak-malezya"] } } } } }, select: { id: true, jockey: true, trainer: true, tjkAtId: true, race: { select: { raceDay: { select: { date: true } } } } }, orderBy: { id: "asc" }, take: 10000, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}) }); if (!b.length) break; for (const x of b) tumRunner.push({ j: x.jockey, t: x.trainer, a: x.tjkAtId, d: gunBasi(x.race.raceDay.date) }); cursor = b[b.length - 1]!.id; await new Promise((q) => setTimeout(q, 300)); }
  const idx = (key: (x: (typeof tumRunner)[number]) => string | number | null) => { const m = new Map<string | number, number[]>(); for (const x of tumRunner) { const k = key(x); if (k != null) (m.get(k) ?? m.set(k, []).get(k)!).push(x.d); } for (const v of m.values()) v.sort((a, b) => a - b); return m; };
  const bs = (a: number[], t: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m]! < t) lo = m + 1; else hi = m; } return lo; };
  const jI = idx((x) => x.j), tI = idx((x) => x.t), aI = idx((x) => x.a);
  const derinlik = (m: Map<string | number, number[]>, f: (x: R["runners"][number]) => string | number | null) => kosanlar.map((k) => { const key = f(k.x); const a = key == null ? undefined : m.get(key); return a ? bs(a, tarihOf(k.r)) : 0; });
  const dj = derinlik(jI, (x) => x.jockey), dt = derinlik(tI, (x) => x.trainer), da = derinlik(aI, (x) => x.tjkAtId);
  P("Kaynak: kendi `Runner`+`Result` kayıtlarımız (sonuçlanmış, karma/perak hariç; veri " + new Date(Math.min(...tumRunner.map((x) => x.d))).toISOString().slice(0, 10) + " → " + new Date(Math.max(...tumRunner.map((x) => x.d))).toISOString().slice(0, 10) + "). Aşağıdaki sayılar, yarış gününden ÖNCE veritabanımızda kaç binişin kayıtlı olduğunu gösterir (as-of).");
  P("| Varlık | Doluluk | Yarış öncesi kayıtlı biniş: medyan / %25 / %75 | Hiç önceki kaydı olmayan |"); P("|---|---|---|---|");
  P("| Jokey | " + yuz(kosanlar.filter((k) => dolu(k.x.jockey)).length, kosanlar.length) + " | " + pct(dj, 0.5) + " / " + pct(dj, 0.25) + " / " + pct(dj, 0.75) + " | " + yuz(dj.filter((n) => n === 0).length, dj.length) + " |");
  P("| Antrenör | " + yuz(kosanlar.filter((k) => dolu(k.x.trainer)).length, kosanlar.length) + " | " + pct(dt, 0.5) + " / " + pct(dt, 0.25) + " / " + pct(dt, 0.75) + " | " + yuz(dt.filter((n) => n === 0).length, dt.length) + " |");
  P("| At (tjkAtId, kendi kayıtlarımızda) | " + yuz(tjkIdli, kosanlar.length) + " | " + pct(da, 0.5) + " / " + pct(da, 0.25) + " / " + pct(da, 0.75) + " | " + yuz(da.filter((n) => n === 0).length, da.length) + " |");
  const [js, ts] = await Promise.all([db.jockeyStatSync.aggregate({ _count: true, _min: { updatedAt: true, year: true }, _max: { updatedAt: true, year: true } }), db.trainerStatSync.aggregate({ _count: true, _min: { updatedAt: true, year: true }, _max: { updatedAt: true, year: true } })]);
  P("\n**TJK jokey/antrenör istatistik tabloları:** `JockeyStatSync` " + js._count + " satır (yıl " + js._min.year + "–" + js._max.year + ", güncellenme " + js._min.updatedAt?.toISOString().slice(0, 10) + " → " + js._max.updatedAt?.toISOString().slice(0, 10) + "); `TrainerStatSync` " + ts._count + " satır (yıl " + ts._min.year + "–" + ts._max.year + ", güncellenme " + ts._min.updatedAt?.toISOString().slice(0, 10) + " → " + ts._max.updatedAt?.toISOString().slice(0, 10) + "). Bunlar YILLIK TOPLAMLARDIR ve her yenilemede ÜZERİNE YAZILIR → geçmiş bir yarış günündeki değeri saklamazlar (bölüm 9).\n");

  // ── 7. Galop ve pedigri ──
  P("## 7. Galop ve pedigri");
  const runnerIds = kosanlar.map((k) => k.x.id); const galByRunner = new Map<string, { t: number; form: string | null; track: string | null; spl: Record<string, unknown> }[]>(); const anahtarG = new Map<string, number>(); let galToplam = 0, galGelecek = 0;
  for (let i = 0; i < runnerIds.length; i += 1500) for (const g of await db.gallop.findMany({ where: { runnerId: { in: runnerIds.slice(i, i + 1500) } }, select: { runnerId: true, date: true, form: true, track: true, jockey: true, splits: true } })) { galToplam++; const s = (g.splits ?? {}) as Record<string, unknown>; for (const [k, v] of Object.entries(s)) if (dolu(v)) anahtarG.set(k, (anahtarG.get(k) ?? 0) + 1); (galByRunner.get(g.runnerId) ?? galByRunner.set(g.runnerId, []).get(g.runnerId)!).push({ t: gunBasi(g.date), form: g.form, track: g.track, spl: s }); }
  const galOnce = (k: (typeof kosanlar)[number], gun: number | null) => (galByRunner.get(k.x.id) ?? []).filter((g) => g.t < tarihOf(k.r) && (gun == null || tarihOf(k.r) - g.t <= gun * 86400000)).length;
  for (const k of kosanlar) for (const g of galByRunner.get(k.x.id) ?? []) if (g.t > tarihOf(k.r)) galGelecek++;
  P("**Galop (Gallop tablosu):** sayfa atlarına bağlı galop kaydı " + galToplam + "; alanlar: tarih, track (tür), surface, jockey, form (efor kodu), splits(JSON). Galop JSON anahtarlarının doluluğu: " + [...anahtarG].sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + yuz(v, galToplam)).join(" · "));
  P("\n| Galop kapsamı (sayfa at-yarışları) | Oran |"); P("|---|---|"); P("| Yarış gününden ÖNCE ≥1 galop kaydı | " + yuz(kosanlar.filter((k) => galOnce(k, null) > 0).length, kosanlar.length) + " |"); P("| Son 14 günde ≥1 | " + yuz(kosanlar.filter((k) => galOnce(k, 14) > 0).length, kosanlar.length) + " |"); P("| Son 30 günde ≥1 | " + yuz(kosanlar.filter((k) => galOnce(k, 30) > 0).length, kosanlar.length) + " |");
  P("| Galop tarihi YARIŞ GÜNÜNDEN SONRA olan kayıt (veri girişi hatası şüphesi) | " + galGelecek + " |");
  P("\n**Koşu türü (kaba) bazında son-14-gün galop kapsamı:** " + KABA.map((g) => { const s = kosanlar.filter((k) => kaba(tip(k.r)) === g); return s.length ? g + " " + yuz(s.filter((k) => galOnce(k, 14) > 0).length, s.length) : ""; }).filter(Boolean).join(" · "));
  const [hp, exp, tjkp, snap, sireO, damO] = await Promise.all([db.horsePedigree.aggregate({ _count: true, _min: { updatedAt: true }, _max: { updatedAt: true } }), db.externalPedigreeStat.aggregate({ _count: true, _min: { capturedAt: true, year: true }, _max: { capturedAt: true, year: true } }), db.tjkPedigriStat.aggregate({ _count: true }), db.tjkPedigriSnapshot.findMany({ select: { snapshotDate: true, rowCount: true }, orderBy: { snapshotDate: "asc" } }), db.sireStatOwn.count(), db.damStatOwn.count()]);
  const hpIds = new Set<number>(); for (let i = 0; i < atIds.length; i += 800) for (const h of await db.horsePedigree.findMany({ where: { tjkAtId: { in: atIds.slice(i, i + 800) } }, select: { tjkAtId: true } })) hpIds.add(h.tjkAtId);
  const stIds = new Set<number>(); const stUpd = new Map<number, number>(); for (let i = 0; i < atIds.length; i += 800) for (const h of await db.horseStatsCache.findMany({ where: { tjkAtId: { in: atIds.slice(i, i + 800) } }, select: { tjkAtId: true, updatedAt: true } })) { stIds.add(h.tjkAtId); stUpd.set(h.tjkAtId, h.updatedAt.getTime()); }
  P("\n**Pedigri (soy):**"); P("| Kaynak | Ölçü |"); P("|---|---|");
  P("| Runner sire / dam / damSire (program alanı) | " + yuz(kosanlar.filter((k) => dolu(k.x.sire)).length, kosanlar.length) + " / " + yuz(kosanlar.filter((k) => dolu(k.x.dam)).length, kosanlar.length) + " / " + yuz(kosanlar.filter((k) => dolu(k.x.damSire)).length, kosanlar.length) + " |");
  P("| `HorsePedigree` (soy ağacı JSON) | toplam " + hp._count + "; sayfa atlarından " + hpIds.size + " / " + atIds.length + " (" + yuz(hpIds.size, atIds.length) + "); güncellenme " + hp._min.updatedAt?.toISOString().slice(0, 10) + " → " + hp._max.updatedAt?.toISOString().slice(0, 10) + " |");
  P("| `ExternalPedigreeStat` (manuel/harici soy istatistiği) | " + exp._count + " satır; yıl " + exp._min.year + "–" + exp._max.year + "; capturedAt " + tStr(exp._min.capturedAt) + " → " + tStr(exp._max.capturedAt) + " |");
  P("| `TjkPedigriStat` (TJK yaş/pist kırılımlı soy istatistiği) | " + tjkp._count + " satır |");
  P("| `TjkPedigriSnapshot` (günlük görüntü arşivi) | " + snap.length + " gün: " + (snap.map((s) => s.snapshotDate).join(", ") || "yok") + " → yarış-öncesi görüntüsü olan sayfa yarışı: " + yuz(races.filter((r) => snap.some((s) => s.snapshotDate <= r.raceDay.date.toISOString().slice(0, 10))).length, races.length) + " |");
  P("| `SireStatOwn` / `DamStatOwn` (kendi verimizden) | " + sireO + " / " + damO + " satır |");
  P("| `HorseStatsCache` (at kariyer istatistiği JSON) | sayfa atlarından " + stIds.size + " / " + atIds.length + " (" + yuz(stIds.size, atIds.length) + "); yarış gününden SONRA güncellenmiş at-yarış: " + yuz(kosanlar.filter((k) => k.x.tjkAtId != null && (stUpd.get(k.x.tjkAtId) ?? 0) > tarihOf(k.r) + 86400000).length, kosanlar.filter((k) => k.x.tjkAtId != null && stUpd.has(k.x.tjkAtId)).length) + " |");
  const dr = await db.tjkDereceKaydi.aggregate({ _count: true, _min: { tarih: true }, _max: { tarih: true } });
  P("| `TjkDereceKaydi` (TJK derece istatistik arşivi) | " + dr._count + " satır; tarih " + dr._min.tarih?.toISOString().slice(0, 10) + " → " + dr._max.tarih?.toISOString().slice(0, 10) + " |\n");

  // ── 8. Eksik veri matrisi ──
  P("## 8. Eksik veri matrisi (koşu türü kaba grubu × alan; DOLULUK oranı)");
  const MATRIS: [string, (k: (typeof kosanlar)[number]) => boolean][] = [["recentForm", (k) => dolu(k.x.recentForm)], ["tjkKgs", (k) => k.x.tjkKgs != null], ["hp", (k) => k.x.hp != null], ["weight", (k) => k.x.weight != null], ["age", (k) => dolu(k.x.age)], ["jockey", (k) => dolu(k.x.jockey)], ["trainer", (k) => dolu(k.x.trainer)], ["sire", (k) => dolu(k.x.sire)], ["tjkAtId", (k) => k.x.tjkAtId != null],
    ["geçmiş satırı (yarış öncesi ≥1)", (k) => k.x.tjkAtId != null && (tarihByAt.get(k.x.tjkAtId)?.includes(tarihOf(k.r)) ?? false) && true], ["Accurace split", (k) => !!accBy.get(k.r.id)?.splits.some((s) => s.horseNumber === k.x.no)], ["galop (son 14 gün)", (k) => galOnce(k, 14) > 0], ["agf (yalnız doluluk)", (k) => k.x.agf != null]];
  P("| Alan | " + KABA.join(" | ") + " | Hepsi |"); P("|---|" + KABA.map(() => "---").join("|") + "|---|");
  for (const [ad, f] of MATRIS) { if (ad.startsWith("geçmiş")) continue; P("| " + ad + " | " + KABA.map((g) => { const s = kosanlar.filter((k) => kaba(tip(k.r)) === g); return s.length ? yuz(s.filter(f).length, s.length) + " (n=" + s.length + ")" : "—"; }).join(" | ") + " | " + yuz(kosanlar.filter(f).length, kosanlar.length) + " |"); }
  P("\n(Geçmiş satırı derinliği için bölüm 4'teki dağılım kullanılır; kaba grup × geçmiş-satır matrisi ayrıca üretilmedi.)\n");

  // ── 9. Zaman doğruluğu ──
  P("## 9. Zaman doğruluğu — \"yarış anında gerçekten biliniyor muydu?\"");
  P("| Veri kaynağı | Yarış öncesi bilinebilir mi? | Kanıt / ölçüm |"); P("|---|---|---|");
  P("| Runner program alanları (kilo, hp, form, yaş, jokey, antrenör, sire…) | Evet, program yayınlandığında | `Runner`'da güncellenme zamanı alanı YOK; sonradan değişip değişmediği DOĞRULANAMAZ. Önceki ölçüm: snapshot ↔ yeniden hesap karşılaştırmasında hpRel/kiloRel %88–94 aynı (fark küçük; çekilen at/saha değişimi tahmini, doğrulanmadı) |");
  P("| Runner.agf | DOĞRULANAMADI (kapanış mı, sonradan güncellenmiş mi) | Yalnız değerlendirmede kullanılır; zamanı bilinmiyor |");
  P("| Result (bitiş sırası, ganyan, süre) | Hayır (yarış sonrası) | Yalnız etiket/değerlendirme |");
  P("| HorseRaceHistoryCache satırları | Evet, **satır tarihi < yarış günü** filtresiyle | Önbellek sayfa at-yarışlarının " + yuz(cacheSonra, kosanlar.filter((k) => k.x.tjkAtId != null).length) + "'inde yarış gününden SONRA güncellenmiş (yarışın kendisini ve sonrasını içerir → tarih filtresi ŞART); geç gelen düzeltmeler ayırt edilemez |");
  P("| HorseStatsCache (kariyer istatistikleri) | **Hayır** (güncel toplam; geçmiş günün değerini saklamaz) | Yarış gününden sonra güncellenmiş at-yarış: " + yuz(kosanlar.filter((k) => k.x.tjkAtId != null && (stUpd.get(k.x.tjkAtId) ?? 0) > tarihOf(k.r) + 86400000).length, kosanlar.filter((k) => k.x.tjkAtId != null && stUpd.has(k.x.tjkAtId)).length) + " |");
  P("| JockeyStatSync / TrainerStatSync | **Hayır** (yıllık toplam, üzerine yazılır) | bölüm 6 |");
  P("| Accurace geçmiş koşular | Evet (başka yarışın verisi, tarih < yarış günü) | Aynı yarışın kendi ara zamanları yarış sonrası yayınlanır → o yarış için KULLANILAMAZ |");
  P("| Gallop kayıtları | Evet, galop tarihi < yarış günü | Galop tarihi yarış gününden sonra olan kayıt: " + galGelecek + " (hatalı tarih şüphesi); Gallop tablosunda kayıt-zamanı alanı YOK |");
  P("| TjkDereceKaydi | Satır `tarih` alanıyla < yarış günü | `updatedAt` var; tarih filtresi kullanılabilir |");
  P("| Pedigri: HorsePedigree / ExternalPedigreeStat / TjkPedigriStat | Soy ağacı sabit (evet); **istatistikler birikimlidir → eski yarışlar için HAYIR** | Yarış-öncesi görüntü (TjkPedigriSnapshot) yalnız " + (snap[0]?.snapshotDate ?? "—") + " ve sonrası |");
  P("| Prediction.featureSnapshot (yayın anı) | Evet (yayın anındaki hesap) | Yalnız yayınlanmış tahminlerde; sinyal alanı kodlarına bağlıdır, yeni motor için veri kaynağı DEĞİL |");
  P("| Sonuç alımı gecikmesi | — | Önceki ölçüm: aynı antrenör aynı gün iki farklı snapshot değeri (önceki günün sonuçları DB'ye geç girmiş) → canlıda geçmiş eksik olabilir |\n");

  // ── 10. Kazanan profilleri (ham alan, betimleyici) ──
  P("## 10. Kazananların ham alan profili (BETİMLEYİCİ — sinyal/sıralama/anlamlılık YOK)");
  P("Kazanan = `winnerNos`'taki at. Karşılaştırma: aynı yarışlardaki çekilmeyen tüm atlar. Bu bir veri tanımıdır; hangi alanın 'işe yaradığı' hakkında hüküm içermez.");
  const kaz = kosanlar.filter((k) => (k.r.result?.winnerNos ?? []).includes(k.x.no)); const yas = (a: string | null) => { const m = (a ?? "").match(/^(\d+)y/); return m ? +m[1]! : null; }; const cins = (a: string | null) => { const t = (a ?? "").trim().split(/\s+/); return t[2] ?? null; };
  P("Kazanan sayısı: " + kaz.length + " / " + races.length + " yarış (ölü yarış nedeniyle yarış sayısından fazla olabilir).");
  P("\n| Ham alan | Kazananlar | Tüm atlar |"); P("|---|---|---|");
  const ort = (a: number[]) => (a.length ? (a.reduce((p, q) => p + q, 0) / a.length).toFixed(2) : "—");
  P("| Yaş (ortalama) | " + ort(kaz.map((k) => yas(k.x.age)).filter((v): v is number => v != null)) + " | " + ort(kosanlar.map((k) => yas(k.x.age)).filter((v): v is number => v != null)) + " |");
  for (const c of [...new Set(kosanlar.map((k) => cins(k.x.age)).filter(Boolean))].slice(0, 4) as string[]) P("| Cins kodu '" + c + "' payı | " + yuz(kaz.filter((k) => cins(k.x.age) === c).length, kaz.length) + " | " + yuz(kosanlar.filter((k) => cins(k.x.age) === c).length, kosanlar.length) + " |");
  P("| Kilo ortalaması (kg, ham) | " + ort(kaz.map((k) => k.x.weight).filter((v): v is number => v != null)) + " | " + ort(kosanlar.map((k) => k.x.weight).filter((v): v is number => v != null)) + " |");
  P("| Saha büyüklüğü (yarış başına, ortalama) | " + ort(kaz.map((k) => sahaOf(k.r))) + " | " + ort(kosanlar.map((k) => sahaOf(k.r))) + " |");
  P("| Takı alanı dolu payı | " + yuz(kaz.filter((k) => dolu(k.x.equipment)).length, kaz.length) + " | " + yuz(kosanlar.filter((k) => dolu(k.x.equipment)).length, kosanlar.length) + " |");
  P("| Jokey değişmiş (jockeyChanged) payı | " + yuz(kaz.filter((k) => k.x.jockeyChanged).length, kaz.length) + " | " + yuz(kosanlar.filter((k) => k.x.jockeyChanged).length, kosanlar.length) + " |");
  P("| Apprentice (çırak) payı | " + yuz(kaz.filter((k) => k.x.apprentice).length, kaz.length) + " | " + yuz(kosanlar.filter((k) => k.x.apprentice).length, kosanlar.length) + " |");
  P("| Son koşudan gün (tjkKgs) medyan | " + pct(kaz.map((k) => k.x.tjkKgs).filter((v): v is number => v != null), 0.5) + " | " + pct(kosanlar.map((k) => k.x.tjkKgs).filter((v): v is number => v != null), 0.5) + " |");
  const sn = (k: (typeof kosanlar)[number]) => k.x.startNo; const grup = (n: number | null, N: number) => (n == null ? "yok" : n <= 3 ? "1-3" : n <= 6 ? "4-6" : "7+");
  P("\n**Kulvar/start sırası (startNo) gruplarına göre kazanan payı** (beklenen = o gruptaki at payı): " + ["1-3", "4-6", "7+", "yok"].map((g) => g + ": kazanan " + yuz(kaz.filter((k) => grup(sn(k), sahaOf(k.r)) === g).length, kaz.length) + " | tüm atlar " + yuz(kosanlar.filter((k) => grup(sn(k), sahaOf(k.r)) === g).length, kosanlar.length)).join(" · "));
  P("\n**Koşu türü (kaba) başına kazananların yaşı/kilosu (ort.):** " + KABA.map((g) => { const s = kaz.filter((k) => kaba(tip(k.r)) === g); return s.length ? g + " (n=" + s.length + "): yaş " + ort(s.map((k) => yas(k.x.age)).filter((v): v is number => v != null)) + ", kilo " + ort(s.map((k) => k.x.weight).filter((v): v is number => v != null)) : ""; }).filter(Boolean).join(" · "));
  P("\n---\nBu rapor yalnız envanterdir. Hiçbir sinyal, puan, katsayı, model, seçim ya da öneri içermez; sinyal tanımı ve motora ekleme yalnız kullanıcının açık onayıyla yapılır.");
  fs.writeFileSync("HAM-VERI-ENVANTERI-2026-11-17.md", out.join("\n"));
  console.log("YAZILDI HAM-VERI-ENVANTERI-2026-11-17.md | " + out.length + " satır | yarış " + races.length + " | at-yarış " + kosanlar.length);
  await db.$disconnect(); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
