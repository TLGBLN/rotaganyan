"use server";

import { pedigriPanelKosu, type PedigriPanelSonuc } from "@/server/services/pedigri-panel.service";

/** Program sayfası "Pedigriler" paneli (açıldığında çağrılır). Yalnız gösterim verisi: ana skora/kupona girmez. */
export async function getPedigriPanel(raceId: string): Promise<PedigriPanelSonuc | null> {
  if (!raceId || typeof raceId !== "string") return null;
  try { return await pedigriPanelKosu(raceId); } catch { return null; }
}
