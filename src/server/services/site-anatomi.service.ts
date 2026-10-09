import { db } from "@/lib/db";
import { turkeyDateString } from "@/lib/tz";
import { getSinyalSaglik, type SinyalOzeti } from "@/server/services/sinyal-saglik.service";
import { ENGINE_VERSIONS } from "@/lib/methodology/engine-versions.data";

// Site Anatomisi — "Sistem çalışıyor mu? Veriler sağlıklı mı? Sinyaller sağlıklı mı?" sorularına
// tek ekranda cevap. Yalnız okuma. Model performansı (kaçan kazananlar) bu sayfada YOK; o
// Koşu Sonuçları Değerlendirme sayfasının işi.

export type OrganDurum = "OK" | "UYARI" | "HATA";

export type Organ = {
  id: string;
  islev: string;
  durum: OrganDurum;
  detay: string;
  olcumMs: number | null;
};

const SAAT = 3_600_000;
// Veritabanı yanıt seviyeleri: ≤500 ms İyi, 501–1500 ms Yavaş (sağlam kabul), >1500 ms Kritik (uyarı).
const DB_IYI_MS = 500;
const DB_KRITIK_MS = 1500;

function ortamSatiri(ad: string): { durum: OrganDurum; detay: string } {
  const deger = process.env[ad];
  if (!deger) return { durum: "HATA", detay: `${ad} tanımlı değil` };
  if (/example\.com|PROJEREF|user:pass|localhost:5432\/test/.test(deger)) {
    return { durum: "HATA", detay: `${ad} örnek/yer tutucu değer içeriyor` };
  }
  return { durum: "OK", detay: `${ad} tanımlı ve biçimi uygun` };
}

