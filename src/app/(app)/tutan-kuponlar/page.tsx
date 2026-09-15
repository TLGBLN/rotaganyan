import type { Metadata } from "next";
import Link from "next/link";
import { getGecmisKazananKuponlar } from "@/server/services/race.service";
import TutanKuponlarListesi from "@/components/home/TutanKuponlarListesi";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "İsabet Sağlayan Kuponlar (Tüm Zamanlar) — ROTAGANYAN",
};

// 2026-09-15 kullanıcı talebi: "üye olmayan bir kişi merak ederse" — bu sayfa BİLEREK
// hiçbir auth() kontrolü yapmıyor, /analizler (giriş şartlı) gibi DEĞİL, /program
// gibi tamamen public. getGecmisKazananKuponlar zaten tarih DESC (en yeni en üstte)
// döndüğü için ek bir sıralama gerekmiyor — 500 limiti getAylikKuponKazanci'nin de
// kullandığı, bu kod tabanında yerleşik "pratikte tüm zamanlar" sınırı.
export default async function TutanKuponlarPage() {
  const items = await getGecmisKazananKuponlar(500).catch(() => []);

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">İsabet Sağlayan Kuponlar — Tüm Zamanlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Yayımlanan ve en az bir kademesi isabet sağlamış TÜM kuponlar, en yeniden en eskiye sıralı.
          </p>
        </div>
        <Link href="/program" className="shrink-0 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
          ← Programa Dön
        </Link>
      </div>

      <TutanKuponlarListesi items={items} />
    </div>
  );
}
