import { db } from "@/lib/db";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Role, Plan } from "@prisma/client";
import { auth } from "@/lib/auth";
import RoleSelector from "./RoleSelector";
import UserActions from "./UserActions";
import CreateUserDialog from "./CreateUserDialog";

const ROLE_LABEL: Record<Role, string> = { USER: "Üye", EDITOR: "Editör", ADMIN: "Admin" };
const PLAN_LABEL: Record<Plan, string> = { FREE: "Ücretsiz", PREMIUM: "Premium" };

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ sayfa?: string; q?: string }> };

export default async function KullanicilarPage({ searchParams }: PageProps) {
  const [params, session] = await Promise.all([searchParams, auth()]);
  const selfId = session?.user?.id ?? "";

  const page = Math.max(1, parseInt(params.sayfa ?? "1", 10));
  const perPage = 30;
  const q = params.q ?? "";

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: { id: true, name: true, email: true, role: true, plan: true, createdAt: true },
    }),
    db.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Kullanıcılar</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{total} kayıtlı üye</span>
          <CreateUserDialog />
        </div>
      </div>

      {/* Arama */}
      <form method="GET">
        <input
          name="q"
          defaultValue={q}
          placeholder="Ad veya e-posta ara…"
          className="w-full max-w-xs rounded-md border bg-background px-3 py-1.5 text-sm"
        />
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Kullanıcı</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Rol</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Plan</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Kayıt</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr
                key={u.id}
                className={cn(
                  "border-b last:border-0",
                  i % 2 === 1 && "race-row-even",
                  u.id === selfId && "opacity-60"
                )}
              >
                <td className="px-3 py-2">
                  <p className="font-medium">
                    {u.name ?? "—"}
                    {u.id === selfId && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">(sen)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="px-3 py-2">
                  <RoleSelector userId={u.id} currentRole={u.role} />
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant={u.plan === "PREMIUM" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {PLAN_LABEL[u.plan]}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {format(new Date(u.createdAt), "d MMM yyyy", { locale: tr })}
                </td>
                <td className="px-3 py-2">
                  <UserActions
                    userId={u.id}
                    currentPlan={u.plan}
                    isSelf={u.id === selfId}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <a
              href={`/admin/kullanicilar?sayfa=${page - 1}${q ? `&q=${q}` : ""}`}
              className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
            >
              ← Önceki
            </a>
          )}
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`/admin/kullanicilar?sayfa=${page + 1}${q ? `&q=${q}` : ""}`}
              className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Sonraki →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
