// RCA kapalı-döngü kayıt defteri — Prisma şema drift'inden İZOLE (rca-scan.service.ts ile AYNI desen):
// RcaSorunKaydi yalnız raw SQL ile yönetilir, schema.prisma'ya eklenmez, yalnız CREATE IF NOT EXISTS.
// Amaç: bir sorun açıldığında kaydedilir; dedektörün KENDİ ölçütü sağlandığında "çözüldü (doğrulandı)" olarak kapanır;
// yeniden ortaya çıkarsa tekrar sayısı artar. Böylece RCA "buldu" ile kalmaz, çözümün gerçekten tuttuğu da görünür.
import { db } from "@/lib/db";
import { kayitGecisi, type KayitSatiri, type RcaSorun } from "@/lib/rca/rca-cekirdek";

export async function ensureRcaKayitTablosu(): Promise<void> {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "RcaSorunKaydi" (
      "kod"           TEXT NOT NULL PRIMARY KEY,
      "durum"         TEXT NOT NULL,
      "baslik"        TEXT NOT NULL,
      "kategori"      TEXT NOT NULL,
      "siddet"        TEXT NOT NULL,
      "ilkGorulme"    TIMESTAMPTZ(3) NOT NULL,
      "sonGorulme"    TIMESTAMPTZ(3) NOT NULL,
      "cozulmeZamani" TIMESTAMPTZ(3),
      "tekrarSayisi"  INTEGER NOT NULL DEFAULT 0,
      "sonKanitJson"  JSONB,
      "updatedAt"     TIMESTAMPTZ(3) NOT NULL DEFAULT now()
    )
  `;
}

export type KayitDetay = KayitSatiri & { baslik: string; kategori: string; siddet: string };

type Ham = { kod: string; durum: string; baslik: string; kategori: string; siddet: string; ilkGorulme: Date; sonGorulme: Date; cozulmeZamani: Date | null; tekrarSayisi: number };
const satira = (r: Ham): KayitDetay => ({
  kod: r.kod, durum: r.durum === "COZULDU" ? "COZULDU" : "ACIK", baslik: r.baslik, kategori: r.kategori, siddet: r.siddet,
  ilkGorulme: r.ilkGorulme.toISOString(), sonGorulme: r.sonGorulme.toISOString(), cozulmeZamani: r.cozulmeZamani?.toISOString() ?? null, tekrarSayisi: r.tekrarSayisi,
});

export async function kayitlariOku(): Promise<KayitDetay[]> {
  await ensureRcaKayitTablosu();
  const rows = await db.$queryRaw<Ham[]>`SELECT "kod","durum","baslik","kategori","siddet","ilkGorulme","sonGorulme","cozulmeZamani","tekrarSayisi" FROM "RcaSorunKaydi" ORDER BY "sonGorulme" DESC`;
  return rows.map(satira);
}

/** Dedektör sonuçlarını kayıt defterine işler (idempotent). Her sonuç için saf `kayitGecisi` kuralı uygulanır. */
export async function kayitlariSenkronla(sorunlar: RcaSorun[], simdi: Date = new Date()): Promise<KayitDetay[]> {
  const onceki = new Map((await kayitlariOku()).map((k) => [k.kod, k]));
  const t = simdi.toISOString();
  for (const s of sorunlar) {
    const g = kayitGecisi(onceki.get(s.kod) ?? null, s.kod, s.durum, t);
    if (g.eylem === "YOK" || !g.yeni) continue;
    const y = g.yeni;
    const kanit = JSON.stringify(s.kanit);
    await db.$executeRaw`
      INSERT INTO "RcaSorunKaydi" ("kod","durum","baslik","kategori","siddet","ilkGorulme","sonGorulme","cozulmeZamani","tekrarSayisi","sonKanitJson","updatedAt")
      VALUES (${y.kod}, ${y.durum}, ${s.baslik}, ${s.kategori}, ${s.siddet}, ${y.ilkGorulme}::timestamptz, ${y.sonGorulme}::timestamptz, ${y.cozulmeZamani}::timestamptz, ${y.tekrarSayisi}, ${kanit}::jsonb, now())
      ON CONFLICT ("kod") DO UPDATE SET
        "durum" = EXCLUDED."durum", "baslik" = EXCLUDED."baslik", "kategori" = EXCLUDED."kategori", "siddet" = EXCLUDED."siddet",
        "sonGorulme" = EXCLUDED."sonGorulme", "cozulmeZamani" = EXCLUDED."cozulmeZamani", "tekrarSayisi" = EXCLUDED."tekrarSayisi",
        "sonKanitJson" = EXCLUDED."sonKanitJson", "updatedAt" = now()`;
  }
  return kayitlariOku();
}
