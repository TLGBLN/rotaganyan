import { getOwnPedigri, getTjkMerkeziData, type TjkBreed, type TjkDistance, type TjkFilters, type TjkKindFilter, type TjkSatir, type TjkSurface } from "@/server/services/tjk-pedigri-merkezi.service";

export type TjkPedigriSearchParams = { irk?: string; q?: string; tur?: string; yil?: string; pist?: string; mesafe?: string };

const num = (v: number, d = 0) => v.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
const kindAd = (k: string) => (k === "SIRE" ? "Aygır" : k === "DAM" ? "Kısrak" : "Kısrak Babası");
const pistAd = (v: string) => (v === "CIM" ? "Çim" : v === "KUM" ? "Kum" : v === "SENTETIK" ? "Sentetik" : v);
const yilAd = (y: number) => (y === -1 ? "Tüm yıllar" : String(y));

function parse(sp: TjkPedigriSearchParams): TjkFilters {
  const breed: TjkBreed = sp.irk === "ARAP" ? "ARAP" : "INGILIZ";
  const kind: TjkKindFilter = sp.tur === "SIRE" || sp.tur === "DAM" || sp.tur === "DAMSIRE" ? sp.tur : "ALL";
  const y = Number(sp.yil); const year = Number.isFinite(y) && sp.yil != null && sp.yil !== "" ? y : 2026;
  const surface: TjkSurface = sp.pist === "CIM" || sp.pist === "KUM" || sp.pist === "SENTETIK" ? sp.pist : "ALL";
  const distance: TjkDistance = sp.mesafe === "800-1400" || sp.mesafe === "1500-2000" || sp.mesafe === "2100-3200" ? sp.mesafe : "ALL";
  return { breed, kind, year, q: (sp.q ?? "").trim(), surface, distance };
}

function Ozet({ baslik, deger }: { baslik: string; deger: number }) {
  return (
    <div>
      <p className="text-muted-foreground">{baslik}</p>
      <p className="font-bold">{deger.toLocaleString("tr-TR")}</p>
    </div>
  );
}

