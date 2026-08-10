import { PrismaClient, Breed, Surface, Confidence, PedigreeRating } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL ortam değişkeni tanımlı değil");

const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seed başlıyor...");

  // ─── Admin kullanıcı ──────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Admin123!", 12);
  const admin = await db.user.upsert({
    where: { email: "admin@rotaganyan.com" },
    update: {},
    create: {
      email: "admin@rotaganyan.com",
      name: "ROTAGANYAN Admin",
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log(`✅ Admin: ${admin.email}`);

  // ─── Hipodromlar ──────────────────────────────────────────────────────────
  const hippodromes = [
    { name: "İstanbul", slug: "istanbul" },
    { name: "İzmir", slug: "izmir" },
    { name: "Bursa", slug: "bursa" },
    { name: "Ankara", slug: "ankara" },
    { name: "Adana", slug: "adana" },
    { name: "Kocaeli", slug: "kocaeli" },
    { name: "Şanlıurfa", slug: "sanliurfa" },
  ];

  for (const h of hippodromes) {
    await db.hippodrome.upsert({
      where: { slug: h.slug },
      update: {},
      create: h,
    });
  }
  console.log(`✅ ${hippodromes.length} hipodrom oluşturuldu`);

  const istanbul = await db.hippodrome.findUnique({ where: { slug: "istanbul" } });
  const bursa = await db.hippodrome.findUnique({ where: { slug: "bursa" } });

  // ─── Koşu Günü 1 — İstanbul ──────────────────────────────────────────────
  const raceDay1 = await db.raceDay.upsert({
    where: { date_hippodromeId: { date: new Date("2026-06-10T00:00:00.000Z"), hippodromeId: istanbul!.id } },
    update: {},
    create: {
      date: new Date("2026-06-10T00:00:00.000Z"),
      hippodromeId: istanbul!.id,
    },
  });

  // Koşu 1 — İstanbul
  const race1 = await db.race.upsert({
    where: { raceDayId_raceNo: { raceDayId: raceDay1.id, raceNo: 1 } },
    update: {},
    create: {
      raceDayId: raceDay1.id,
      raceNo: 1,
      time: "13:30",
      classType: "Maiden",
      breed: Breed.INGILIZ,
      surface: Surface.CIM,
      distance: 1400,
      ageWeight: "3Y Dişi 56kg",
      conditions: "Pist: İyi",
    },
  });

  // Atlar — Koşu 1
  const runner1 = await db.runner.upsert({
    where: { raceId_no: { raceId: race1.id, no: 1 } },
    update: {},
    create: {
      raceId: race1.id,
      no: 1,
      name: "STAR QUEEN",
      sire: "Frankel",
      dam: "Lady Star",
      damSire: "Galileo",
      jockey: "A. Çelik",
      trainer: "M. Yıldız",
      startNo: 3,
      weight: 56.0,
      agf: 28.5,
      raceStyle: { kacak: 10, onGrupArkasi: 45, bekleme: 40, enGeri: 5 },
    },
  });

  const runner2 = await db.runner.upsert({
    where: { raceId_no: { raceId: race1.id, no: 2 } },
    update: {},
    create: {
      raceId: race1.id,
      no: 2,
      name: "GOLDEN DREAM",
      sire: "Sea The Stars",
      dam: "Dream Girl",
      damSire: "Dansili",
      jockey: "B. Karahan",
      trainer: "S. Acar",
      startNo: 1,
      weight: 56.0,
      agf: 35.2,
      raceStyle: { kacak: 5, onGrupArkasi: 60, bekleme: 30, enGeri: 5 },
    },
  });

  const runner3 = await db.runner.upsert({
    where: { raceId_no: { raceId: race1.id, no: 3 } },
    update: {},
    create: {
      raceId: race1.id,
      no: 3,
      name: "ROSE GARDEN",
      sire: "Dubawi",
      dam: "Rose Hip",
      damSire: "Montjeu",
      jockey: "C. Demir",
      trainer: "K. Arslan",
      startNo: 5,
      weight: 55.0,
      weightChange: -1.0,
      agf: 18.9,
      raceStyle: { kacak: 0, onGrupArkasi: 25, bekleme: 60, enGeri: 15 },
    },
  });

  // Galoplar — Runner1
  await db.gallop.createMany({
    skipDuplicates: false,
    data: [
      {
        runnerId: runner1.id,
        date: new Date("2026-06-07T07:00:00.000Z"),
        track: "İstanbul",
        surface: Surface.CIM,
        jockey: "A. Çelik",
        form: "HÇ",
        splits: { "400": "0.26.80", "600": "0.40.20", "800": "0.53.90", "1000": "1.07.40" },
      },
      {
        runnerId: runner3.id,
        date: new Date("2026-06-08T07:00:00.000Z"),
        track: "İstanbul",
        surface: Surface.CIM,
        jockey: "C. Demir",
        form: "Ç",
        splits: { "400": "0.26.10", "600": "0.39.80", "800": "0.53.20", "1000": "1.06.80" },
      },
    ],
  });

  // Analiz — Koşu 1
  const pred1 = await db.prediction.upsert({
    where: { raceId: race1.id },
    update: {},
    create: {
      raceId: race1.id,
      authorId: admin.id,
      confidence: Confidence.ORTA,
      notes: "Maiden koşusu. Rose Garden son iki galopta grup lideriydi ve 1kg kilo düşüşünden yararlanıyor. Star Queen form soru işareti olmasa öne çıkabilirdi. Tempo orta, bekleme stili avantaj.",
      tempo: "Orta tempo — tek kaçak Golden Dream, avantajı düşük",
      couponNarrow: "3-1",
      couponNormal: "3-1-2",
      couponWide: "3-1-2",
      isBanko: false,
      bankoNote: "Maiden koşusunda banko önerilmez",
      published: true,
      publishedAt: new Date("2026-06-10T08:00:00.000Z"),
      picks: {
        createMany: {
          data: [
            {
              rank: 1,
              runnerId: runner3.id,
              runnerLabel: "3 ROSE GARDEN",
              score: 7,
              details: ["Son 2 galopta grup lideri", "−1kg kilo düşüşü", "Dubawi pedigri 1400m ideal"],
              pedigreeRating: PedigreeRating.GUCLU,
              isTarget: true,
            },
            {
              rank: 2,
              runnerId: runner1.id,
              runnerLabel: "1 STAR QUEEN",
              score: 6,
              details: ["Frankel pedigri uyumlu", "Form soru işareti var"],
              pedigreeRating: PedigreeRating.YUKSEK,
              isTarget: false,
            },
            {
              rank: 3,
              runnerId: runner2.id,
              runnerLabel: "2 GOLDEN DREAM",
              score: 5,
              details: ["AGF#1 ama form düşük", "Kaçak stili yavaş tempoda avantaj"],
              pedigreeRating: PedigreeRating.GUCLU,
              isTarget: false,
            },
          ],
          skipDuplicates: true,
        },
      },
    },
  });

  // Sonuç — Koşu 1
  await db.result.upsert({
    where: { raceId: race1.id },
    update: {},
    create: {
      raceId: race1.id,
      actualOrder: ["3", "1", "2"],
      winnerNo: 3,
      winnerNos: [3],
      hitTop1: true,
      hitInCoupon: true,
      hitRanks: { g2: true, g3: true },
      errorTag: null,
      errorNote: "Tahmin tuttu. Rose Garden beklediği gibi bekleme stiliyle son düzlükte öne geçti.",
    },
  });

  console.log(`✅ Koşu günü 1 (İstanbul) oluşturuldu`);

  // ─── Koşu Günü 2 — Bursa ─────────────────────────────────────────────────
  const raceDay2 = await db.raceDay.upsert({
    where: { date_hippodromeId: { date: new Date("2026-06-12T00:00:00.000Z"), hippodromeId: bursa!.id } },
    update: {},
    create: {
      date: new Date("2026-06-12T00:00:00.000Z"),
      hippodromeId: bursa!.id,
    },
  });

  const race2 = await db.race.upsert({
    where: { raceDayId_raceNo: { raceDayId: raceDay2.id, raceNo: 2 } },
    update: {},
    create: {
      raceDayId: raceDay2.id,
      raceNo: 2,
      time: "15:00",
      classType: "Handikap 15",
      breed: Breed.INGILIZ,
      surface: Surface.KUM,
      distance: 1200,
      ageWeight: "3Y+ 54-60kg",
      conditions: "Pist: Normal",
    },
  });

  const runner4 = await db.runner.upsert({
    where: { raceId_no: { raceId: race2.id, no: 5 } },
    update: {},
    create: {
      raceId: race2.id,
      no: 5,
      name: "DORUKBATUR",
      sire: "Kahyasi",
      dam: "Dora",
      damSire: "Pennekamp",
      jockey: "M. Güven",
      trainer: "T. Kaya",
      startNo: 2,
      weight: 54.0,
      weightChange: -3.0,
      agf: 22.1,
    },
  });

  await db.gallop.createMany({
    skipDuplicates: false,
    data: [
      {
        runnerId: runner4.id,
        date: new Date("2026-06-10T06:30:00.000Z"),
        track: "Bursa",
        surface: Surface.KUM,
        jockey: "M. Güven",
        form: "Ç",
        splits: { "400": "0.25.40", "600": "0.38.90", "800": "0.52.10" },
      },
    ],
  });

  await db.prediction.upsert({
    where: { raceId: race2.id },
    update: {},
    create: {
      raceId: race2.id,
      authorId: admin.id,
      confidence: Confidence.YUKSEK,
      notes: "Handikap 15. Dorukbatur −3kg kilo düşüşüyle listeye alındı; galop serisi Bursa kum pistinde grup lideri. Tek kaçak stili yavaş tempoda dezavantaj olmaz, iki kaçak → tempo düşük.",
      tempo: "Düşük tempo — tek kaçak senaryosu, bekleyenler avantajlı",
      couponNarrow: "5",
      couponNormal: "5-3",
      couponWide: "5-3-1",
      isBanko: false,
      bankoNote: "Handikap koşusu — banko yasak",
      published: true,
      publishedAt: new Date("2026-06-12T09:00:00.000Z"),
      picks: {
        createMany: {
          data: [
            {
              rank: 1,
              runnerId: runner4.id,
              runnerLabel: "5 DORUKBATUR",
              score: 8,
              details: ["−3kg kilo düşüşü (Dorukbatur dersi)", "Bursa kum galop lideri", "Tek kaçak — bekleme avantaj"],
              pedigreeRating: PedigreeRating.GUCLU,
              isTarget: true,
            },
          ],
          skipDuplicates: true,
        },
      },
    },
  });

  console.log(`✅ Koşu günü 2 (Bursa) oluşturuldu`);

  // ─── Metodoloji v1.6 ──────────────────────────────────────────────────────
  await db.methodologyVersion.upsert({
    where: { version: "1.6" },
    update: {},
    create: {
      version: "1.6",
      effectiveDate: new Date("2026-01-01T00:00:00.000Z"),
      isCurrent: true,
      content: `# ROTAGANYAN Analiz Metodolojisi v1.6

## 1. Genel İlkeler
- Her koşu tipinin kendi ağırlık matrisi vardır
- Banko, yalnızca belirli koşu tipi + puan farkı koşullarında kullanılır
- Tüm atlar analiz edilmeden sıralama yapılmaz (Golden Bee dersi)
- AGF ayrışması varsa banko verilmez

## 2. Galop Değerlendirmesi
**İngiliz 1200m barem (çim):**
- Çok İyi: 400m ≤ 0.26.50, 800m ≤ 0.53.00
- İyi: 400m ≤ 0.27.00, 800m ≤ 0.54.00
- Normal: üstü

**Form iskontosu:**
- ÇR (Çok Rahat): 0
- R (Rahat): −0.5sn
- HÇ (Hafif Çalışma): −1.0sn
- Ç (Çalışma): yüz değer

**İç pist avansı:** ~1.0sn → dış pist değerine dönüştür

## 3. Banko Doğrulayıcı
- Handikap / Grup / Şartlı 1 Koridor: ASLA banko
- KV / Şartlı: fark ≥ 3 puan ve 1. at ≥ 6 puan
- Maiden: fark ≥ 4 puan ve 1. at ≥ 7 puan
- Fark < 2: kombinasyon

## 4. AGF Ayrışma Kuralları
- AGF#1 ≠ sistem#1 → banko verme
- AGF ilk-3 atı sıralamada ≥ 4 farklı → çekirdek at
- AGF ≥ %40 ve HP ≥ 85 → en az 2. sıra (Şıkturbo kuralı)

## 5. Göreli Kilo
- −3kg ve üstü: listeye al, başa yazmadan düşün (Love Sea tersi)
- Ağır kilo + kalite: dibe atma (Love Sea dersi)

## 6. Tempo
- 0 kaçak: kapak tempo, bekleyenler avantaj
- 1 kaçak: orta tempo
- 2+ kaçak: yüksek tempo, kaçak stillerini düşür, bekleyenleri yukarı al

## 7. Grup Büyüklüğü
- ≤ 8 at: closer/sprinter +1 puan
- 15+ at: kaçak/ön grup +1 puan
- 15+ at ve dış start + kaçak: dezavantaj bayrağı (Prenses Seda tersi)

## 8. Form Arası
- Son koşu ≥ 60 gün: −1 puan bayrağı

## 9. Faktör Ağırlık Matrisi
| Faktör | Maiden | Şartlı | Handikap | KV | Grup |
|--------|--------|--------|----------|-----|------|
| Galop | 25% | 20% | 15% | 20% | 15% |
| Pedigri | 30% | 15% | 10% | 10% | 15% |
| Kilo | 5% | 15% | 25% | 15% | 20% |
| Jokey | 10% | 15% | 20% | 20% | 15% |
| Form | 20% | 25% | 20% | 25% | 25% |
| Tempo | 10% | 10% | 10% | 10% | 10% |
`,
    },
  });
  console.log(`✅ Metodoloji v1.6 oluşturuldu`);

  console.log("\n🎉 Seed tamamlandı!");
}

main()
  .catch((e) => {
    console.error("❌ Seed hatası:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
