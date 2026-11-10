"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import type { ProgramRaceDay, KuponOnerisi } from "@/server/services/race.service";
import type { TempoSenaryosu } from "@/lib/methodology/pace-analizi";
import { KuponBlock } from "@/components/home/TahminOnerileri";
import { puanYuzdesiMetni } from "@/lib/methodology/muhakeme-format";
import { agfSiraMapOlustur } from "@/lib/agf-sira";

type Race = ProgramRaceDay["races"][number];
type Kupon = NonNullable<KuponOnerisi>;

// 2026-09-14 — Koşu sekmesi pist renkleri: ProgramView.tsx'teki SURFACE_TAB_BG ile
// AYNI kaynaktan (TJK'nın kendi Son 6 Yarış font-renkleri, bkz. proje hafızası
// "TJK Pist Renkleri") — o dosyanın büyüklüğü/karmaşıklığı yüzünden export edip
// import etmek yerine burada da (KuponForm.tsx'teki ALTILI_STAKE_PER_COMBINATION
// gibi) küçük, kararlı bir sabit olarak kopyalandı.
const SURFACE_TAB_BG: Record<string, string> = {
  CIM: "bg-[#009900] hover:bg-[#00b300] text-white",
  KUM: "bg-[#996633] hover:bg-[#a8754a] text-white",
  SENTETIK: "bg-[#D39B1E] hover:bg-[#e0ab3a] text-white",
};

function hasAnalysis(r: Race): boolean {
  return !!r.prediction?.published && (r.prediction.picks?.length ?? 0) > 0;
}

// Referans görseldeki "yan yana sütun" rengi — ProgramView.tsx'teki rankStyle ile AYNI eşik
// (rank<=3 yeşil/güçlü, rank<=6 marka rengi/orta, kalanı soluk) — sıraya göre, ham puana göre
// DEĞİL (sahanın büyüklüğüne göre anlamı değişmeyen, zaten kurulu bir kural).
function puanRengi(rank: number): string {
  if (rank <= 3) return "text-[#27ae60] font-bold";
  if (rank <= 6) return "text-brand font-semibold";
  return "text-muted-foreground";
}

type Props = {
  raceDay: ProgramRaceDay;
  tempoByRaceId: Record<string, TempoSenaryosu | null>;
  kuponlar: Kupon[];
  isAdmin: boolean;
  /** 2026-09-14 — /program'daki "Rotaganyan Sıralaması" butonundan derin bağlantı:
   *  bu koşu bu raceDay'de gerçekten analiz edilmişse başlangıç sekmesi bu olur,
   *  aksi halde (undefined veya eşleşmiyorsa) eski davranışa (ilk analiz edilen koşu) düşer. */
  initialRaceNo?: number;
};

