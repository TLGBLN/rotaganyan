/**
 * 2026-08-20 kullanıcı talebi: "sürekli siteyi kolaçan edecek bir agent istiyorum" —
 * bugün galop/tjkAtId/HP verisinin sessizce eksik kaldığı elle bulundu. Bu servis,
 * /api/cron/veri-denetimi tarafından GÜNLÜK çağrılır: Veri Tamlığı panelinin "Son 7 Gün"
 * yüzdelerinden biri eşiğin altına düşerse admin(ler)e SYSTEM bildirimi düşürür —
 * /admin/veri-tamligi'ye elle bakmayı beklemeden.
 */
import { db } from "@/lib/db";
import { getVeriTamligiRaporu } from "./veri-tamligi.service";

const ESIK_YUZDE = 70;

export async function runVeriDenetimi(): Promise<{ sorunlu: string[]; bildirimGonderildi: boolean }> {
  const rapor = await getVeriTamligiRaporu();
  const sorunlular = rapor.filter((r) => r.toplamSon7 >= 10 && r.yuzdeSon7 < ESIK_YUZDE);

  if (sorunlular.length === 0) return { sorunlu: [], bildirimGonderildi: false };

  const baslikliListe = sorunlular.map((s) => `${s.alan}: %${s.yuzdeSon7.toFixed(1)} (${s.doluSon7}/${s.toplamSon7})`);

  // Aynı gün içinde tekrar tekrar bildirim yağdırmasın — bugün zaten bir "Veri Tamlığı"
  // uyarısı gönderilmişse atla (cron günde bir kez çalışıyor olsa da, elle tetiklenirse
  // ya da yeniden denenirse spam olmasın diye).
  const bugunBaslangic = new Date();
  bugunBaslangic.setHours(0, 0, 0, 0);
  const zatenVar = await db.notification.findFirst({
    where: { type: "SYSTEM", title: "Veri Tamlığı uyarısı", createdAt: { gte: bugunBaslangic } },
    select: { id: true },
  });
  if (zatenVar) return { sorunlu: sorunlular.map((s) => s.alan), bildirimGonderildi: false };

  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length > 0) {
    await db.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "SYSTEM" as const,
        title: "Veri Tamlığı uyarısı",
        body: `Son 7 günde eşiğin (%${ESIK_YUZDE}) altına düşen ${sorunlular.length} alan var:\n${baslikliListe.join("\n")}`,
        link: "/admin/veri-tamligi",
      })),
    });
  }

  return { sorunlu: sorunlular.map((s) => s.alan), bildirimGonderildi: admins.length > 0 };
}
