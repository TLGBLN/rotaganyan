import { db } from "@/lib/db";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { getHippodromes, buildKuponOnerisi, type KuponStatus } from "@/server/services/race.service";
import { getAdminRaceDays, getAnalystStats, getClassTypeAdvice, GUNCEL_MOTOR_BASLANGIC } from "@/server/services/admin.service";
import { turkeyDateString } from "@/lib/tz";
import DateNavigator from "@/components/kosular/DateNavigator";
import RaceAdviceCard from "@/components/admin/RaceAdviceCard";
import CollapsibleHipodrom from "@/components/admin/CollapsibleHipodrom";
import KuponForm from "./KuponForm";
import KuponActions from "./KuponActions";
import type { HomeKuponLegInput } from "@/server/actions/home-kupon.actions";
import { syncResultsForDate } from "@/server/services/result-sync";
import DeleteRaceDayButton from "@/components/admin/DeleteRaceDayButton";
import ForceIngestButton from "@/components/admin/ForceIngestButton";
import { forceIngestDate } from "@/server/actions/race.actions";

export const dynamic = "force-dynamic";

function parseConditionsRef(conditions: string): { slug: string; raceNo: number } | null {
  const m = conditions.match(/^(.+?)\s+(\d+)\.\s*Ko[şs]u/i);
  if (!m) return null;
  const slug = m[1].trim()
    .replace(/[İI]/g, "i").replace(/ı/g, "i")
    .replace(/[ğĞ]/g, "g").replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s").replace(/[öÖ]/g, "o").replace(/[çÇ]/g, "c")
    .toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return { slug, raceNo: parseInt(m[2], 10) };
}

type PageProps = { searchParams: Promise<{ tarih?: string }> };

