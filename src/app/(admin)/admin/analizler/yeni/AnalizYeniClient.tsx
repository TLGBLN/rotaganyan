"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { getKosuAnalizVerisi } from "@/server/actions/admin-analiz.actions";
import SmartAnalysisEditor from "@/components/admin/SmartAnalysisEditor";
import MarkdownRaceInput from "@/components/admin/MarkdownRaceInput";
import BultenUpload from "@/components/admin/BultenUpload";
import DatePickerNav from "./DatePickerNav";

// 2026-08-14 — kullanıcı talebi: "Veri Gir — Koşu Seç" listesi ile analiz paneli tek
// sayfada birleştirildi — bir koşuya tıklayınca sayfa DEĞİŞMEZ, yalnız aşağıdaki analiz
// bölümü seçilen koşuya göre güncellenir. Liste her zaman görünür kalır, aralarında
// gezinmek için geri dönmeye gerek yok.

export type KosuSecimGunu = {
  id: string;
  gunEtiketi: string;
  races: { id: string; raceNo: number; hasAnaliz: boolean }[];
};

type Mod = "oto" | "md" | "screenshot";

type RaceData = NonNullable<Awaited<ReturnType<typeof getKosuAnalizVerisi>>>;

type Props = {
  gunler: KosuSecimGunu[];
  selectedDate: string;
  today: string;
  tomorrow: string;
  initialRaceId?: string;
};

export default function AnalizYeniClient({ gunler, selectedDate, today, tomorrow, initialRaceId }: Props) {
  const router = useRouter();
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(initialRaceId ?? null);
  const [raceData, setRaceData] = useState<RaceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mod, setMod] = useState<Mod>("oto");

  const loadRace = useCallback(async (raceId: string) => {
    setLoading(true);
    setError(null);
    setRaceData(null);
    setMod("oto");
    try {
      const data = await getKosuAnalizVerisi(raceId);
      if (!data) {
        setError("Koşu bulunamadı.");
        return;
      }
      setRaceData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koşu verisi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialRaceId) loadRace(initialRaceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSelectRace(raceId: string) {
    if (raceId === selectedRaceId && raceData) return;
    setSelectedRaceId(raceId);
    // Sayfa hiç yeniden yüklenmeden URL'i güncel tutar — paylaşılabilir link + geri
    // tuşu desteği için, ama router.push GİBİ tam bir istemci-taraflı navigasyon
    // tetiklemez (scroll:false ile mevcut kaydırma konumu da korunur).
    router.replace(`/admin/analizler/yeni?kosu=${raceId}&tarih=${selectedDate}`, { scroll: false });
    loadRace(raceId);
  }

  const raceName = raceData ? `${raceData.raceDay.hippodrome.name} — ${raceData.raceNo}. Koşu` : "";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,360px)_1fr] lg:items-start">
      {/* ── Koşu listesi — her zaman görünür ─────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-lg font-bold">Veri Gir — Koşu Seç</h1>
        </div>
        <DatePickerNav selectedDate={selectedDate} today={today} tomorrow={tomorrow} />
        <p className="text-xs text-muted-foreground">Günü seçip analiz gireceğin koşuya tıkla.</p>

        {gunler.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            Bu tarih için koşu programı bulunamadı.
            {selectedDate >= today && <p className="mt-1 text-xs">Program henüz import edilmemiş olabilir.</p>}
          </div>
        ) : (
          <div className="space-y-4">
            {gunler.map((gun) => (
              <div key={gun.id}>
                <p className="mb-2 text-sm font-semibold text-muted-foreground">{gun.gunEtiketi}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
                  {gun.races.map((race) => (
                    <button
                      key={race.id}
                      type="button"
                      onClick={() => handleSelectRace(race.id)}
                      className={`rounded-lg border px-3 py-2 text-center text-sm transition-colors hover:bg-muted ${
                        race.id === selectedRaceId ? "border-brand bg-brand/10" : race.hasAnaliz ? "border-brand/30 bg-brand/5" : ""
                      }`}
                    >
                      <span className="font-semibold">{race.raceNo}. Koşu</span>
                      {race.hasAnaliz && <div className="mt-0.5 text-[10px] text-brand">✓ Analiz var</div>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Seçilen koşunun analizi ───────────────────────────────────────── */}
      <div className="min-w-0 space-y-5 lg:border-l lg:pl-6">
        {!selectedRaceId && (
          <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
            <ChevronLeft className="mx-auto mb-2 h-5 w-5" />
            Analiz girmek için soldan bir koşu seçin.
          </div>
        )}

        {selectedRaceId && loading && (
          <div className="flex items-center gap-2 py-16 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Koşu yükleniyor…
          </div>
        )}

        {selectedRaceId && error && (
          <p className="rounded-md border border-miss/40 bg-miss/10 p-3 text-xs text-miss">{error}</p>
        )}

        {selectedRaceId && !loading && raceData && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">{raceName}</h2>
                <p className="text-xs text-muted-foreground">
                  {raceData.classType} · {raceData.distance}m · {raceData.runners.length} at
                </p>
              </div>
              {raceData.prediction && (
                <Link
                  href={`/admin/analizler/${raceData.prediction.id}`}
                  className="shrink-0 rounded-lg border border-brand/30 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10"
                >
                  Analizi Gör →
                </Link>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMod("oto")}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                  mod === "oto" ? "bg-brand text-black" : "border border-white/10 text-muted-foreground hover:bg-white/5"
                }`}
              >
                Otomatik Analiz
              </button>
              <button
                type="button"
                onClick={() => setMod("md")}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                  mod === "md" ? "bg-brand text-black" : "border border-white/10 text-muted-foreground hover:bg-white/5"
                }`}
              >
                Markdown Giriş
              </button>
              <button
                type="button"
                onClick={() => setMod("screenshot")}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                  mod === "screenshot" ? "bg-brand text-black" : "border border-white/10 text-muted-foreground hover:bg-white/5"
                }`}
              >
                Ekran Görüntüsü
              </button>
            </div>

            {mod === "oto" && (
              <SmartAnalysisEditor
                key={raceData.id}
                raceId={raceData.id}
                runners={raceData.runners}
                existingPrediction={raceData.prediction ?? undefined}
              />
            )}
            {mod === "md" && (
              <MarkdownRaceInput
                raceId={raceData.id}
                raceLabel={`${raceData.raceNo}. Koşu — ${raceData.runners.length} at`}
                defaultOpen
              />
            )}
            {mod === "screenshot" && <BultenUpload raceId={raceData.id} raceName={raceName} />}
          </>
        )}
      </div>
    </div>
  );
}
