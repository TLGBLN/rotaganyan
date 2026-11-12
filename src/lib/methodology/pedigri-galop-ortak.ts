// Ortak, SAF (DB'siz) fonksiyonlar — galopSkoru ve pedigriSkoru. 2026-11-10 kullanıcı kararı
// ("18 sinyal yapacağız") öncesinde yalnız ran-v2.ts içindeydi; v546-1-engine.ts da canlı
// skorlama için bunları kullanmaya başlayınca DÖNGÜSEL IMPORT riski doğdu (ran-v2.ts zaten
// v546-1-engine.ts'den gatherV461RawSinyaller import ediyor) — bu yüzden buraya taşındı, hem
// ran-v2.ts hem v546-1-engine.ts BURADAN import eder, kopya/sürüklenme riski yok.
import type { Faz1RunnerV5 } from "./v5-engine";
import type { V5461DamlineOzet } from "@/server/actions/v5461-damline.actions";
import { galopQuality, isSameJockey } from "@/components/program/panels/galop-helpers";

// 2026-11-09 kullanıcı düzeltmesi (tam detaylı "Galop okuma rehberi", verbatim aktarıldı) —
// dört ayrı form ailesi, HER BİRİ farklı yorumlanır ("Derece + Kısaltma kombinasyonuna
// bakın — aynı kronometre, farklı anlam"):
//   RAHAT (R/Rahat, HR="Hafif Rahat"): EN kıymetli — binici hiç teşvik etmemiş, at kendi
//     isteğiyle o dereceyi yapmış → zirve formda. Dereceye göre TAM kredi.
//   ÇOK RAHAT (ÇR/"Çok Rahat"): FARKLI bir amaç — minimum efor, "nefes açma" (genlikle
//     yarıştan 1-2 gün önce). Derece burada güvenilir bir sinyal DEĞİL, atlanır.
//   HAFİF TEŞVİKLİ (HÇ/"Hafif Çalışarak"): çok iyi derece KABUL EDİLEBİLİR (tam kredi), ama
//     SIRADAN bir derece hafif teşvikle çıkmışsa "henüz tam forma gelmedi" sinyali — NEGATİF.
//   TEŞVİKLİ/KAMÇILI (Ç/"Çalışarak"): en temkinli okunan — çok iyi derece bile ancak AZ
//     kredi, sıradan/kötü derece ise AÇIK bir formsuzluk/yorgunluk işareti.
// "Kenter"/"Galop"/bilinmeyen form kodları güvenilir bir hız testi SAYILMAZ, atlanır.
// İdman jokeyi bugünkü koşu jokeyiyle AYNIYSA pozitif bonus (+0.5) — farklıysa ceza YOK.
const GALOP_RAHAT_KODLARI = new Set(["R", "RAHAT", "HR"]);
const GALOP_COK_RAHAT_KODLARI = new Set(["ÇR", "ÇOK RAHAT"]);
const GALOP_HAFIF_TESVIKLI_KODLARI = new Set(["HÇ", "HAFİF ÇALIŞARAK"]);
const GALOP_TESVIKLI_KODLARI = new Set(["Ç", "ÇALIŞARAK"]);
export function galopSkoru(galoplar: { date: Date; splits: unknown; form: string | null; jockey: string | null }[], breed: string, bugunkuJokey: string | null): number | null {
  for (const g of galoplar) {
    const splits = g.splits as Record<string, string | null> | null;
    const finish = splits?.["400"];
    if (!finish) continue;
    const formKodu = g.form?.toUpperCase().trim() ?? "";
    if (GALOP_COK_RAHAT_KODLARI.has(formKodu)) continue; // derece güvenilir sinyal değil, atla

    const kalite = galopQuality("400", finish, breed, false); // "cok_iyi" | "iyi" | null
    let puan: number;
    if (GALOP_RAHAT_KODLARI.has(formKodu)) {
      puan = kalite === "cok_iyi" ? 2 : kalite === "iyi" ? 1 : 0;
    } else if (GALOP_HAFIF_TESVIKLI_KODLARI.has(formKodu)) {
      puan = kalite === "cok_iyi" ? 2 : kalite === "iyi" ? -0.5 : -1;
    } else if (GALOP_TESVIKLI_KODLARI.has(formKodu)) {
      puan = kalite === "cok_iyi" ? 0.5 : kalite === "iyi" ? -1 : -1.5;
    } else {
      continue; // Kenter/Galop/bilinmeyen — güvenilir değil, sonraki kayda bak
    }
    if (isSameJockey(g.jockey, bugunkuJokey)) puan += 0.5;
    return puan;
  }
  return null;
}

// 2026-11-09 kullanıcı bulgusu (İstanbul K1 Şartlı 1 — IRON ANGEL vakası): n=3 eşiği çok
// düşük, saf şans eseri "sert sıfır" atı anlamsızca cezalandırıyordu — eşik yükseltildi.
const PEDIGRI_MIN_ORNEK = 8;
// 2026-11-10 kullanıcı kararı ("dam ve damsire ı var olan sire sinyaline eklenecek") —
// Sire+Dam+DamSire, her biri KENDİ örneklem eşiğinden bağımsız geçmeli, eksik olan atlanır
// (0'a çekilmez) — RAN v2'nin "Own Sire" tekilinden BAŞKA, daha zengin bir pedigri skoru.
export function pedigriSkoru(r: Faz1RunnerV5, damOzet: V5461DamlineOzet, damSireOzet: V5461DamlineOzet): number | null {
  const parcalar: number[] = [];
  if (r.sireKazanmaOraniHam != null && r.sireOrneklemKendiVeri != null && r.sireOrneklemKendiVeri >= PEDIGRI_MIN_ORNEK) {
    parcalar.push(r.sireKazanmaOraniHam);
  }
  if (damOzet.kYuzde != null && damOzet.ornekKendiVeri != null && damOzet.ornekKendiVeri >= PEDIGRI_MIN_ORNEK) {
    parcalar.push(damOzet.kYuzde);
  }
  if (damSireOzet.kYuzde != null && damSireOzet.ornekKendiVeri != null && damSireOzet.ornekKendiVeri >= PEDIGRI_MIN_ORNEK) {
    parcalar.push(damSireOzet.kYuzde);
  }
  if (parcalar.length === 0) return null;
  return parcalar.reduce((a, b) => a + b, 0) / parcalar.length;
}
