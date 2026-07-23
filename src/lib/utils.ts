import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import slugifyLib from "slugify";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { toTurkeyWallClock } from "./tz";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return slugifyLib(text, { lower: true, strict: true, locale: "tr" });
}

// ÖNEMLİ: her üçü de toTurkeyWallClock ile sarmalı — sunucu (Vercel) UTC'de çalışıyor,
// date-fns'in format() fonksiyonu doğrudan bir Date verilirse UTC saatini gösterir.
// Kullanıcıya giden HER saat/tarih Türkiye saati olmalı (bkz. tz.ts).
export function formatDate(date: Date | string, pattern = "d MMMM yyyy"): string {
  return format(toTurkeyWallClock(date), pattern, { locale: tr });
}

export function formatDateTime(date: Date | string): string {
  return format(toTurkeyWallClock(date), "d MMMM yyyy HH:mm", { locale: tr });
}

export function formatRaceDate(date: Date | string): string {
  return format(toTurkeyWallClock(date), "dd.MM.yyyy", { locale: tr });
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
