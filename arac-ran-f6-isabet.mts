// RAN F6 Top1/Top3 isabet testi (salt-okuma). Üretim servisini (ranF6Hesapla; dondurulmuş katsayı, as-of özellik) gerçek sonuçlanmış yarışlarda çalıştırır.
// UYARI: katsayılar bu dönemin verisiyle eğitildi → ÖRNEKLEM-İÇİ (in-sample) sonuçtur; bağımsız doğrulama DEĞİL. Out-of-fold kronolojik sonuç RAN_F6_KATSAYI_RAPORU.md'de.
import { db } from "./src/lib/db";
import { ranF6Hesapla } from "./src/server/services/ran-f6.service";
const BAS = process.env.BAS ?? "2026-08-01", BIT = process.env.BIT ?? "2026-11-17";
const rs = await db.race.findMany({ where: { conditions: null, result: { isNot: null }, raceDay: { date: { gte: new Date(BAS + "T00:00:00Z"), lte: new Date(BIT + "T00:00:00Z") }, hippodrome: { name: { not: "Karma" } } } }, select: { id: true, result: { select: { winnerNos: true } }, raceDay: { select: { date: true } } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }] });
console.log("yarış", rs.length, BAS, "→", BIT);
type S = { n: number; t1: number; t3: number; r1: number; r3: number };
const Z = (): S => ({ n: 0, t1: 0, t3: 0, r1: 0, r3: 0 }); const tum = Z(); const tip: Record<string, S> = {}; const ay: Record<string, S> = {}; const mod: Record<string, S> = {};
const topla = (s: S, t1: boolean, t3: boolean, k: number) => { s.n++; s.t1 += +t1; s.t3 += +t3; s.r1 += 1 / k; s.r3 += Math.min(3, k) / k; };
const by = new Map(rs.map((r) => [r.id, r])); let atlanan = 0, esit = 0;
for (let i = 0; i < rs.length; i += 120) {
  const s = await ranF6Hesapla(rs.slice(i, i + 120).map((r) => r.id)); atlanan += s.atlananlar.length;
  for (const y of s.yarislar) { const w = new Set(by.get(y.raceId)?.result?.winnerNos ?? []); if (!w.size) continue; const sr = [...y.atlar].sort((a, b) => a.sira - b.sira); const t1 = w.has(sr[0]!.no); const t3 = sr.slice(0, 3).some((a) => w.has(a.no)); const k = y.atlar.length; if (w.size > 1) esit++;
    topla(tum, t1, t3, k); topla((tip[y.turAdi] ??= Z()), t1, t3, k); topla((ay[by.get(y.raceId)!.raceDay.date.toISOString().slice(0, 7)] ??= Z()), t1, t3, k); topla((mod[y.model] ??= Z()), t1, t3, k); }
  console.error("…", Math.min(i + 120, rs.length));
}
const f = (a: number, n: number) => (100 * a / n).toFixed(1) + "%";
const satir = (ad: string, s: S) => `| ${ad} | ${s.n} | ${f(s.t1, s.n)} | ${f(s.r1, s.n)} | ${(100 * (s.t1 - s.r1) / s.n).toFixed(1)} | ${f(s.t3, s.n)} | ${f(s.r3, s.n)} | ${(100 * (s.t3 - s.r3) / s.n).toFixed(1)} |`;
const L = [`# RAN F6 — Top1/Top3 isabet testi (${BAS} → ${BIT}; ÖRNEKLEM-İÇİ, bağımsız doğrulama DEĞİL)`, "", `Üretim servisi, dondurulmuş katsayılar. Top1 = F6'nın 1. seçimi kazandı; Top3 = kazanan F6'nın ilk 3 seçimi içinde. Rastgele = saha büyüklüğüne göre beklenen. Atlanan ${atlanan}; at başı/beraberlikli ${esit}.`, "", "| Küme | n | Top1 | Rastgele Top1 | Fark (puan) | Top3 | Rastgele Top3 | Fark (puan) |", "|---|---|---|---|---|---|---|---|", satir("**Tümü**", tum), ...Object.entries(tip).sort().map(([k, v]) => satir(k, v)), ...Object.entries(mod).map(([k, v]) => satir("model " + k, v)), ...Object.entries(ay).sort().map(([k, v]) => satir("ay " + k, v))];
import fs from "node:fs"; fs.writeFileSync(".sinyal-veri/ran-f6-isabet.md", L.join("\n")); console.log(L.join("\n")); process.exit(0);
