// Gerçek yayınlanmış HomeKupon kayıtlarının tutma oranı (sitenin KENDİ isabet mantığı: buildKuponOnerisi).
// Salt-okuma: HomeKupon + küçük Race sorguları (kayıt başına 1). Yazma yok.
import fs from "node:fs";
import { db } from "./src/lib/db";
import { buildKuponOnerisi } from "./src/server/services/race.service";

const parseTutar = (s: string | null) => { if (!s) return 0; const m = s.match(/([\d.]+,\d+)/); if (!m) return 0; const n = parseFloat(m[1].replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
type Row = { tarih: string; hip: string; slot: number; yedili: boolean; kademe: string; hit: boolean; maliyet: number; eksik: number; ayak: number; ortAt: number; ikramiye: number; ikramiyeVar: boolean };

async function main() {
  const all = await db.homeKupon.findMany({ orderBy: [{ date: "asc" }, { updatedAt: "desc" }] });
  const seen = new Set<string>();
  const dedup = all.filter((k) => { const key = `${k.hippodromeName}|${k.date.toISOString()}|${k.slot}`; if (seen.has(key)) return false; seen.add(key); return true; });
  console.log("HomeKupon kayıt: " + all.length + " | tekil (hipodrom+tarih+slot, en güncel): " + dedup.length);
  const rows: Row[] = []; let bos = 0;
  for (let i = 0; i < dedup.length; i += 8) {
    const grup = dedup.slice(i, i + 8);
    const sonuc = await Promise.all(grup.map((k) => buildKuponOnerisi(k).catch(() => null)));
    sonuc.forEach((o, j) => {
      const k = grup[j]; if (!o) { bos++; return; }
      for (const v of o.variants) {
        if (!v.filled || v.status === "pending") continue;
        const legs = v.legs;
        const eksik = legs.filter((l) => l.resulted && !l.nos.some((no) => l.winnerNos.includes(no) || no in l.ekuriWinnerByNo)).length;
        rows.push({ tarih: k.date.toISOString().slice(0, 10), hip: k.hippodromeName.split(" — ")[0], slot: k.slot, yedili: k.hippodromeName.includes("7'li"), kademe: v.key, hit: v.status === "hit", maliyet: v.amount, eksik, ayak: legs.length, ortAt: legs.reduce((s, l) => s + l.nos.length, 0) / legs.length, ikramiye: parseTutar(o.ikramiye), ikramiyeVar: !!o.ikramiye });
      }
    });
    if ((i / 8) % 10 === 0) console.log("  işlendi " + Math.min(i + 8, dedup.length) + "/" + dedup.length);
  }
  fs.writeFileSync("C:/tmp/kupon-gercek.json", JSON.stringify(rows));
  console.log("sonuçlanmış+dolu kademe satırı: " + rows.length + " | buildKuponOnerisi null: " + bos);
  const pct = (a: number, b: number) => (b ? (a / b * 100).toFixed(1) : "-") + "%";
  const ort = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(a.length, 1);
  const KAD = ["ekonomik", "normal", "genis"];
  const altili = rows.filter((r) => !r.yedili);
  console.log("\n##### 1) GENEL TUTMA ORANI (Altılı; 7'li ayrı) #####");
  for (const k of KAD) { const a = altili.filter((r) => r.kademe === k); console.log(k.padEnd(9) + " n=" + String(a.length).padStart(4) + " | tuttu " + String(a.filter((r) => r.hit).length).padStart(3) + " (" + pct(a.filter((r) => r.hit).length, a.length) + ") | ort maliyet " + ort(a.map((r) => r.maliyet)).toFixed(0) + "₺ | ort at/ayak " + ort(a.map((r) => r.ortAt)).toFixed(2)); }
  const y7 = rows.filter((r) => r.yedili); console.log("7'li Ganyan satırı: " + y7.length + " | tuttu " + y7.filter((r) => r.hit).length);

  console.log("\n##### 2) AYLIK #####");
  const aylar = [...new Set(altili.map((r) => r.tarih.slice(0, 7)))].sort();
  for (const ay of aylar) console.log(ay + " " + KAD.map((k) => { const a = altili.filter((r) => r.kademe === k && r.tarih.startsWith(ay)); return k.slice(0, 4) + " " + a.filter((r) => r.hit).length + "/" + a.length + " (" + pct(a.filter((r) => r.hit).length, a.length) + ")"; }).join(" | "));

  console.log("\n##### 3) SON 30 GÜN vs ÖNCESİ #####");
  const sinir = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  for (const [ad, f] of [["son 30 gün (" + sinir + "+)", (r: Row) => r.tarih >= sinir], ["öncesi", (r: Row) => r.tarih < sinir]] as const) console.log(ad.padEnd(26) + KAD.map((k) => { const a = altili.filter((r) => r.kademe === k && f(r)); return k.slice(0, 4) + " " + a.filter((r) => r.hit).length + "/" + a.length + " (" + pct(a.filter((r) => r.hit).length, a.length) + ")"; }).join(" | "));

  console.log("\n##### 4) KAÇIRMA DERİNLİĞİ (tutmayanlarda kaç ayak eksik) #####");
  for (const k of KAD) { const m = altili.filter((r) => r.kademe === k && !r.hit); const d = [1, 2, 3].map((e) => m.filter((r) => r.eksik === e).length); console.log(k.padEnd(9) + " tutmayan " + m.length + " | 1 ayak eksik " + d[0] + " (" + pct(d[0], m.length) + ") | 2 ayak " + d[1] + " (" + pct(d[1], m.length) + ") | 3+ ayak " + (m.length - d[0] - d[1]) + " (" + pct(m.length - d[0] - d[1], m.length) + ")"); }

  console.log("\n##### 5) HİPODROM (Normal kademe, n≥12) #####");
  const hipler = [...new Set(altili.map((r) => r.hip))];
  const hs = hipler.map((h) => { const a = altili.filter((r) => r.hip === h && r.kademe === "normal"); const w = altili.filter((r) => r.hip === h && r.kademe === "genis"); return { h, n: a.length, hit: a.filter((r) => r.hit).length, wn: w.length, wh: w.filter((r) => r.hit).length }; }).filter((x) => x.n >= 12).sort((a, b) => b.n - a.n);
  for (const x of hs) console.log(x.h.padEnd(14) + " normal " + x.hit + "/" + x.n + " (" + pct(x.hit, x.n) + ") | geniş " + x.wh + "/" + x.wn + " (" + pct(x.wh, x.wn) + ")");

  console.log("\n##### 6) PARA: İKRAMİYE YAKALANAN DÖNEM (2026-07-26+) — sitenin kendi ikramiye alanıyla #####");
  const donem = altili.filter((r) => r.tarih >= "2026-07-26");
  for (const k of KAD) {
    const a = donem.filter((r) => r.kademe === k), h = a.filter((r) => r.hit), eksik = h.filter((r) => !r.ikramiyeVar).length;
    const gider = a.reduce((s, r) => s + r.maliyet, 0), gelir = h.reduce((s, r) => s + r.ikramiye, 0);
    console.log(k.padEnd(9) + " kupon " + a.length + " | tuttu " + h.length + " (ikramiyesi kayıtsız: " + eksik + ") | toplam harcama " + gider.toFixed(0) + "₺ | toplam ikramiye " + gelir.toFixed(0) + "₺ | net " + (gelir - gider).toFixed(0) + "₺ | getiri/harcama " + (gider ? (gelir / gider).toFixed(2) : "-") + " | tutan başı ort. ikramiye " + (h.length ? (gelir / Math.max(h.length - eksik, 1)).toFixed(0) : "-") + "₺");
  }
  process.exit(0);
}
main().catch((e) => { console.error("HATA:", e); process.exit(1); });
