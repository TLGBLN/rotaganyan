import { db } from "@/lib/db";
import { turkeyDateString } from "@/lib/tz";

export type OrganDurum = "OK" | "UYARI" | "HATA";

export type Organ = {
  id: string;
  kalpParcasi: string;
  islev: string;
  durum: OrganDurum;
  detay: string;
  olcumMs: number | null;
};

const SIMDI = () => Date.now();
const SAAT = 3_600_000;

function ortamSatiri(ad: string): { durum: OrganDurum; detay: string } {
  const deger = process.env[ad];
  if (!deger) return { durum: "HATA", detay: `${ad} tanımlı değil` };
  if (/example\.com|PROJEREF|user:pass|localhost:5432\/test/.test(deger)) {
    return { durum: "HATA", detay: `${ad} örnek/yer tutucu değer içeriyor` };
  }
  return { durum: "OK", detay: `${ad} tanımlı ve biçimi uygun` };
}

export async function getSiteAnatomisi(): Promise<{ genel: OrganDurum; organlar: Organ[]; uretildi: string }> {
  const organlar: Organ[] = [];
  const bugun = turkeyDateString();
  const bugunDate = new Date(bugun + "T00:00:00.000Z");

  // Vena Cava Superior: veritabanı bağlantısı
  {
    const t0 = SIMDI();
    try {
      await db.$queryRaw`SELECT 1`;
      const ms = SIMDI() - t0;
      organlar.push({ id: "db", kalpParcasi: "Vena Cava Superior", islev: "Veritabanı bağlantısı", durum: ms > 4000 ? "UYARI" : "OK", detay: `Yanıt ${ms} ms${ms > 4000 ? " (yavaş)" : ""}`, olcumMs: ms });
    } catch {
      organlar.push({ id: "db", kalpParcasi: "Vena Cava Superior", islev: "Veritabanı bağlantısı", durum: "HATA", detay: "Veritabanına bağlanılamadı", olcumMs: null });
    }
  }

  // Aort: bu sayfayı sunan sunucu
  organlar.push({ id: "sunucu", kalpParcasi: "Aort", islev: "Sunucu (bu sayfa)", durum: "OK", detay: "Sayfa üretildi", olcumMs: 0 });

  // Sağ Atrium: ortam değişkenleri
  {
    const a = ortamSatiri("DATABASE_URL");
    const b = ortamSatiri("DIRECT_URL");
    const kotu = [a, b].find((x) => x.durum === "HATA");
    organlar.push({ id: "env", kalpParcasi: "Sağ Atrium", islev: "Ortam değişkenleri (bağlantı bilgileri)", durum: kotu ? "HATA" : "OK", detay: kotu ? kotu.detay : "DATABASE_URL ve DIRECT_URL geçerli görünüyor", olcumMs: null });
  }

  // Sağ Ventrikül: derleme/deploy bilgisi
  {
    const sha = process.env.VERCEL_GIT_COMMIT_SHA;
    const env = process.env.VERCEL_ENV;
    organlar.push({
      id: "deploy",
      kalpParcasi: "Sağ Ventrikül",
      islev: "Yayın (deploy) bilgisi",
      durum: "OK",
      detay: sha ? `Commit ${sha.slice(0, 7)} · ortam ${env ?? "bilinmiyor"}` : "Yerel çalışma (Vercel commit bilgisi yok)",
      olcumMs: null,
    });
  }

  // Pulmoner Arter: kupon yayını (bugünkü aktif kupon)
  {
    try {
      const n = await db.homeKupon.count({ where: { isActive: true, date: bugunDate } });
      organlar.push({ id: "kupon", kalpParcasi: "Pulmoner Arter", islev: "Kupon yayını (bugün)", durum: n === 0 ? "UYARI" : "OK", detay: n === 0 ? `${bugun} için aktif kupon yok` : `${bugun} için ${n} aktif kupon`, olcumMs: null });
    } catch {
      organlar.push({ id: "kupon", kalpParcasi: "Pulmoner Arter", islev: "Kupon yayını (bugün)", durum: "HATA", detay: "Kupon tablosu okunamadı", olcumMs: null });
    }
  }

  // Sol Ventrikül: tahmin motoru (bugünkü yayınlanmış tahmin sayısı)
  {
    try {
      const n = await db.prediction.count({ where: { published: true, race: { raceDay: { date: bugunDate } } } });
      organlar.push({ id: "tahmin", kalpParcasi: "Sol Ventrikül", islev: "Tahmin motoru çıktısı (bugün)", durum: n === 0 ? "UYARI" : "OK", detay: n === 0 ? "Bugün yayınlanmış tahmin yok" : `Bugün ${n} yayınlanmış tahmin`, olcumMs: null });
    } catch {
      organlar.push({ id: "tahmin", kalpParcasi: "Sol Ventrikül", islev: "Tahmin motoru çıktısı (bugün)", durum: "HATA", detay: "Tahmin tablosu okunamadı", olcumMs: null });
    }
  }

  // Sol Atrium: sonuç senkronu (son girilen sonuç yaşı)
  {
    try {
      const r = await db.result.aggregate({ _max: { enteredAt: true } });
      const son = r._max.enteredAt;
      if (!son) {
        organlar.push({ id: "sonuc", kalpParcasi: "Sol Atrium", islev: "Sonuç senkronu", durum: "UYARI", detay: "Hiç sonuç kaydı yok", olcumMs: null });
      } else {
        const yas = SIMDI() - son.getTime();
        organlar.push({ id: "sonuc", kalpParcasi: "Sol Atrium", islev: "Sonuç senkronu", durum: yas > 12 * SAAT ? "UYARI" : "OK", detay: `Son sonuç ${Math.round(yas / SAAT)} saat önce girildi`, olcumMs: null });
      }
    } catch {
      organlar.push({ id: "sonuc", kalpParcasi: "Sol Atrium", islev: "Sonuç senkronu", durum: "HATA", detay: "Sonuç tablosu okunamadı", olcumMs: null });
    }
  }

  // Pulmoner Venler: araştırma snapshot kayıtları (flag ve son kayıt)
  {
    const acik = process.env.RESEARCH_SNAPSHOT_ENABLED === "true";
    try {
      const rows = await db.$queryRaw<{ son: Date | null; hata24: bigint }[]>`SELECT MAX("createdAt") AS son, COUNT(*) FILTER (WHERE status = 'FAILED' AND "createdAt" > now() - interval '24 hours') AS hata24 FROM "ResearchSnapshotRun"`;
      const { son, hata24 } = rows[0];
      const hataSayi = Number(hata24);
      if (!acik) {
        organlar.push({ id: "snapshot", kalpParcasi: "Pulmoner Venler", islev: "Araştırma kayıtları (snapshot)", durum: "OK", detay: "Kapalı (RESEARCH_SNAPSHOT_ENABLED değil)", olcumMs: null });
      } else if (!son || SIMDI() - son.getTime() > 48 * SAAT) {
        organlar.push({ id: "snapshot", kalpParcasi: "Pulmoner Venler", islev: "Araştırma kayıtları (snapshot)", durum: "UYARI", detay: "Açık ama son 48 saatte kayıt yok", olcumMs: null });
      } else {
        organlar.push({ id: "snapshot", kalpParcasi: "Pulmoner Venler", islev: "Araştırma kayıtları (snapshot)", durum: hataSayi > 0 ? "UYARI" : "OK", detay: `Açık · son kayıt ${new Date(son).toISOString().slice(0, 16).replace("T", " ")} · son 24 saatte ${hataSayi} hata`, olcumMs: null });
      }
    } catch {
      organlar.push({ id: "snapshot", kalpParcasi: "Pulmoner Venler", islev: "Araştırma kayıtları (snapshot)", durum: acik ? "HATA" : "UYARI", detay: "Snapshot tablosu okunamadı", olcumMs: null });
    }
  }

  const genel: OrganDurum = organlar.some((o) => o.durum === "HATA") ? "HATA" : organlar.some((o) => o.durum === "UYARI") ? "UYARI" : "OK";
  return { genel, organlar, uretildi: new Date().toISOString() };
}
