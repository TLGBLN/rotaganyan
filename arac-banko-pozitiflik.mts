// KALICI ARAÇ — BANKO POZİTİFLİK KAYITLARI (şartname v1.2 bölüm 7-10). SALT-OKUMA; yalnız .sinyal-veri/anlik.ndjson'dan türetir, DB'ye/modele/kupona DOKUNMAZ.
// Her at için CANLI 24 sinyalin (S2'de atılanlar DAHİL) ham değeri + z + yön-düzeltmeli z + pozitif mi + (GEÇİCİ) güç + veri güveni saklanır.
// Sıralama modelinin katsayıları kullanılmaz: yön = banko-sinyal-yonleri.json (TEK BAŞINA eğitim işareti; YALNIZ bootstrap+blok KARARLILIK testini geçenler — diğerleri "belirsiz": kayıt tutulur, pozitif SAYILMAZ). Banko KARARINA ETKİSİ YOK — pozitifliğin işe yarayıp yaramadığı henüz doğrulanmadı.
// GEÇİCİ alanlar (şartnamede eşikler "geliştirme verisinden öğrenilecek"): güç S = clip(z_yön/2, 0, 1)  (t=0, u=2); güven C = güvenirlik × gözlem. Ham değer + z saklandığı için tüm bunlar sonradan YENİDEN hesaplanabilir.
// Tekrar işaretleri: tempoOnBaski/tempoGeriBaski = matematiksel ayna (ρ=−1) → TEKİLLEŞTİRİLMİŞ sayımda yalnız tempoOnBaski; ACC_CLOSE_RES/ACC_LATE aynı ailede (ρ=0,83) → aile destek sayısında bir kez.
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-banko-pozitiflik.mts  → .sinyal-veri/banko-pozitiflik.ndjson (her çalıştırmada baştan, idempotent)
import fs from "node:fs";
const CANLI = JSON.parse(fs.readFileSync("src/lib/methodology/weights/v546-1-saf-weights.json", "utf8")) as { featureNames: string[]; means: number[]; stds: number[] };
const YON = (JSON.parse(fs.readFileSync("src/lib/methodology/weights/banko-sinyal-yonleri.json", "utf8")) as { yonler: Record<string, { yon: 1 | -1 | null; durum: string }> }).yonler; // yon=null → "belirsiz": etkin destek YOK
const AILE: Record<string, string> = { ACC_CLOSE_RES: "ACCURACE", ACC_LATE: "ACCURACE", accHizFormu: "ACCURACE", hizDerecesi: "ACCURACE", tempoOnOran: "TEMPO", tempoErkenHiz: "TEMPO", tempoOnBaski: "TEMPO", tempoGeriBaski: "TEMPO", jokeyPIT: "JOKEY", jokeyFormuGenel: "JOKEY", antrenorPIT: "ANTRENOR", galopKaliteV1: "GALOP", galopPedigri: "GALOP", fMean: "FORM", lastWon: "FORM", kgsLog: "FORM", hpRel: "HANDIKAP_SINIF", kiloRel: "HANDIKAP_SINIF", dususDelta: "HANDIKAP_SINIF", h2hNetSkor: "HANDIKAP_SINIF", zeminToleransi: "PIST_MESAFE", zeminMesafeDeneyim: "PIST_MESAFE", sireOrani: "PEDIGRI", sexE: "DIGER" };
const TEKRAR: Record<string, string> = { tempoGeriBaski: "tempoOnBaski aynası (ρ=−1)" };
type Sig = [string, number | null, boolean, number?];
type Kosu = { raceId: string; tarih: string; hip: string; kosu: number; tip: string; kazananlar: number[]; atlar: { no: number; rank: number; p: number; sig: Sig[] }[] };
const lines = fs.readFileSync(".sinyal-veri/anlik.ndjson", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Kosu);
const out: string[] = []; let at = 0, kapsam = 0;
for (const r of lines) {
  for (const a of r.atlar) {
    const m = new Map(a.sig.map((s) => [s[0], s] as [string, Sig])); const sinyaller: Record<string, unknown> = {};
    let ham = 0, guclu = 0, zayif = 0, tekil = 0, gecerli = 0, belirsiz = 0; const aileler = new Set<string>(), aileGuc: Record<string, number> = {};
    for (let i = 0; i < CANLI.featureNames.length; i++) {
      const n = CANLI.featureNames[i]!; const s = m.get(n); if (!s) continue;
      const obs = s[2] && s[1] != null, rel: number | null = typeof s[3] === "number" ? s[3] : null;
      if (!obs) { sinyaller[n] = { obs: false }; continue; }
      const z = (s[1]! - CANLI.means[i]!) / CANLI.stds[i]!; const yon = YON[n]?.yon ?? null;
      if (yon == null) { sinyaller[n] = { ham: +s[1]!.toFixed(5), z: +z.toFixed(3), obs: true, yon: null, yonDurumu: YON[n]?.durum ?? "bilinmiyor", poz: null, guc: 0, guven: rel == null ? null : +rel.toFixed(3), ...(TEKRAR[n] ? { tekrar: TEKRAR[n] } : {}) }; belirsiz++; continue; } // yönü kararlı olmayan sinyal: kayıt var, DESTEK yok
      const zy = yon * z, poz = zy > 0, guc = Math.min(1, Math.max(0, zy / 2)), guven = rel;
      sinyaller[n] = { ham: +s[1]!.toFixed(5), z: +z.toFixed(3), zy: +zy.toFixed(3), obs: true, yon, poz: poz ? 1 : 0, guc: +guc.toFixed(3), guven: guven == null ? null : +guven.toFixed(3), ...(TEKRAR[n] ? { tekrar: TEKRAR[n] } : {}) };
      gecerli++;
      if (poz && guven != null) { ham++; if (!TEKRAR[n]) tekil++; if (guc >= 0.5) guclu++; else zayif++; const f = AILE[n] ?? "DIGER"; aileler.add(f); aileGuc[f] = Math.max(aileGuc[f] ?? 0, guc * guven!); }
    }
    if (!Object.keys(sinyaller).length) continue; at++; if (gecerli) kapsam++;
    out.push(JSON.stringify({ raceId: r.raceId, tarih: r.tarih, hip: r.hip, kosu: r.kosu, tip: r.tip, no: a.no, kazandi: r.kazananlar.includes(a.no) ? 1 : 0, canliSira: a.rank, canliP: +a.p.toFixed(2), sinyaller,
      ozet: { RAW_POSITIVE_COUNT: ham, RAW_POSITIVE_TEKIL: tekil, STRONG_POSITIVE_COUNT: guclu, WEAK_POSITIVE_COUNT: zayif, VALID_SIGNAL_COUNT: gecerli, YONU_BELIRSIZ_SINYAL_COUNT: belirsiz, POSITIVE_RATIO: gecerli ? +(ham / gecerli).toFixed(3) : null, POSITIVE_FAMILY_COUNT: aileler.size, AILE_GUC: aileGuc, SIGNAL_COVERAGE: +(gecerli / CANLI.featureNames.length).toFixed(3) } }));
  }
}
fs.writeFileSync(".sinyal-veri/banko-pozitiflik.ndjson", out.join("\n") + "\n");
console.log("banko-pozitiflik.ndjson: " + lines.length + " koşu, " + at + " at kaydı (" + kapsam + " en az bir geçerli sinyalli). GEÇİCİ güç/güven; banko kararına etkisi YOK.");
// kısa teşhis: ham pozitif sayısı ile kazanma ilişkisi (n küçükse YALNIZ bilgi)
const oz = out.map((l) => JSON.parse(l)) as { kazandi: number; ozet: { RAW_POSITIVE_COUNT: number; VALID_SIGNAL_COUNT: number } }[];
const tam = oz.filter((x) => x.ozet.VALID_SIGNAL_COUNT >= 20);
if (tam.length) { const ort = (a: number[]) => a.reduce((p, q) => p + q, 0) / a.length; console.log("≥20 geçerli sinyalli at: " + tam.length + " | kazananların ort. ham pozitif sayısı " + ort(tam.filter((x) => x.kazandi).map((x) => x.ozet.RAW_POSITIVE_COUNT)).toFixed(1) + " vs diğerleri " + ort(tam.filter((x) => !x.kazandi).map((x) => x.ozet.RAW_POSITIVE_COUNT)).toFixed(1)); }
