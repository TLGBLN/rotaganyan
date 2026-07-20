import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { gatherFaz1 } from "@/lib/methodology/veri-toplama";
import type { Role } from "@prisma/client";

export type RunnerVeriDurumu = {
  id: string;
  no: number;
  ad: string;
  eksikler: string[];
  bilgiler: string[];
  adminNotu: string | null;
};

/**
 * Faz 1'i (ücretsiz — Claude'a gitmez) çalıştırıp her at için hangi verinin
 * çekilemediğini döner. Admin bunu görüp /admin/pedigri'ye gitmeden, aynı
 * ekrandaki tek metin kutusundan eksikleri elle girebilir.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { raceId } = (await req.json()) as { raceId: string };
  if (!raceId) return NextResponse.json({ error: "raceId gerekli" }, { status: 400 });

  const faz1 = await gatherFaz1(raceId);
  if (!faz1) return NextResponse.json({ error: "Koşu verisi bulunamadı" }, { status: 404 });

  const runners: RunnerVeriDurumu[] = faz1.runners.map((r) => {
    const eksikler: string[] = [];
    const bilgiler: string[] = [];

    if (!r.sire && !r.dam && !r.sireTier && !r.damSireTier && !r.pedigreeNote) {
      eksikler.push("Pedigri");
    } else if (r.sire && !r.sireTier && !r.pedigreeNote) {
      // Sire/dam adları TJK'dan zaten geliyor olabilir ama aygır itibarı (reputasyon
      // değerlendirmesi) yalnızca admin girer — bu, TJK'nın hiç vermediği ve en çok
      // katkı sağlayan pedigri bilgisidir, özellikle az yarışlı/Maiden atlarda.
      // NOT: admin bunu SireTier (global, at-bağımsız aygır tablosu) yerine bu atın
      // kendi pedigreeNote'una (yarışa özel, /admin/pedigri toplu yapıştırma) yazmış
      // olabilir — pedigreeNote zaten Faz 1 tablosuna gidiyor, o zaman gerçekten eksik
      // değildir, uyarı YANLIŞ ALARM olur.
      eksikler.push("Aygır İtibarı");
    }
    if (r.galopOzet === "İdman kaydı yok") eksikler.push("Galop");
    if (!r.recentForm) eksikler.push("Form dizisi");
    if (r.agfSirasi == null) eksikler.push("AGF (henüz yayınlanmamış)");

    // Son800 admin tarafından elle girilemeyen, tamamen otomatik bir alan — at bu
    // hipodrom/pist/mesafe kombinasyonunda hiç koşmamışsa 0 çıkması YAPISAL bir durumdur,
    // "eksik veri" değil (Faz 2/4 zaten bunu ceza sebebi yapmıyor). Kırmızı "eksik" olarak
    // göstermek admin'e düzeltemeyeceği bir şeyi işaret ediyordu — bilgi notuna taşındı.
    if (r.son800BenzerKosuN === 0) bilgiler.push("Son800: bu hipodrom/pist/mesafede benzer koşu yok (yapısal, 0 kabul edilir)");

    if (r.hpBugunResmiYok) bilgiler.push("Bugünkü HP resmi yok (yapısal — Şartlı1/Maiden'de normal)");
    if (r.ilkStart) bilgiler.push("İlk start (geçmiş yarış yok)");
    else if (r.hpOncekiResmiYok) bilgiler.push("Geçmiş HP resmi yok (yapısal)");

    return {
      id: r.id, no: r.no, ad: r.ad,
      eksikler, bilgiler,
      adminNotu: r.adminNote,
    };
  });

  return NextResponse.json({ ok: true, runners });
}
