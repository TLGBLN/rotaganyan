import { PrismaClient, Breed, Surface, Confidence, PedigreeRating, LessonCategory } from "@prisma/client";
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
      pedigreeNote: "Frankel × Galileo — klasik mesafe pedigri, 1400m ideal mesafe",
      pedigreeUrl: "https://www.pedigreequery.com/star+queen",
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
      pedigreeNote: "Sea The Stars × Dansili — güçlü pedigri, form soru işareti",
      pedigreeUrl: "https://www.pedigreequery.com/golden+dream",
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
      pedigreeNote: "Dubawi × Montjeu — kilo düşüşü ve galop serisi dikkat çekici",
      pedigreeUrl: "https://www.pedigreequery.com/rose+garden",
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
      pedigreeNote: "Kahyasi × Pennekamp — kum pistinde güçlü soy, −3kg kilo düşüşü kritik avantaj",
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

  // ─── Post-mortem dersler ──────────────────────────────────────────────────
  const lessons = [
    {
      title: "Sugar Storm Dersi",
      date: new Date("2025-09-14T00:00:00.000Z"),
      category: LessonCategory.AGF,
      rule: "AGF#1 oranı %40+ ve HP değeri ≥ 85 olan at en az 2. sırada olmalı; hiçbir zaman 4. ve sonrasına düşürülmez.",
      raceRef: "5. Koşu, 14.09.2025 İstanbul",
      tags: ["agf", "ayrışma", "ingiliz"],
    },
    {
      title: "Emirenes Dersi",
      date: new Date("2025-10-03T00:00:00.000Z"),
      category: LessonCategory.JOKEY,
      rule: "Çok güçlü jokey değişikliği (3/3 sicil) sicil>kilo kuralını tetiklemez; ayrı değerlendirilmeli. Jokey değişimi + kilo artışı kombinasyonu tehlikelidir.",
      raceRef: "3. Koşu, 03.10.2025 Bursa",
      tags: ["jokey", "sicil", "kilo"],
    },
    {
      title: "Prenses Seda Dersi",
      date: new Date("2025-11-20T00:00:00.000Z"),
      category: LessonCategory.GRUP,
      rule: "15+ atlı koşularda dış kulvar + kaçak stili kombinasyonu başa yazılmaz. Dış kulvarda kaçak → yüksek enerji harcaması → son düzlükte düşüş.",
      raceRef: "7. Koşu, 20.11.2025 Ankara",
      tags: ["grup", "kulvar", "kacak"],
    },
    {
      title: "Şıkturbo Dersi",
      date: new Date("2025-12-05T00:00:00.000Z"),
      category: LessonCategory.AGF,
      rule: "AGF ≥ %40 ve HP ≥ 85 olan at hiçbir koşulda 3. sıradan aşağı yazılmaz. Bu eşiği geçen at mutlaka ilk 2 adayı arasında olmalı.",
      raceRef: "4. Koşu, 05.12.2025 İzmir",
      tags: ["agf", "hp", "ingiliz"],
    },
    {
      title: "Dorukbatur Dersi",
      date: new Date("2026-01-18T00:00:00.000Z"),
      category: LessonCategory.SICIL_KILO,
      rule: "−3kg ve üzeri kilo düşüşü olan at, galop performansı destekliyorsa mutlaka listeye alınmalı. Galop lideri + kilo düşüşü = güçlü kombinasyon.",
      raceRef: "2. Koşu, 18.01.2026 Bursa",
      tags: ["kilo", "galop", "handikap"],
    },
    {
      title: "Midnight Mirage Dersi",
      date: new Date("2026-02-12T00:00:00.000Z"),
      category: LessonCategory.TEMPO,
      rule: "2+ kaçak olan koşuda kaçak stilli atlar başa yazılmaz. Yüksek tempoda enerji kaybı kaçınılmaz; bekleyenler ve geç açılanlar avantajlı.",
      raceRef: "6. Koşu, 12.02.2026 İstanbul",
      tags: ["tempo", "kacak", "ingiliz"],
    },
    {
      title: "Sükanbey & Golden Bee Dersi",
      date: new Date("2026-03-07T00:00:00.000Z"),
      category: LessonCategory.TUM_ATLAR,
      rule: "Tüm atlar analiz edilmeden sıralama yapılmaz. Düşük AGF'li bir at bile galop+pedigri kombinasyonuyla sürpriz yapabilir (Golden Bee: %8 AGF, 1. geldi).",
      raceRef: "5. Koşu, 07.03.2026 Bursa",
      tags: ["tum_atlar", "agf", "surpriz"],
    },
    {
      title: "Love Sea Dersi",
      date: new Date("2026-04-15T00:00:00.000Z"),
      category: LessonCategory.SICIL_KILO,
      rule: "Ağır kilo taşıyan kaliteli at dibe atılmaz. Kalite + ağır kilo → orta sıra. Love Sea örneği: 60kg ama sınıfın en iyi pedigri atı, 2. geldi.",
      raceRef: "1. Koşu, 15.04.2026 İstanbul",
      tags: ["kilo", "kalite", "handikap"],
    },
    {
      title: "Can Efe Dersi",
      date: new Date("2026-05-20T00:00:00.000Z"),
      category: LessonCategory.GALOP,
      rule: "İç pistte yapılan galop değerleri dış piste dönüştürülmeden karşılaştırılmaz. İç pist ~1 saniye daha hızlıdır; barem hesabında bu fark mutlaka dikkate alınır.",
      raceRef: "3. Koşu, 20.05.2026 Bursa",
      tags: ["galop", "ic_pist", "barem"],
    },
  ];

  for (const lesson of lessons) {
    await db.postMortemLesson.createMany({ data: [lesson], skipDuplicates: true });
  }
  console.log(`✅ ${lessons.length} post-mortem ders oluşturuldu`);

  // ─── Engine Config başlangıç değerleri ────────────────────────────────────
  const engineConfigs = [
    // Galop baremleri — İngiliz çim
    { key: "galop.barem.ingiliz.cim.1200.cok_iyi.400m", value: 26.5 },
    { key: "galop.barem.ingiliz.cim.1200.iyi.400m", value: 27.0 },
    { key: "galop.barem.ingiliz.cim.1400.cok_iyi.800m", value: 53.0 },
    { key: "galop.barem.ingiliz.cim.1400.iyi.800m", value: 54.5 },
    // İç pist avansı
    { key: "galop.ic_pist_avans_sn", value: 1.0 },
    // Şekil iskontosu
    { key: "galop.iskonto.CR", value: 0.0 },
    { key: "galop.iskonto.R", value: 0.5 },
    { key: "galop.iskonto.HC", value: 1.0 },
    { key: "galop.iskonto.C", value: 0.0 },
    // Banko eşikleri
    { key: "banko.kv.min_fark", value: 3 },
    { key: "banko.kv.min_skor", value: 6 },
    { key: "banko.maiden.min_fark", value: 4 },
    { key: "banko.maiden.min_skor", value: 7 },
    { key: "banko.kombinasyon_esigi", value: 2 },
    // AGF eşikleri
    { key: "agf.dominans.oran", value: 40.0 },
    { key: "agf.dominans.hp", value: 85 },
    // Göreli kilo
    { key: "kilo.dususu.esik", value: -3.0 },
    // Form arası
    { key: "form.arasi.gun_esigi", value: 60 },
    // Grup büyüklüğü
    { key: "grup.kucuk.esik", value: 8 },
    { key: "grup.buyuk.esik", value: 15 },
  ];

  for (const cfg of engineConfigs) {
    await db.engineConfig.upsert({
      where: { key: cfg.key },
      update: {},
      create: { key: cfg.key, value: cfg.value },
    });
  }
  console.log(`✅ ${engineConfigs.length} engine config oluşturuldu`);

  // ─── Sire tier referansı (otomatik pedigri puanlaması) ────────────────────
  const sireTiers: { name: string; tier: PedigreeRating; surface?: Surface; breed?: Breed; note?: string }[] = [
    { name: "Kuruşağa", tier: PedigreeRating.COK_YUKSEK, surface: Surface.KUM, breed: Breed.ARAP, note: "Kanıtlı kum/1400m aygırı" },
    { name: "Fatih Ağa", tier: PedigreeRating.COK_YUKSEK, surface: Surface.KUM, breed: Breed.ARAP, note: "Grubun en elit kum aygırı" },
    { name: "Araslı", tier: PedigreeRating.COK_YUKSEK, surface: Surface.KUM, breed: Breed.ARAP, note: "En değerli 1400m kum dayanıklılık hattı (damsire rolünde)" },
    { name: "Ayabakan", tier: PedigreeRating.COK_YUKSEK, surface: Surface.KUM, breed: Breed.ARAP, note: "Kum sprint hattı" },
    { name: "Turbo", tier: PedigreeRating.COK_YUKSEK, surface: Surface.KUM, breed: Breed.ARAP, note: "Dayanıklılık hattı" },
    { name: "Mengübert", tier: PedigreeRating.ORTA, breed: Breed.ARAP, note: "1400m kum için spesifik kanıt yok" },
    { name: "Beyefendi", tier: PedigreeRating.ORTA, breed: Breed.ARAP, note: "1400m kum için spesifik kanıt yok" },
    { name: "Diliran", tier: PedigreeRating.ORTA, breed: Breed.ARAP, note: "Zayıf kum hattı" },
    { name: "Bilgin", tier: PedigreeRating.ORTA, breed: Breed.ARAP },
    { name: "Berksoy", tier: PedigreeRating.ZAYIF, breed: Breed.ARAP },
    { name: "Tamerinoğlu", tier: PedigreeRating.ZAYIF, breed: Breed.ARAP },
  ];

  for (const st of sireTiers) {
    await db.sireTier.upsert({
      where: { name: st.name },
      update: {},
      create: st,
    });
  }
  console.log(`✅ ${sireTiers.length} sire tier oluşturuldu`);

  console.log("\n🎉 Seed tamamlandı!");
}

main()
  .catch((e) => {
    console.error("❌ Seed hatası:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
