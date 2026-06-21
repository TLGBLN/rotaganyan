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

  const versions = await db.methodologyVersion.findMany({ orderBy: { effectiveDate: "desc" } });

  const methodology = versions.find((v) => v.isCurrent) ?? versions[0];

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

    </div>
  );
}
