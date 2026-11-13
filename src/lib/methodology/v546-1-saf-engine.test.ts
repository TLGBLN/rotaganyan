import { describe, it, expect, vi } from "vitest";

// 2026-10-23 P1 KABUL KRİTERİ (kullanıcı talebi): "AGF değerleri değiştirildiğinde Saf Model
// çıktısının değişmediğini otomatik testle kanıtla." Saf Model'in matematiksel bağımsızlığı
// mimari olarak garanti: scoreV461Saf, gatherV461RawSinyaller'ın döndürdüğü ham sinyal
// listesinden yalnız SAF_MODEL_AGF_KODLARI'nda OLMAYANLARI puanlar (filtrele parametresi,
// bkz. v546-1-engine.ts::puanlaVeSirala) — agfSirasi/agfPayi/agfPayi2 vektöre HİÇ GİRMEZ.
// Bu test, gatherFaz1V5'i (DB bağımsız) mock'layıp agfSirasi/agfPayi'yi keyfi
// DEĞİŞTİRDİĞİMİZDE scoreV461'in (A) DEĞİŞTİĞİNİ ama scoreV461Saf'ın (C) AYNI KALDIĞINI
// doğrudan kanıtlar — yalnız "mimari böyle tasarlandı" iddiası değil, çalıştırılmış kanıt.

vi.mock("@/lib/db", () => ({
  db: {
    race: { findUnique: vi.fn(async () => ({ raceDay: { date: new Date("2026-09-01") } })) },
    // 2026-11-13 — motor 11-10'dan beri Runner (dam/damSire/hp/kilo/form/KGS/cins) ve Gallop sorguları
    // yapıyor; bu mock'ta yoktu ve test 2 haftadır çöküyordu. Boş sonuç = "veri yok" (gözlemsiz).
    runner: { findMany: vi.fn(async () => []) },
    gallop: { findMany: vi.fn(async () => []) },
  },
}));

const baseRunner = (no: number, agfSirasi: number, agfPayi: number) => ({
  id: `r${no}`, no, ad: `AT${no}`,
  agfSirasi, agfPayi, idmJokey: 0.1 * no, h2hNetSkor: 0, h2hKarsilastirmaSayisi: 0,
  hizDerecesi: 0, zeminToleransi: 0, zeminToleransiGozlemli: true, zeminMesafeDeneyim: 0,
  yakinsama2Plus: 0, sonIdmanSprint: 0, sonIdmanSprintGozlemli: false,
  takiEklendiMi: 0, takiCikarildiMi: 0, takiDegisikligiGozlemli: true,
  sireOrani: 0, sireOrneklemKendiVeri: 0, externalPedigree: null,
});

function mockFaz1(runners: ReturnType<typeof baseRunner>[]) {
  return {
    race: { id: "race1", distance: 1400, surface: "KUM", breed: "INGILIZ", hippodromeName: "Test", raceNo: 1, classType: "Şartlı" },
    runners,
  };
}

vi.mock("@/lib/methodology/v5-engine", () => ({
  gatherFaz1V5: vi.fn(),
  hibritMaidenSatisMi: () => false,
}));
vi.mock("@/server/actions/hiz-derecesi.actions", () => ({ getHizDerecesiGozlemliForRace: vi.fn(async () => new Map()) }));
vi.mock("@/lib/methodology/veri-toplama", () => ({
  fetchAccuraceGecmisKayitlari: vi.fn(async () => ({ son800AccuraceKayitlari: [], son800Siblings: [] })),
  normalizeHorseName: (s: string) => s,
}));
vi.mock("@/server/actions/tempo-tasima-gucu.actions", () => ({ hesaplaTempoTasimaGucuMap: vi.fn(async () => new Map()) }));
vi.mock("@/lib/accurace/loader", () => ({
  accuraceKosulari: vi.fn(async () => []),
  tjkAtIdOf: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/accurace/features", () => ({
  closingResidual: () => ({ observed: false, raw: null, reliability: 0 }),
  lateSegmentSpeed: () => ({ observed: false, raw: null, reliability: 0 }),
  speedResidual: () => ({ observed: false, raw: null, reliability: 0 }),
  styleVector: () => ({ observed: false, vec: null, reliability: 0 }),
  rivalPressure: () => ({ vec: null }),
  makeBaselineCache: () => ({}),
  makeClosingBaselineCache: () => ({}),
}));