function BantTablosu({ s }: { s: TjkSatir }) {
  if (s.bantDurumu === "belirsiz") return <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800" title="Bu ad birden çok TJK kaydına uyuyor; yanlış ata bant yapıştırmamak için atanmadı.">belirsiz ad</span>;
  if (s.bantlar.length === 0) return <span className="text-[10px] text-muted-foreground">—</span>;
  return (
    <details>
      <summary className="cursor-pointer list-none text-[10px] font-semibold text-brand">{s.bantlar.length} bant ▾</summary>
      <table className="mt-1 w-full text-[10px]">
        <thead><tr className="text-muted-foreground"><th className="text-left">Pist</th><th className="text-left">Mesafe</th><th className="text-right">Start</th><th className="text-right">1.</th><th className="text-right">K%</th><th className="text-right">AEI</th></tr></thead>
        <tbody>
          {s.bantlar.map((b, i) => (
            <tr key={i}><td>{pistAd(b.surface)}</td><td>{b.distanceBand}</td><td className="text-right">{num(b.starts)}</td><td className="text-right">{num(b.wins)}</td><td className="text-right font-bold">%{num(b.winRatePct)}</td><td className="text-right">{b.aei == null ? "—" : num(b.aei, 2)}</td></tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export default async function TjkPedigriMerkeziPanel({ searchParams, currentDate }: { searchParams: TjkPedigriSearchParams; currentDate: string }) {
  const filters = parse(searchParams);
  const [data, own] = await Promise.all([getTjkMerkeziData(filters), getOwnPedigri(filters)]);
  const irkAd = filters.breed === "INGILIZ" ? "İngiliz" : "Arap";
  const toplam = data.sayilar.SIRE + data.sayilar.DAM + data.sayilar.DAMSIRE;
  const yillar = data.yillar.length ? data.yillar : [2026, -1];

  return (
    <section className="space-y-5 rounded-xl border bg-muted/10 p-4 md:p-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">ROTAGANYAN</p>
        <h1 className="mt-1 text-2xl font-black">Pedigri Merkezi</h1>
        <p className="mt-2 max-w-5xl text-xs leading-relaxed text-muted-foreground">
          TJK resmî Aygır / Kısrak / Kısrak Babası istatistikleri doğrudan TJK sayfalarından çekilir ve TJK kimliğiyle saklanır (adlandırma farkından etkilenmez).
          Rotaganyan Own verisi yarış sonuçlarından üretilir ve TJK tablosunu ezmez. Mevcut V5 skorunda Own Sire sinyali kullanılır; TJK, Dam, DamSire ve
          Own Dam/DamSire bu ekranda destek/audit verisi olarak gösterilir ve mevcut skoru değiştirmez. TJK sayfalarında mesafe/pist kırılımı yoktur;
          mesafe/pist bantları ad eşleştirmesiyle TJK kayıtlarına bağlanır (ad birden çok kayda uyuyorsa bağlanmaz, &quot;belirsiz ad&quot; yazar).
          Genel Not yalnız manuel kayıt/gösterim alanıdır; güncel V5 motoruna otomatik olarak girmez.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{irkAd} TJK resmî · {yilAd(filters.year)}</p>
          <p className="mt-1 text-3xl font-black">{toplam.toLocaleString("tr-TR")}</p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
            <Ozet baslik="Aygır" deger={data.sayilar.SIRE} />
            <Ozet baslik="Kısrak" deger={data.sayilar.DAM} />
            <Ozet baslik="Kısrak Babası" deger={data.sayilar.DAMSIRE} />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Resmî TJK sayfalarından, kimlikle. Son güncelleme: {data.sonGuncelleme ? new Date(data.sonGuncelleme).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : "henüz çekilmedi"}.
            Mesafe/pist bandı bulunan: {data.toplamEslesen}/{data.satirlar.length}.
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{irkAd} Rotaganyan Own</p>
          <p className="mt-1 text-3xl font-black">{own.counts.total.toLocaleString("tr-TR")}</p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
            <Ozet baslik="Aygır (Sire)" deger={own.counts.sire} />
            <Ozet baslik="Kısrak (Dam)" deger={own.counts.dam} />
            <Ozet baslik="Kısrak Babası" deger={own.counts.damSire} />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Sonuçlanmış Runner + Result kayıtlarından otomatik hesaplanır.</p>
        </div>
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
        <select name="yil" defaultValue={String(filters.year)} className="rounded-md border bg-background px-2 py-2 text-xs">
          {yillar.map((y) => <option key={y} value={y}>{yilAd(y)}</option>)}
        </select>
        <select name="pist" defaultValue={filters.surface} className="rounded-md border bg-background px-2 py-2 text-xs">
          <option value="ALL">Tüm pistler</option>
          <option value="CIM">Çim</option>
          <option value="KUM">Kum</option>
          <option value="SENTETIK">Sentetik</option>
        </select>
        <div className="flex gap-2">
          <select name="mesafe" defaultValue={filters.distance} className="min-w-0 flex-1 rounded-md border bg-background px-2 py-2 text-xs">
            <option value="ALL">Tüm mesafeler</option>
            <option value="800-1400">800-1400</option>
            <option value="1500-2000">1500-2000</option>
            <option value="2100-3200">2100-3200</option>
          </select>
          <button type="submit" className="rounded-md bg-brand px-3 py-2 text-xs font-bold text-brand-foreground">Ara</button>
        </div>
      </form>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black">TJK resmî istatistikler</h2>
          <span className="text-[11px] text-muted-foreground">{data.satirlar.length} kayıt gösteriliyor / {toplam.toLocaleString("tr-TR")} toplam (koşuya göre sıralı, en çok 150)</span>
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
                <th className="px-1.5 py-1.5 text-right">Kazanç</th>
                <th className="px-1.5 py-1.5 text-left">Mesafe/pist</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.satirlar.length === 0 ? (
                <tr><td colSpan={11} className="px-1.5 py-6 text-center text-muted-foreground">Bu filtrelerde kayıt yok{toplam === 0 ? " (bu yıl/ırk için henüz TJK verisi çekilmemiş)" : ""}.</td></tr>
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
                  <td className="px-1.5 py-1.5 text-right">{num(s.earningsTRY)} ₺</td>
                  <td className="px-1.5 py-1.5"><BantTablosu s={s} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black">Rotaganyan Own</h2>
          <span className="text-[11px] text-muted-foreground">{own.rows.length} kayıt gösteriliyor / {own.counts.total.toLocaleString("tr-TR")} toplam</span>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-background">
          <table className="w-full text-[11px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-1.5 py-1.5 text-left">Tür</th>
                <th className="px-1.5 py-1.5 text-left">İsim</th>
                <th className="px-1.5 py-1.5 text-left">Pist</th>
                <th className="px-1.5 py-1.5 text-left">Mesafe</th>
                <th className="px-1.5 py-1.5 text-right">Start</th>
                <th className="px-1.5 py-1.5 text-right">1.</th>
                <th className="px-1.5 py-1.5 text-right">K%</th>
                <th className="px-1.5 py-1.5 text-right">2.</th>
                <th className="px-1.5 py-1.5 text-right">3.</th>
                <th className="px-1.5 py-1.5 text-right">Yavru/Torun</th>
                <th className="px-1.5 py-1.5 text-left">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {own.rows.length === 0 ? (
                <tr><td colSpan={11} className="px-1.5 py-6 text-center text-muted-foreground">Bu filtrelerde Own kayıt yok.</td></tr>
              ) : own.rows.map((r, i) => (
                <tr key={`${r.sourceType}-${r.entityName}-${r.surface}-${r.distanceBand}-${i}`}>
                  <td className="px-1.5 py-1.5 font-semibold">{r.sourceType === "SIRE" ? "Sire" : r.sourceType === "DAM" ? "Dam" : "DamSire"}</td>
                  <td className="px-1.5 py-1.5"><div className="font-bold">{r.entityName}</div>{r.relatedName ? <div className="text-[9px] text-muted-foreground">DS: {r.relatedName}</div> : null}</td>
                  <td className="px-1.5 py-1.5">{r.surface}</td>
                  <td className="px-1.5 py-1.5">{r.distanceBand}</td>
                  <td className="px-1.5 py-1.5 text-right">{num(r.starts)}</td>
                  <td className="px-1.5 py-1.5 text-right">{num(r.wins)}</td>
                  <td className="px-1.5 py-1.5 text-right font-bold">%{num(r.winRatePct)}</td>
                  <td className="px-1.5 py-1.5 text-right">{num(r.seconds)}</td>
                  <td className="px-1.5 py-1.5 text-right">{num(r.thirds)}</td>
                  <td className="px-1.5 py-1.5 text-right">{r.sourceType === "SIRE" ? "—" : `${num(r.winningOffspringCount)}/${num(r.offspringCount)}`}</td>
                  <td className="px-1.5 py-1.5">
                    <span className={r.sourceType === "SIRE" ? "rounded-full bg-hit/15 px-1.5 py-0.5 text-[9px] font-bold text-hit" : "rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground"}>
                      {r.sourceType === "SIRE" ? "V5 Sire" : "Destek"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
