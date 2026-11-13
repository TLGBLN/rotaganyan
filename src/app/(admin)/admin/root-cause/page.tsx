import Link from "next/link";
import { getRcaV2 } from "@/server/services/rca-v2.service";
import { kayitlariSenkronla, kayitlariOku, type KayitDetay } from "@/server/services/rca-kayit.service";
import { AcikSorunlar, KayitDefteriTablosu, KuponKokNeden, OzetSeridi, SaglikliKontroller } from "@/components/admin/rca/RcaBolumleri";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export default async function RootCausePage() {
  const rapor = await getRcaV2();
  let kayitlar: KayitDetay[] = [];
  try { kayitlar = await kayitlariSenkronla(rapor.sorunlar, new Date(rapor.uretildi)); } catch { try { kayitlar = await kayitlariOku(); } catch { kayitlar = []; } }
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Kök Neden Analizi</h1>
          <p className="mt-1 text-xs text-muted-foreground">Sorunu bulur, kök nedene iner, çözümü gösterir/uygular ve çözüldüğünü kendi ölçütüyle doğrular. Üretildi: {new Date(rapor.uretildi).toLocaleString("tr-TR")}</p>
        </div>
        <Link href="/admin/root-cause/otopsi" className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Yarış otopsisi (eski görünüm) →</Link>
      </div>
      {rapor.hatalar.length > 0 && <p className="rounded-xl border border-risk/40 bg-risk/5 px-3 py-2 text-xs text-risk">Bazı dedektörler çalışamadı: {rapor.hatalar.join(" · ")}</p>}
      <OzetSeridi sorunlar={rapor.sorunlar} kayitlar={kayitlar} kupon={rapor.kupon} />
      <AcikSorunlar sorunlar={rapor.sorunlar} kayitlar={kayitlar} />
      {rapor.kupon && <KuponKokNeden kupon={rapor.kupon} />}
      <KayitDefteriTablosu kayitlar={kayitlar} />
      <SaglikliKontroller sorunlar={rapor.sorunlar} />
    </div>
  );
}
