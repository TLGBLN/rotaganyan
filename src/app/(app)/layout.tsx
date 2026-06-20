import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Giriş yapmış ADMIN/EDITOR kullanıcılar /giris'ten gelince /admin'e gönder
  // (panel layout'u da ayrıca kontrol ediyor)

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
