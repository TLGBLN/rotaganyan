import { getTjkMerkeziData, type TjkBreed, type TjkFilters, type TjkKindFilter } from "@/server/services/tjk-pedigri-merkezi.service";

export type TjkPedigriSearchParams = { irk?: string; q?: string; tur?: string; yil?: string; grup?: string; pist?: string };

// TJK Aygır sayfasının süzgeç seçenekleri (kimlikler TJK formundan).
const GRUPLAR: [number, string][] = [[-1, "Tüm gruplar"], [1, "2 Yaşlı İngilizler"], [6, "3 Yaşlı Araplar"], [3, "3 Yaşlı İngilizler"], [5, "4 ve Yukarı İngilizler"], [8, "4 Yaşlı Araplar"], [10, "5 ve Yukarı Araplar"]];
const PISTLER: [number, string][] = [[-1, "Tüm pistler"], [1, "Çim"], [2, "Kum"], [4, "Sentetik"]];

const num = (v: number, d = 0) => v.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
const kindAd = (k: string) => (k === "SIRE" ? "Aygır" : k === "DAM" ? "Kısrak" : "Kısrak Babası");

function parse(sp: TjkPedigriSearchParams): TjkFilters {
  const breed: TjkBreed = sp.irk === "ARAP" ? "ARAP" : "INGILIZ";
  const g = Number(sp.grup), ps = Number(sp.pist);
  const grup = GRUPLAR.some(([k]) => k === g) && sp.grup != null && sp.grup !== "" ? g : -1;
  const pist = PISTLER.some(([k]) => k === ps) && sp.pist != null && sp.pist !== "" ? ps : -1;
  // Pist yalnız Aygır sayfasında vardır → pist seçiliyse tür Aygır'a kilitlenir. Grup Aygır ve Kısrak Babası sayfalarında vardır (Kısrak'ta yok).
  const kind: TjkKindFilter = pist !== -1 ? "SIRE" : sp.tur === "SIRE" || sp.tur === "DAM" || sp.tur === "DAMSIRE" ? sp.tur : "ALL";
  const y = Number(sp.yil); const year = Number.isFinite(y) && sp.yil != null && sp.yil !== "" ? y : 2026;
  return { breed, kind, year, q: (sp.q ?? "").trim(), grup, pist };
}

function Ozet({ baslik, deger }: { baslik: string; deger: number }) {
  return (
    <div>
      <p className="text-muted-foreground">{baslik}</p>
      <p className="font-bold">{deger.toLocaleString("tr-TR")}</p>
    </div>
  );
}

