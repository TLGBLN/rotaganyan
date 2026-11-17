// KALICI ARAÇ — AS-OF (yarış-öncesi bilgi) SAPMA DENETİMİ. SALT-OKUMA. Kayıtlı eğitim verisindeki (10-11 Kasım'da üretilmiş) motor-türevli sinyal değerlerini, BUGÜNKÜ motorla (gatherV461RawSinyaller) yeniden hesaplanan değerlerle karşılaştırır.
// Mantık: bir sinyal gerçekten "yarış tarihine kadar" bilgiyle üretiliyorsa, aradan geçen günlerde DB'ye giren YENİ sonuçlar o eski yarış için değerini DEĞİŞTİRMEMELİ. Sapan sinyal = "şimdiki bilgi" sızdırıyor (veya veri sonradan düzeltilmiş) şüphesi.
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-asof-denetimi.mts [--n 45]   → .sinyal-veri/asof-denetimi.md
import fs from "node:fs";
import { gatherV461RawSinyaller } from "./src/lib/methodology/v546-1-engine";
import { db } from "./src/lib/db";
const ni = process.argv.indexOf("--n"); const N = ni >= 0 ? Number(process.argv[ni + 1]) : 45;
type Sig = { ad: string; raw: number | null; observed: boolean };
type Kayit = { raceId: string; tarih: string; runners: { no: number; sinyaller: Sig[] }[] };
const d16 = JSON.parse(fs.readFileSync("C:/tmp/saf-model-egitim-verisi-16ozellik.json", "utf8")) as Kayit[];
const d18 = new Map((JSON.parse(fs.readFileSync("C:/tmp/saf18-model-egitim-verisi.json", "utf8")) as Kayit[]).map((r) => [r.raceId, r]));
const SIN = ["h2hNetSkor", "hizDerecesi", "zeminToleransi", "zeminMesafeDeneyim", "sireOrani", "jokeyFormuGenel", "yarisGidisatiSkoru", "PS_front", "PS_closerFit", "ACC_CLOSE_RES", "ACC_LATE", "ACC_SPEED"];
// tarihe göre tabakalı örnek (aylara eşit dağıt)
const sirali = [...d16].sort((a, b) => a.tarih.localeCompare(b.tarih)); const ornek: Kayit[] = []; for (let i = 0; i < N; i++) ornek.push(sirali[Math.floor((i + 0.5) * sirali.length / N)]!);
const ist: Record<string, { n: number; ayni: number; mutlak: number[]; goreli: number[]; durumFarkli: number }> = {}; for (const s of SIN) ist[s] = { n: 0, ayni: 0, mutlak: [], goreli: [], durumFarkli: 0 };
let islenen = 0, atla = 0;
for (const k of ornek) {
  const yeni = await gatherV461RawSinyaller(k.raceId).catch(() => null); if (!yeni) { atla++; continue; } islenen++;
  const yeniMap = new Map(yeni.runners.map((x) => [x.r.no, new Map(x.rawSinyaller.map((s) => [s.ad, s]))]));
  for (const a of k.runners) { const ym = yeniMap.get(a.no); if (!ym) continue;
    for (const s of SIN) { const e = a.sinyaller.find((x) => x.ad === s), y = ym.get(s); if (!e || !y) continue; const o = ist[s]!;
      if (e.observed !== y.observed) o.durumFarkli++;
      if (e.raw == null || y.raw == null) continue; o.n++; const d = Math.abs(e.raw - y.raw); if (d < 1e-6) o.ayni++; o.mutlak.push(d); o.goreli.push(d / Math.max(1e-9, Math.abs(e.raw) + 1e-9)); } }
  console.log("işlendi " + islenen + "/" + ornek.length + " " + k.tarih);
}
const ort = (a: number[]) => (a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0);
const out: string[] = ["# AS-OF SAPMA DENETİMİ — " + new Date().toISOString().slice(0, 10), "Örnek: " + islenen + " yarış (tarihe göre tabakalı, " + sirali[0]!.tarih + " → " + sirali[sirali.length - 1]!.tarih + "); kayıtlı değerler 10-11 Kasım'da üretilmiş, yeniden hesaplama " + new Date().toISOString().slice(0, 10) + ". Atlanan: " + atla,
  "| Sinyal | karşılaştırılan at | birebir aynı % | ort. mutlak fark | ort. göreli fark | gözlem durumu değişen | yorum |", "|---|---|---|---|---|---|---|"];
for (const s of SIN) { const o = ist[s]!; const p = o.n ? o.ayni / o.n * 100 : NaN; const yorum = !o.n ? "veri yok" : p >= 99 ? "KARARLI (as-of ile tutarlı)" : p >= 90 ? "az sapma" : "⚠ SAPIYOR — şimdiki bilgi sızıntısı şüphesi"; out.push("| " + s + " | " + o.n + " | " + (o.n ? p.toFixed(1) : "—") + " | " + ort(o.mutlak).toExponential(2) + " | " + ort(o.goreli).toExponential(2) + " | " + o.durumFarkli + " | " + yorum + " |"); }
fs.mkdirSync(".sinyal-veri", { recursive: true }); fs.writeFileSync(".sinyal-veri/asof-denetimi.md", out.join("\n")); console.log(out.join("\n"));
void d18; await db.$disconnect(); process.exit(0);
