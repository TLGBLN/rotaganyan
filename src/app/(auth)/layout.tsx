import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasRole } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Zaten giriş yapmışsa giriş/kayıt sayfalarına erişimi engelle
  if (session?.user) {
    if (hasRole(session.user.role, "EDITOR")) {
      redirect("/admin");
    }
    redirect("/panel");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Link href="/" className="mb-8 flex flex-col items-center gap-3">
        <Image
          src="/logo.png"
          alt="ROTAGANYAN"
          width={80}
          height={80}
          className="rounded-full"
          priority
        />
        <span className="text-xl font-bold tracking-tight">
          <span className="text-foreground">ROTA</span>
          <span className="text-brand">GANYAN</span>
        </span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
