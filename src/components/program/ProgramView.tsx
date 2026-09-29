"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn, raceTimeForLocale } from "@/lib/utils";
import { useLocaleSwitch } from "@/components/providers/LocaleProvider";
import { EKURI_COLORS, ekuriRengi } from "@/lib/ekuri-colors";
import { ChevronDown, ChevronUp, Star, Info, Radio } from "lucide-react";
import type { ProgramDay, ProgramRace, ProgramRunner, ProgramPick } from "@/server/services/race.service";
import { toggleHorseFollow } from "@/server/actions/horse-follow";
import SiralamaRaceView from "@/components/kosular/SiralamaRaceView";
import { programKosusuToSiralama } from "@/components/kosular/siralama-tipleri";
import HorseDetailModal from "./HorseDetailModal";
import HipodromOzellikleriModal from "./HipodromOzellikleriModal";
import EmailVerificationGate from "./EmailVerificationGate";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getPistMesafeStilIstatistigi, type PistMesafeStilSonuc } from "@/server/actions/pist-mesafe-stil.actions";
import type { Surface } from "@prisma/client";

// Sadece ilgili buton tıklanınca açılan paneller — ilk sayfa yüklemesinin JS
// paketine dahil edilmesinler diye lazy-load (next/dynamic) ile yükleniyor.
const PANEL_LOADING = (
  <div className="border-t px-4 py-8 text-center text-sm text-muted-foreground">Yükleniyor…</div>
);
const Son800Panel = dynamic(() => import("./panels/Son800Panel"), { loading: () => PANEL_LOADING, ssr: false });
const AgfTrendPanel = dynamic(() => import("./panels/AgfTrendPanel"), { loading: () => PANEL_LOADING, ssr: false });
const GalopPanel = dynamic(() => import("./panels/GalopPanel"), { loading: () => PANEL_LOADING, ssr: false });
const PedigreePanel = dynamic(() => import("./panels/PedigreePanel"), { loading: () => PANEL_LOADING, ssr: false });
const ComparisonPanel = dynamic(() => import("./panels/ComparisonPanel"), { loading: () => PANEL_LOADING, ssr: false });
const H2HPanel = dynamic(() => import("./panels/H2HPanel"), { loading: () => PANEL_LOADING, ssr: false });
const SonYarisDetayPanel = dynamic(() => import("./panels/SonYarisDetayPanel"), { loading: () => PANEL_LOADING, ssr: false });
const AtDetaylariPanel = dynamic(() => import("./panels/AtDetaylariPanel"), { loading: () => PANEL_LOADING, ssr: false });

// Detay paneli açma/kapama butonları (Son 800/Galop/Pedigriler/H2H/Karşılaştır/Son Yarış Detayları) —
// her biri farklı renkteyken karmaşık görünüyordu; artık hepsi tek tip, sadece açık/kapalı
// durumuna göre (marka rengi / nötr) ayrışıyor.
const LAST_HIPO_STORAGE_KEY = "rg-last-hipo";
const PANEL_BTN_CLASS = "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors shrink-0";
const PANEL_BTN_OPEN = "bg-brand text-brand-foreground";
const PANEL_BTN_CLOSED = "bg-foreground/5 text-muted-foreground border border-foreground/10 hover:bg-foreground/10";

// Koşu tab'ları — kullanıcı isteği: TJK'nın kendi sitesindeki gibi pist türüne göre
// renklendirilsin, TJK'nın KENDİ renk kodlarıyla birebir (bkz. tjk.adapter.ts'teki
// "Son 6 Yarış" font-color notu: #009900=Çim, #996633=Kum, #d39b1e=Sentetik — aynı
// kaynak, tek yerde tutarlı). r.surface, Race.surface'ten geliyor ve program senkronu
// her çalıştığında güncelleniyor — pist değişikliği (yağışta çim→kum gibi) olursa bir
// sonraki senkronda burası da otomatik güncellenir, sabit/statik değil.
const SURFACE_TAB_BG: Record<string, string> = {
  CIM: "bg-[#009900] hover:bg-[#00b300] text-white",
  KUM: "bg-[#996633] hover:bg-[#a8754a] text-white",
  SENTETIK: "bg-[#D39B1E] hover:bg-[#e0ab3a] text-white",
};

// ── Yurt dışı hipodrom sekmesi: ülke bayrağı + kısa isim ────────────────────────
// 2026-09-29 — kullanıcı bulgusu: unicode bayrak EMOJİ'leri (🇫🇷 vb.) bazı ortamlarda
// (emoji fontu eksikse) "FR"/"GB" gibi düz harflere düşüyor, güvenilir değil. Bunun
// yerine flagcdn.com'un (ücretsiz, API-key'siz, yaygın kullanılan) SVG bayraklarını
// <img> ile gösteriyoruz — fonttan bağımsız, her cihazda AYNI görünür. ISO 3166-1
// alpha-2 kodları tjk.adapter.ts'teki YABANCI_ULKELER listesiyle BİREBİR AYNI SIRADA
// tutulmalı (Hippodrome.country oradan geliyor); yeni bir ülke eklenirse ikisi de
// güncellenmeli, aksi halde o hipodromun bayrağı çıkmaz (nötr 🏳 yedeğe düşer).
const ULKE_KODU: Record<string, string> = {
  "Fransa": "fr", "Birleşik Krallık": "gb", "İngiltere": "gb", "İskoçya": "gb",
  "İrlanda": "ie", "Kanada": "ca", "ABD": "us", "Amerika Birleşik Devletleri": "us",
  "Şili": "cl", "Arjantin": "ar", "Brezilya": "br", "Almanya": "de", "İtalya": "it",
  "İspanya": "es", "Avustralya": "au", "Yeni Zelanda": "nz", "Güney Afrika": "za",
  "Japonya": "jp", "Hong Kong": "hk", "Singapur": "sg", "Suudi Arabistan": "sa",
  "Katar": "qa", "Birleşik Arap Emirlikleri": "ae", "BAE": "ae", "Malezya": "my",
  "Hindistan": "in", "Norveç": "no", "İsveç": "se", "Danimarka": "dk", "Belçika": "be",
  "Hollanda": "nl", "Türkiye": "tr",
};

function UlkeBayragi({ country }: { country: string | null }) {
  const kod = country ? ULKE_KODU[country] : undefined;
  if (!kod) return <span aria-hidden="true">🏳</span>;
  return (
    <img
      src={`https://flagcdn.com/${kod}.svg`}
      alt={country ?? ""}
      className="inline-block h-3 w-4 shrink-0 rounded-[1px] object-cover align-[-1px]"
      loading="lazy"
    />
  );
}

/** "Chantilly Fransa" → "Chantilly" (country son eki kırpılır — sekme kısa kalsın diye,
 *  ülke zaten bayrakla gösteriliyor). country eşleşmezse (nadiren) TAM isim korunur. */
function kisaHipodromAdi(hippodromeName: string, country: string | null): string {
  if (!country) return hippodromeName;
  return hippodromeName.endsWith(` ${country}`) ? hippodromeName.slice(0, -(country.length + 1)) : hippodromeName;
}

// ── Gece yarısını aşan koşu saatleri (yurt dışı hipodromlar) ─────────────────────
// 2026-09-29 kullanıcı bulgusu: Horseshoe Indianapolis'in 7./8. koşuları TR saatiyle
// 00.16/00.47'ye denk geliyor (ABD saati TR'ye çevrilince gece yarısını aşıyor) — TJK
// bunu "ertesi gün" işareti KOYMADAN düz "00.16" yazıyor (doğrulandı: 6. koşu 23.45,
// 7. koşu 00.16, aynı günün devamı). RaceDay.date TEK bir gün olduğu için (TR
// hipodromlarında hiç gün taşması olmadığından bu güne kadar hiç sorun çıkmamıştı),
// saat bir önceki koşudan KÜÇÜLDÜĞÜNDE o koşudan itibaren geri sayım/"Başladı"
// hesaplaması RaceDay.date+1 GÜN üzerinden yapılmalı — yoksa henüz başlamamış bir
// koşu "Başladı" (geçmiş) sanılır. Şema DEĞİŞMEDİ (Race.time hâlâ "HH:mm" string),
// bu SADECE gösterim/hesaplama katmanında bir düzeltme.
function raceGunOffsetleriHesapla(races: { raceNo: number; time: string | null }[]): Map<number, number> {
  const offsets = new Map<number, number>();
  let prevMinutes: number | null = null;
  let offset = 0;
  for (const r of [...races].sort((a, b) => a.raceNo - b.raceNo)) {
    if (r.time) {
      const [h, m] = r.time.replace(".", ":").split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const minutes = h * 60 + m;
        if (prevMinutes != null && minutes < prevMinutes) offset++;
        prevMinutes = minutes;
      }
    }
    offsets.set(r.raceNo, offset);
  }
  return offsets;
}

function raceEffectiveDateStr(dateStr: string, offsetGun: number): string {
  if (offsetGun === 0) return dateStr;
  const d = new Date(dateStr + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + offsetGun);
  return d.toISOString().slice(0, 10);
}

// ── Geri sayım (Turkey UTC+3) ────────────────────────────────────────────────

