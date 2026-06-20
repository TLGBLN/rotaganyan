import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import PanelNav from "./PanelNav";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/giris?callbackUrl=/panel");
  if (session.user.role === "ADMIN" || session.user.role === "EDITOR") redirect("/admin");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-base font-semibold">Kullanıcı Paneli</h1>
        <p className="text-xs text-muted-foreground">
          Hoş geldiniz, {session.user.name ?? session.user.email}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <PanelNav />
        <div>{children}</div>
      </div>
    </div>
  );
}
