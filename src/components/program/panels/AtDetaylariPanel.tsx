"use client";

import { useTranslations } from "next-intl";
import HorseDetailContent from "../HorseDetailContent";

type Runner = { no: number; name: string; scratched: boolean };

/**
 * 2026-08-31 kullanıcı talebi ("atlara tıklandığında çıkan bu verileri de o butonun
 * altına işleyebilir misin") — HorseDetailModal'ın (tek at, tıklayınca açılan) içeriği
 * artık "Tüm Verileri Göster" ile sahadaki HER at için AYNI ANDA, alt alta render
 * ediliyor — tek tek tıklamaya gerek kalmadan bütüncül inceleme.
 *
 * 2026-10-10 kullanıcı talebi — "Tüm Veriler" altındaki diğer 7 panel (Son Yarış
 * Detayları/Accurace/AGF Trend/Son Hazırlıklar/Pedigriler/Karşılaştır/H2H) kendi
 * başlıklarıyla AYRI/dışarıda kalıyor (zaten öyleydi); bu panel (soy ağacı+sahiplik+
 * detaylı istatistik+geçmiş yarış tablosu — "diğerleri") o 7'nin aksine HİÇBİR üst
 * başlık taşımıyordu. Diğer panellerle AYNI başlık-çubuğu kalıbıyla (bg-[#022637])
 * "At Bilgileri" etiketi eklendi, grupları görsel olarak ayırt edilebilir yapar.
 */
export default function AtDetaylariPanel({ runners }: { runners: Runner[] }) {
  const t = useTranslations("programToolbar");
  const kosanlar = runners.filter((r) => !r.scratched);
  if (kosanlar.length === 0) return null;

  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#022637] border-b flex items-center">
        <span className="text-sm font-bold tracking-wide text-white">{t("atBilgileri")}</span>
      </div>
      <div className="divide-y divide-border/60">
        {kosanlar.map((r) => (
          <div key={r.no}>
            <div className="flex items-center gap-2 bg-muted/40 px-4 py-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-black/10 text-xs font-bold">
                {r.no}
              </span>
              <h3 className="text-sm font-bold">{r.name}</h3>
            </div>
            <HorseDetailContent name={r.name} />
          </div>
        ))}
      </div>
    </div>
  );
}