export default async function AdminKuponPage({ searchParams }: PageProps) {
  const { tarih } = await searchParams;
  const today = turkeyDateString();
  const currentDate = tarih ?? today;

  // Sayfa her açıldığında o günün bitmiş koşularının sonucu otomatik senkronize edilir —
  // admin artık manuel "Yenile"ye gerek kalmadan, sayfayı ziyaret ettiğinde biten koşuların
  // sonucunu (ve kupon isabet durumunu/tavsiyeleri) taze görür.
  if (currentDate <= today) {
    try { await syncResultsForDate(currentDate); } catch { /* TJK geçici olarak erişilemezse sessizce geç, mevcut veriyle devam et */ }
  }

  const [kuponlar, hippodromes, adminRaceDays] = await Promise.all([
    db.homeKupon.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    getHippodromes(),
    getAdminRaceDays(currentDate),         // Koşu programı tablosu için (kosular ile aynı)
  ]);

  // Her kuponun güncel isabet durumu (Ekonomik/Normal/Geniş) — koşular bittikçe burada da görülsün diye.
  const kuponSonuclari = await Promise.all(
    kuponlar.map((k) => buildKuponOnerisi({ id: k.id, hippodromeName: k.hippodromeName, date: k.date, legs: k.legs, ikramiye: k.ikramiye }))
  );
  const statusBadge: Record<KuponStatus, { label: string; cls: string }> = {
    hit: { label: "Tuttu", cls: "bg-hit/15 text-hit" },
    miss: { label: "Yattı", cls: "bg-miss/15 text-miss" },
    pending: { label: "Bekliyor", cls: "bg-muted text-muted-foreground" },
  };

  // Karma mirror lookup — kosular/page.tsx ile aynı mantık
  type RaceRow = (typeof adminRaceDays)[0]["races"][0];
  type OriginalMeta = {
    raceId: string;
    prediction: RaceRow["prediction"];
    classType: string;
    distance: number;
    surface: RaceRow["surface"];
    runners: RaceRow["runners"];
  };
  const originalByKey = new Map<string, OriginalMeta>();
  const originalByTime = new Map<string, OriginalMeta>();
  for (const rd of adminRaceDays) {
    if (rd.hippodrome.slug === "karma") continue;
    for (const race of rd.races) {
      if (race.conditions != null) continue;
      const meta: OriginalMeta = {
        raceId: race.id,
        prediction: race.prediction,
        classType: race.classType,
        distance: race.distance,
        surface: race.surface,
        runners: race.runners,
      };
      originalByKey.set(`${rd.hippodrome.slug}:${race.raceNo}`, meta);
      if (race.time) originalByTime.set(race.time, meta);
    }
  }

  // Her koşunun tavsiyesi kendi (ya da karma ise eşleştiği asıl koşunun) sonucunu saymasın diye
  // koşu başına ayrı hesaplanır — bugün daha erken biten diğer koşuların sonuçları yine sayılır.
  function effectiveRaceIdFor(race: RaceRow): string {
    const karmaRef = race.conditions ? parseConditionsRef(race.conditions) : null;
    const original = karmaRef
      ? (originalByKey.get(`${karmaRef.slug}:${karmaRef.raceNo}`) ?? (race.time ? originalByTime.get(race.time) : null))
      : null;
    return original?.raceId ?? race.id;
  }
  const allEffectiveRaceIds = [...new Set(adminRaceDays.flatMap((rd) => rd.races.map((race) => effectiveRaceIdFor(race))))];
  const analystStatsEntries = await Promise.all(
    allEffectiveRaceIds.map(async (id) => [id, await getAnalystStats(id, true)] as const)
  );
  const analystStatsByRaceId = new Map(analystStatsEntries);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Kupon Hazırla</h1>
        <div className="flex items-center gap-2">
          <ForceIngestButton date={currentDate} action={forceIngestDate} />
          <DateNavigator currentDate={currentDate} basePath="/admin/kupon" />
        </div>
      </div>

      {/* ── Koşu Programı (kosular ile aynı veri) ── */}
      {adminRaceDays.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Koşu Programı
          </h2>
          {adminRaceDays.map((rd) => (
            <CollapsibleHipodrom
              key={rd.id}
              title={rd.hippodrome.name}
              raceCount={rd.races.length}
              deleteSlot={
                <DeleteRaceDayButton
                  raceDayId={rd.id}
                  label={`${rd.hippodrome.name} — ${format(rd.date, "d MMMM yyyy", { locale: tr })}`}
                />
              }
            >
                {rd.races.map((race) => {
                  const karmaRef = race.conditions ? parseConditionsRef(race.conditions) : null;
                  const original = karmaRef
                    ? (originalByKey.get(`${karmaRef.slug}:${karmaRef.raceNo}`) ?? (race.time ? originalByTime.get(race.time) : null))
                    : null;
                  const effectivePred = race.prediction ?? original?.prediction ?? null;
                  const effectiveClassType =
                    race.classType && race.classType !== "—"
                      ? race.classType
                      : (original?.classType ?? race.classType);
                  const effectiveRunners =
                    race.runners.length > 0 ? race.runners : (original?.runners ?? []);
                  // 2026-09-02 kullanıcı talebi: mesafe de artık kırılıma giriyor (bkz.
                  // admin.service.ts getClassTypeAdvice notu) — karma/mirror koşularda
                  // aynı effectiveClassType/effectiveRunners deseniyle gerçek mesafeye düşer.
                  const effectiveDistance = race.distance || original?.distance;
                  // 2026-09-03 kullanıcı talebi: pist de artık kırılıma giriyor (bkz.
                  // admin.service.ts getClassTypeAdvice/byTipPist notu) — AYNI karma/mirror
                  // deseniyle gerçek pist'e düşer.
                  const effectiveSurface = race.surface || original?.surface;
                  // 2026-08-30 kullanıcı talebi: at sayısı arttıkça kazananın Ekonomik'te
                  // yakalanma oranı düşüyor, Geniş'e kaçma oranı artıyor — bu koşunun
                  // GERÇEK at sayısı (scratched hariç, bkz. getAdminRaceDays) tierOneri'ye
                  // aktarılıyor ki koşu-tipi bazlı öneriden daha geniş bir kupon
                  // gerekiyorsa öneri buna göre yükselsin.
                  const advice = getClassTypeAdvice(analystStatsByRaceId.get(effectiveRaceIdFor(race))!, effectiveClassType, effectiveRunners.length, effectiveDistance, effectiveSurface);

                  return (
                    <RaceAdviceCard
                      key={race.id}
                      hippodromeName={rd.hippodrome.name}
                      raceId={race.id}
                      raceNo={race.raceNo}
                      time={race.time}
                      classType={effectiveClassType}
                      conditions={race.conditions}
                      distance={race.distance}
                      atSayisi={effectiveRunners.length}
                      advice={advice}
                      hasResult={!!race.result}
                      newAnalysisHref={`/admin/analizler/yeni?kosu=${effectiveRaceIdFor(race)}`}
                      prediction={
                        effectivePred
                          ? {
                              id: effectivePred.id,
                              published: effectivePred.published,
                              isBanko: effectivePred.isBanko,
                              // 2026-09-08 kullanıcı bulgusu ("1. sıradaki atı nasıl
                              // bulucaz, tek bırakmalı mıyım anlayamıyorum") — v5BankoAdayiTespit
                              // ZATEN her koşuda (banko olsun olmasın) bunun tam gerekçesini
                              // (olasılık + bağımsız sinyal var mı) hesaplayıp bankoNote'a
                              // yazıyordu, ama admin ekranı bunu yalnız isBanko=true iken
                              // gösteriyordu — "hayır" cevabı hiç görünmüyordu, admin
                              // sessizlikle karşılaşıyordu. Artık ham metin her durumda
                              // geçiyor, RaceAdviceCard HER ZAMAN bir "tek at" verdisi
                              // gösteriyor (eski bankoOlasilikCikar kaldırıldı — bankoNote
                              // zaten olasılığı metin içinde taşıyor, ayrı bir sayı
                              // türetmeye gerek yoktu).
                              bankoNote: effectivePred.bankoNote,
                              // 2026-09-07 kullanıcı bulgusu ("v5 dönemi dimi? geçmiş
                              // veriler olmamalı"): eski motorların (V1-V22/V2/V3/V4)
                              // Pick.score'u gerçek bir kalibre olasılık DEĞİL (bu oturumda
                              // bulunan model-sağlık bug'ıyla aynı desen) — modelTabanliKapsamOnerisi
                              // yalnız GÜNCEL motor döneminde yayınlanmış tahminlerde çalışmalı.
                              guncelMotor: effectivePred.createdAt >= GUNCEL_MOTOR_BASLANGIC,
                              // 2026-09-07 kullanıcı talebi ("nokta atışı... 3 at yeter ya
                              // da GERÇEKTEN 6 at yeter demesini istiyorum"): geçmiş
                              // koşu-tipi istatistiği (advice.oneri) sahaya özel değil, bir
                              // ÜST GRUBUN ortalaması. Bu koşunun KENDİ yayınlanmış
                              // olasılıklarından (score) doğrudan kapsama hesaplamak için
                              // ilk 6'nın tamamı gerekiyor, yalnız 3 değil — bkz.
                              // RaceAdviceCard'daki modelTabanliKapsamOnerisi.
                              topPicks: effectivePred.picks.slice(0, 6).map((p) => ({
                                rank: p.rank,
                                no: `#${p.runnerLabel.match(/^#*(\d+)/)?.[1] ?? "?"}`,
                                score: p.score,
                                scoreExact: p.scoreExact,
                              })),
                              pistAnormalMi: effectivePred.pistAnormalMi,
                              pistDuyarliligi: effectivePred.pistDuyarliligi,
                              gecmisRiskSeviyesi: effectivePred.gecmisRiskSeviyesi,
                              pistUyariMesaji: effectivePred.pistUyariMesaji,
                            }
                          : null
                      }
                    />
                  );
                })}
            </CollapsibleHipodrom>
          ))}
        </div>
      )}

      <div className="rounded-lg border p-4">
        <h2 className="mb-4 text-sm font-semibold">Yeni Kombine Kupon</h2>
        <KuponForm hippodromes={hippodromes} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Geçmiş Kuponlar</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Hipodrom</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tarih</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ayak</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Durum</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Sonuç</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {kuponlar.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Henüz kupon oluşturulmadı.
                  </td>
                </tr>
              )}
              {kuponlar.map((k, i) => {
                const legCount = Array.isArray(k.legs) ? k.legs.length : 0;
                const sonuc = kuponSonuclari[i];
                return (
                  <tr key={k.id} className={cn("border-b last:border-0", i % 2 === 1 && "race-row-even")}>
                    <td className="px-3 py-2 font-medium">{k.hippodromeName}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {format(new Date(k.date), "d MMMM yyyy", { locale: tr })}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{legCount} ayak</td>
                    <td className="px-3 py-2">
                      <Badge variant={k.isActive ? "default" : "secondary"} className="text-xs">
                        {k.isActive ? "Yayında" : "Pasif"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {sonuc ? (
                        <div className="flex flex-wrap gap-1">
                          {sonuc.variants.filter((v) => v.filled).map((v) => (
                            <span
                              key={v.key}
                              title={v.label}
                              className={cn(
                                "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                statusBadge[v.status].cls
                              )}
                            >
                              {v.label[0]}: {statusBadge[v.status].label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <KuponActions
                        id={k.id}
                        isActive={k.isActive}
                        hippodromeName={k.hippodromeName}
                        date={k.date}
                        legs={Array.isArray(k.legs) ? (k.legs as HomeKuponLegInput[]) : []}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
