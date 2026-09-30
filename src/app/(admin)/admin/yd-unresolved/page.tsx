import { db } from "@/lib/db";
import { markYdUnresolvedReviewed } from "@/server/actions/yd-unresolved.actions";

export const dynamic = "force-dynamic";

type SearchParams = { status?: string; entityType?: string };

/**
 * YD Veri Bankası — Unresolved Kuyruğu. Kullanıcı kararı (Entity Resolution V1.1):
 * "atlanmasın; UNRESOLVED olarak karantinaya alınsın... hiçbir kaydı sessizce
 * kaybetmeyelim." Bu sayfa o kuyruğu admin'in GÖREBİLDİĞİ tek yer — TR admin
 * sayfalarından TAMAMEN AYRI.
 */
export default async function YdUnresolvedPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const status = sp.status || "UNRESOLVED";

  const kayitlar = await db.yurtDisiUnresolvedEntity.findMany({
    where: {
      status: status === "TUMU" ? undefined : status,
      entityType: sp.entityType || undefined,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const sayimlar = await db.yurtDisiUnresolvedEntity.groupBy({ by: ["status"], _count: { _all: true } });
  const sayimMap = Object.fromEntries(sayimlar.map((s) => [s.status, s._count._all]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">YD Veri Bankası — Unresolved Kuyruğu</h1>
        <p className="text-xs text-muted-foreground">
          Güvenilir kimliği kurulamayan veya çakışma şüphesi olan kayıtlar — hiçbiri sessizce kaybolmadı,
          buradan gözden geçirilip &quot;REVIEWED&quot; olarak işaretlenebilir.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {["UNRESOLVED", "REVIEWED", "RESOLVED", "TUMU"].map((s) => (
          <a
            key={s}
            href={`?status=${s}${sp.entityType ? `&entityType=${sp.entityType}` : ""}`}
            className={`rounded-md border px-2.5 py-1 ${status === s ? "bg-brand/15 text-brand border-brand" : "text-muted-foreground"}`}
          >
            {s} {sayimMap[s] != null ? `(${sayimMap[s]})` : s === "TUMU" ? `(${sayimlar.reduce((a, b) => a + b._count._all, 0)})` : "(0)"}
          </a>
        ))}
      </div>

      {kayitlar.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Bu filtrede kayıt yok.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/60 text-left text-muted-foreground">
                <th className="px-2 py-1.5">Tür</th>
                <th className="px-2 py-1.5">Kaynak İsim</th>
                <th className="px-2 py-1.5">Normalize</th>
                <th className="px-2 py-1.5">Bağlam</th>
                <th className="px-2 py-1.5">Güven</th>
                <th className="px-2 py-1.5">Tarih</th>
                <th className="px-2 py-1.5">Durum</th>
                <th className="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {kayitlar.map((k) => (
                <tr key={k.id} className="border-b">
                  <td className="px-2 py-1.5 font-semibold">{k.entityType}</td>
                  <td className="px-2 py-1.5">{k.sourceName}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{k.normalizedName}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                    {k.context ? JSON.stringify(k.context) : "—"}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{k.confidence != null ? k.confidence.toFixed(2) : "—"}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{k.createdAt.toLocaleDateString("tr-TR")}</td>
                  <td className="px-2 py-1.5">{k.status}</td>
                  <td className="px-2 py-1.5">
                    {k.status === "UNRESOLVED" && (
                      <form action={markYdUnresolvedReviewed}>
                        <input type="hidden" name="id" value={k.id} />
                        <button type="submit" className="rounded border px-2 py-0.5 hover:bg-muted">
                          Gözden geçirildi
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
