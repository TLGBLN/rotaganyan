import { getRaceOptionsForDate } from "@/server/actions/v1-analiz.actions";
import V1AnalizClient from "./V1AnalizClient";

// ROTAGANYAN ANALİZ MOTORU v1.0 — basit yarış analiz ekranı (kullanıcı talimatı, 2026-10-20:
// "bir yarış seçelim, V1.0 ile Analiz Et butonuna basalım"). Bu sayfa (admin)/admin/layout.tsx
// üzerinden YALNIZ EDITOR+ rolüne açık — ayrı bir auth kontrolü BURADA TEKRARLANMADI (tek
// kaynak), ama /api/admin/v1-analiz AYRICA kendi auth kontrolünü yapıyor (API doğrudan
// çağrılabilir olduğu için savunma iki katmanlı).
export default async function V1AnalizPage() {
  const today = new Date().toISOString().slice(0, 10);
  const races = await getRaceOptionsForDate(today);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-bold">RotaGanyan Analiz Motoru V1.0 — Yarış Analizi</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Bu ekran yalnız araştırma amaçlıdır — V5.46.1 ve üye kuponlarını ETKİLEMEZ. Modelin
          sadece EĞİTİMDE gerçekten katsayı öğrenmiş kodları skora girer; henüz öğrenilmemiş
          aileler/ilişkiler aşağıda ayrıca işaretlenir.
        </p>
      </div>
      <V1AnalizClient initialDate={today} initialRaces={races} />
    </div>
  );
}