export default async function TjkPedigriMerkeziPanel({ searchParams, currentDate }: { searchParams: TjkPedigriSearchParams; currentDate: string }) {
  const filters = parse(searchParams);
  const data = await getTjkMerkeziData(filters);
  const irkAd = filters.breed === "INGILIZ" ? "İngiliz" : "Arap";
  const toplam = data.sayilar.SIRE + data.sayilar.DAM + data.sayilar.DAMSIRE;
  const yillar = data.yillar.length ? data.yillar : [2026];

  return (
    <section className="space-y-5 rounded-xl border bg-muted/10 p-4 md:p-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">ROTAGANYAN</p>
        <h1 className="mt-1 text-2xl font-black">Pedigri Merkezi</h1>
        <p className="mt-2 max-w-5xl text-xs leading-relaxed text-muted-foreground">
          Bu sayfadaki tüm veri doğrudan resmî TJK Aygır / Kısrak / Kısrak Babası istatistik sayfalarından çekilir ve TJK kimliğiyle saklanır
          (adlandırma farkından etkilenmez). Veri destek/audit amaçlıdır ve mevcut V5 skorunu değiştirmez.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{irkAd} TJK resmî · {filters.year}</p>
        <p className="mt-1 text-3xl font-black">{toplam.toLocaleString("tr-TR")}</p>
        <div className="mt-3 grid max-w-md grid-cols-3 gap-3 text-xs">
          <Ozet baslik="Aygır" deger={data.sayilar.SIRE} />
          <Ozet baslik="Kısrak" deger={data.sayilar.DAM} />
          <Ozet baslik="Kısrak Babası" deger={data.sayilar.DAMSIRE} />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {filters.pist !== -1 ? "Pist süzgeci yalnız Aygır için vardır. " : filters.grup !== -1 ? "Grup süzgeci Aygır ve Kısrak Babası için vardır (Kısrak’ta yok). " : ""}Son güncelleme: {data.sonGuncelleme ? new Date(data.sonGuncelleme).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : "henüz çekilmedi"}.
        </p>
      </div>

      <form method="get" className="grid gap-2 lg:grid-cols-7">
        <input type="hidden" name="tarih" value={currentDate} />
        <select name="irk" defaultValue={filters.breed} className="rounded-md border bg-background px-2 py-2 text-xs">
          <option value="INGILIZ">İngiliz</option>
          <option value="ARAP">Arap</option>
        </select>
        <input name="q" defaultValue={filters.q} placeholder="Aygır / kısrak / kısrak babası ara" className="rounded-md border bg-background px-3 py-2 text-xs lg:col-span-2" />
        <select name="tur" defaultValue={filters.kind} className="rounded-md border bg-background px-2 py-2 text-xs">
          <option value="ALL">Aygır + Kısrak + Kısrak Babası</option>
          <option value="SIRE">Aygır</option>
          <option value="DAM">Kısrak</option>
          <option value="DAMSIRE">Kısrak Babası</option>
        </select>
        <select name="grup" defaultValue={String(filters.grup)} className="rounded-md border bg-background px-2 py-2 text-xs" title="Yalnız Aygır">
          {GRUPLAR.map(([k, ad]) => <option key={k} value={k}>{ad}</option>)}
        </select>
        <select name="pist" defaultValue={String(filters.pist)} className="rounded-md border bg-background px-2 py-2 text-xs" title="Yalnız Aygır">
          {PISTLER.map(([k, ad]) => <option key={k} value={k}>{ad}</option>)}
        </select>
        <div className="flex gap-2">
          <select name="yil" defaultValue={String(filters.year)} className="min-w-0 flex-1 rounded-md border bg-background px-2 py-2 text-xs">
            {yillar.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="submit" className="rounded-md bg-brand px-3 py-2 text-xs font-bold text-brand-foreground">Ara</button>
        </div>
      </form>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black">TJK resmî istatistikler</h2>
          <span className="text-[11px] text-muted-foreground">{data.satirlar.length} kayıt gösteriliyor (koşuya göre sıralı, en çok 150)</span>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-background">
          <table className="w-full text-[11px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-1.5 py-1.5 text-left">Tür</th>
                <th className="px-1.5 py-1.5 text-left">İsim</th>
                <th className="px-1.5 py-1.5 text-right">Tay</th>
                <th className="px-1.5 py-1.5 text-right">Kaz. yavru</th>
                <th className="px-1.5 py-1.5 text-right">Koşu</th>
                <th className="px-1.5 py-1.5 text-right">1.</th>
                <th className="px-1.5 py-1.5 text-right">K%</th>
                <th className="px-1.5 py-1.5 text-right">2.</th>
                <th className="px-1.5 py-1.5 text-right">3.</th>
                <th className="px-1.5 py-1.5 text-right">4.</th>
                <th className="px-1.5 py-1.5 text-right">5.</th>
                <th className="px-1.5 py-1.5 text-right">Kazanç</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.satirlar.length === 0 ? (
                <tr><td colSpan={12} className="px-1.5 py-6 text-center text-muted-foreground">Bu filtrelerde kayıt yok{toplam === 0 ? " (bu ırk/yıl için henüz TJK verisi çekilmemiş)" : ""}.</td></tr>
              ) : data.satirlar.map((s) => (
                <tr key={`${s.kind}-${s.tjkId}`}>
                  <td className="px-1.5 py-1.5 font-semibold">{kindAd(s.kind)}</td>
                  <td className="px-1.5 py-1.5"><div className="font-bold">{s.name}</div><div className="text-[9px] text-muted-foreground">{s.country ?? ""} · TJK #{s.tjkId}</div></td>
                  <td className="px-1.5 py-1.5 text-right">{num(s.runnerCount)}</td>
                  <td className="px-1.5 py-1.5 text-right">{s.winnerCount == null ? "—" : num(s.winnerCount)}</td>
                  <td className="px-1.5 py-1.5 text-right">{num(s.starts)}</td>
                  <td className="px-1.5 py-1.5 text-right">{num(s.wins)}</td>
                  <td className="px-1.5 py-1.5 text-right font-bold">%{num(s.winRatePct, 1)}</td>
                  <td className="px-1.5 py-1.5 text-right">{num(s.seconds)}</td>
                  <td className="px-1.5 py-1.5 text-right">{num(s.thirds)}</td>
                  <td className="px-1.5 py-1.5 text-right">{num(s.fourths)}</td>
                  <td className="px-1.5 py-1.5 text-right">{num(s.fifths)}</td>
                  <td className="px-1.5 py-1.5 text-right">{num(s.earningsTRY)} ₺</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