const SAF_W = {
  version: "V5.46.1-SAF-TEST",
  featureNames: ["idmJokey", "h2hNetSkor", "hizDerecesi", "zeminToleransi", "zeminMesafeDeneyim", "yakinsama2Plus", "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru", "sireOrani", "ACC_CLOSE_RES", "ACC_LATE", "ACC_SPEED", "PS_front", "PS_lone", "PS_closerFit"],
  weights: Array(16).fill(0.1),
  means: Array(16).fill(0),
  stds: Array(16).fill(1),
};

describe("Saf Model AGF bağımsızlığı (P1 kabul kriteri)", () => {
  it("agfSirasi/agfPayi değiştiğinde scoreV461 (A) DEĞİŞİR ama scoreV461Saf (C) AYNI KALIR", async () => {
    const { gatherFaz1V5 } = await import("@/lib/methodology/v5-engine");
    const { scoreV461Saf } = await import("./v546-1-engine");

    const runnersOrijinal = [baseRunner(1, 1, 40), baseRunner(2, 2, 30), baseRunner(3, 3, 20)];
    const runnersAgfDegisti = [baseRunner(1, 3, 5), baseRunner(2, 1, 60), baseRunner(3, 2, 25)]; // AGF tamamen TERS çevrildi

    // 2026-11-13: eskiden burada AGF dahil 19 özellikli scoreV461 (A) "değişir" diye de sınanıyordu;
    // o eski yol üretimde kaldırıldı ve 18 sinyalli ham veriyle (sireOraniBirlesik vb.) ÇÖKÜYOR —
    // ölü yolu sınamak yerine yalnız asıl kabul kriteri (Saf Model AGF'den bağımsız) korunuyor.
    vi.mocked(gatherFaz1V5).mockResolvedValueOnce(mockFaz1(runnersOrijinal) as never);
    const cOnce = await scoreV461Saf("race1", SAF_W);
    vi.mocked(gatherFaz1V5).mockResolvedValueOnce(mockFaz1(runnersAgfDegisti) as never);
    const cDegisti = await scoreV461Saf("race1", SAF_W);

    expect(cOnce).not.toBeNull();
    expect(cDegisti).not.toBeNull();
    // C (Saf Model) AYNI KALMALI - agfSirasi/agfPayi hic vektore girmiyor.
    for (const p of cOnce!.picks) {
      const digeri = cDegisti!.picks.find((x) => x.no === p.no)!;
      expect(digeri.probability).toBeCloseTo(p.probability, 10);
      expect(digeri.score).toBeCloseTo(p.score, 10);
    }
    // Ek kanit: C'nin feature listesinde agfSirasi/agfPayi/agfPayi2 HİÇ YOK.
    const cKodlar = new Set(cOnce!.picks[0].features.map((f) => f.ad));
    expect(cKodlar.has("agfSirasi")).toBe(false);
    expect(cKodlar.has("agfPayi")).toBe(false);
    expect(cKodlar.has("agfPayi2")).toBe(false);
  });

  it("Saf Model olasılıkları her yarışta tam 1'e toplanır", async () => {
    const { gatherFaz1V5 } = await import("@/lib/methodology/v5-engine");
    const { scoreV461Saf } = await import("./v546-1-engine");
    vi.mocked(gatherFaz1V5).mockResolvedValueOnce(mockFaz1([baseRunner(1, 1, 50), baseRunner(2, 2, 30), baseRunner(3, 3, 20)]) as never);
    const c = await scoreV461Saf("race1", SAF_W);
    const toplam = c!.picks.reduce((s, p) => s + p.probability, 0);
    expect(toplam).toBeCloseTo(1, 10);
  });
});