export async function getSiteAnatomisi(): Promise<{
  genel: OrganDurum;
  organlar: Organ[];
  sinyal: SinyalOzeti | null;
  uretildi: string;
}> {
  const organlar: Organ[] = [];
  const bugun = turkeyDateString();
  const bugunDate = new Date(bugun + "T00:00:00.000Z");

  // Veritabanı bağlantısı ve yanıt seviyesi
  {
    const t0 = Date.now();
    try {
      await db.$queryRaw`SELECT 1`;
      const ms = Date.now() - t0;
      const seviye = ms <= DB_IYI_MS ? "İyi" : ms <= DB_KRITIK_MS ? "Yavaş" : "Kritik";
      organlar.push({
        id: "db",
        islev: "Veritabanı bağlantısı",
        durum: ms > DB_KRITIK_MS ? "UYARI" : "OK",
        detay: `Yanıt ${ms} ms · performans: ${seviye}`,
        olcumMs: ms,
      });
    } catch {
      organlar.push({ id: "db", islev: "Veritabanı bağlantısı", durum: "HATA", detay: "Veritabanına bağlanılamadı", olcumMs: null });
    }
  }

  // Bu sayfayı sunan sunucu
  organlar.push({ id: "sunucu", islev: "Sunucu (bu sayfa)", durum: "OK", detay: "Sayfa üretildi", olcumMs: 0 });

  // Ortam değişkenleri (bağlantı bilgileri)
  {
    const a = ortamSatiri("DATABASE_URL");
    const b = ortamSatiri("DIRECT_URL");
    const kotu = [a, b].find((x) => x.durum === "HATA");
    organlar.push({
      id: "env",
      islev: "Ortam değişkenleri (bağlantı bilgileri)",
      durum: kotu ? "HATA" : "OK",
      detay: kotu ? kotu.detay : "DATABASE_URL ve DIRECT_URL geçerli görünüyor",
      olcumMs: null,
    });
  }

  // Yayın (deploy) bilgisi: Vercel'de çalışırken commit bilgisi CLI deploy'da gelmeyebilir;
  // bu bir arıza değil, yalnız bilgi eksikliği. Yerel geliştirmede ayrıca belirtilir.
  {
    const sha = process.env.VERCEL_GIT_COMMIT_SHA;
    const env = process.env.VERCEL_ENV;
    const vercelde = process.env.VERCEL === "1";
    organlar.push({
      id: "deploy",
      islev: "Yayın (deploy) bilgisi",
      durum: "OK",
      detay: sha
        ? `Commit ${sha.slice(0, 7)} · ortam ${env ?? "bilinmiyor"}`
        : vercelde
          ? `Deployment aktif · ortam ${env ?? "bilinmiyor"} · commit bilgisi yok (CLI deploy)`
          : "Yerel geliştirme ortamı (Vercel dışı)",
      olcumMs: null,
    });
  }

  // Kupon yayını (bugünkü aktif kupon)
  {
    try {
      const n = await db.homeKupon.count({ where: { isActive: true, date: bugunDate } });
      organlar.push({
        id: "kupon",
        islev: "Kupon yayını (bugün)",
        durum: n === 0 ? "UYARI" : "OK",
        detay: n === 0 ? `${bugun} için aktif kupon yok` : `${bugun} için ${n} aktif kupon`,
        olcumMs: null,
      });
    } catch {
      organlar.push({ id: "kupon", islev: "Kupon yayını (bugün)", durum: "HATA", detay: "Kupon tablosu okunamadı", olcumMs: null });
    }
  }

  // Tahmin motoru çıktısı (bugünkü yayınlanmış tahmin sayısı) — 2026-10-10 kullanıcı talebi:
  // yalnız "tahmin var mı" değil, "hangi MOTORLA üretilmiş" de denetlenmeli. Her Pick'in
  // featureSnapshot.motorEtiketi'si (V5AnalysisPanel'in kaydettiği, CURRENT_ENGINE_LABEL'den
  // türetilen etiket) o anki güncel sürümle (ENGINE_VERSIONS'ın son/bitis:null girdisi,
  // şu an V5.46.1) karşılaştırılır. Bugün YAYINLANMIŞ bir tahmin eski/farklı bir motorla
  // üretilmişse bu gerçek bir arıza sayılır (production tek motorda olmalı).
  {
    try {
      const guncelVersiyon = ENGINE_VERSIONS[ENGINE_VERSIONS.length - 1].versiyon;
      const predictions = await db.prediction.findMany({
        where: { published: true, race: { raceDay: { date: bugunDate } } },
        select: { picks: { select: { featureSnapshot: true }, take: 1 } },
      });
      const n = predictions.length;
      const eskiMotorlar = new Set<string>();
      let etiketsiz = 0;
      for (const p of predictions) {
        const fs = p.picks[0]?.featureSnapshot as { motorEtiketi?: string } | null;
        const etiket = fs?.motorEtiketi;
        if (!etiket) { etiketsiz++; continue; }
        if (!etiket.startsWith(guncelVersiyon)) eskiMotorlar.add(etiket.split(" —")[0]);
      }
      organlar.push({
        id: "tahmin",
        islev: "Tahmin motoru çıktısı (bugün)",
        durum: n === 0 ? "UYARI" : eskiMotorlar.size > 0 ? "HATA" : "OK",
        detay:
          n === 0
            ? "Bugün yayınlanmış tahmin yok"
            : eskiMotorlar.size > 0
              ? `Bugün ${n} tahmin var ama güncel olmayan motor tespit edildi: ${[...eskiMotorlar].join(", ")} (güncel: ${guncelVersiyon} olmalı)`
              : `Bugün ${n} yayınlanmış tahmin, hepsi ${guncelVersiyon}${etiketsiz > 0 ? ` (${etiketsiz} tanesinin motor etiketi kayıtlı değil, eski/manuel kayıt olabilir)` : ""}`,
        olcumMs: null,
      });
    } catch {
      organlar.push({ id: "tahmin", islev: "Tahmin motoru çıktısı (bugün)", durum: "HATA", detay: "Tahmin tablosu okunamadı", olcumMs: null });
    }
  }

  // Sonuç senkronu (son girilen sonuç yaşı)
  {
    try {
      const r = await db.result.aggregate({ _max: { enteredAt: true } });
      const son = r._max.enteredAt;
      if (!son) {
        organlar.push({ id: "sonuc", islev: "Sonuç senkronu", durum: "UYARI", detay: "Hiç sonuç kaydı yok", olcumMs: null });
      } else {
        const yas = Date.now() - son.getTime();
        organlar.push({
          id: "sonuc",
          islev: "Sonuç senkronu",
          durum: yas > 12 * SAAT ? "UYARI" : "OK",
          detay: `Son sonuç ${Math.round(yas / SAAT)} saat önce girildi`,
          olcumMs: null,
        });
      }
    } catch {
      organlar.push({ id: "sonuc", islev: "Sonuç senkronu", durum: "HATA", detay: "Sonuç tablosu okunamadı", olcumMs: null });
    }
  }

  // Araştırma kayıtları (snapshot): flag ve son kayıt
  {
    const acik = process.env.RESEARCH_SNAPSHOT_ENABLED === "true";
    try {
      const rows = await db.$queryRaw<{ son: Date | null; hata24: bigint }[]>`SELECT MAX("createdAt") AS son, COUNT(*) FILTER (WHERE status = 'FAILED' AND "createdAt" > now() - interval '24 hours') AS hata24 FROM "ResearchSnapshotRun"`;
      const { son, hata24 } = rows[0];
      const hataSayi = Number(hata24);
      if (!acik) {
        organlar.push({ id: "snapshot", islev: "Araştırma kayıtları (snapshot)", durum: "OK", detay: "Kapalı (RESEARCH_SNAPSHOT_ENABLED değil)", olcumMs: null });
      } else if (!son || Date.now() - son.getTime() > 48 * SAAT) {
        organlar.push({ id: "snapshot", islev: "Araştırma kayıtları (snapshot)", durum: "UYARI", detay: "Açık ama son 48 saatte kayıt yok", olcumMs: null });
      } else {
        organlar.push({
          id: "snapshot",
          islev: "Araştırma kayıtları (snapshot)",
          durum: hataSayi > 0 ? "UYARI" : "OK",
          detay: `Açık · son kayıt ${new Date(son).toISOString().slice(0, 16).replace("T", " ")} · son 24 saatte ${hataSayi} hata`,
          olcumMs: null,
        });
      }
    } catch {
      organlar.push({ id: "snapshot", islev: "Araştırma kayıtları (snapshot)", durum: acik ? "HATA" : "UYARI", detay: "Snapshot tablosu okunamadı", olcumMs: null });
    }
  }

  // Sinyal motoru: 13 sinyalin özet durumu (ayrıntı sayfada açılır)
  let sinyal: SinyalOzeti | null = null;
  try {
    sinyal = await getSinyalSaglik();
    const s = sinyal.sayilar;
    const toplam = sinyal.satirlar.length;
    organlar.push({
      id: "sinyal",
      islev: "Sinyal motoru",
      durum: s.SORUN > 0 ? "HATA" : s.IZLE > 0 || s.DATA_HOLD > 0 ? "UYARI" : "OK",
      detay: toplam === 0
        ? "Ölçülecek sinyal verisi yok"
        : `${toplam} sinyal · ${s.SAGLAM} sağlam · ${s.IZLE} izle · ${s.SORUN} sorun · ${s.DATA_HOLD} veri yetersiz`,
      olcumMs: null,
    });
  } catch {
    organlar.push({ id: "sinyal", islev: "Sinyal motoru", durum: "HATA", detay: "Sinyal sağlığı hesaplanamadı", olcumMs: null });
  }

  const genel: OrganDurum = organlar.some((o) => o.durum === "HATA")
    ? "HATA"
    : organlar.some((o) => o.durum === "UYARI")
      ? "UYARI"
      : "OK";
  return { genel, organlar, sinyal, uretildi: new Date().toISOString() };
}