function useRaceCountdown(time: string | null, hasResult: boolean, dateStr: string) {
  const t = useTranslations("programToolbar");
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (hasResult) { setDisplay(t("kostu")); return; }
    if (!time) return;

    const tick = () => {
      const now = Date.now();
      const [h, m] = time.replace(".", ":").split(":").map(Number);
      if (isNaN(h) || isNaN(m)) return;
      // race target in UTC: use explicit dateStr, not today's date
      const raceUtcMs = new Date(`${dateStr}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00Z`).getTime()
        - 3 * 60 * 60 * 1000;
      const diffSec = Math.floor((raceUtcMs - now) / 1000);
      if (diffSec <= 0) { setDisplay(t("basladi")); return; }
      const hrs = Math.floor(diffSec / 3600);
      const mins = Math.floor((diffSec % 3600) / 60);
      const secs = diffSec % 60;
      // 2026-08-24 kullanıcı talebi: sitedeki TÜM geri sayımlar tek biçime (saniye
      // hassasiyetiyle HH:MM:SS) getirildi — bkz. RaceCountdown.tsx'teki aynı desen.
      const pad = (n: number) => String(n).padStart(2, "0");
      setDisplay(`${pad(hrs)}:${pad(mins)}:${pad(secs)}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [time, hasResult, dateStr, t]);

  return display;
}

// ── Son Yarışlar renk ────────────────────────────────────────────────────────

function formBoxClass(pos: string, surface: string): string {
  if (pos === "K") return "bg-[#7f8c8d] text-white"; // Koşmadı — always gray
  if (surface === "C") return "bg-[#009900] text-white"; // Çim
  if (surface === "S") return "bg-[#D39B1E] text-white"; // Sentetik
  if (surface === "K") return "bg-[#996633] text-white"; // Kum
  return formBoxClassByPos(pos); // zemin bilinmiyorsa pozisyona göre
}

function formBoxClassByPos(pos: string): string {
  if (pos === "1") return "bg-[#27ae60] text-white";
  if (pos === "2") return "bg-[#2980b9] text-white";
  if (pos === "3") return "bg-[#f39c12] text-white";
  if (pos === "0") return "bg-[#7f8c8d] text-white";
  const n = parseInt(pos, 10);
  if (n >= 4 && n <= 6) return "bg-[#e74c3c] text-white";
  return "bg-[#922b21] text-white";
}

// En İyi Derece — "1.58.82 - 13/06/2026" → saniyeye çevir (karşılaştırma için)
function bestTimeToSeconds(t: string): number {
  const time = t.split(" - ")[0].trim();
  const parts = time.split(".");
  if (parts.length !== 3) return Infinity;
  const [m, s, cs] = parts.map(Number);
  if ([m, s, cs].some(isNaN)) return Infinity;
  return m * 60 + s + cs / 100;
}

type ProgramT = ReturnType<typeof useTranslations<"programToolbar">>;

function surfaceLabel(s: string, t: ProgramT) {
  if (s === "CIM") return { label: t("surfaceCim"), cls: "text-[#009900]" };
  if (s === "SENTETIK") return { label: t("surfaceSentetik"), cls: "text-[#D39B1E]" };
  return { label: t("surfaceKum"), cls: "text-[#996633]" };
}

function breedShort(b: string, t: ProgramT) {
  return b === "ARAP" ? t("breedArap") : t("breedIngiliz");
}

const STIL_KISA_ETIKET_KEY: Record<string, "kacakAtKisa" | "onGrupArkasiKisa" | "beklemeGrubuKisa" | "enGeriTakipKisa"> = {
  KACAK_AT: "kacakAtKisa", ON_GRUP_ARKASI: "onGrupArkasiKisa", BEKLEME_GRUBU: "beklemeGrubuKisa", EN_GERI_TAKIP: "enGeriTakipKisa",
};
const STIL_RENK_CLS: Record<string, string> = {
  KACAK_AT: "bg-[#e74c3c]/15 text-[#e74c3c]",
  // #d4a017 (koyu sarı) beyaz zeminde neredeyse okunmuyordu — açık temada koyulaştırıldı.
  ON_GRUP_ARKASI: "bg-[#d4a017]/10 text-[#8a6510] dark:bg-[#d4a017]/15 dark:text-[#d4a017]",
  BEKLEME_GRUBU: "bg-[#2980b9]/15 text-[#2980b9]", EN_GERI_TAKIP: "bg-[#8e44ad]/15 text-[#8e44ad]",
};

// 2026-09-11 kullanıcı talebi — saha geneli "Yarış Temposu" rozeti. Veri zaten
// hesaplanıyordu (v5-engine.ts yarisGidisatiSkoru için), yalnız hiçbir yere
// gösterilmiyordu — bkz. race.service.ts hesaplaRaceTempoSenaryosu. Hesaplama
// pace-analizi.ts'in 6 teknik senaryosunu (RAHAT_LİDERLİK vb.) üretir — kullanıcı
// talebiyle (2026-09-11, "alışılmamış terimler kullanılmamalı") GÖSTERİM 4 basit
// hız terimine indirgendi, HESAPLAMA MANTIĞI DEĞİŞMEDİ, yalnız etiket eşlemesi.
const TEMPO_LABEL_KEY: Record<string, "tempoCokYavas" | "tempoYavas" | "tempoNormal" | "tempoHizli" | "tempoCokHizli"> = {
  RAHAT_LIDERLIK: "tempoCokYavas",
  YAVAS_TEMPO: "tempoYavas",
  DENGELI: "tempoNormal",
  MUCADELELI: "tempoHizli",
  COK_YUKSEK: "tempoCokHizli",
  DAGILMA_RISKI: "tempoCokHizli",
};
const TEMPO_RENK_CLS: Record<string, string> = {
  RAHAT_LIDERLIK: "bg-[#2980b9]/15 text-[#2980b9]",
  YAVAS_TEMPO: "bg-muted text-muted-foreground",
  DENGELI: "bg-[#27ae60]/15 text-[#27ae60]",
  MUCADELELI: "bg-[#d4a017]/10 text-[#8a6510] dark:bg-[#d4a017]/15 dark:text-[#d4a017]",
  COK_YUKSEK: "bg-[#e74c3c]/15 text-[#e74c3c]",
  DAGILMA_RISKI: "bg-[#e74c3c]/15 text-[#e74c3c]",
};
function TempoSenaryosuBadge({ tempoSenaryosu, t }: { tempoSenaryosu: string | null; t: ProgramT }) {
  if (!tempoSenaryosu || !TEMPO_LABEL_KEY[tempoSenaryosu]) return null;
  return (
    <span
      className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", TEMPO_RENK_CLS[tempoSenaryosu])}
      title={t("yarisTemposuAciklama")}
    >
      {t("yarisTemposu")}: {t(TEMPO_LABEL_KEY[tempoSenaryosu])}
    </span>
  );
}

// Yarış stili — Accurace (GPS/sektörel zamanlama) geçmişinden n>=3 yarışla hesaplanan
// kalıcı eğilim (bkz. pace-analizi.ts). Eski TJK Son800 tabanlı 4'lü sistemin yerini aldı.
// 2026-09-01 kullanıcı talebi ("tek değil yüzdesel stillerini çıkarmalısın"): rozet artık
// yalnız BASKIN stili değil, dagilim varsa (Yarış Gidişatı çalışmasıyla eklendi — bkz.
// accurace-sync.service.ts) 4 stilin TAMAMINI (sıfır olmayanları) yüzdesiyle gösteriyor.
// dagilim henüz hesaplanmamış (eski kayıt) atlarda eski tek-stil gösterimine düşer.
function raceStyleBadge(
  raceStyle: { style: string; percent: number; veri?: number | null; dagilim?: Record<string, number> } | null,
  t: ProgramT
): { text: string; cls: string; dusukGuven: boolean } | null {
  if (!raceStyle) return null;
  const { style, percent, veri, dagilim } = raceStyle;
  if (!STIL_RENK_CLS[style]) return null;
  // n=3-4 ile çıkan bir yüzde (örn. %33, 3 yarışta 3 farklı stil demek) gerçek bir
  // eğilim değil, neredeyse rastgele — rozette n'i göstermezsek kullanıcı bunu
  // yüksek-güvenilirlikli bir örüntüyle (örn. n=20+ %80) karıştırabilir.
  const dusukGuven = veri != null && veri <= 4;
  const n = veri != null ? ` (${veri})` : "";
  const cls = STIL_RENK_CLS[style];

  if (dagilim) {
    const parcalar = (Object.entries(dagilim) as [string, number][])
      .filter(([, p]) => p > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([s, p]) => `%${p} ${t(STIL_KISA_ETIKET_KEY[s] ?? "kacakAtKisa")}`)
      .join(" · ");
    return { text: `${parcalar}${n}`, cls, dusukGuven };
  }
  const styleKey = style === "KACAK_AT" ? "kacakAt" : style === "ON_GRUP_ARKASI" ? "onGrupArkasi" : style === "BEKLEME_GRUBU" ? "beklemeGrubu" : "enGeriTakip";
  return { text: t("styleBadgeText", { percent, style: t(styleKey), n }), cls, dusukGuven };
}

function getRaceStyleInfo(t: ProgramT): { style: string; label: string; desc: string; cls: string }[] {
  return [
    { style: "KACAK_AT", label: t("kacakAt"), desc: t("kacakAtDesc"), cls: "text-[#e74c3c]" },
    { style: "ON_GRUP_ARKASI", label: t("onGrupArkasi"), desc: t("onGrupArkasiDesc"), cls: "text-[#8a6510] dark:text-[#d4a017]" },
    { style: "BEKLEME_GRUBU", label: t("beklemeGrubu"), desc: t("beklemeGrubuDesc"), cls: "text-[#2980b9]" },
    { style: "EN_GERI_TAKIP", label: t("enGeriTakip"), desc: t("enGeriTakipDesc"), cls: "text-[#8e44ad]" },
  ];
}

function RaceStyleInfoButton() {
  const t = useTranslations("programToolbar");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground align-middle transition-opacity hover:opacity-80"
          aria-label={t("yarisStiliAriaLabel")}
        >
          <Info className="h-2.5 w-2.5" strokeWidth={2.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-xs" onClick={(e) => e.stopPropagation()}>
        <p className="mb-2 font-semibold text-foreground">{t("yarisStiliNedir")}</p>
        <p className="mb-2 text-muted-foreground">
          {t("yarisStiliAciklama1")}
        </p>
        <p className="mb-2 text-muted-foreground">
          <span className="opacity-60 font-semibold">{t("yarisStiliAciklama2Prefix")}</span> {t("yarisStiliAciklama2")}
        </p>
        <ul className="space-y-1.5">
          {getRaceStyleInfo(t).map((s) => (
            <li key={s.style}>
              <span className={cn("font-semibold", s.cls)}>{s.label}:</span>{" "}
              <span className="text-muted-foreground">{s.desc}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function styleLabelCls(style: string, t: ProgramT) {
  return getRaceStyleInfo(t).find((s) => s.style === style) ?? { label: style, cls: "text-foreground" };
}

/** Bu pist+mesafe kombinasyonunda geçmişte hangi yarış stilinin kazandığını gösteren
 *  bilgi kartı — yalnız tıklanınca (lazy) yükler, sonucu bir kere önbelleğe alır. */
function PistMesafeInfoButton({
  hippodromeName, surface, distance, breed, classType,
}: {
  hippodromeName?: string; surface: string; distance: number; breed: string; classType: string;
}) {
  const t = useTranslations("programToolbar");
  const [data, setData] = useState<PistMesafeStilSonuc | "loading" | "error" | "idle">("idle");

  // ÖNEMLİ: bu bileşen koşu değiştiğinde YENİDEN MOUNT OLMUYOR — üst bileşen
  // (RaceTable) tek bir "seçili koşu" state'iyle sürüyor, aynı React instance'ı
  // korunuyor. Bu yüzden koşu-kimliği (hipodrom/pist/mesafe/ırk/tip) her
  // değiştiğinde state'i elle "idle"a döndürmezsek, bir önceki koşunun
  // sonucu ekranda YAPIŞIK kalır — az önce yaşanan gerçek bug buydu.
  useEffect(() => {
    setData("idle");
  }, [hippodromeName, surface, distance]);

  function handleOpenChange(open: boolean) {
    if (open && data === "idle" && hippodromeName) {
      setData("loading");
      getPistMesafeStilIstatistigi(hippodromeName, surface as Surface, distance)
        .then(setData)
        .catch(() => setData("error"));
    }
  }

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-tour="pist-mesafe-ipucu"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-semibold text-brand transition-colors hover:bg-brand/25"
          aria-label={t("kazananlarAriaLabel")}
        >
          <Info className="h-3 w-3" strokeWidth={2.5} />
          {t("kazananlarButton")}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs" onClick={(e) => e.stopPropagation()}>
        <p className="mb-2 font-semibold text-foreground">
          {hippodromeName} · {distance}m · {surfaceLabel(surface, t).label} · {breedShort(breed, t)} · {classType}
        </p>
        {data === "idle" && <p className="text-muted-foreground">{t("kazananlarAcTiklayin")}</p>}
        {data === "loading" && <p className="text-muted-foreground">{t("kazananlarHesaplaniyor")}</p>}
        {data === "error" && <p className="text-muted-foreground">{t("kazananlarVeriAlinamadi")}</p>}
        {data === null && <p className="text-muted-foreground">{t("kazananlarYetersizVeri")}</p>}
        {data && typeof data === "object" && (
          <>
            <p className="mb-1 text-muted-foreground">
              <strong className="text-foreground">{t("kazananlarBugunkuAtlarlaIlgiliDegil")}</strong>{" "}
              {t.rich("kazananlarGecmisYarisAciklama", { n: data.n, b: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
            </p>
            <ul className="space-y-1 my-2">
              {data.breakdown.map((b) => (
                <li key={b.style} className="flex items-center justify-between">
                  <span className={cn("font-semibold", styleLabelCls(b.style, t).cls)}>{styleLabelCls(b.style, t).label}</span>
                  <span className="tabular-nums text-muted-foreground">%{b.percent} ({b.count})</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground">
              {t("kazananlarTaktikIpucu", { style: styleLabelCls(data.topStyle, t).label.toLocaleLowerCase() })}
            </p>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {t("kazananlarTekYaris")}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {t("kazananlarSonGuncelleme", { tarih: data.enYeniTarih.split("-").reverse().join(".") })}
            </p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function pickDisplay(p: ProgramPick): { no: number | string; name: string } {
  if (p.runner) return { no: p.runner.no, name: p.runner.name };
  return { no: "—", name: p.runnerLabel ?? "—" };
}

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ── Panel kilit kapısı ───────────────────────────────────────────────────────
// v6.104 — kullanıcı talebi 2026-08-11: "bu kısımlar üye olmayanlara kilitli
// gözüksün" (Accurace/AGF Trend/Son Hazırlıklar/Pedigriler/H2H/Karşılaştır/Son
// Yarış Detayları/Hipodrom Özellikleri). Bu paneller o güne kadar isLoggedIn/
// isVerified hiç almıyordu, herkese açıktı — yalnız "Analiz Detayları" (yukarıdaki
// AnalysisPanel) gerçekten üyelik kontrolü yapıyordu. Bu bileşen AYNI kilit
// deneyimini (🔒 + giriş/kayıt, ya da e-posta doğrulama kapısı) merkezi olarak
// tekrar kullanılabilir kılıyor — her panel kendi kilit mantığını tekrar yazmasın.
function PanelKilitGate({
  isLoggedIn, isVerified, userEmail, children,
}: {
  isLoggedIn: boolean;
  isVerified: boolean;
  userEmail: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("programToolbar");

  if (!isLoggedIn) {
    return (
      <div className="border-t px-4 py-8 text-center">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <span className="text-2xl">🔒</span>
          <p className="font-medium">{t("analiziGormekIcinUye")}</p>
          <div className="flex gap-2">
            <a href="/giris?callbackUrl=%2Fprogram" className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground hover:bg-brand/90">
              {t("girisYap")}
            </a>
            <a href="/kayit" className="rounded-md border px-4 py-2 text-xs font-semibold hover:bg-muted">
              {t("kayitOl")}
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="border-t">
        <EmailVerificationGate email={userEmail} />
      </div>
    );
  }

  return <>{children}</>;
}

// ── Analiz paneli ────────────────────────────────────────────────────────────

function AnalysisPanel({
  race, picks, runners, winnerNos, ganyan, isLoggedIn, isAdmin, isVerified, userEmail, raceNo, hippodromeName, raceId,
}: {
  /** 2026-09-28: sıralama görünümü (SiralamaRaceView) tüm koşu verisini (sonuç, tempo, runner'lar) ister. */
  race: ProgramRace;
  picks: ProgramPick[];
  runners: ProgramRunner[];
  winnerNos?: number[] | null;
  ganyan?: number | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isVerified: boolean;
  userEmail: string;
  raceNo: number;
  hippodromeName?: string;
  raceId: string;
}) {
  const t = useTranslations("programToolbar");
  const ref = useRef<HTMLDivElement>(null);

  // Faz 4 yalnız en iyi 3-6 atı sıralayıp "pick" olarak kaydediyor — geri kalanı
  // (Geniş kupon) yalnız couponWide metninde numara olarak geçiyor, ayrı satır
  // olarak hiç gösterilmiyordu. Kullanıcı isteği: tam saha görünsün — seçilmeyen
  // atlar da (sıra/gerekçe olmadan, sade) listenin altına eklenir.
  const pickedNos = new Set(picks.map((p) => p.runner?.no).filter((n): n is number => n != null));
  const unpickedRunners = runners
    .filter((r) => !r.scratched && !pickedNos.has(r.no))
    .sort((a, b) => a.no - b.no);
  // 2026-09-20 kullanıcı talebi: kupon kaydedildikten SONRA o attaki bir isim çekilirse,
  // kaydedilen pick/kupon numarası değişmiyordu ama at artık koşmuyor. runners'ın GÜNCEL
  // (canlı) durumundan geliyor — picks sabit kaldığı için aradaki farkı yakalayabiliyor.
  const scratchedNos = new Set(runners.filter((r) => r.scratched).map((r) => r.no));


  // v6.68 — kullanıcı talebi 2026-08-09: "link istemiyorum direk image üstüne
  // yerleştirilmeli" — eskiden Twitter intent'ine bir URL (link) gönderiliyordu, o da
  // OG görselini bir KART olarak unfurl ediyordu. Artık görsel bir DOSYA olarak Web
  // Share API ile paylaşılıyor — mobil tarayıcılarda ilgili uygulamayı (Instagram/X)
  // paylaşım hedefi olarak sunar, görsel doğrudan yapıştırılır, hiçbir link gitmez.
  // İki AYRI buton var çünkü platforma göre en uygun format farklı: Instagram için
  // dikey Story görseli (1080×1920), X için standart kart oranı (1080×1180).
  async function handleShare(platform: "instagram" | "x") {
    // v6.107 — kullanıcı bulgusu 2026-08-11: senkron-aç-sonra-yönlendir denemesi
    // bazı tarayıcılarda (Safari başta) "about:blank" olarak sabit kalıyordu —
    // gecikmeli .location ataması da o tarayıcılarda popup engeliyle AYNI kısıtlamaya
    // takılabiliyor. Güvenilir tek yol: X'i açan linki GERÇEK bir kullanıcı
    // tıklamasına bağlamak — toast'un action butonu tam bunu sağlıyor, kendi
    // tıklaması olduğu için hiçbir tarayıcıda engellenmiyor.
    const imageUrl = `${window.location.origin}/api/og/sonuc/${raceId}${platform === "instagram" ? "/story" : ""}`;
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`Görsel oluşturulamadı (HTTP ${res.status})`);
      const blob = await res.blob();
      const file = new File([blob], "rotaganyan-sonuc.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Rotaganyan" });
        return;
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "rotaganyan-sonuc.png";
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(t("gorselIndirildi"), platform === "x"
        ? { action: { label: "X'i Aç", onClick: () => window.open("https://x.com/rotaganyantr", "_blank", "noopener,noreferrer") } }
        : undefined);
    } catch (e) {
      // v6.108 — kullanıcı bulgusu 2026-08-11: navigator.share() kullanıcı paylaşım
      // menüsünü kapatınca (bir uygulama SEÇMEDEN) "AbortError" fırlatır — bu GERÇEK
      // bir hata değil, kullanıcının kendi vazgeçmesi. Önceden bu da "başarısız"
      // toast'ı gösteriyordu, yanlış alarm veriyordu.
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error(t("paylasimBasarisiz"));
    }
  }

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const start = window.scrollY;
    const target = start + el.getBoundingClientRect().top - 80;
    const distance = target - start;
    const duration = 600;
    let startTime: number | null = null;
    function easeIn(t: number) { return t * t * t; }
    function step(now: number) {
      if (!startTime) startTime = now;
      const elapsed = Math.min((now - startTime) / duration, 1);
      window.scrollTo(0, start + distance * easeIn(elapsed));
      if (elapsed < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, []);

  if (!isLoggedIn) {
    return (
      <div ref={ref} className="border-t px-4 py-10 text-center">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <span className="text-2xl">🔒</span>
          <p className="font-medium">{t("analiziGormekIcinUye")}</p>
          <div className="flex gap-2">
            <a href="/giris?callbackUrl=%2Fprogram" className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground hover:bg-brand/90">
              {t("girisYap")}
            </a>
            <a href="/kayit" className="rounded-md border px-4 py-2 text-xs font-semibold hover:bg-muted">
              {t("kayitOl")}
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div ref={ref} className="border-t">
        <div className="px-4 py-2.5 bg-[#022637] border-b flex items-center">
          <span className="text-sm font-bold tracking-wide text-white">{t("analizDetaylari")}</span>
        </div>
        <EmailVerificationGate email={userEmail} />
      </div>
    );
  }

  const kazananPick = winnerNos && winnerNos.length > 0 ? picks.find((pk) => pk.runner?.no != null && winnerNos.includes(pk.runner.no)) : undefined;

  return (
    <div ref={ref} className="border-t">
      {/* Başlık */}
      <div className="px-4 py-2.5 bg-[#022637] border-b flex items-center">
        <span className="text-sm font-bold tracking-wide text-white">Analiz Detayları</span>
      </div>

      {/* 2026-09-28 kullanıcı talebi: "/rotaganyansiralamasi'ndaki yapı, Analiz Yayında tıklandığında açılsın" —
          eski Sıra/No/At/Toplam tablosu yerine o sayfayla AYNI paylaşılan bileşen (karar hero'su + sıralama
          listesi). Yan sütunda bu koşuya özgü kademeli Kupon Önerisi (önceki paneldeki mantık aynen). */}
      {isAdmin && kazananPick && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-[#f5c518]/10 px-4 py-1.5 text-xs print:hidden">
          <span className="text-muted-foreground">{t("sonucLabel")}</span>
          <span className="font-semibold text-winner">#{pickDisplay(kazananPick).no} {pickDisplay(kazananPick).name}</span>
          {ganyan != null && <span className="text-[10px] font-semibold text-winner">Gny: {ganyan.toFixed(2)}</span>}
          <button
            type="button"
            onClick={() => handleShare("instagram")}
            title={t("instagramdaPaylas")}
            aria-label={t("instagramdaPaylas")}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors hover:bg-foreground/15"
          >
            <InstagramLogo className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => handleShare("x")}
            title={t("xtePaylas")}
            aria-label={t("xtePaylas")}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors hover:bg-foreground/15"
          >
            <XLogo className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="p-3 sm:p-4">
        <SiralamaRaceView
          raceKey={raceId}
          race={programKosusuToSiralama(race)}
          tempoSenaryosu={race.tempoSenaryosu}
          yan={
            picks.length > 0 || unpickedRunners.length > 0 ? (
              <div className="rounded-2xl border bg-card px-4 py-3">
                <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("kuponOnerisi")}</div>
                <div className="space-y-2">
              {(() => {
                const ekonomikNos = picks.slice(0, 3).map((p) => p.runner?.no).filter((n): n is number => n != null);
                const normalEkNos = picks.slice(3, 6).map((p) => p.runner?.no).filter((n): n is number => n != null);
                const genisEkNos = [
                  ...picks.slice(6).map((p) => p.runner?.no).filter((n): n is number => n != null),
                  ...unpickedRunners.map((r) => r.no),
                ].sort((a, b) => a - b);
                const gruplar = [ekonomikNos, normalEkNos, genisEkNos];
                const parcalar = gruplar.map((g) => (g.length > 0 ? g.join("-") : null));
                const tiers = [
                  { label: t("ekonomik"), color: "text-hit", metin: parcalar.slice(0, 1).filter(Boolean).join(" / "), nos: gruplar.slice(0, 1).flat() },
                  { label: t("normal"), color: "text-brand", metin: parcalar.slice(0, 2).filter(Boolean).join(" / "), nos: gruplar.slice(0, 2).flat() },
                  { label: t("genis"), color: "text-muted-foreground", metin: parcalar.slice(0, 3).filter(Boolean).join(" / "), nos: gruplar.slice(0, 3).flat() },
                ];
                return tiers.map((tier) => {
                  const cekilenler = tier.nos.filter((no) => scratchedNos.has(no));
                  return (
                    <div key={tier.label}>
                      <div className="flex items-baseline gap-2">
                        <span className={cn("w-14 shrink-0 text-[10px] font-bold uppercase", tier.color)}>{tier.label}</span>
                        <span className="font-mono text-xs font-semibold tabular-nums">{tier.metin || "—"}</span>
                      </div>
                      {cekilenler.length > 0 && (
                        <p className="pl-16 text-[10px] font-medium text-red-400">
                          {t("kuponAtCekildiUyari", { nos: cekilenler.join(", #") })}
                        </p>
                      )}
                    </div>
                  );
                });
              })()}
                </div>
              </div>
            ) : null
          }
        />
      </div>
    </div>
  );
}

// ── At satırı ────────────────────────────────────────────────────────────────

function RunnerRow({
  r, t, isWinner, idx, isTopAgf, ekuriColor, agfRank, isBestTime, isFollowed, onToggleFollow, onSelectHorse, jockeyStat, trainerStat,
}: {
  r: ProgramRunner;
  t: ProgramT;
  isWinner: boolean;
  idx: number;
  isTopAgf: boolean;
  ekuriColor?: { border: string; badge: string };
  agfRank?: number;
  isBestTime: boolean;
  isFollowed: boolean;
  onToggleFollow: () => void;
  onSelectHorse: (name: string) => void;
  jockeyStat?: JockeyStatRow;
  trainerStat?: TrainerStatRow;
}) {
  const formChars = (r.recentForm ?? "").split("").filter((c) => /[\dK]/i.test(c)).slice(-6);
  const surfaces = (r.recentFormSurfaces ?? "").split("");

  function pct(b: { wins: number; rides: number }) {
    return b.rides === 0 ? 0 : Math.round(b.wins / b.rides * 100);
  }

  return (
    <tr
      className={cn(
        "border-b text-xs",
        idx % 2 === 0 ? "bg-background" : "bg-muted/30",
        isWinner && "bg-[#f5c518]/10",
        r.scratched && "opacity-60"
      )}
    >
      {/* No + Eküri gösterge */}
      <td className={cn("px-2 py-1.5 font-bold tabular-nums text-center w-10", ekuriColor?.border)}>
        <div className="flex items-center justify-center gap-1">
          {ekuriColor && (
            <span className={cn("inline-block w-2 h-2 rounded-full shrink-0", ekuriColor.badge)} />
          )}
          {r.no}
        </div>
      </td>

      {/* At İsmi */}
      <td className="px-2 py-1.5 min-w-[140px]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleFollow}
            title={isFollowed ? t("takiptenCik") : t("takipEt")}
            aria-label={isFollowed ? t("takiptenCik") : t("takipEt")}
            className="shrink-0 transition-colors print:hidden"
          >
            <Star className={cn(
              "h-3.5 w-3.5",
              isFollowed
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground hover:text-yellow-400"
            )} />
          </button>
          <button
            type="button"
            onClick={() => onSelectHorse(r.name)}
            data-tour="at-detay"
            className={cn("font-semibold text-left hover:underline", isWinner && "text-winner")}
          >
            {r.name}
            {r.scratched ? (
              <span className="ml-1.5 text-[10px] font-normal text-red-400 no-underline">{t("kosmaz")}</span>
            ) : r.ekuriGroup != null ? (
              <span title={`Eküri grubu ${r.ekuriGroup}`} className="ml-1 text-[11px]">🐴</span>
            ) : null}
          </button>
        </div>
        {(r.sire || r.dam) && (
          <div className="text-[10px] text-muted-foreground ml-5">
            {[r.sire, r.dam].filter(Boolean).join(" — ")}
          </div>
        )}
      </td>

      {/* Yaş */}
      <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{r.age ?? "—"}</td>

      {/* Kilo */}
      <td className="px-2 py-1.5 tabular-nums text-center">
        <div className="font-medium">{r.weight ?? "—"}</div>
        {r.weightChange != null && r.weightChange !== 0 && (
          <div className={cn("text-[10px]", r.weightChange < 0 ? "text-red-500" : "text-green-500")}>
            {r.weightChange > 0 ? "+" : ""}{r.weightChange}
          </div>
        )}
      </td>

      {/* Start */}
      <td className="px-2 py-1.5 tabular-nums text-center">
        {r.startNo ?? "—"}
        {r.disaridanStart && (
          <sup className="ml-0.5 font-sans font-bold text-red-500" title={t("dsTitle")}>DS</sup>
        )}
      </td>

      {/* Jokey */}
      <td className="px-2 py-1.5 min-w-[110px]">
        <div className={cn(r.jockeyChanged && "text-orange-500 font-medium")}>
          {r.jockey ?? "—"}
          {r.apprentice && (
            <span className="ml-1 text-[10px] font-semibold text-brand">
              {t("ap")}
            </span>
          )}
        </div>
        {r.jockeyChanged && r.previousJockey && (
          <div className="text-[10px] text-muted-foreground">← {r.previousJockey}</div>
        )}
        {jockeyStat && (() => {
          const wp = pct(jockeyStat);
          const wc = wp >= 25 ? "text-hit" : wp >= 15 ? "text-brand" : "text-muted-foreground";
          return (
            <div className="mt-0.5 text-[10px] leading-snug space-y-0.5">
              <div className="text-muted-foreground/70">{jockeyStat.label}</div>
              <div className="tabular-nums">
                <span className="text-muted-foreground">{jockeyStat.rides} {t("binis")} · </span>
                <span className={cn("font-semibold", wc)}>{jockeyStat.wins} {t("gal")} · %{wp}</span>
              </div>
            </div>
          );
        })()}
      </td>

      {/* Sahip / Antrenör */}
      <td className="px-2 py-1.5 min-w-[130px]">
        {r.owner && <div className="font-medium">{r.owner}</div>}
        {r.trainer && <div className="text-[10px] text-muted-foreground">{r.trainer}</div>}
        {trainerStat && (() => {
          const wp = pct(trainerStat);
          const wc = wp >= 25 ? "text-hit" : wp >= 15 ? "text-brand" : "text-muted-foreground";
          return (
            <div className={cn("text-[10px] tabular-nums font-semibold", wc)}>
              %{wp} · {trainerStat.rides} {t("yarisSuffix")}
            </div>
          );
        })()}
      </td>

      {/* H.P */}
      <td className="px-2 py-1.5 tabular-nums text-center font-mono">
        {r.hp != null ? r.hp : "—"}
      </td>

      {/* En İyi Derece */}
      <td className="px-2 py-1.5 text-center">
        {r.bestTime ? (() => {
          const [time, date] = r.bestTime.split(" - ");
          return (
            <div>
              <div className={cn("font-mono text-[11px] font-semibold tabular-nums", isBestTime && "text-[#27ae60]")}>
                {isBestTime && "★ "}{time}
              </div>
              {date && <div className="text-[9px] text-muted-foreground tabular-nums">{date}</div>}
            </div>
          );
        })() : <span className="text-muted-foreground text-[10px]">—</span>}
      </td>

      {/* Son Yarışlar */}
      <td className="px-2 py-1.5">
        <div className="flex gap-0.5">
          {formChars.length === 0 ? (
            <span className="text-muted-foreground text-[10px]">—</span>
          ) : (
            formChars.map((c, i) => {
              const surf = surfaces[i]?.trim() ?? "";
              const cls = formBoxClass(c, surf);
              return (
                <span
                  key={i}
                  className={cn("inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold", cls)}
                >
                  {c}
                </span>
              );
            })
          )}
        </div>
      </td>

      {/* AGF */}
      <td className={cn("px-2 py-1.5 tabular-nums text-center font-semibold", isTopAgf && "text-[#27ae60]")}>
        {r.agf != null ? (
          <div>
            <div>{isTopAgf && "★ "}{`%${r.agf.toFixed(1)}`}</div>
            {agfRank != null && (
              <div className="text-[9px] text-muted-foreground font-normal">{agfRank}. sıra</div>
            )}
          </div>
        ) : "—"}
      </td>

      {/* Yarış Stili */}
      <td className="px-2 py-1.5">
        {raceStyleBadge(r.raceStyle, t) ? (
          <span
            className={cn(
              "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap",
              raceStyleBadge(r.raceStyle, t)!.cls,
              raceStyleBadge(r.raceStyle, t)!.dusukGuven && "opacity-60"
            )}
            title={raceStyleBadge(r.raceStyle, t)!.dusukGuven ? t("azSayidaYarisaDayaniyor") : undefined}
          >
            {raceStyleBadge(r.raceStyle, t)!.text}
          </span>
        ) : (
          <span className="text-muted-foreground text-[10px]">—</span>
        )}
      </td>

    </tr>
  );
}

// ── Mobil kart — hizalı stat hücresi ────────────────────────────────────────

function StatCell({
  label, value, sub, subClass, valueClass,
}: {
  label: string;
  value: string | number;
  sub?: string;
  subClass?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[8px] uppercase tracking-wide text-muted-foreground/60">{label}</span>
      <span className={cn("text-[11px] font-mono font-medium tabular-nums", valueClass)}>
        {value}
        {sub && <span className={cn("ml-0.5 text-[9px] font-sans", subClass)}>{sub}</span>}
      </span>
    </div>
  );
}

// ── At kartı (mobil) ─────────────────────────────────────────────────────────

function RunnerCard({
  r, t, isWinner, isTopAgf, ekuriColor, agfRank, isBestTime, isFollowed, onToggleFollow, onSelectHorse, jockeyStat, trainerStat,
}: {
  r: ProgramRunner;
  t: ProgramT;
  isWinner: boolean;
  isTopAgf: boolean;
  ekuriColor?: { border: string; badge: string };
  agfRank?: number;
  isBestTime: boolean;
  isFollowed: boolean;
  onToggleFollow: () => void;
  onSelectHorse: (name: string) => void;
  jockeyStat?: JockeyStatRow;
  trainerStat?: TrainerStatRow;
}) {
  const formChars = (r.recentForm ?? "").split("").filter((c) => /[\dK]/i.test(c)).slice(-6);
  const surfaces = (r.recentFormSurfaces ?? "").split("");

  function pct(b: { wins: number; rides: number }) {
    return b.rides === 0 ? 0 : Math.round(b.wins / b.rides * 100);
  }

  return (
    <div className={cn(
      "px-3 py-2.5 border-b text-xs",
      isWinner && "bg-[#f5c518]/10",
      r.scratched && "opacity-60"
    )}>
      {/* Satır 1: No | İsim | AGF + Form */}
      <div className="flex items-start gap-2">
        <div className={cn(
          "flex items-center justify-center gap-1 font-bold tabular-nums w-8 shrink-0 pt-0.5",
          ekuriColor?.border
        )}>
          {ekuriColor && <span className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", ekuriColor.badge)} />}
          <span>{r.no}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleFollow}
              title={isFollowed ? t("takiptenCik") : t("takipEt")}
              aria-label={isFollowed ? t("takiptenCik") : t("takipEt")}
              className="shrink-0 transition-colors print:hidden"
            >
              <Star className={cn(
                "h-3.5 w-3.5",
                isFollowed
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground hover:text-yellow-400"
              )} />
            </button>
            <button
              type="button"
              onClick={() => onSelectHorse(r.name)}
              className={cn("font-semibold truncate text-left hover:underline", isWinner && "text-winner")}
            >
              {r.name}
              {r.scratched ? (
                <span className="ml-1 text-[10px] font-normal text-red-400 no-underline">{t("kosmaz")}</span>
              ) : r.ekuriGroup != null ? (
                <span title={`Eküri grubu ${r.ekuriGroup}`} className="ml-1 text-[11px]">🐴</span>
              ) : null}
            </button>
          </div>
          {(r.sire || r.dam) && (
            <div className="text-[10px] text-muted-foreground truncate ml-5">
              {[r.sire, r.dam].filter(Boolean).join(" — ")}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {r.agf != null ? (
            <div className={cn("font-semibold", isTopAgf && "text-[#27ae60]")}>
              {isTopAgf && "★ "}%{r.agf.toFixed(1)}
              {agfRank != null && <span className="text-[9px] text-muted-foreground font-normal ml-1">{agfRank}.</span>}
            </div>
          ) : <span className="text-muted-foreground">—</span>}
          <div className="flex gap-0.5">
            {formChars.length === 0
              ? <span className="text-muted-foreground">—</span>
              : formChars.slice(-5).map((c, i) => {
                  const surf = surfaces[i]?.trim() ?? "";
                  const cls = formBoxClass(c, surf);
                  return (
                    <span key={i} className={cn("inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold", cls)}>
                      {c}
                    </span>
                  );
                })}
          </div>
        </div>
      </div>

      {/* Jokey satırı */}
      {r.jockey && (
        <div className="mt-1.5 ml-10 text-[11px] leading-snug">
          <span className={cn("font-medium", r.jockeyChanged && "text-orange-500")}>
            {r.jockey}
          </span>
          {r.apprentice && (
            <span className="ml-1 text-[10px] font-semibold text-brand">
              {t("ap")}
            </span>
          )}
          {jockeyStat && (() => {
            const wp = pct(jockeyStat);
            const wc = wp >= 25 ? "text-hit" : wp >= 15 ? "text-brand" : "text-muted-foreground";
            const tip = `${jockeyStat.label} · ${jockeyStat.rides} ${t("binis")} · ${jockeyStat.wins} ${t("galibiyet")} · %${wp}`;
            return (
              <span title={tip} className={cn("ml-1.5 tabular-nums", wc)}>
                %{wp} {t("gal")}
              </span>
            );
          })()}
          {r.jockeyChanged && r.previousJockey && (
            <span className="ml-1.5 text-muted-foreground">← {r.previousJockey}</span>
          )}
        </div>
      )}

      {/* Sahip / Antrenör — masaüstüyle aynı bilgi, mobilde de gösterilsin */}
      {(r.owner || r.trainer) && (
        <div className="mt-1 ml-10 text-[10px] leading-snug text-muted-foreground">
          {r.owner && <span className="font-medium text-foreground">{r.owner}</span>}
          {r.owner && r.trainer && " · "}
          {r.trainer && <span>{r.trainer}</span>}
          {trainerStat && (() => {
            const wp = pct(trainerStat);
            const wc = wp >= 25 ? "text-hit" : wp >= 15 ? "text-brand" : "text-muted-foreground";
            return (
              <span className={cn("ml-1.5 tabular-nums font-semibold", wc)}>
                %{wp} · {trainerStat.rides} {t("yarisSuffix")}
              </span>
            );
          })()}
        </div>
      )}

      {/* Kilo · Start · HP · Derece · Yaş — hizalı grid */}
      <div className="grid grid-cols-5 gap-1 mt-1.5 ml-10">
        <StatCell
          label={t("statKilo")}
          value={r.weight ?? "—"}
          sub={r.weightChange != null && r.weightChange !== 0 ? `${r.weightChange > 0 ? "+" : ""}${r.weightChange}` : undefined}
          subClass={r.weightChange != null && r.weightChange < 0 ? "text-red-500" : "text-green-500"}
        />
        <StatCell
          label={t("statStart")}
          value={r.startNo ?? "—"}
          sub={r.disaridanStart ? "DS" : undefined}
          subClass="text-red-500 font-bold"
        />
        <StatCell label={t("statHp")} value={r.hp ?? "—"} />
        <StatCell
          label={t("statDerece")}
          value={r.bestTime ? `${isBestTime ? "★ " : ""}${r.bestTime.split(" - ")[0]}` : "—"}
          valueClass={isBestTime ? "text-[#27ae60] font-semibold" : undefined}
        />
        <StatCell label={t("statYas")} value={r.age ?? "—"} />
      </div>

      {raceStyleBadge(r.raceStyle, t) && (
        <div className="mt-1.5 ml-10 flex items-center gap-1">
          <span
            className={cn(
              "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold",
              raceStyleBadge(r.raceStyle, t)!.cls,
              raceStyleBadge(r.raceStyle, t)!.dusukGuven && "opacity-60"
            )}
            title={raceStyleBadge(r.raceStyle, t)!.dusukGuven ? t("azSayidaYarisaDayaniyor") : undefined}
          >
            {raceStyleBadge(r.raceStyle, t)!.text}
          </span>
          <RaceStyleInfoButton />
        </div>
      )}
    </div>
  );
}

// ── Koşu tablosu ─────────────────────────────────────────────────────────────

function RaceTimer({ time, hasResult, dateStr }: { time: string | null; hasResult: boolean; dateStr: string }) {
  const display = useRaceCountdown(time, hasResult, dateStr);
  if (!display) return null;
  return (
    <span className={cn(
      "text-xs font-semibold px-2 py-0.5 rounded",
      hasResult ? "bg-muted text-muted-foreground" : "bg-brand/10 text-brand"
    )}>
      {hasResult ? display : `⏱ ${display}`}
    </span>
  );
}

type JockeyStatRow = {
  wins: number;
  rides: number;
  label: string;
  tableRate?: number;
  performanceScore?: number;
};

type TrainerStatRow = { wins: number; rides: number };

type StatBucket = { wins: number; rides: number; winRate?: number; tableRate?: number; performanceScore?: number };
type JockeyStatsMap = Record<string, {
  overall: StatBucket;
  byHippo: Record<string, StatBucket>;
  bySurface: Record<string, StatBucket>;
  byContext: Record<string, StatBucket>;
}>;
type TrainerStatsMap = Record<string, TrainerStatRow>;

function RaceTable({
  race, dateStr, analysisOpen, onAnalysisToggle, son800Open, agfTrendOpen, galopOpen, pedigreeOpen, comparisonOpen, h2hOpen, sonYarisOpen, atDetayOpen, followedSet, onToggleFollow, onSelectHorse, isLoggedIn, isAdmin, isVerified, userEmail, jockeyStats, trainerStats, hippodromeName,
}: {
  race: ProgramRace;
  dateStr: string;
  analysisOpen: boolean;
  onAnalysisToggle: () => void;
  son800Open: boolean;
  agfTrendOpen: boolean;
  galopOpen: boolean;
  pedigreeOpen: boolean;
  comparisonOpen: boolean;
  h2hOpen: boolean;
  sonYarisOpen: boolean;
  atDetayOpen: boolean;
  followedSet: Set<string>;
  onToggleFollow: (horseName: string) => void;
  onSelectHorse: (name: string) => void;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isVerified: boolean;
  userEmail: string;
  jockeyStats?: JockeyStatsMap;
  hippodromeName?: string;
  trainerStats?: TrainerStatsMap;
}) {
  const t = useTranslations("programToolbar");
  const { locale } = useLocaleSwitch();
  const surf = surfaceLabel(race.surface, t);
  const winnerNos = race.result?.winnerNos ?? [];

  // AGF sıralama (en yüksek = 1. sıra)
  const agfSorted = race.runners
    .filter((r) => r.agf != null && r.agf > 0 && !r.scratched)
    .sort((a, b) => b.agf! - a.agf!);
  const topAgfNo = agfSorted[0]?.no;
  const agfRankMap = new Map(agfSorted.map((r, i) => [r.no, i + 1]));

  // En İyi Derece — en düşük süre yeşil
  const bestTimeSec = Math.min(
    ...race.runners.filter((r) => r.bestTime).map((r) => bestTimeToSeconds(r.bestTime!))
  );
  const bestTimeNoSet = new Set(
    race.runners.filter((r) => r.bestTime && bestTimeToSeconds(r.bestTime) === bestTimeSec).map((r) => r.no)
  );

  // Eküri renk map
  const ekuriColorMap = new Map<number, typeof EKURI_COLORS[0]>();
  race.runners.forEach((r) => {
    if (r.ekuriGroup != null && r.ekuriGroup >= 1) {
      ekuriColorMap.set(r.no, ekuriRengi(r.ekuriGroup));
    }
  });

  // TJK'nın resmi istatistiklerinden içinde bulunulan yılın geneli kazanma oranı — hipodrom/pist/ırk kırılımı yok
  function buildJockeyStat(jockey: string | null): JockeyStatRow | undefined {
    if (!jockey || !jockeyStats) return undefined;
    const raw = jockeyStats[jockey];
    if (!raw || raw.overall.rides === 0) return undefined;
    return { wins: raw.overall.wins, rides: raw.overall.rides, label: String(new Date().getFullYear()) };
  }

  function buildTrainerStat(trainer: string | null): TrainerStatRow | undefined {
    if (!trainer || !trainerStats) return undefined;
    const raw = trainerStats[trainer];
    if (!raw || raw.rides === 0) return undefined;
    return raw;
  }

  return (
    <div>
      {/* Koşu başlığı */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 bg-muted/50 border-b text-sm">
        <span className="font-bold">{t("raceNoLabel", { no: race.raceNo })}</span>
        {race.time && <span className="text-muted-foreground">{raceTimeForLocale(race.time, locale)}</span>}
        <span className="font-medium">{race.distance}m</span>
        <span className={cn("font-semibold", surf.cls)}>● {surf.label}</span>
        <span className="text-muted-foreground">{breedShort(race.breed, t)}</span>
        {race.classType && <span className="text-muted-foreground">· {race.classType}</span>}
        {race.conditions && <span className="text-xs text-brand">· {race.conditions}</span>}
        <TempoSenaryosuBadge tempoSenaryosu={race.tempoSenaryosu} t={t} />
        <span className="sm:hidden ml-auto">
          <RaceTimer time={race.time} hasResult={race.result != null} dateStr={dateStr} />
        </span>
      </div>
      {/* Pist/Mesafe İpucu — geçmiş kazananların stil eğilimi, ayrı satırda (mobilde kaybolmasın diye) */}
      <div className="px-3 py-1.5 bg-muted/30 border-b">
        <PistMesafeInfoButton hippodromeName={hippodromeName} surface={race.surface} distance={race.distance} breed={race.breed} classType={race.classType} />
      </div>

      {/* Tablo — masaüstü */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60 text-xs text-muted-foreground">
              <th className="px-2 py-1.5 text-center">{t("no")}</th>
              <th className="px-2 py-1.5 text-left">{t("atIsmi")}</th>
              <th className="px-2 py-1.5 text-left">{t("yas")}</th>
              <th className="px-2 py-1.5 text-center">{t("kilo")}</th>
              <th className="px-2 py-1.5 text-center">{t("start")}</th>
              <th className="px-2 py-1.5 text-left" data-tour="jokey">{t("jokey")}</th>
              <th className="px-2 py-1.5 text-left" data-tour="antrenor">{t("sahipAntrenor")}</th>
              <th className="px-2 py-1.5 text-center">{t("hp")}</th>
              <th className="px-2 py-1.5 text-center">{t("enIyiDerece")}</th>
              <th className="px-2 py-1.5 text-left">{t("sonYarislar")}</th>
              <th className="px-2 py-1.5 text-center">{t("agf")}</th>
              <th className="px-2 py-1.5 text-left" data-tour="yaris-stili">
                <span className="inline-flex items-center gap-1">
                  {t("yarisStili")}
                  <RaceStyleInfoButton />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {race.runners.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-8 text-center text-sm text-muted-foreground">
                  {t("yarisciVerisiYok")}
                </td>
              </tr>
            ) : (
              race.runners.map((r, i) => (
                <RunnerRow
                  key={r.id}
                  r={r}
                  t={t}
                  idx={i}
                  isWinner={winnerNos.includes(r.no)}
                  isTopAgf={r.no === topAgfNo}
                  ekuriColor={ekuriColorMap.get(r.no)}
                  agfRank={agfRankMap.get(r.no)}
                  isBestTime={bestTimeNoSet.has(r.no)}
                  isFollowed={followedSet.has(r.name)}
                  onToggleFollow={() => onToggleFollow(r.name)}
                  onSelectHorse={onSelectHorse}
                  jockeyStat={buildJockeyStat(r.jockey)}
                  trainerStat={buildTrainerStat(r.trainer)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Kartlar — mobil */}
      <div className="sm:hidden">
        {race.runners.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t("yarisciVerisiYok")}
          </div>
        ) : (
          race.runners.map((r) => (
            <RunnerCard
              key={r.id}
              r={r}
              t={t}
              isWinner={winnerNos.includes(r.no)}
              isTopAgf={r.no === topAgfNo}
              ekuriColor={ekuriColorMap.get(r.no)}
              agfRank={agfRankMap.get(r.no)}
              isBestTime={bestTimeNoSet.has(r.no)}
              isFollowed={followedSet.has(r.name)}
              onToggleFollow={() => onToggleFollow(r.name)}
              onSelectHorse={onSelectHorse}
              jockeyStat={buildJockeyStat(r.jockey)}
              trainerStat={buildTrainerStat(r.trainer)}
            />
          ))
        )}
      </div>

      {/* Sonuç kartı — koşu sonuçlandığında TJK formatında otomatik doldurulur */}
      {race.result && (
        <div className="border-t bg-muted/10 px-3 pt-2 pb-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-mono">
          <span className="font-semibold text-foreground">{t("sonucLabel")}</span>
          <span>
            {(Array.isArray(race.result.actualOrder) ? (race.result.actualOrder as number[]).slice(0, 5) : []).join(" · ") || "—"}
          </span>
          <span className="mx-1 text-muted-foreground">/</span>
          <span className="font-semibold text-foreground">{t("muddetLabel")}</span>
          <span>{race.result.time || "—"}</span>
          <span className="mx-1 text-muted-foreground">/</span>
          <span className="font-semibold text-foreground">{t("farklarLabel")}</span>
          <span>{race.result.farklar || "—"}</span>
          <span className="mx-1 text-muted-foreground">/</span>
          <span className="font-semibold text-foreground">{t("ganyanLabel")}</span>
          <span>{race.result.ganyan != null ? String(race.result.ganyan).replace(".", ",") : "—"}</span>
        </div>
      )}

      {/* Analiz paneli */}
      <div id="panel-analiz" className="scroll-mt-14">
        {race.hasAnalysis && analysisOpen && (
          <AnalysisPanel
            race={race}
            picks={race.picks}
            runners={race.runners}
            winnerNos={winnerNos}
            ganyan={race.result?.ganyan}
            isLoggedIn={isLoggedIn}
            isAdmin={isAdmin}
            isVerified={isVerified}
            userEmail={userEmail}
            raceNo={race.raceNo}
            hippodromeName={hippodromeName}
            raceId={race.id}
          />
        )}
      </div>
      <div id="panel-son-yaris-detay" className="scroll-mt-14">
        {sonYarisOpen && (
          <PanelKilitGate isLoggedIn={isLoggedIn} isVerified={isVerified} userEmail={userEmail}>
            <SonYarisDetayPanel raceId={race.id} />
          </PanelKilitGate>
        )}
      </div>
      <div id="panel-son800">
        {son800Open && (
          <PanelKilitGate isLoggedIn={isLoggedIn} isVerified={isVerified} userEmail={userEmail}>
            <Son800Panel raceId={race.id} />
          </PanelKilitGate>
        )}
      </div>
      <div id="panel-agf-trend">
        {agfTrendOpen && (
          <PanelKilitGate isLoggedIn={isLoggedIn} isVerified={isVerified} userEmail={userEmail}>
            <AgfTrendPanel raceId={race.id} winnerNos={winnerNos} />
          </PanelKilitGate>
        )}
      </div>
      <div id="panel-galop">
        {galopOpen && (
          <PanelKilitGate isLoggedIn={isLoggedIn} isVerified={isVerified} userEmail={userEmail}>
            <GalopPanel runners={race.runners} breed={race.breed} />
          </PanelKilitGate>
        )}
      </div>
      <div id="panel-pedigriler">
        {pedigreeOpen && (
          <PanelKilitGate isLoggedIn={isLoggedIn} isVerified={isVerified} userEmail={userEmail}>
            <PedigreePanel runners={race.runners} />
          </PanelKilitGate>
        )}
      </div>
      <div id="panel-karsilastir">
        {comparisonOpen && (
          <PanelKilitGate isLoggedIn={isLoggedIn} isVerified={isVerified} userEmail={userEmail}>
            <ComparisonPanel raceId={race.id} />
          </PanelKilitGate>
        )}
      </div>
      <div id="panel-h2h">
        {h2hOpen && (
          <PanelKilitGate isLoggedIn={isLoggedIn} isVerified={isVerified} userEmail={userEmail}>
            <H2HPanel raceId={race.id} />
          </PanelKilitGate>
        )}
      </div>
      <div id="panel-at-detaylari">
        {atDetayOpen && (
          <PanelKilitGate isLoggedIn={isLoggedIn} isVerified={isVerified} userEmail={userEmail}>
            <AtDetaylariPanel runners={race.runners} />
          </PanelKilitGate>
        )}
      </div>
    </div>
  );
}

// ── Ana görünüm ───────────────────────────────────────────────────────────────

export default function ProgramView({
  days, dateStr, followedNames = [], isLoggedIn = false, isAdmin = false, isVerified = false, userEmail = "", jockeyStats = {}, trainerStats = {},
}: {
  days: ProgramDay[];
  dateStr: string;
  followedNames?: string[];
  isLoggedIn?: boolean;
  isAdmin?: boolean;
  isVerified?: boolean;
  userEmail?: string;
  jockeyStats?: JockeyStatsMap;
  trainerStats?: TrainerStatsMap;
}) {
  const t = useTranslations("programToolbar");
  const [activeHipo, setActiveHipo] = useState(days[0]?.hippodromeSlug ?? "");
  const [activeRace, setActiveRace] = useState<Record<string, number>>({});
  useEffect(() => {
    const saved = localStorage.getItem(LAST_HIPO_STORAGE_KEY);
    if (saved && days.some((d) => d.hippodromeSlug === saved)) setActiveHipo(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (activeHipo) localStorage.setItem(LAST_HIPO_STORAGE_KEY, activeHipo);
  }, [activeHipo]);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [son800Open, setSon800Open] = useState(false);
  const [agfTrendOpen, setAgfTrendOpen] = useState(false);
  const [galopOpen, setGalopOpen] = useState(false);
  const [pedigreeOpen, setPedigreeOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [h2hOpen, setH2hOpen] = useState(false);
  const [sonYarisOpen, setSonYarisOpen] = useState(false);
  const [atDetayOpen, setAtDetayOpen] = useState(false);
  const [selectedHorse, setSelectedHorse] = useState<string | null>(null);
  const [hipodromOzellikleriOpen, setHipodromOzellikleriOpen] = useState(false);
  const [followedSet, setFollowedSet] = useState(() => new Set(followedNames));
  const [, startFollowTransition] = useTransition();

  /** v6.104 — üye olmayana kilit ikonu, üyeye aç/kapa oku (bkz. PanelKilitGate). */
  function kilitVeyaChevron(acik: boolean) {
    if (!isLoggedIn) return "🔒";
    return acik ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  // 2026-09-02 kullanıcı talebi ("açılır menü açıldığında bu şekilde scroll hizalı
  // açılsın") — önceki sürüm `getBoundingClientRect` ile ELLE hesaplayıp `window.scrollTo`
  // çağırıyordu; bu ölçüm React'ın panel içeriğini gerçekten boyayışından bir video karesi
  // önce alınabiliyordu (double rAF her zaman yetmiyor), bu da başlığın sticky nav'ın
  // altına TAM oturmayıp birkaç piksel kayık açılmasına yol açıyordu. `scrollIntoView` +
  // panel div'lerindeki `scroll-mt-14` (56px, nav yüksekliğiyle birebir) tarayıcının kendi
  // paint anında hesapladığı, bu yarış koşuluna kapalı yerel bir mekanizma.

  /** Panel butonuna basınca paneli aç/kapat; açılıyorsa render sonrası panelin başlığına scroll et. */
  function toggleAndScroll(setter: (v: (prev: boolean) => boolean) => void, current: boolean, panelId: string) {
    const willOpen = !current;
    setter((v) => !v);
    if (willOpen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    }
  }

  // 2026-08-31 kullanıcı talebi ("bunların hepsini tek bir çatı altına taşısak nasıl
  // olur") — Accurace/AGF Trend/Son Hazırlıklar/Pedigriler/H2H/Karşılaştır/Son Yarış
  // Detayları'nın yedisi de zaten koşu-bazlı (sahadaki TÜM atları kapsıyor) ama tek
  // tek açılması gerekiyordu — bir atı (ör. MEGAFAUNA) değerlendirirken 7 ayrı panele
  // tek tek tıklamak yerine, hepsini AYNI ANDA açan tek bir anahtar. Analizi Gör ayrı
  // tutuldu (farklı amaç, ayrı kilit/CTA akışı).
  const tumPanellerAcikMi = son800Open && agfTrendOpen && galopOpen && pedigreeOpen && comparisonOpen && h2hOpen && sonYarisOpen && atDetayOpen;
  function tumPanelleriAcVeyaKapat() {
    const hedef = !tumPanellerAcikMi;
    setSon800Open(hedef);
    setAgfTrendOpen(hedef);
    setGalopOpen(hedef);
    setPedigreeOpen(hedef);
    setComparisonOpen(hedef);
    setH2hOpen(hedef);
    setSonYarisOpen(hedef);
    setAtDetayOpen(hedef);
    // Açılırken ilk panelin (Son Yarış Detayları) başlığına kaydır — toggleAndScroll ile aynı desen,
    // kullanıcı butona bastıktan sonra veriyi görmek için elle aşağı kaydırmasın.
    if (hedef) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById("panel-son-yaris-detay")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    }
  }

  function handleToggleFollow(horseName: string) {
    setFollowedSet((prev) => {
      const next = new Set(prev);
      if (next.has(horseName)) next.delete(horseName); else next.add(horseName);
      return next;
    });
    startFollowTransition(async () => {
      try { await toggleHorseFollow(horseName); } catch { /* sessizce hata yut */ }
    });
  }

  const currentDay = days.find((d) => d.hippodromeSlug === activeHipo) ?? days[0];

  function selectedRaceNo(day: ProgramDay) {
    return activeRace[day.hippodromeSlug] ?? day.races[0]?.raceNo ?? 1;
  }

  const raceNo = selectedRaceNo(currentDay!);
  const currentRace = currentDay?.races.find((r) => r.raceNo === raceNo) ?? currentDay?.races[0];
  // bkz. raceGunOffsetleriHesapla üstündeki not — yurt dışı hipodromlarda gece yarısını
  // aşan koşuların geri sayımı/"Başladı" durumu bu offsetsiz YANLIŞ hesaplanır.
  const gunOffsetleri = raceGunOffsetleriHesapla(currentDay?.races ?? []);

  // Yarış veya hipodrom değişince analiz/son800/galop panelini kapat
  useEffect(() => {
    setAnalysisOpen(false);
    setSon800Open(false);
    setGalopOpen(false);
    setPedigreeOpen(false);
    setComparisonOpen(false);
    setH2hOpen(false);
    setSonYarisOpen(false);
  }, [activeHipo, raceNo]);

  if (days.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        {t("kosuProgramiBulunamadi")}
      </div>
    );
  }

  // 2026-09-29 kullanıcı talebi: hipodrom sekmeleri (a) yatay kaydırma OLMADAN tek sayfaya
  // sığsın — flex-wrap ile taşan sekmeler alt satıra iner, sayfa yatay kaymaz; (b) TR
  // hipodromları önce/yan yana, yurt dışı fikstürler SONRA (isForeign'a göre kararlı sort —
  // JS'in Array.sort'u kararlı olduğu için her iki grubun kendi içindeki [DB'den gelen
  // alfabetik] sırası korunur); (c) yurt dışı sekmelerin başında hangi ÜLKEYE aitlerse o
  // ülkenin bayrağı (Hippodrome.country, bkz. tjk.adapter.ts'teki YABANCI_ULKELER — bu
  // liste ile BİREBİR aynı sırada tutulmalı) + isim ülke son eki kırpılmış kısa haliyle
  // ("Chantilly Fransa" yerine "🇫🇷 Chantilly") — uzun isimler sekmeyi gereksiz genişletmesin.
  const sortedDays = [...days].sort((a, b) => Number(a.isForeign) - Number(b.isForeign));
  const ilkYabanciIndex = sortedDays.findIndex((d) => d.isForeign);

  return (
    <div className="flex flex-col">
      {/* Hipodrom tab'ları */}
      <div className="flex flex-wrap gap-1 border-b bg-muted/30 px-1 py-1 shrink-0 print:hidden">
        {sortedDays.map((d, i) => (
          <button
            key={d.hippodromeSlug}
            onClick={() => setActiveHipo(d.hippodromeSlug)}
            className={cn(
              "rounded px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap",
              i === ilkYabanciIndex && "ml-1 border-l pl-3.5",
              activeHipo === d.hippodromeSlug
                ? "bg-[#c0392b] text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <UlkeBayragi country={d.isForeign ? d.country : "Türkiye"} />{" "}
              {d.isForeign ? kisaHipodromAdi(d.hippodromeName, d.country) : d.hippodromeName}
            </span>
          </button>
        ))}
      </div>

      {currentDay && (
        <>
          {/* Koşu tab'ları + Pist durumu/hava — 2026-09-20 kullanıcı talebi: web'de (sm+)
              aynı satırda, dar mobilde eskisi gibi alt alta. */}
          <div className="flex flex-col border-b bg-background shrink-0 print:hidden lg:flex-row lg:items-center">
            {/* Koşu tab'ları — 2026-09-29 kullanıcı talebi (üçüncü tur): mobilde sabit 5 SÜTUNLU
                grid (her satırda TAM 5 kutucuk — içerik uzunluğuna göre değişken sığdırma
                DEĞİL, "10. Koşu" gibi uzun etiketler de aynı hücre genişliğinde sarılır).
                sm+'ta (web) eski flex-wrap tek-satır görünümü korunuyor. */}
            <div className="grid grid-cols-5 gap-1 p-2 sm:flex sm:flex-wrap lg:flex-1">
              {currentDay.races.map((r) => (
                <button
                  key={r.raceNo}
                  onClick={() => setActiveRace((prev) => ({ ...prev, [currentDay.hippodromeSlug]: r.raceNo }))}
                  className={cn(
                    "relative rounded-lg border px-1.5 py-2 text-center text-xs font-semibold transition-all sm:px-3 sm:whitespace-nowrap",
                    SURFACE_TAB_BG[r.surface],
                    selectedRaceNo(currentDay) === r.raceNo
                      ? "border-white shadow-inner"
                      : "border-black/20 opacity-70 hover:opacity-100"
                  )}
                >
                  {t("raceNoLabel", { no: r.raceNo })}
                  {r.hasAnalysis && (
                    <span className="absolute top-1 right-0.5 w-1.5 h-1.5 rounded-full bg-[#27ae60] ring-1 ring-white" />
                  )}
                </button>
              ))}
            </div>

            {/* Pist durumu + hava (TJK) */}
            {((currentDay.surfaceConditions?.length ?? 0) > 0 || currentDay.weather || currentRace) && (
              // 2026-09-28: web'de (sm+) pist/hava bilgisi sağa yaslı (koşu satırının sonuna); yan yana
              // yalnız lg+ (≥1024px) — dar/orta genişlikte sekmeler ezilmesin diye kendi satırına iner.
              <div className="flex flex-wrap items-center gap-2 border-t bg-muted/10 px-3 py-1.5 text-[11px] sm:justify-end sm:text-right lg:border-t-0 lg:border-l lg:bg-transparent">
                {currentDay.surfaceConditions?.map((c, i) => (
                  <span
                    key={i}
                    className={cn(
                      "rounded border px-1.5 py-0.5 font-medium",
                      /çim/i.test(c.label) ? "border-[#009900] text-[#009900]"
                        : /kum/i.test(c.label) ? "border-[#996633] text-[#996633]"
                        : "border-[#D39B1E] text-[#D39B1E]"
                    )}
                  >
                    {c.label}: {c.detail}
                  </span>
                ))}
                {currentDay.weather && <span className="text-muted-foreground">{currentDay.weather}</span>}
                {currentRace && (
                  <button
                    onClick={() => setHipodromOzellikleriOpen(true)}
                    data-tour="hipodrom-ozellikleri"
                    className="sm:hidden ml-auto shrink-0 rounded border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground whitespace-nowrap"
                  >
                    {t("hipodromOzellikleri")} {!isLoggedIn && "🔒"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Analiz + geri sayım */}
          <div className="flex items-center px-3 py-1.5 bg-muted/20 border-b text-[11px]">
            <div className="flex items-center gap-2 overflow-x-auto min-w-0 print:hidden">
              {currentRace?.hasAnalysis ? (
                <button
                  onClick={() => toggleAndScroll(setAnalysisOpen, analysisOpen, "panel-analiz")}
                  data-tour="analiz-buton"
                  className="flex items-center gap-1 rounded-md bg-[#006D05] px-2.5 py-1 text-xs font-semibold text-[#EFF2F5] transition-opacity hover:opacity-90 shrink-0"
                >
                  {isLoggedIn
                    ? <><Radio className="h-3 w-3 animate-pulse" /> {t("analiziGor")} {analysisOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</>
                    : <><Radio className="h-3 w-3 animate-pulse" /> {t("analiziGor")} 🔒</>}
                </button>
              ) : currentDay?.isForeign ? (
                <span className="text-xs font-semibold text-muted-foreground shrink-0 whitespace-nowrap">{t("yurtDisiAnaliz")}</span>
              ) : (
                <span className="text-xs font-semibold text-[#e74c3c] shrink-0 whitespace-nowrap">{t("analizHazirlaniyor")}</span>
              )}
              {currentRace && (
                <button
                  onClick={tumPanelleriAcVeyaKapat}
                  data-tour="tum-panelleri-ac"
                  className={cn(PANEL_BTN_CLASS, tumPanellerAcikMi ? PANEL_BTN_OPEN : PANEL_BTN_CLOSED, "font-bold")}
                >
                  {tumPanellerAcikMi ? "Tüm Verileri Kapat" : "Tüm Verileri Göster"} {kilitVeyaChevron(tumPanellerAcikMi)}
                </button>
              )}
              {currentRace && (
                <button
                  onClick={() => setHipodromOzellikleriOpen(true)}
                  data-tour="hipodrom-ozellikleri"
                  className={cn(PANEL_BTN_CLASS, PANEL_BTN_CLOSED, "hidden sm:flex")}
                >
                  {t("hipodromOzellikleri")} {!isLoggedIn && "🔒"}
                </button>
              )}
              {currentRace && (
                <div className="hidden sm:block shrink-0">
                  <RaceTimer time={currentRace.time} hasResult={currentRace.result != null} dateStr={raceEffectiveDateStr(dateStr, gunOffsetleri.get(currentRace.raceNo) ?? 0)} />
                </div>
              )}
            </div>
          </div>

          {/* Seçili koşu */}
          {currentRace && (
            <RaceTable
              race={currentRace}
              dateStr={raceEffectiveDateStr(dateStr, gunOffsetleri.get(currentRace.raceNo) ?? 0)}
              analysisOpen={analysisOpen}
              onAnalysisToggle={() => setAnalysisOpen((v) => !v)}
              son800Open={son800Open}
              agfTrendOpen={agfTrendOpen}
              galopOpen={galopOpen}
              pedigreeOpen={pedigreeOpen}
              comparisonOpen={comparisonOpen}
              h2hOpen={h2hOpen}
              sonYarisOpen={sonYarisOpen}
              atDetayOpen={atDetayOpen}
              followedSet={followedSet}
              onToggleFollow={handleToggleFollow}
              onSelectHorse={setSelectedHorse}
              isLoggedIn={isLoggedIn}
              isAdmin={isAdmin}
              isVerified={isVerified}
              userEmail={userEmail}
              jockeyStats={jockeyStats}
              trainerStats={trainerStats}
              hippodromeName={currentDay?.hippodromeName}
            />
          )}
        </>
      )}
      {selectedHorse && <HorseDetailModal name={selectedHorse} onClose={() => setSelectedHorse(null)} />}
      {hipodromOzellikleriOpen && currentDay && (
        isLoggedIn && isVerified ? (
          <HipodromOzellikleriModal
            hippodromeSlug={currentDay.hippodromeSlug}
            hippodromeName={currentDay.hippodromeName}
            distance={currentRace?.distance}
            surface={currentRace?.surface}
            onClose={() => setHipodromOzellikleriOpen(false)}
          />
        ) : (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setHipodromOzellikleriOpen(false)}
          >
            <div className="w-full max-w-sm rounded-lg border bg-background" onClick={(e) => e.stopPropagation()}>
              <PanelKilitGate isLoggedIn={isLoggedIn} isVerified={isVerified} userEmail={userEmail}>
                <></>
              </PanelKilitGate>
            </div>
          </div>
        )
      )}
    </div>
  );
}
