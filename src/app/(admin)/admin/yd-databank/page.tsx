import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * YD Veri Bankası — Durum. TR admin sayfalarından TAMAMEN AYRI (kullanıcı kararı,
 * 2026-09-30) — yalnız YurtDisi* tablolarını okur, hiçbir TR modeline dokunmaz.
 *
 * Kullanıcının Entity Resolution V1.1 başarı kriterlerini DOĞRUDAN ekranda görünür
 * kılar: "silent skipped runner = 0", "unresolved kayıtlar ölçülüyor", "duplicate
 * horse rate çok düşük" — bunları her seferinde sohbette rapor etmek yerine burada
 * kalıcı olarak izlenebilir.
 */
export default async function YdDatabankPage() {
  const [
    equineCount,
    trackCount,
    jockeyCount,
    trainerCount,
    ownerCount,
    raceCount,
    runnerCount,
    horseRunCount,
    unresolvedByStatus,
    unresolvedByType,
    sourceSnapshotCount,
    sonProgramEtl,
  ] = await Promise.all([
    db.yurtDisiEquine.count(),
    db.yurtDisiTrack.count(),
    db.yurtDisiJockey.count(),
    db.yurtDisiTrainer.count(),
    db.yurtDisiOwner.count(),
    db.yurtDisiRace.count(),
    db.yurtDisiRunner.count(),
    db.yurtDisiHorseRun.count(),
    db.yurtDisiUnresolvedEntity.groupBy({ by: ["status"], _count: { _all: true } }),
    db.yurtDisiUnresolvedEntity.groupBy({ by: ["entityType"], _count: { _all: true } }),
    db.yurtDisiSourceSnapshot.count(),
    db.yurtDisiRace.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
  ]);

  // Duplicate şüphesi: aynı normalizedName kökünden türeyen "#" ekli çakışma kayıtları
  // (bkz. entity-resolution.ts — çelişkili ülke bilgisiyle AYRI açılan equine'ler).
  const celismeliEquineCount = await db.yurtDisiEquine.count({ where: { normalizedName: { contains: "#" } } });

  const kartlar = [
    { label: "Equine (At)", value: equineCount },
    { label: "Hipodrom", value: trackCount },
    { label: "Jokey", value: jockeyCount },
    { label: "Antrenör", value: trainerCount },
    { label: "Sahip", value: ownerCount },
    { label: "Yarış", value: raceCount },
    { label: "Runner", value: runnerCount },
    { label: "Geçmiş Yarış Satırı", value: horseRunCount },
    { label: "Ham Kaynak Kaydı", value: sourceSnapshotCount },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">YD Veri Bankası — Durum</h1>
        <p className="text-xs text-muted-foreground">
          Analiz Motoru YD V1.0&apos;dan TAMAMEN AYRI, yurt dışı (ABD/İngiltere/Kanada) koşuları için kurulan
          veri bankasının (Master/Racing/Pedigree/Statistics/Quality/Raw) canlı durumu.
          {sonProgramEtl && (
            <> Son Program ETL güncellemesi: {sonProgramEtl.updatedAt.toLocaleString("tr-TR")}.</>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kartlar.map((k) => (
          <div key={k.label} className="rounded-lg border p-3">
            <div className="text-2xl font-bold tabular-nums">{k.value.toLocaleString("tr-TR")}</div>
            <div className="text-xs text-muted-foreground">{k.label}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold">Entity Resolution — Sağlık Göstergeleri</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className={cn("rounded-lg border p-3", celismeliEquineCount > 0 ? "border-amber-500/50 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5")}>
            <div className="text-2xl font-bold tabular-nums">{celismeliEquineCount}</div>
            <div className="text-xs text-muted-foreground">Çelişkili isim/ülke duplikasyonu (# işaretli)</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-2xl font-bold tabular-nums">
              {unresolvedByStatus.reduce((s, r) => s + r._count._all, 0)}
            </div>
            <div className="text-xs text-muted-foreground">
              Unresolved toplam (
              {unresolvedByStatus.map((r) => `${r.status}: ${r._count._all}`).join(", ") || "hiç yok"})
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground mb-1">Unresolved tür kırılımı</div>
            <div className="text-xs">
              {unresolvedByType.length === 0
                ? "—"
                : unresolvedByType.map((r) => (
                    <div key={r.entityType} className="flex justify-between">
                      <span>{r.entityType}</span>
                      <span className="font-mono">{r._count._all}</span>
                    </div>
                  ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-3 text-xs text-muted-foreground">
        <p className="mb-1 font-semibold text-foreground">Kapsam notu</p>
        <p>
          Bu banka şu an yalnız TJK&apos;nın yurt dışı program sayfasından (Program ETL) ve zaten çekilmiş
          geçmiş yarış önbelleğinden (HorseRun ETL) besleniyor. Pedigree ETL, Chef-de-Race/Dosage hesabı ve
          istatistik snapshot&apos;ları (Jockey/Trainer/Track/Draw) HENÜZ yazılmadı — tablolar şemada var ama boş.
          Analiz Motoru YD V1.0 bu bankayı HENÜZ kullanmıyor, kendi ayrı (YurtDisiAtRaceHistoryCache) kaynağını okuyor.
        </p>
      </div>
    </div>
  );
}

