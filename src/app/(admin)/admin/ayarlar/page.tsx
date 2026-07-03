import { db } from "@/lib/db";
import BannerUpload from "./BannerUpload";

export const dynamic = "force-dynamic";

const DEFAULT_BANNER = "/banner-v3.png";

export default async function AyarlarPage() {
  const setting = await db.siteSetting.findUnique({ where: { key: "banner_url" } });
  const currentBannerUrl = setting?.value ?? DEFAULT_BANNER;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-bold">Site Ayarları</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ana sayfa banner görseli ve genel site ayarları.
        </p>
      </div>

      <section className="rounded-xl border border-brand/20 bg-card p-6">
        <h2 className="mb-1 font-semibold">Ana Sayfa Banneri</h2>
        <p className="mb-5 text-xs text-muted-foreground">
          Önerilen boyut: <strong>2191 × 718 px</strong>. Yüklenince site anında güncellenir.
        </p>
        <BannerUpload currentUrl={currentBannerUrl} />
      </section>
    </div>
  );
}
