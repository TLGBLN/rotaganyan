import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t bg-background px-4 py-8 text-sm text-muted-foreground">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="font-medium">
            <span className="text-white">ROTA</span>
            <span
              style={{
                background:
                  "linear-gradient(90deg,#5b9bd5 0%,#a8c8e8 30%,#e4ddc8 50%,#d4b45a 65%,#c8971e 85%,#b8820a 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              GANYAN
            </span>
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
          Analizler yatırım tavsiyesi değildir. Her zaman en doğru tercih sizin tercihlerinizdir. ·{" "}
          <a href="mailto:destek@rotaganyan.com" className="hover:text-foreground hover:underline underline-offset-4">
            destek@rotaganyan.com
          </a>
        </p>
      </div>
    </footer>
  );
}
