import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Bookmark } from "lucide-react";
import UnfollowButton from "./UnfollowButton";

export const dynamic = "force-dynamic";

export default async function TakipAtlarimPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const follows = await db.horseFollow.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Takip Atlarım</h2>

      {follows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Bookmark className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Henüz takip ettiğin at yok.
          </p>
          <p className="text-xs text-muted-foreground">
            Koşu analizlerinde at isimlerinin yanındaki yer imi ikonuna tıklayarak takip edebilirsin.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {follows.map((follow) => (
            <div
              key={follow.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">{follow.horseName}</p>
                {follow.note && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{follow.note}</p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Takip tarihi: {format(new Date(follow.createdAt), "d MMM yyyy", { locale: tr })}
                </p>
              </div>
              <UnfollowButton horseName={follow.horseName} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
