"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getHorseHistory, type HorseHistoryEntry } from "@/server/actions/horse-detail.actions";
import { getHorsePedigreeTree } from "@/server/actions/horse-pedigree.actions";
import type { PedigreeTree } from "@/lib/pedigree-tree-types";
import SoyAgaciTree from "./SoyAgaciTree";
import { getHorseProfileByName, getHorseDetailedStatsByName } from "@/server/actions/horse-profile.actions";
import type { HorseProfile, HorseDetailStatSection } from "@/server/services/ingest/tjk-at-profil.adapter";
import HorseProfileSummary from "./HorseProfileSummary";
import HorseDetailedStatsView from "./HorseDetailedStatsView";

function surfaceShort(s: string) {
  if (s === "CIM") return { label: "Çim", cls: "text-[#009900]" };
  if (s === "SENTETIK") return { label: "Sentetik", cls: "text-[#D39B1E]" };
  return { label: "Kum", cls: "text-[#996633]" };
}

function finishClass(pos: number | null) {
  if (pos === 1) return "text-[#27ae60]";
  if (pos != null && pos <= 3) return "text-[#2980b9]";
  return "text-muted-foreground";
}

export default function HorseDetailModal({ name, onClose }: { name: string; onClose: () => void }) {
  const [data, setData] = useState<HorseHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pedigreeTree, setPedigreeTree] = useState<PedigreeTree | null>(null);
  const [pedigreeLoading, setPedigreeLoading] = useState(true);
  const [profile, setProfile] = useState<HorseProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [detailedStats, setDetailedStats] = useState<HorseDetailStatSection[]>([]);
  const [detailedStatsLoading, setDetailedStatsLoading] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setData(null);
    getHorseHistory(name)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [name]);

  useEffect(() => {
    let cancelled = false;
    setPedigreeLoading(true);
    setPedigreeTree(null);
    getHorsePedigreeTree(name)
      .then((res) => { if (!cancelled) setPedigreeTree(res); })
      .catch(() => { if (!cancelled) setPedigreeTree(null); })
      .finally(() => { if (!cancelled) setPedigreeLoading(false); });
    return () => { cancelled = true; };
  }, [name]);

  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    setProfile(null);
    getHorseProfileByName(name)
      .then((res) => { if (!cancelled) setProfile(res); })
      .catch(() => { if (!cancelled) setProfile(null); })
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [name]);

  useEffect(() => {
    let cancelled = false;
    setDetailedStatsLoading(true);
    setDetailedStats([]);
    getHorseDetailedStatsByName(name)
      .then((res) => { if (!cancelled) setDetailedStats(res); })
      .catch(() => { if (!cancelled) setDetailedStats([]); })
      .finally(() => { if (!cancelled) setDetailedStatsLoading(false); });
    return () => { cancelled = true; };
  }, [name]);

  // Odağı diyalog içine al ve önceki elemana geri döndür — ekran okuyucu/klavye kullanıcıları arkadaki sayfaya kaçmasın
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={name}
        className="flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-bold">{name}</h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            title="Kapat"
            aria-label="Kapat"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto">
          <div className="border-b px-4 py-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Soy Ağacı (3 kuşak, TJK)
            </div>
            {pedigreeLoading ? (
              <div className="py-4 text-center text-xs text-muted-foreground">Soy ağacı yükleniyor…</div>
            ) : pedigreeTree ? (
              <SoyAgaciTree tree={pedigreeTree} />
            ) : (
              <div className="py-2 text-xs text-muted-foreground">Bu at için soy ağacı bulunamadı.</div>
            )}
          </div>

          <div className="border-b px-4 py-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sahiplik & Kazanç (TJK)
            </div>
            {profileLoading ? (
              <div className="py-4 text-center text-xs text-muted-foreground">Yükleniyor…</div>
            ) : profile ? (
              <HorseProfileSummary profile={profile} />
            ) : (
              <div className="py-2 text-xs text-muted-foreground">Bu at için detaylı bilgi bulunamadı.</div>
            )}
          </div>

          <div className="border-b px-4 py-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Detaylı İstatistikler (Zaman / Hipodrom / Jokey / Pist / Mesafe)
            </div>
            {detailedStatsLoading ? (
              <div className="py-4 text-center text-xs text-muted-foreground">Yükleniyor…</div>
            ) : (
              <HorseDetailedStatsView sections={detailedStats} />
            )}
          </div>

          {loading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Geçmiş yükleniyor…</div>
          ) : error ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Geçmiş yarışlar alınamadı.</div>
          ) : !data || data.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Geçmiş yarış kaydı bulunamadı.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/60 text-muted-foreground">
                    <th className="px-2 py-1.5 text-left">Tarih</th>
                    <th className="px-2 py-1.5 text-left">Hipodrom</th>
                    <th className="px-2 py-1.5 text-center">Mesafe</th>
                    <th className="px-2 py-1.5 text-center">Pist</th>
                    <th className="px-2 py-1.5 text-left">Cins</th>
                    <th className="px-2 py-1.5 text-center">Takı</th>
                    <th className="px-2 py-1.5 text-left">Jokey</th>
                    <th className="px-2 py-1.5 text-center">Kilo</th>
                    <th className="px-2 py-1.5 text-center">H.P</th>
                    <th className="px-2 py-1.5 text-center">AGF</th>
                    <th className="px-2 py-1.5 text-center">Derece</th>
                    <th className="px-2 py-1.5 text-center">Sonuç</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((h) => {
                    const surf = surfaceShort(h.surface);
                    return (
                      <tr key={h.raceId} className="border-b text-xs">
                        <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                          {new Date(h.date).toLocaleDateString("tr-TR")}
                        </td>
                        <td className="px-2 py-1.5">{h.hippodrome} · {h.raceNo}.K</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{h.distance}m</td>
                        <td className={cn("px-2 py-1.5 text-center font-medium", surf.cls)}>
                          {surf.label}
                          {h.zeminEtiketi && (
                            <div className="text-[10px] font-normal text-muted-foreground">{h.zeminEtiketi}</div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{h.classType || "—"}</td>
                        <td className="px-2 py-1.5 text-center whitespace-nowrap text-[11px]">
                          {h.equipment ? h.equipment.split(",").join(" ") : "—"}
                        </td>
                        <td className="px-2 py-1.5">{h.jockey ?? "—"}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{h.weight ?? "—"}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums font-mono">{h.hp ?? "—"}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{h.agf != null ? `%${h.agf.toFixed(1)}` : "—"}</td>
                        <td className="px-2 py-1.5 text-center font-mono tabular-nums">{h.bestTime?.split(" - ")[0] ?? "—"}</td>
                        <td className={cn("px-2 py-1.5 text-center font-semibold", finishClass(h.finishPos))}>
                          {h.scratched ? <span className="text-red-400">Koşmadı</span> : h.finishPos != null ? `${h.finishPos}.` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
