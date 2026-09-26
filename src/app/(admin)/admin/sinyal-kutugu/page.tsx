import { CANLI_SINYALLER, SIRALAMA_KURALLARI, ADAY_SINYALLER, PRODUKSIYON_GERCEKLIGI } from "@/server/services/sinyal-kutugu.service";
import { getV5SinyalPerformansi } from "@/server/services/v5-sinyal-performans.service";
import SinyalKutuguDashboard from "./SinyalKutuguDashboard";

export const dynamic = "force-dynamic";

// 2026-09-25: Sinyal Kütüğü, /admin dashboard'undan çıkarıldı; Sistem Anatomisi gibi kendi sayfasında, etkileşimli. Kütük verisi elle bakımı yapılan
// sinyal-kutugu.service.ts'ten; "sahadaki gerçek isabet" ise her açılışta canlı DB'den (yayınlanmış + sonuçlanmış V5 tahminleri).
export default async function SinyalKutuguPage() {
  const isabet = await getV5SinyalPerformansi().catch(() => []);
  return <SinyalKutuguDashboard canli={CANLI_SINYALLER} siralama={SIRALAMA_KURALLARI} adaylar={ADAY_SINYALLER} isabet={isabet} gercekler={PRODUKSIYON_GERCEKLIGI} />;
}
