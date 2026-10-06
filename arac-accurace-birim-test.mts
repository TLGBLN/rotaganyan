import { closingSlope, styleVector, rivalPressure, speedResidual, makeBaselineCache, lateSegmentLength, paceOf, expectedPace, buildBaseline } from "./src/lib/accurace/features";
import type { AccuraceRun, TargetRace } from "./src/lib/accurace/types";
let basarili = 0, basarisiz = 0;
const kontrol = (ad: string, ok: boolean, detay = "") => { ok ? basarili++ : basarisiz++; console.log(`${ok ? "PASS" : "FAIL"} ${ad} ${detay}`); };
const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const kosu = (o: Partial<AccuraceRun>): AccuraceRun => ({ tjk: 1, date: D("2026-07-01"), length: 1600, surface: "CIM", breed: "INGILIZ", hippodrome: "H", going: "Normal", place: 3, fieldSize: 10, finishMs: 100000, checkpoints: [], lateSegMs: null, lateSegScore: null, lateSegReason: null, earlyBin: null, ...o });

// T1: finiş checkpoint'i 0.9995'te ise yalnız bir kez sayılmalı (çift ağırlık yok)
const cpA = kosu({ checkpoints: [{ checkpoint: 800, timeReal: 1, place: 5 }, { checkpoint: 1200, timeReal: 2, place: 4 }, { checkpoint: 1599, timeReal: 3, place: 3 }] });
const cpB = kosu({ checkpoints: [{ checkpoint: 800, timeReal: 1, place: 5 }, { checkpoint: 1200, timeReal: 2, place: 4 }, { checkpoint: 1599, timeReal: 3, place: 3 }, { checkpoint: 1600, timeReal: 3, place: 3 }] });
kontrol("T1 t=1 checkpoint dışlanır: eğim finiş-only ile birebir aynı", Math.abs((closingSlope(cpB) ?? NaN) - (closingSlope(cpA) ?? NaN)) < 1e-12, `A=${closingSlope(cpA)} B=${closingSlope(cpB)}`);
const sl = closingSlope(kosu({ checkpoints: [{ checkpoint: 800, timeReal: 1, place: 5 }, { checkpoint: 1599, timeReal: 3, place: 3 }] }));
kontrol("T1b closing eğimi pozitif (sıra kazanma)", (sl ?? 0) > 0, `slope=${sl?.toFixed(4)}`);

// T2: LateSegment uzunluğu
kontrol("T2 1200m → 600 m", lateSegmentLength(1200) === 600);
kontrol("T2 1400m → 700 m", lateSegmentLength(1400) === 700);
kontrol("T2 1600m → 800 m", lateSegmentLength(1600) === 800);

// T3: stil vektörü toplamı 1 ve as-of
const gecmis = [0, 1, 1, 5].map((bin, i) => kosu({ earlyBin: bin, date: D(`2026-06-${10 + i}`) }));
gecmis.push(kosu({ earlyBin: 3, date: D("2026-08-01") })); // hedefin sonrası: dışarıda kalmalı
const hedef: TargetRace = { date: D("2026-07-01"), length: 1600, surface: "CIM" };
const h = styleVector(gecmis, hedef);
const toplam = (h.vec ?? []).reduce((s, x) => s + x, 0);
kontrol("T3 stil toplamı = 1", Math.abs(toplam - 1) < 1e-9, `sum=${toplam.toFixed(6)}`);
kontrol("T3 as-of: gelecek koşu yok sayılır", h.observed && h.effectiveN < 4.0001, `effN=${h.effectiveN.toFixed(3)}`);
const rp = rivalPressure([h, { vec: null, observed: false, reliability: 0, effectiveN: 0, missingReason: "NO_STYLE_HISTORY" }]);
kontrol("T3b rakip baskısı eksik rakibi raporlar", rp.nObserved === 1 && rp.nMissing === 1);

// T4: speedResidual işareti — hedefe göre daha hızlı geçmiş koşu pozitif residual vermeli
const nufus: AccuraceRun[] = [];
for (let i = 0; i < 25; i++) nufus.push(kosu({ tjk: 100 + i, date: D("2026-06-01"), finishMs: 100000 + i * 10 })); // ~6.25 s/100m civarı
const hizli = kosu({ tjk: 7, date: D("2026-06-20"), finishMs: 95000 }); // daha hızlı → +
const yavas = kosu({ tjk: 7, date: D("2026-06-21"), finishMs: 105000 }); // daha yavaş → −
const cache = makeBaselineCache(nufus);
const sHizli = speedResidual([hizli], hedef, cache);
const sYavas = speedResidual([yavas], hedef, cache);
kontrol("T4 hızlı koşu → residual > 0", (sHizli.raw ?? -1) > 0, `raw=${sHizli.raw?.toFixed(3)}`);
kontrol("T4b yavaş koşu → residual < 0", (sYavas.raw ?? 1) < 0, `raw=${sYavas.raw?.toFixed(3)}`);

// T5: bağlam ayrımı — Arap ve İngiliz aynı pace'te değil; baseline ayrı tutulur
const arap = Array.from({ length: 25 }, (_, i) => kosu({ tjk: 200 + i, breed: "ARAP", date: D("2026-06-01"), finishMs: 110000 }));
const ingiliz = Array.from({ length: 25 }, (_, i) => kosu({ tjk: 300 + i, breed: "INGILIZ", date: D("2026-06-01"), finishMs: 100000 }));
const tablo = buildBaseline([...arap, ...ingiliz], hedef.date);
const ea = expectedPace(arap[0], tablo), ei = expectedPace(ingiliz[0], tablo);
kontrol("T5 Arap/İngiliz ayrı baseline", ea != null && ei != null && Math.abs(ea.v - ei.v) > 0.5, `Arap=${ea?.v.toFixed(2)} İng=${ei?.v.toFixed(2)}`);
kontrol("T5b baseline seviyesi 1 (hipodrom+zemin dolu)", ea?.level === 1);
const eksik = kosu({ breed: "INGILIZ", going: null, date: D("2026-06-01") });
const ee = expectedPace(eksik, tablo);
kontrol("T5c zemin yoksa seviye 2'ye düşer", ee?.level === 2, `level=${ee?.level}`);

// T6: yüzey SERT — farklı yüzey 0 ağırlıklı, speedResidual'a girmez
const kumKosu = kosu({ tjk: 9, surface: "KUM", date: D("2026-06-25"), finishMs: 90000 });
kontrol("T6 farklı yüzey speedResidual'a girmez", !speedResidual([kumKosu], hedef, cache).observed);

console.log(`\nSONUC: ${basarili} PASS / ${basarisiz} FAIL`);
process.exit(basarisiz ? 1 : 0);
