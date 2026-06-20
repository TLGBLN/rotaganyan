import { db } from "@/lib/db";
import { auth, hasRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import MethodologyForm from "./MethodologyForm";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

function nextVersionGuess(current: string | undefined): string {
  const match = current?.match(/^v?(\d+)\.(\d+)$/i);
  if (!match) return "v1.0";
  const [, major, minor] = match;
  return `v${major}.${parseInt(minor, 10) + 1}`;
}

export default async function MetodolobiPage() {
  const session = await auth();
  const canEdit = hasRole((session?.user.role as Role) ?? "USER", "ADMIN");

  const [configs, versions, lessons] = await Promise.all([
    db.engineConfig.findMany({ orderBy: { key: "asc" } }),
    db.methodologyVersion.findMany({ orderBy: { effectiveDate: "desc" } }),
    db.postMortemLesson.findMany({ where: { active: true }, orderBy: { date: "desc" }, take: 20 }),
  ]);

  const methodology = versions.find((v) => v.isCurrent) ?? versions[0];
  const history = versions.filter((v) => v.id !== methodology?.id);

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-bold">Metodoloji</h1>

      {/* Current version */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Güncel Versiyon
        </h2>
        {methodology ? (
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Badge>{methodology.version}</Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(methodology.effectiveDate).toLocaleDateString("tr-TR")}
              </span>
            </div>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed">
              {methodology.content.substring(0, 500)}…
            </pre>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Versiyon bulunamadı.</p>
        )}
      </section>

      {/* Update */}
      {canEdit && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Yeni Versiyon Yayımla
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Yayımladığın versiyon otomatik olarak güncel (aktif) versiyon olur; analiz ekranlarında
            ve kontrol listesinde her zaman bu içerik referans alınır.
          </p>
          <MethodologyForm
            suggestedVersion={nextVersionGuess(methodology?.version)}
            defaultContent={methodology?.content ?? ""}
          />
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Geçmiş Versiyonlar
          </h2>
          <div className="space-y-2">
            {history.map((v) => (
              <details key={v.id} className="group rounded-lg border">
                <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm select-none hover:bg-white/5">
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{v.version}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.effectiveDate).toLocaleDateString("tr-TR")}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground transition-transform group-open:rotate-180">▾</span>
                </summary>
                <pre className="whitespace-pre-wrap border-t px-4 py-3 text-xs text-muted-foreground leading-relaxed">
                  {v.content}
                </pre>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Engine config */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Motor Konfigürasyonu
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left font-medium">Anahtar</th>
                <th className="px-3 py-2 text-left font-medium">Değer</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Son Güncelleme</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c, i) => (
                <tr key={c.id} className={i % 2 === 1 ? "race-row-even border-b last:border-0" : "border-b last:border-0"}>
                  <td className="px-3 py-2 font-mono font-medium">{c.key}</td>
                  <td className="px-3 py-2 font-mono text-brand">
                    {JSON.stringify(c.value)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(c.updatedAt).toLocaleDateString("tr-TR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Post-mortem lessons */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Öğrenilen Dersler
        </h2>
        <div className="space-y-2">
          {lessons.map((l) => (
            <div key={l.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{l.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{l.rule}</p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {l.category}
                </Badge>
              </div>
              {l.raceRef && (
                <p className="mt-1 text-xs text-muted-foreground">Ref: {l.raceRef}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
