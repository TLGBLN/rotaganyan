import Link from "next/link";
import Wordmark from "./Wordmark";

export default function Footer() {
  return (
    <footer className="border-t bg-background px-4 py-8 text-sm text-muted-foreground print:hidden">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="flex items-center font-medium">
            <Wordmark />
            <span className="ml-2 font-normal">© 2026 At Yarışı Analiz Platformu</span>
          </p>
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link href="/hakkinda" className="hover:text-foreground hover:underline underline-offset-4">Hakkında</Link>
            <Link href="/iletisim" className="hover:text-foreground hover:underline underline-offset-4">İletişim</Link>
            <Link href="/gizlilik" className="hover:text-foreground hover:underline underline-offset-4">Gizlilik</Link>
            <Link href="/kullanim-kosullari" className="hover:text-foreground hover:underline underline-offset-4">Kullanım Koşulları</Link>
          </nav>
        </div>
        <p className="mt-4 text-center text-xs">
          Analizler yatırım tavsiyesi değildir. Her zaman en doğru tercih sizin tercihlerinizdir.
        </p>
      </div>
    </footer>
  );
}
