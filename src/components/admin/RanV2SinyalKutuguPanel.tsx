"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  RAN_V2_PILLARLAR, RAN_V2_KATEGORILER, RAN_V2_ACIK_MADDELER, RAN_V2_REDDEDILEN,
  type RanV2Pillar, type RanV2Kategori, type RanV2AcikMadde,
} from "@/server/services/ranv2-sinyal-kutugu.service";

function pillarAdi(kod: string): string {
  return RAN_V2_PILLARLAR.find((p) => p.kod === kod)?.ad ?? kod;
}

export default function RanV2SinyalKutuguPanel() {
  const [acikPillar, setAcikPillar] = useState<RanV2Pillar | null>(null);
  const [acikKategori, setAcikKategori] = useState<RanV2Kategori | null>(null);
  const [acikMadde, setAcikMadde] = useState<RanV2AcikMadde | null>(null);

  return (
    <section className="space-y-6 border-t border-brand/20 pt-6">
      <div>
        {/* 2026-11-10 BUG DÜZELTMESİ (kullanıcı bulgusu, "RAN v2 neden hala bu isim") — bu
            başlık eskiden "RotaGanyan Analiz Motoru — Sinyal Kütüğü" idi; 2026-11-10'da
            PRODUCTION motoru da TAM OLARAK bu adı aldı (bkz. engine-versions.data.ts) —
            aynı sayfada (/admin/sinyal-kutugu) iki ayrı bölüm AYNI başlığı taşıyordu, biri
            gerçek canlı motor, diğeri hiç deploy edilmemiş bir araştırma prototipi. Artık
            net ayrışıyor: "RAN v2" adı KORUNUYOR ama "(Araştırma Prototipi — PRODUCTION
            DEĞİL)" ibaresiyle, karışıklık önleniyor. */}
        <h2 className="text-lg font-bold text-foreground">RAN v2 <span className="text-sm font-normal text-amber-500">(Araştırma Prototipi — PRODUCTION DEĞİL)</span></h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong className="text-amber-500">Bu, canlı &quot;RotaGanyan Analiz Motoru&quot; (yukarıdaki bölüm) DEĞİLDİR</strong> — tamamen ayrı, izole bir araştırma sistemi
          (<code className="font-mono text-[11px]">ran-v2.ts</code>, <code className="font-mono text-[11px]">hesaplaRanV2</code>), hiçbir route bunu çağırmaz, &quot;Analiz Et&quot; butonu bunu KULLANMAZ.
          AGF/piyasa hiç girmez, katsayısız (saha-içi z-skor ortalaması), koşu tipine göre farklı pillar alt-kümesi kullanır.
          Rakamlar 2026-11-08 B300 (n=295) + G1/G2/G3 (n=124) yerel önbellek testlerinden — izole, production&apos;a bağlı değil.
          Bir karta tıklayın, detayı açılır pencerede görün.
        </p>
      </div>

      {/* Pillar'lar */}
      <div className="space-y-2">
        <h3 className="text-base font-bold text-foreground">Pillar&apos;lar (6)</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RAN_V2_PILLARLAR.map((p) => (
            <button
              key={p.kod}
              onClick={() => setAcikPillar(p)}
              className="rounded-lg border border-brand/20 bg-[#0d0d14] p-4 text-left transition-colors hover:border-brand/50 hover:bg-[#0d0d14]/80"
            >
              <div className="font-semibold text-foreground">{p.ad}</div>
              <div className="font-mono text-[10.5px] text-muted-foreground">{p.kod}</div>
              <div className="mt-2 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{p.aciklama}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Koşu Tipi → Pillar Seti */}
      <div className="space-y-2">
        <h3 className="text-base font-bold text-foreground">Koşu Tipi → Pillar Seti (koşullu mimari)</h3>
        <p className="text-xs text-muted-foreground">Her kategori kendi B300-kanıtlı alt kümesini kullanır — &quot;her sinyal her koşuda kullanılmaz&quot;.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {RAN_V2_KATEGORILER.map((k) => (
            <button
              key={k.ad}
              onClick={() => setAcikKategori(k)}
              className="rounded-lg border border-hit/30 bg-[#0d0d14] p-4 text-left transition-colors hover:border-hit/60 hover:bg-[#0d0d14]/80"
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-semibold text-foreground">{k.ad}</div>
                {k.n > 0 && (
                  <span className="font-mono text-[10px] text-hit">Top1 %{k.top1.toFixed(1)}</span>
                )}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{k.pillarKodlari.map(pillarAdi).join(" + ")}</div>
              {k.n > 0 && <div className="mt-1 font-mono text-[10px] text-muted-foreground">n={k.n} · Top3 %{k.top3.toFixed(1)}</div>}
            </button>
          ))}
        </div>
      </div>

      {/* Açık maddeler / adaylar */}
      <div className="space-y-2">
        <h3 className="text-base font-bold text-foreground">Aday / Açık Maddeler (motora HENÜZ eklenmedi)</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {RAN_V2_ACIK_MADDELER.map((m) => (
            <button
              key={m.ad}
              onClick={() => setAcikMadde(m)}
              className="rounded-lg border border-amber-500/30 bg-[#0d0d14] p-4 text-left transition-colors hover:border-amber-500/60 hover:bg-[#0d0d14]/80"
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-semibold text-foreground">{m.ad}</div>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide border-amber-500/40 bg-amber-500/10 text-amber-400">{m.durum}</span>
              </div>
              <div className="mt-2 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{m.bulgu}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Reddedilenler */}
      <div className="space-y-2">
        <h3 className="text-base font-bold text-foreground">Test Edilip Reddedilen Pillar&apos;lar</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {RAN_V2_REDDEDILEN.map((r) => (
            <div key={r.ad} className="rounded-lg border border-[#c0392b]/30 bg-[#0d0d14] p-4">
              <div className="font-semibold text-foreground">{r.ad}</div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{r.neden}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Modaller */}
      <Dialog open={acikPillar != null} onOpenChange={(open) => !open && setAcikPillar(null)}>
        <DialogContent>
          {acikPillar && (
            <>
              <DialogHeader>
                <DialogTitle>{acikPillar.ad}</DialogTitle>
                <DialogDescription className="font-mono text-[11px]">{acikPillar.kod}</DialogDescription>
              </DialogHeader>
              <p className="text-sm leading-relaxed text-foreground/90">{acikPillar.aciklama}</p>
              <p className="text-xs text-muted-foreground">Kaynak: {acikPillar.kaynak}</p>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={acikKategori != null} onOpenChange={(open) => !open && setAcikKategori(null)}>
        <DialogContent>
          {acikKategori && (
            <>
              <DialogHeader>
                <DialogTitle>{acikKategori.ad}</DialogTitle>
                <DialogDescription>{acikKategori.tanim}</DialogDescription>
              </DialogHeader>
              <p className="text-sm text-foreground/90">
                Kullanılan pillar&apos;lar: <b>{acikKategori.pillarKodlari.map(pillarAdi).join(" + ")}</b>
              </p>
              {acikKategori.n > 0 && (
                <p className="font-mono text-xs text-muted-foreground">n={acikKategori.n} · Top1 %{acikKategori.top1.toFixed(1)} · Top3 %{acikKategori.top3.toFixed(1)}</p>
              )}
              {acikKategori.not && <p className="text-xs leading-relaxed text-amber-400">{acikKategori.not}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={acikMadde != null} onOpenChange={(open) => !open && setAcikMadde(null)}>
        <DialogContent>
          {acikMadde && (
            <>
              <DialogHeader>
                <DialogTitle>{acikMadde.ad}</DialogTitle>
                <DialogDescription>{acikMadde.durum}</DialogDescription>
              </DialogHeader>
              <p className="text-sm leading-relaxed text-foreground/90">{acikMadde.bulgu}</p>
              <p className="text-xs text-muted-foreground">Kanıt seviyesi: {acikMadde.kanitSeviyesi}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
