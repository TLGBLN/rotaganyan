import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import Link from "next/link";
import RefreshButton from "@/components/admin/RefreshButton";
import JokeySyncButton from "@/components/admin/JokeySyncButton";
import JokeyClearButton from "@/components/admin/JokeyClearButton";
import { getJokeyExpectedWinsTablosu } from "@/server/actions/jokey-expected-wins.actions";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ hipo?: string; pist?: string; irk?: string; sort?: string; q?: string }> };

export default async function AdminJokeyPage({ searchParams }: PageProps) {
  const { hipo, pist, irk, sort = "wins", q } = await searchParams;

  const where = {
    year: 2026,
    ...(hipo ? { hippoSlug: hipo } : {}),
    ...(pist ? { surface: pist } : {}),
    ...(irk ? { breed: irk } : {}),
    ...(q ? { jockey: { contains: q, mode: "insensitive" as const } } : {}),
  };

  // Jokey başına toplu istatistik
  const grouped = await db.jockeyStatSync.groupBy({
    by: ["jockey"],
    where,
    _sum: { rides: true, wins: true, tableCount: true },
    _avg: { performanceScore: true },
    orderBy: sort === "score"
      ? { _avg: { performanceScore: "desc" } }
      : sort === "rides"
      ? { _sum: { rides: "desc" } }
      : { _sum: { wins: "desc" } },
  });

  const rows = grouped.map((g) => {
    const rides = g._sum.rides ?? 0;
    const wins = g._sum.wins ?? 0;
    const tableCount = g._sum.tableCount ?? 0;
    return {
      jockey: g.jockey,
      rides,
      wins,
      tableCount,
      winRate: rides > 0 ? wins / rides : 0,
      tableRate: rides > 0 ? tableCount / rides : 0,
      performanceScore: g._avg.performanceScore,
    };
  });

  const expectedReport = await getJokeyExpectedWinsTablosu(new Date(), {
    jockeyNames: rows.map(r => r.jockey),
    hippodromeSlug: hipo,
    surface: pist,
    breed: irk,
  });
  const expectedRows = [...expectedReport.rows].sort((a,b) => {
    if (sort === "rides") return b.son30Start - a.son30Start || a.jockey.localeCompare(b.jockey, "tr");
    if (sort === "score") return (b.etkinForm ?? -1000) - (a.etkinForm ?? -1000) || a.jockey.localeCompare(b.jockey, "tr");
    return b.son30Win - a.son30Win || a.jockey.localeCompare(b.jockey, "tr");
  });

  // Mevcut veri setleri (filtre seçenekleri için)
  const datasets = await db.jockeyStatSync.groupBy({
    by: ["hippoSlug", "breed", "surface", "year"],
    _count: { jockey: true },
    orderBy: [{ year: "desc" }, { hippoSlug: "asc" }],
  });

  const hippos = [...new Set(datasets.map((d) => d.hippoSlug))].sort();
  const surfaces = [...new Set(datasets.map((d) => d.surface).filter(Boolean))].sort();
  const breeds = [...new Set(datasets.map((d) => d.breed).filter(Boolean))].sort();

  // Bağlam etiketi
  const ctxParts: string[] = [];
  if (hipo) ctxParts.push(hipo);
  else ctxParts.push("Tüm hipodromlar");
  if (pist) ctxParts.push({ CIM: "Çim", KUM: "Kum", SENTETIK: "Sentetik" }[pist] ?? pist);
  if (irk) ctxParts.push(irk === "INGILIZ" ? "İngiliz" : irk === "ARAP" ? "Arap" : irk);
  const contextLabel = ctxParts.join(" · ") + " · 2026";

  const isFiltered = !!(hipo || pist || irk || q);

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Jokey İstatistikleri</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {contextLabel} · {rows.length} jokey
          </p>
        </div>
        <RefreshButton className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
      </div>

      {/* Filtreler — tam genişlik */}
      <form method="GET" className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Jokey Ara</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="İsim..."
            className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand min-w-[130px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Hipodrom</label>
          <select name="hipo" defaultValue={hipo ?? ""} className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none min-w-[110px]">
            <option value="">Tümü</option>
            {hippos.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Pist</label>
          <select name="pist" defaultValue={pist ?? ""} className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none min-w-[90px]">
            <option value="">Tümü</option>
            {surfaces.map((s) => <option key={s ?? ""} value={s ?? ""}>{s === "CIM" ? "Çim" : s === "KUM" ? "Kum" : s === "SENTETIK" ? "Sentetik" : s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Irk</label>
          <select name="irk" defaultValue={irk ?? ""} className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none min-w-[90px]">
            <option value="">Tümü</option>
            {breeds.map((b) => <option key={b ?? ""} value={b ?? ""}>{b === "INGILIZ" ? "İngiliz" : b === "ARAP" ? "Arap" : b}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Sırala</label>
          <select name="sort" defaultValue={sort} className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none min-w-[100px]">
            <option value="wins">30G Galibiyet</option>
            <option value="rides">30G Biniş</option>
            <option value="score">Beklentiye Göre Form</option>
          </select>
        </div>
        <button type="submit" className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 transition-colors">
          Filtrele
        </button>
        {isFiltered && (
          <Link href="/admin/jokey" className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            Temizle
          </Link>
        )}
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sol: Import + yönetim */}
        <div className="space-y-4">
          <JokeySyncButton />
          <JokeyClearButton />


          {datasets.length > 0 && (
            <div className="rounded-xl border p-3 space-y-1.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Yüklü Setler</h3>
              {datasets.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                  <span className="font-medium capitalize">
                    {d.hippoSlug}
                    {d.surface ? ` · ${d.surface === "CIM" ? "Çim" : d.surface === "KUM" ? "Kum" : "Snt"}` : ""}
                    {d.breed ? ` · ${d.breed === "INGILIZ" ? "İng" : "Arap"}` : ""}
                  </span>
                  <span className="text-muted-foreground">{d._count.jockey}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sağ: yeni beklenti tablosu + korunan TJK ham verileri */}
        <div className="lg:col-span-3 space-y-4">
          <section className="rounded-lg border overflow-hidden">
            <div className="p-3 border-b bg-muted/20 space-y-1">
              <h2 className="text-sm font-semibold">Son 30 Gün — Jokey Beklenen Galibiyet Formu</h2>
              <p className="text-[11px] text-muted-foreground">
                Piyasa beklentisine göre performans farkı (W−E); jokeyin saf nedensel katkısı değildir.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Ölçülebilen yarış: {expectedReport.pricedRaceCount}/{expectedReport.raceCount}.
                Saati bulunmayan yarış: {expectedReport.skippedTimeCount}.
                Son30G veya referans döneminde ölçülemeyen biniş oranı %30'u aşarsa Form/Güven gizlenir.
              </p>
            </div>
            {expectedRows.length === 0 ? (
              <p className="p-6 text-xs text-muted-foreground">
                Bu filtre için jokey bulunamadı. Ham TJK kayıtlarını aşağıdan kontrol edin.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b bg-muted/50 text-muted-foreground">
                      <th className="px-2 py-2 text-left">#</th>
                      <th className="px-2 py-2 text-left">Jokey</th>
                      <th className="px-2 py-2 text-center">30G Biniş</th>
                      <th className="px-2 py-2 text-center">Ölçülen</th>
                      <th className="px-2 py-2 text-center">Galibiyet*</th>
                      <th className="px-2 py-2 text-center">K%*</th>
                      <th className="px-2 py-2 text-center">Beklenen E*</th>
                      <th className="px-2 py-2 text-center">Fark W−E*</th>
                      <th className="px-2 py-2 text-center">Ölçülemedi</th>
                      <th className="px-2 py-2 text-center">Form</th>
                      <th className="px-2 py-2 text-center">Güven</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expectedRows.map((r,i) => (
                      <tr key={r.jockey} className={cn("border-b last:border-0",i%2===1&&"bg-muted/20")}>
                        <td className="px-2 py-2 text-muted-foreground">{i+1}</td>
                        <td className="px-2 py-2 font-semibold">{r.jockey}</td>
                        <td className="px-2 py-2 text-center tabular-nums">{r.son30Start}</td>
                        <td className="px-2 py-2 text-center tabular-nums">{r.son30Olculen}</td>
                        <td className="px-2 py-2 text-center tabular-nums">
                          {r.son30Olculen>0?r.son30Win:"—"}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums">
                          {r.son30Olculen>0?("%"+(100*r.son30Win/r.son30Olculen).toFixed(1)):"—"}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums">
                          {r.son30Olculen>0?r.son30Expected.toFixed(2):"—"}
                        </td>
                        <td className={cn("px-2 py-2 text-center tabular-nums font-semibold",
                          r.son30Residual>0?"text-hit":r.son30Residual<0?"text-destructive":"text-muted-foreground")}>
                          {r.son30Olculen>0?((r.son30Residual>0?"+":"")+r.son30Residual.toFixed(2)):"—"}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums">
                          {r.son30Olculemeyen} {r.son30Start?"(%"+(100*r.olculemeyenOrani).toFixed(0)+")":""}
                        </td>
                        <td className="px-2 py-2 text-center" title={"Ref: "+r.refTier+", ölçülemeyen: "+r.refOlculemeyen+", z="+(r.z?.toFixed(2)??"—")}>
                          {r.guvenGosterilebilirMi && r.durum?r.durum:"—"}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums">
                          {r.guvenGosterilebilirMi?"%"+(100*r.reliability).toFixed(0):"—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="p-3 border-t text-[11px] text-muted-foreground space-y-1">
              <p>*W, E ve K% yalnız AGF'si ölçülebilen binişlerden hesaplanır. Toplam Biniş/Ölçülemedi bütün binişlerdir.</p>
              <p>Form = [Son30G (W−E)/N − Referans (W−E)/N] × N30/(N30+8). N ölçülen biniş sayısıdır.
                Güven, doğruluk olasılığı değil örneklem düzeltme katsayısıdır.</p>
              <p>{expectedReport.note}</p>
            </div>
          </section>

          <section className="rounded-lg border overflow-hidden">
            <h2 className="px-3 py-2 text-xs font-semibold border-b bg-muted/20">
              Ham TJK Verisi — Yıllık İstatistikler (Korundu)
            </h2>
            {rows.length===0?(
              <p className="p-4 text-xs text-muted-foreground">Yıllık ham istatistik bulunamadı.</p>
            ):(
              <div className="overflow-x-auto">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b bg-muted/50 text-muted-foreground">
                      <th className="px-3 py-2 text-left">Jokey</th>
                      <th className="px-3 py-2 text-center">Biniş</th>
                      <th className="px-3 py-2 text-center">1.</th>
                      <th className="px-3 py-2 text-center">K%</th>
                      <th className="px-3 py-2 text-center">Tb%</th>
                      <th className="px-3 py-2 text-center">Skor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r=>(
                      <tr key={r.jockey} className="border-b last:border-0">
                        <td className="px-3 py-2 font-semibold">{r.jockey}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{r.rides}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{r.wins}</td>
                        <td className="px-3 py-2 text-center tabular-nums">%{(r.winRate*100).toFixed(1)}</td>
                        <td className="px-3 py-2 text-center tabular-nums">%{(r.tableRate*100).toFixed(1)}</td>
                        <td className="px-3 py-2 text-center tabular-nums">
                          {r.performanceScore!=null?r.performanceScore.toFixed(1):"—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="p-3 border-t text-[11px] text-muted-foreground">
              Kaynak: JockeyStatSync (yıllık TJK setleri). Ayrı veri kümesidir; Form Endeksi hesabına eklenmez.
              Hipodrom veri setleri örtüşebileceğinden toplulaştırma kapsamı ayrıca kontrol edilmelidir.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
