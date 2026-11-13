// Gerçek yayınlanmış HomeKupon kayıtlarının TUTMA oranı (sitenin kendi isabet mantığı: buildKuponOnerisi — eküri kuralı dahil).
// Son 30 günün Altılı kuponları; 7'li Ganyan ayrı ürün olduğu için dışarıda. Önbellek 60 dk (kupon başına 1 sorgu → ağır).
import { db } from "@/lib/db";
import { buildKuponOnerisi } from "@/server/services/race.service";
import { wilson, type Aralik } from "@/lib/izleme/metrikler";

export type KuponKademe = { anahtar: "ekonomik" | "normal" | "genis"; ad: string; n: number; tuttu: number; aralik: Aralik; ortMaliyet: number; harcama: number; ikramiye: number; ikramiyeKayitsiz: number; net: number; medyanIkramiye: number | null };
export type KuponTutma = { uretildi: string; gunSayisi: number; kuponSayisi: number; kademeler: KuponKademe[] };

const parseTutar = (s: string | null): number => {
  if (!s) return 0;
  const m = s.match(/([\d.]+,\d+)/);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export async function hesaplaKuponTutma(gunSayisi = 30, simdi: Date = new Date()): Promise<KuponTutma> {
  const bas = new Date(simdi.getTime() - gunSayisi * 86400000);
  const hepsi = await db.homeKupon.findMany({ where: { date: { gte: bas } }, orderBy: [{ date: "desc" }, { updatedAt: "desc" }] });
  const goruldu = new Set<string>();
  const tekil = hepsi.filter((k) => { const key = `${k.hippodromeName}|${k.date.toISOString()}|${k.slot}`; if (goruldu.has(key)) return false; goruldu.add(key); return !k.hippodromeName.includes("7'li"); });

  type Satir = { anahtar: KuponKademe["anahtar"]; hit: boolean; maliyet: number; ikramiye: number; ikramiyeVar: boolean };
  const satirlar: Satir[] = [];
  for (let i = 0; i < tekil.length; i += 8) {
    const grup = tekil.slice(i, i + 8);
    const sonuc = await Promise.all(grup.map((k) => buildKuponOnerisi(k).catch(() => null)));
    sonuc.forEach((o) => {
      if (!o) return;
      for (const v of o.variants) {
        if (!v.filled || v.status === "pending") continue;
        satirlar.push({ anahtar: v.key, hit: v.status === "hit", maliyet: v.amount, ikramiye: parseTutar(o.ikramiye), ikramiyeVar: !!o.ikramiye });
      }
    });
  }
  const AD = { ekonomik: "Ekonomik", normal: "Normal", genis: "Geniş" } as const;
  const kademeler: KuponKademe[] = (["ekonomik", "normal", "genis"] as const).map((a) => {
    const s = satirlar.filter((x) => x.anahtar === a), h = s.filter((x) => x.hit);
    const harcama = s.reduce((p, x) => p + x.maliyet, 0), ikramiye = h.reduce((p, x) => p + x.ikramiye, 0);
    const sirali = h.filter((x) => x.ikramiyeVar).map((x) => x.ikramiye).sort((p, q) => p - q);
    return {
      anahtar: a, ad: AD[a], n: s.length, tuttu: h.length, aralik: wilson(h.length, s.length),
      ortMaliyet: s.length ? harcama / s.length : 0, harcama, ikramiye, ikramiyeKayitsiz: h.filter((x) => !x.ikramiyeVar).length, net: ikramiye - harcama,
      medyanIkramiye: sirali.length ? sirali[Math.floor(sirali.length / 2)] : null,
    };
  });
  return { uretildi: simdi.toISOString(), gunSayisi, kuponSayisi: tekil.length, kademeler };
}

const TTL_MS = 60 * 60_000;
let onbellek: { t: number; v: KuponTutma } | null = null;
export async function getKuponTutma(): Promise<KuponTutma> {
  if (onbellek && Date.now() - onbellek.t < TTL_MS) return onbellek.v;
  const v = await hesaplaKuponTutma();
  onbellek = { t: Date.now(), v };
  return v;
}
