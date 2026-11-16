"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ProgramRunner } from "@/server/services/race.service";
import { getPedigriPanel } from "@/server/actions/pedigri-panel.actions";
import type { AtaSatiri, PedigriPanelSonuc } from "@/server/services/pedigri-panel.service";

// Pedigri paneli — TJK resmî verisi. Üç AYRI değer (karıştırılmaz): KALİTE (kategorideki diğer soy hatlarına göre yüzdelik, 0–100),
// UZMANLAŞMA (bağlam oranı − atanın bağlam dışı kendi oranı, açıklayıcı), VERİ GÜVENİ (doğru tahmin ihtimali DEĞİL).
// Yalnız gösterim: ana skora girmez. Atın kendi koşuları atanın istatistiğinden çıkarılmıştır ("diğer yavrular").
const ROL_AD: Record<AtaSatiri["rol"], string> = { BABA: "Baba", ANNE: "Anne", KISRAK_BABASI: "Kısrak Babası" };
const yuzde = (x: number | null, d = 1) => (x == null ? "—" : `%${(x * 100).toFixed(d).replace(".", ",")}`);
const pp = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1).replace(".", ",")} yp`;

function AtaSatir({ a }: { a: AtaSatiri }) {
  if (a.durum === "VERI_YOK") {
    // Bilgi yokluğu OLUMSUZ değildir: nötr gri, puana katılmaz.
    return (
      <div className="py-1 text-[11px] leading-snug text-muted-foreground">
        <span className="font-semibold">{ROL_AD[a.rol]}</span>
        {a.ad && <span> — {a.ad}</span>}
        <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] font-medium">VERİ YOK</span>
        <span className="ml-1">{a.not?.replace(/^VERİ YOK( \(olumsuz değil\))? — /, "")}{a.not?.includes("olumsuz değil") ? " (olumsuz değil)" : ""}</span>
      </div>
    );
  }
  return (
    <div className="py-1.5 text-[11px] leading-snug">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold">{ROL_AD[a.rol]}</span>
        <span className="text-foreground">{a.ad}</span>
        <span className="text-base font-bold tabular-nums">{yuzde(a.ham)}</span>
        <span className="text-muted-foreground tabular-nums">{a.wins} galibiyet / {a.starts} koşu{a.yavru ? ` · ${a.yavru} yavru` : ""}</span>
      </div>
      <div className="text-muted-foreground">
        {a.kategori}
        {a.durum === "GENEL_YEDEK" && <span className="ml-1 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] font-medium text-amber-500">genel yedek</span>}
        {a.uzmanlasma && <> · Kendi diğer kaydına göre <span className="text-foreground tabular-nums">{pp(a.uzmanlasma.farkPp)}</span> (diğer {a.uzmanlasma.refStarts} koşuda {yuzde(a.uzmanlasma.refK)})</>}
      </div>
      <div className="flex flex-wrap gap-x-4 text-muted-foreground">
        <span title="Aynı kategorideki diğer soy hatlarına göre yüzdelik konum (0–100). Örnek sayısı düzeltmeli. Kazanma olasılığı DEĞİLDİR.">
          Kalite <span className="font-semibold text-foreground tabular-nums">{a.kalite != null ? a.kalite.toFixed(0) : "—"}</span>
          {a.kategoriOrtalama != null && <span className="text-[10px]"> (kategori ort. {yuzde(a.kategoriOrtalama)})</span>}
        </span>
        <span title="Veri güveni: örnek (etkin, farklı yavru sayısı dahil) ne kadar büyük. Tahminin doğru çıkma ihtimali DEĞİLDİR.">
          Veri güveni <span className="font-semibold text-foreground tabular-nums">{a.veriGuveni != null ? `%${a.veriGuveni.toFixed(0)}` : "—"}</span>
        </span>
      </div>
      {a.ayrintilar.length > 0 && <div className="text-muted-foreground">Ayrı ayrı (birleşik veri yok): {a.ayrintilar.map((x) => `${x.etiket} ${x.wins}/${x.starts}`).join(" · ")}</div>}
      {a.not && <div className="text-amber-500">{a.not}</div>}
      {a.yarisSonrasiVeri && <div className="text-miss">Bu istatistik yarıştan SONRA alınmış — geçmişe dönük analizde kullanılamaz.</div>}
    </div>
  );
}

export default function PedigreePanel({ runners, raceId }: { runners: ProgramRunner[]; raceId: string }) {
  const t = useTranslations("programToolbar");
  const [veri, setVeri] = useState<PedigriPanelSonuc | null | undefined>(undefined);
  useEffect(() => {
    let iptal = false;
    getPedigriPanel(raceId).then((s) => { if (!iptal) setVeri(s); }).catch(() => { if (!iptal) setVeri(null); });
    return () => { iptal = true; };
  }, [raceId]);
  const atOf = (no: number) => veri?.atlar.find((a) => a.no === no);

  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#022637] border-b flex items-center">
        <span className="text-sm font-bold tracking-wide text-white">{t("pedigriler")}</span>
      </div>
      {veri === undefined && <div className="px-4 py-3 text-xs text-muted-foreground">Pedigri verisi yükleniyor…</div>}
      {veri === null && <div className="px-4 py-3 text-xs text-muted-foreground">Pedigri istatistikleri şu an alınamadı.</div>}
      {veri?.uyari && <div className="px-4 py-2 text-[11px] text-miss border-b">{veri.uyari}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2">
        {runners.map((r, idx) => {
          const p = atOf(r.no);
          return (
            <div key={r.id} className={cn("px-3 py-2.5 border-b", idx % 2 === 0 && "sm:border-r")}>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <div className="text-xs font-semibold">
                  <span className="font-mono mr-1.5">{r.no}</span>
                  {r.name}
                </div>
                {p && (p.pedigriKalite != null || p.pedigriGuven > 0) && (
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap" title="Pedigri Kalitesi: mevcut soy hatlarının kalite ortalaması (eksik hat sıfırlanmaz). Pedigri Güveni: üç hattın veri güveni ortalaması (eksik hat 0). Ana skora girmez.">
                    Pedigri Kalitesi <span className="font-bold text-foreground tabular-nums">{p.pedigriKalite != null ? p.pedigriKalite.toFixed(0) : "—"}</span>
                    {" · "}Veri güveni <span className="font-bold text-foreground tabular-nums">%{p.pedigriGuven.toFixed(0)}</span>
                  </div>
                )}
              </div>
              {p ? (
                <>
                  <AtaSatir a={p.baba} />
                  <AtaSatir a={p.anne} />
                  <AtaSatir a={p.kisrakBabasi} />
                </>
              ) : (
                <div className="text-[11px] text-muted-foreground leading-snug">
                  {r.sire || r.dam ? (
                    <>
                      <span className="text-foreground">{r.sire ?? "—"}</span>
                      {" — "}
                      <span className="text-foreground">{r.dam ?? "—"}</span>
                      {r.damSire && <span> ({r.damSire})</span>}
                    </>
                  ) : (
                    <span>{t("pedigriBilgisiYok")}</span>
                  )}
                </div>
              )}
              {r.adminNote && <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{r.adminNote}</div>}
            </div>
          );
        })}
      </div>
      <div className="px-4 py-1.5 text-[10px] text-muted-foreground border-t leading-snug">
        Kaynak: TJK. Kalite = aynı kategorideki diğer soy hatlarına göre yüzdelik (kazanma olasılığı değildir). Veri güveni = örnek büyüklüğü (doğru tahmin ihtimali değildir). Atın kendi koşuları ata istatistiğinden çıkarılmıştır. Yalnız bilgi amaçlıdır; modele girmez.
      </div>
    </div>
  );
}
