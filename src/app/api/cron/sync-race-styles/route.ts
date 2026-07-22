import { NextResponse } from "next/server";

// DEVRE DIŞI (2026-07): Runner.raceStyle artık Accurace (GPS/sektörel zamanlama)
// geçmişinden hesaplanıyor — bkz. scripts/_migrate_race_style.ts ve pace-analizi.ts.
// TJK Son800'ün tek sayısına dayanan eski yaris-stili.service.ts hesaplaması, Accurace'in
// sağladığı çok daha zengin (her 100m checkpoint) verinin bir alt kümesi olduğu için
// gereksiz hale geldi — vercel.json'dan da kaldırıldı, bu route artık tetiklenmiyor.
export async function GET() {
  return NextResponse.json({ ok: true, message: "Devre dışı — Runner.raceStyle artık Accurace'ten hesaplanıyor." });
}
