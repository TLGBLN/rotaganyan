import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import slugifyLib from "slugify";
import { format } from "date-fns";
import { tr, enUS } from "date-fns/locale";
import { toWallClockInTz, TZ } from "./tz";
import type { AppLocale } from "@/i18n/request";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return slugifyLib(text, { lower: true, strict: true, locale: "tr" });
}

// 2026-08-30 kullanıcı kararı: "TR tarafındakiler lokal (Türkiye) olacak, EN tarafındakiler
// UTC olacak" — sunucu (Vercel) UTC'de çalışıyor, date-fns'in format() fonksiyonu doğrudan
// bir Date verilirse UTC saatini gösterir; TR için Türkiye duvar-saatine çevirmek GEREKİR
// (bkz. tz.ts), EN için ise zaten UTC olduğundan HİÇ çevirmeye gerek yok. Üç fonksiyon da
// artık `locale` parametresi ZORUNLU alıyor — çağıran taraf (Server Component'te
// next-intl/server'ın getLocale()'i, Client Component'te useLocaleSwitch()) hangi dilde
// render edildiğini bilmek zorunda, burada SESSİZCE TR varsayılmıyor.
function localeToDateFnsLocale(locale: AppLocale) {
  return locale === "tr" ? tr : enUS;
}
function wallClockForLocale(date: Date | string, locale: AppLocale): Date {
  return toWallClockInTz(date, locale === "tr" ? TZ : "UTC");
}

export function formatDate(date: Date | string, locale: AppLocale, pattern = "d MMMM yyyy"): string {
  return format(wallClockForLocale(date, locale), pattern, { locale: localeToDateFnsLocale(locale) });
}

export function formatDateTime(date: Date | string, locale: AppLocale): string {
  return format(wallClockForLocale(date, locale), "d MMMM yyyy HH:mm", { locale: localeToDateFnsLocale(locale) });
}

export function formatRaceDate(date: Date | string, locale: AppLocale): string {
  return format(wallClockForLocale(date, locale), "dd.MM.yyyy", { locale: localeToDateFnsLocale(locale) });
}

/**
 * Race.time TJK'dan gelen ham "HH:mm" (Türkiye duvar saati) metni — bir Date değil,
 * yukarıdaki formatDate ailesi bunu çeviremez. EN'de UTC göstermek için 3 saat geri
 * alınır (gün taşması yalnız saat değerine yansır, yanındaki tarih etiketi değişmez —
 * TJK koşuları pratikte hiç 03:00 TR öncesi başlamadığından bu ihmal edilebilir).
 */
export function raceTimeForLocale(time: string, locale: AppLocale): string {
  if (locale === "tr") return time;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const utcHour = ((h - 3) % 24 + 24) % 24;
  return `${String(utcHour).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function pedigreeUrl(atName: string, breed: "ARAP" | "INGILIZ"): string {
  const encoded = encodeURIComponent(atName.toLowerCase().replace(/\s+/g, "+"));
  if (breed === "INGILIZ") {
    return `https://www.pedigreequery.com/${encoded}`;
  }
  return `https://www.allbreedpedigree.com/${encoded}`;
}

export function classTypeLabel(classType: string): string {
  const map: Record<string, string> = {
    Maiden: "Maiden",
    "Şartlı 1": "Ş1",
    "Şartlı 2": "Ş2",
    "Şartlı 3": "Ş3",
    "Handikap 15": "HK15",
    "Handikap 20": "HK20",
    "Handikap 25": "HK25",
    KV: "KV",
    Grup: "Grup",
    Açık: "Açık",
    DHÖW: "DHÖW",
  };
  return map[classType] ?? classType;
}

export function surfaceLabel(surface: "CIM" | "KUM" | "SENTETIK"): string {
  return { CIM: "Çim", KUM: "Kum", SENTETIK: "Sentetik" }[surface];
}

export function breedLabel(breed: "ARAP" | "INGILIZ"): string {
  return { ARAP: "Arap", INGILIZ: "İngiliz" }[breed];
}

export function confidenceLabel(confidence: "DUSUK" | "ORTA" | "YUKSEK"): string {
  return { DUSUK: "Düşük", ORTA: "Orta", YUKSEK: "Yüksek" }[confidence];
}

export function confidenceColor(confidence: "DUSUK" | "ORTA" | "YUKSEK"): string {
  return {
    DUSUK: "text-miss",
    ORTA: "text-muted-foreground",
    YUKSEK: "text-hit",
  }[confidence];
}
