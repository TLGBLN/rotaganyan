/**
 * BÜTÇE İZLEME — yalnız izler ve uyarır, hiçbir akışı durdurmaz.
 * ---------------------------------------------------------------
 * Bu gecenin dersi: yarım/kesilmiş bir analiz, biraz daha pahalı ama
 * TAM bir analizden çok daha kötü (166sn + $0.20 harcanıp sıfır sonuç
 * alınan olay, bkz. Bursa 9.Koşu). Bu yüzden bu dosya hiçbir Claude
 * çağrısını engellemez, hiçbir akışı kesmez — yalnız bir koşunun
 * maliyeti beklenenden yüksek çıktığında bilgi verir.
 *
 * Kendi paralel fiyatlandırma mantığını KURMAZ — mevcut
 * src/lib/claude-cost.ts içindeki tahminiMaliyet()'i kullanır, gerçek
 * ClaudeUsageLog şemasına göre okur (costUsd/batchKey gibi olmayan
 * alanlar varsaymaz).
 */

import { db } from "@/lib/db";
import { tahminiMaliyet } from "@/lib/claude-cost";

/** Bir koşu için o ana kadar harcanan toplam tahmini maliyeti,
 * gerçek ClaudeUsageLog satırlarını mevcut tahminiMaliyet()
 * fonksiyonundan geçirerek toplar. Ayrı bir fiyat kaynağı yok. */
export async function harcananTutariGetir(raceId: string): Promise<number> {
  const loglar = await db.claudeUsageLog.findMany({
    where: { raceId },
    select: {
      inputTokens: true,
      outputTokens: true,
      createdAt: true,
      cacheCreationInputTokens: true,
      cacheReadInputTokens: true,
      cacheCreation1hInputTokens: true,
    },
  });

  return loglar.reduce(
    (toplam, log) =>
      toplam +
      tahminiMaliyet(
        log.inputTokens,
        log.outputTokens,
        log.createdAt,
        log.cacheCreationInputTokens,
        log.cacheReadInputTokens,
        log.cacheCreation1hInputTokens
      ),
    0
  );
}

/** Yalnız bilgi amaçlı kontrol — hiçbir zaman pipeline'ı durdurmaz.
 * Eşik aşılırsa yalnız loglar/webhook'a bildirir; çağıran taraf bu
 * sonucu görmezden gelip devam edebilir/etmelidir. */
export async function butceDurumunuBildir(
  raceId: string,
  bilgiEsigiUsd = 1.0 // "dikkat çek" eşiği — kesici değil, yalnız uyarı tetikler
): Promise<{ harcanan: number; esikAsildiMi: boolean }> {
  const harcanan = await harcananTutariGetir(raceId);
  const esikAsildiMi = harcanan > bilgiEsigiUsd;

  if (esikAsildiMi) {
    await bildirimGonder(
      `ℹ️ Bilgi: ${raceId} için harcanan tutar $${harcanan.toFixed(4)} — beklenen eşiği ($${bilgiEsigiUsd}) aştı. Pipeline durdurulmadı, yalnız bilgi amaçlı.`
    );
  }

  return { harcanan, esikAsildiMi };
}

async function bildirimGonder(mesaj: string): Promise<void> {
  const webhookUrl = process.env.ANALIZ_UYARI_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: mesaj }),
    });
  } catch {
    // Bildirim başarısız olsa bile pipeline'ı ASLA bloklamaz.
  }
}
