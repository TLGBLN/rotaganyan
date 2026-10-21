// AGF Sırası — TEK paylaşılan hesap (train + live). 2026-08-30 bug-fix (eküri ortaklarının
// AGF'si TOPLU değerlendirilir, aynı sırayı paylaşırlar — TJK'nın kendi gösterimiyle tutarlı)
// daha önce yalnız v5-engine.ts'e (canlı) uygulanmıştı; arac-model-veri-olustur.mts (eğitim)
// hâlâ eski, eküri-farkında-olmayan basit sıralamayı kullanıyordu — 2026-10-07'de bu dosyaya
// taşınarak TEK kaynağa indirgendi (bkz. V5.46.1 parity denetimi).
//
// 2026-10-18 — ROTAGANYAN V1.0: Bu dosya canlı rotaganyan reposundan (src/lib/methodology/
// agf-sirasi.ts, commit 400ec22'den beri orada) DEĞİŞTİRİLMEDEN kopyalandı — bu worktree'nin
// git tabanı (origin/master, ed4a28b) o commit'i içermiyor (canlı repoda yerel/push edilmemiş
// commit'ler var, bkz. V1.0 AGF araştırma raporu). Saf, DB'siz, test edilmiş bir fonksiyon
// olduğu için kopyalamak güvenli — AGF_01'in piyasa-sırası hesaplamasında AYNEN reuse edilir.
export interface AgfSiraGirdi { id: string; agf: number | null; ekuriGroup: number | null }

export function hesaplaAgfSirasi(runners: AgfSiraGirdi[]): Map<string, number> {
  const agfToplamByEkuriGroup = new Map<number, number>();
  for (const r of runners) {
    if (r.ekuriGroup != null && r.agf != null) {
      agfToplamByEkuriGroup.set(r.ekuriGroup, (agfToplamByEkuriGroup.get(r.ekuriGroup) ?? 0) + r.agf);
    }
  }
  const siralamaDegeri = (r: AgfSiraGirdi): number => {
    if (r.ekuriGroup != null) return agfToplamByEkuriGroup.get(r.ekuriGroup) ?? (r.agf ?? 0);
    return r.agf ?? 0;
  };
  const benzersizDegerler = [...new Set(runners.filter((r) => r.agf != null).map(siralamaDegeri))].sort((a, b) => b - a);
  const siraByDeger = new Map(benzersizDegerler.map((deger, i) => [deger, i + 1]));
  const sonuc = new Map<string, number>();
  for (const r of runners) {
    if (r.agf == null) continue;
    sonuc.set(r.id, siraByDeger.get(siralamaDegeri(r))!);
  }
  return sonuc;
}
