// SALT-OKUMA — "ilk defa farklı mesafe / pist" kuralı veride bir etkiyi yakalıyor mu? (HorseRaceHistoryCache: ardışık koşular)
// Her koşu (≥1 önceki koşusu olan): bugünkü mesafeye eşdeğer (hibrit kural) bir geçmiş koşu var mı? Yoksa "yeni mesafe"; yeni mesafe alt kırılımı:
// bant atlayan ±100–300 m, aynı bantta 300 m, 300 m+ büyük sıçrama; yön (yukarı/aşağı). Yeni pist: geçmişte bu pistte koşu yok.
// Ölçüt: kazanma %, ilk3 %, piyasa-oranı (gerçek kazanma / Σ 1/ganyan). Piyasa-oranı tüm kovalarda benzer ise etki piyasada fiyatlı demektir.
import { db } from "./src/lib/db";
import { mesafeBandi, mesafeEsdeger } from "./src/lib/pedigri-form";

const trT = (d: string) => { const [g, a, y] = d.split("."); return Date.UTC(+y, +a - 1, +g); };
const numT = (s: unknown) => { if (s == null) return null; const m = String(s).replace(",", ".").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
type Ag = { n: number; w: number; t3: number; mkt: number; mktW: number; mktN: number };
const yeni = (): Ag => ({ n: 0, w: 0, t3: 0, mkt: 0, mktW: 0, mktN: 0 });
async function main() {
  const A = new Map<string, Ag>();
  const ek = (k: string, fin: number | null, gan: number | null) => { const g = A.get(k) ?? yeni(); A.set(k, g); g.n++; if (fin === 1) g.w++; if (fin != null && fin <= 3) g.t3++; if (gan != null && gan > 0) { g.mkt += 1 / gan; g.mktN++; if (fin === 1) g.mktW++; } };
  let cursor: number | undefined; let satir = 0;
  for (;;) {
    const batch = await db.horseRaceHistoryCache.findMany({ take: 400, ...(cursor ? { skip: 1, cursor: { tjkAtId: cursor } } : {}), orderBy: { tjkAtId: "asc" }, select: { tjkAtId: true, rowsJson: true } });
    if (!batch.length) break; cursor = batch[batch.length - 1].tjkAtId;
    for (const h of batch) {
      const rows = (h.rowsJson as { date?: string; finishPos?: string; ganyan?: string; surface?: string; distance?: number | string }[]).filter((q) => q.date)
        .map((q) => ({ t: trT(q.date!), fin: numT(q.finishPos), gan: numT(q.ganyan), pist: String(q.surface ?? "").trim().charAt(0).toUpperCase(), d: q.distance != null && Number.isFinite(Number(q.distance)) ? Number(q.distance) : null })).sort((a, b) => a.t - b.t);
      for (let i = 1; i < rows.length; i++) {
        const cur = rows[i]; if (cur.fin == null || cur.d == null || !cur.pist) continue; satir++;
        const prev = rows.slice(0, i).filter((q) => q.d != null);
        if (!prev.length) continue;
        const esdeger = prev.some((q) => mesafeEsdeger(q.d!, cur.d!));
        let en = prev[0].d!; for (const q of prev) if (Math.abs(q.d! - cur.d!) < Math.abs(en - cur.d!)) en = q.d!;
        const fark = cur.d - en, bantAtlar = mesafeBandi(en) !== mesafeBandi(cur.d), yon = fark > 0 ? "yukarı" : "aşağı";
        ek("0) TÜMÜ (≥1 önceki koşu)", cur.fin, cur.gan);
        if (esdeger) ek("1) mesafe EŞDEĞER (kural: yeni değil)", cur.fin, cur.gan);
        else {
          ek("2) YENİ MESAFE (kural: devreye)", cur.fin, cur.gan);
          const a = Math.abs(fark);
          if (bantAtlar && a <= 300) ek(`2a) yeni, bant atlar, ≤300 m (${yon})`, cur.fin, cur.gan);
          else if (!bantAtlar && a <= 300) ek(`2b) yeni, AYNI bant, 300 m (${yon})`, cur.fin, cur.gan);
          else ek(`2c) yeni, büyük sıçrama >300 m (${yon})`, cur.fin, cur.gan);
          if (bantAtlar && a === 200) ek("2d) yeni, bant atlar, TAM 200 m (aynı bantta 200 eşdeğer sayılırdı)", cur.fin, cur.gan);
        }
        // referans: aynı 200 m farkın aynı bant içindeki hali (eşdeğer sayılan) — doğrudan karşılaştırma için
        if (esdeger && !bantAtlar && Math.abs(fark) === 200 && !prev.some((q) => Math.abs(q.d! - cur.d!) < 200)) ek("3) eşdeğer, AYNI bant, en yakın geçmiş TAM 200 m", cur.fin, cur.gan);
        const pistVar = prev.some((q) => q.pist === cur.pist);
        ek(pistVar ? "P1) bu pistte geçmişi VAR" : "P2) İLK DEFA bu pistte", cur.fin, cur.gan);
        if (!pistVar) ek(`P2${cur.pist}) ilk defa ${cur.pist === "Ç" ? "ÇİM" : cur.pist === "K" ? "KUM" : "SENTETİK"}'te`, cur.fin, cur.gan);
        if (!esdeger && !pistVar) ek("2+P2) hem yeni mesafe hem yeni pist", cur.fin, cur.gan);
      }
    }
  }
  console.log("satır:", satir);
  const g0 = A.get("0) TÜMÜ (≥1 önceki koşu)")!; const base = (g0.mktW / g0.mktN) / (g0.mkt / g0.mktN);
  console.log(`taban: n=${g0.n} | kazanma %${(g0.w / g0.n * 100).toFixed(1)} | ilk3 %${(g0.t3 / g0.n * 100).toFixed(1)} | piyasa-oranı ${base.toFixed(3)}\n`);
  for (const [k, g] of [...A].sort((a, b) => a[0].localeCompare(b[0]))) {
    const mo = g.mktN ? (g.mktW / g.mktN) / (g.mkt / g.mktN) : NaN; const se = Math.sqrt(g.w + 1) / Math.max(1, g.mktW) * mo; // yaklaşık %68 hata payı
    console.log(k.padEnd(76) + ` n=${String(g.n).padStart(6)} | kazanma %${(g.w / g.n * 100).toFixed(1).padStart(4)} | ilk3 %${(g.t3 / g.n * 100).toFixed(1).padStart(4)} | piyasa-oranı ${mo.toFixed(3)} (±${se.toFixed(3)})`);
  }
  await db.$disconnect();
}
main();
