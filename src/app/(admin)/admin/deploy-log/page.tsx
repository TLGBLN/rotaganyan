import { db } from "@/lib/db";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

// 2026-09-27 kullanıcı talebi ("admin sayfasında backup kayıtları tutulsun") — DeployLog
// tablosunun (bkz. arac-deploy-kaydet.mts / arac-deploy-tarihce.mts, CLAUDE.md) admin
// panelden de okunabilmesi için. Tam-site-geri-alma vakasında "21.09'da tam olarak hangi
// commit canlıydı" sorusunu yanıtlamak için SAATLER harcandı — bu sayfa o soruyu (ve genel
// olarak "şu an hangi deploy canlı, ne zaman/neden yapıldı") CLI'ye hiç gerek kalmadan
// anında cevaplar.
const TUR_ETIKET: Record<string, string> = { feature: "Özellik", fix: "Düzeltme", revert: "Geri Alma", config: "Yapılandırma" };
const TUR_RENK: Record<string, string> = {
  feature: "bg-brand/15 text-brand border-brand/30",
  fix: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  revert: "bg-miss/15 text-miss border-miss/30",
  config: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30",
};

export default async function DeployLogPage() {
  const kayitlar = await db.deployLog.findMany({ orderBy: { deployedAt: "desc" }, take: 200 });
  const sonKayit = kayitlar[0];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold">Deploy Kayıtları</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Her production deploy'undan sonra kaydedilir — &quot;şu an tam olarak hangi commit
          canlı, ne zaman ve neden deploy edildi&quot; sorusunu git arkeolojisi yapmadan
          cevaplar (bkz. CLAUDE.md).
        </p>
      </div>

      {sonKayit && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-hit animate-pulse shrink-0" />
            <span className="text-sm font-semibold">Şu an canlı olan (son kayıt)</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", TUR_RENK[sonKayit.tur])}>
              {TUR_ETIKET[sonKayit.tur] ?? sonKayit.tur}
            </Badge>
            <span className="font-mono text-muted-foreground">{sonKayit.gitSha.slice(0, 8)}</span>
            <span className="font-mono text-muted-foreground">{sonKayit.deploymentId}</span>
            <span className="text-muted-foreground">{formatDate(sonKayit.deployedAt, "tr", "d MMM yyyy HH:mm")}</span>
          </div>
          <p className="mt-1.5 text-sm">{sonKayit.gitMessage}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{sonKayit.ozet}</p>
        </div>
      )}

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Zaman</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tür</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Commit</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Deployment</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Özet</th>
            </tr>
          </thead>
          <tbody>
            {kayitlar.map((k, i) => (
              <tr key={k.id} className={cn("border-b last:border-0 align-top", i % 2 === 1 && "bg-muted/10")}>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  {formatDate(k.deployedAt, "tr", "d MMM HH:mm")}
                  <div className="text-[10px] opacity-60">{formatDate(k.deployedAt, "tr", "yyyy")}</div>
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 whitespace-nowrap", TUR_RENK[k.tur])}>
                    {TUR_ETIKET[k.tur] ?? k.tur}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="font-mono text-[10px] text-muted-foreground">{k.gitSha.slice(0, 8)}</div>
                  <div className="max-w-[280px] font-medium">{k.gitMessage}</div>
                </td>
                <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{k.deploymentId}</td>
                <td className="px-3 py-2 max-w-[420px] text-muted-foreground">{k.ozet}</td>
              </tr>
            ))}
            {kayitlar.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                  Henüz kayıt yok — her deploy sonrası <code>arac-deploy-kaydet.mts</code> çalıştırılmalı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