export default function SiralamaKarti({ raceDay, tempoByRaceId, kuponlar, isAdmin, initialRaceNo }: Props) {
  const analyzed = raceDay.races.filter(hasAnalysis);
  if (analyzed.length === 0) return null;

  // 2026-11-10 kullanıcı talebi ("tüm koşular yan yana açık olarak gözüksün", sonra görsel
  // referansla netleşti: dar sütunlar, At No + Puan) — eskiden sekmeye tıklayınca YALNIZ o
  // koşu görünüyordu (activeRaceNo state'i, tek render). Artık HER analiz edilmiş koşu kendi
  // dar sütununda, hepsi aynı anda YATAY olarak yan yana — hiçbiri gizlenmiyor. Üstteki sekme
  // şeridi artık bir "seç/gizle" kontrolü değil, sayfa içi hızlı atlama (anchor link) —
  // tıklanınca o koşunun sütununa kaydırır, initialRaceNo (derin bağlantı) da aynısını yapar.
  const ilkYuklemeRaceNo =
    initialRaceNo != null && analyzed.some((r) => r.raceNo === initialRaceNo)
      ? initialRaceNo
      : undefined;

  return (
    <div className="space-y-4">
      {/* Marka rozeti — eski PuanTablosu.tsx'in (bu sayfanın önceki görünümü) at-ikonu +
          ROTA/GANYAN logosu, SiralamaKarti'ye geçişte kaybolmuştu (kullanıcı bulgusu,
          2026-10-20) — geri eklendi, OG paylaşım kartıyla (api/og/kupon) AYNI varlık. */}
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/horse-icon-gold.png" alt="" width={22} height={22} style={{ objectFit: "contain" }} />
        <span className="text-xs font-extrabold tracking-wide">
          <span>ROTA</span><span className="text-brand">GANYAN</span>
        </span>
      </div>

      {/* Koşu sekmesi şeridi — artık hızlı atlama (anchor), gizleme/seçme DEĞİL. */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {raceDay.races.map((r) => (
          <a
            key={r.id}
            href={hasAnalysis(r) ? `#kosu-${r.id}` : undefined}
            className={cn(
              "relative shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition-all",
              SURFACE_TAB_BG[r.surface] ?? "bg-muted text-muted-foreground",
              hasAnalysis(r) ? "opacity-70 hover:opacity-100" : "pointer-events-none opacity-30"
            )}
          >
            {r.raceNo}
            {hasAnalysis(r) && (
              <span className="absolute top-1 right-0.5 h-1.5 w-1.5 rounded-full bg-[#27ae60] ring-1 ring-white" />
            )}
          </a>
        ))}
      </div>

      {/* 2026-11-10 kullanıcı talebi ("yan yana buna benzer olsun sadece şekil olarak", sonra
          "hepsi tam sayfaya sığsın ve at isimleri ile agf sıraları da yazsın") — her analiz
          edilmiş koşu kendi dar sütununda, hepsi aynı anda YATAY yan yana; grid'in kendisi
          (auto-fit) mevcut genişliğe göre kaç sütun sığacağını kendi hesaplıyor, yatay kaydırma
          YOK — dar ekranda fazla koşu varsa yeni satıra sarar (mobil-uyumlu). AGF sırası YALNIZ
          admin'e gösterilir (bkz. agf-sira.ts'teki gerekçe — piyasa bilgisini önceden bilmek
          normal kullanıcıya haksız avantaj sayılır), agfSiraMapOlustur ile AYNI paylaşılan
          kaynaktan (ProgramView.tsx'teki "AGF X." rozetiyle TUTARLI). */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {analyzed.map((race) => {
          const picks = [...(race.prediction?.picks ?? [])].sort((a, b) => a.rank - b.rank);
          const agfSiraMap = agfSiraMapOlustur(race.runners.map((r) => ({ no: r.no, agf: r.agf })));
          return (
            <div key={race.id} id={`kosu-${race.id}`} className="scroll-mt-20 rounded-xl border overflow-hidden">
              <div className="bg-muted/50 px-2 py-1.5 text-center">
                <div className="text-xs font-bold">{race.raceNo}. Koşu</div>
                <div className="text-[10px] text-muted-foreground">{race.time ?? ""} · {race.distance}m</div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-[10px] text-muted-foreground">
                    <th className="py-1 pl-2 text-left font-medium">No</th>
                    <th className="py-1 text-left font-medium">At</th>
                    {isAdmin && <th className="py-1 text-right font-medium">AGF</th>}
                    <th className="py-1 pr-2 text-right font-medium">Puan</th>
                  </tr>
                </thead>
                <tbody>
                  {picks.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-1 pl-2 font-mono">{p.runner?.no ?? "—"}</td>
                      <td className="py-1 truncate max-w-[110px]" title={p.runner?.name ?? p.runnerLabel ?? undefined}>
                        {p.runner?.name ?? p.runnerLabel ?? "—"}
                      </td>
                      {isAdmin && (
                        <td className="py-1 text-right tabular-nums text-muted-foreground">
                          {p.runner?.no != null ? (agfSiraMap.get(p.runner.no) ?? "—") : "—"}
                        </td>
                      )}
                      <td className={cn("py-1 pr-2 text-right tabular-nums", puanRengi(p.rank))}>
                        {puanYuzdesiMetni(p.score, p.scoreExact) != null ? `%${puanYuzdesiMetni(p.score, p.scoreExact)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* Kupon Önerisi — hipodrom başına, sütunların altında (bkz. yukarıdaki not). */}
      {(() => {
        const hipoKuponlari = kuponlar.filter((k) => k.hippodromeName.split(" — ")[0] === raceDay.hippodrome.name);
        if (hipoKuponlari.length === 0) return null;
        return (
          <div className="space-y-3">
            {hipoKuponlari.map((k) => (
              <KuponBlock key={k.hippodromeName + k.variants.map((v) => v.legs.map((l) => l.raceNo).join("-")).join("|")} data={k} ikramiye={k.ikramiye} isAdmin={isAdmin} cityLabel="Kupon Önerisi" />
            ))}
          </div>
        );
      })()}

      {ilkYuklemeRaceNo != null && <OtomatikKaydir raceId={analyzed.find((r) => r.raceNo === ilkYuklemeRaceNo)?.id} />}
    </div>
  );
}

// Derin bağlantı (hipodrom/kosu query param) — sayfa ilk yüklenince o koşunun bloğuna
// otomatik kaydırır (eskiden initialRaceNo tab seçimi yapıyordu, artık hepsi zaten açık
// olduğu için yalnız kaydırma gerekiyor).
function OtomatikKaydir({ raceId }: { raceId?: string }) {
  useEffect(() => {
    if (!raceId) return;
    document.getElementById(`kosu-${raceId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [raceId]);
  return null;
}
