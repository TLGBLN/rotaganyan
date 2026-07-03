import { db } from "@/lib/db";
import BannerManager from "./BannerManager";

export const dynamic = "force-dynamic";

export default async function AyarlarPage() {
  const slides = await db.bannerSlide.findMany({
    orderBy: { order: "asc" },
    select: { id: true, url: true, order: true, active: true },
  });

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-bold">Site Ayarları</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ana sayfa banner görselleri — birden fazla yüklenirse otomatik slayt gösterisi yapılır.
        </p>
      </div>

      <section className="rounded-xl border border-brand/20 bg-card p-6">
        <h2 className="mb-1 font-semibold">Banner Slaytları</h2>
        <p className="mb-5 text-xs text-muted-foreground">
          Önerilen boyut: <strong>2191 × 718 px</strong>. Sıra numarası değiştirilebilir, gizlenebilir veya silinebilir.
        </p>
        <BannerManager initialSlides={slides} />
      </section>
    </div>
  );
}
