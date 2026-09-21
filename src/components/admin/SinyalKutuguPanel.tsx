import {
  CANLI_SINYALLER,
  SIRALAMA_KURALLARI,
  ADAY_SINYALLER,
  type SinyalAnlamlilik,
  type AdaySinyalDurum,
} from "@/server/services/sinyal-kutugu.service";

const DURUM_STIL: Record<SinyalAnlamlilik, string> = {
  anlamli: "border-hit/40 bg-hit/10 text-hit",
  sinirda: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  anlamsiz: "border-muted-foreground/20 bg-muted/10 text-muted-foreground",
  override: "border-[#c0392b]/40 bg-[#c0392b]/10 text-[#e57368]",
  "veri-yok": "border-muted-foreground/10 bg-muted/5 text-muted-foreground/70",
};

const DURUM_ETIKET: Record<SinyalAnlamlilik, string> = {
  anlamli: "anlamlı",
  sinirda: "sınırda",
  anlamsiz: "anlamsız",
  override: "override",
  "veri-yok": "veri yok",
};

function KatsayiHucre({ katsayi, durum, not: notMetni }: { katsayi: number; durum: SinyalAnlamlilik; not?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-bold tabular-nums text-foreground">
          {katsayi >= 0 ? "+" : ""}
          {katsayi.toFixed(3)}
        </span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${DURUM_STIL[durum]}`}>
          {DURUM_ETIKET[durum]}
        </span>
      </div>
      {notMetni && <div className="text-[10.5px] text-muted-foreground">{notMetni}</div>}
    </div>
  );
}

const ADAY_STIL: Record<AdaySinyalDurum, { rail: string; tag: string; etiketRengi: string }> = {
  acik: { rail: "border-l-amber-500/70", tag: "border-amber-500/40 bg-amber-500/10 text-amber-400", etiketRengi: "" },
  reddedildi: { rail: "border-l-[#c0392b]/70", tag: "border-[#c0392b]/40 bg-[#c0392b]/10 text-[#e57368]", etiketRengi: "" },
  beklemede: { rail: "border-l-muted-foreground/40", tag: "border-muted-foreground/30 bg-muted/10 text-muted-foreground", etiketRengi: "" },
};

export default function SinyalKutuguPanel() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">V5 Sinyal Kütüğü — Araştırma/Karar Kaydı</h2>
        <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          ⚠️ Bu panel elle bakımı yapılan bir ARAŞTIRMA/KARAR kütüğüdür (hangi sinyal ne zaman/neden
          eklendi-çıkarıldı-reddedildi) — production&apos;da o an tam olarak hangi sayının çalıştığının
          garantili canonical kaynağı DEĞİLDİR. Kesin/kod-doğrulanmış güncel katsayılar için{" "}
          <code className="font-mono">rotaganyan/SINYAL-FORMULLERI.md</code> esas alınmalı.
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Canlı skorlamaya giren 15 sinyal — 13&apos;ü A-Katmanı&apos;nda (tek ortak koşullu-logit
          regresyonunda birlikte fit edilir), 2&apos;si B-Katmanı&apos;nda (softmax&apos;a girmeden önce
          skora ayrı eklenen additive mekanizma) — segment bazlı katsayılarıyla (Düşük-şart = Maiden/Şartlı
          1/19/27, Diğer = Handikap/Şartlı 2-5/KV-Grup/Satış); sıralama kuralları; ve test edilmiş aday
          sinyaller. Katsayı/GA her yeniden eğitimde elle güncellenir — sahadaki GERÇEK isabet oranı için
          aşağıdaki &quot;Sinyal Bazlı Gerçek İsabet Oranı&quot; tablosuna bakın.
        </p>
      </div>

      {/* ── A Katmanı: 13 sinyalin TAMAMI — ortak koşullu-logit regresyonunda birlikte fit
          edilir. Kanıt gücü satır satır DEĞİŞİR (bazıları güçlü, bazıları kullanıcı kararıyla
          eklenmiş istisna) — bu, satırın kendi durum/not alanında okunur, "A=güçlü" gibi bir
          toplu iddia DEĞİL (2026-09-21 düzeltmesi, bkz. dosya başı SinyalKatmani yorumu). ── */}
      <div className="space-y-2">
        <div>
          <h3 className="text-base font-bold text-foreground">A Katmanı — Ortak Regresyondaki Sinyaller (13)</h3>
          <p className="text-xs text-muted-foreground">
            Ana koşullu-logit regresyonunun TAMAMI — kanıt gücü satır satır değişir (bazıları
            kanıtlanmış, bazıları kullanıcı kararıyla eklenmiş istisna), her satırın kendi
            durum/not alanına bakın.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-brand/20">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand/20 bg-[#0d0d14] text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Sinyal</th>
                <th className="px-3 py-2">Düşük-şart</th>
                <th className="px-3 py-2">Diğer</th>
              </tr>
            </thead>
            <tbody>
              {CANLI_SINYALLER.filter((s) => s.katman === "A").map((s) => (
                <tr key={s.kod} className="border-b border-brand/10 last:border-0 hover:bg-[#0d0d14]/60">
                  <td className="px-3 py-2.5 align-top">
                    <div className="font-semibold text-foreground">{s.ad}</div>
                    <div className="font-mono text-[10.5px] text-muted-foreground">{s.kod}</div>
                    <div className="mt-1 max-w-xs text-[11px] leading-snug text-muted-foreground">{s.aciklama}</div>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <KatsayiHucre {...s.dusukSart} />
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <KatsayiHucre {...s.diger} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── B Katmanı: GERÇEKTEN yalnız 2 sinyal — A'nın regresyonuna hiç girmeyen, softmax'a
          girmeden önce skora AYRI eklenen additive mekanizma (bkz. v5-engine.ts bKatmaniUygula).
          2026-09-21 düzeltmesi ÖNCESİ bu tabloda zeminToleransi/yakinsama2Plus/sonIdmanSprint/
          takiDegisikligi de vardı — onlar MEKANİK olarak A'nın 13'lük ortak regresyonunun
          parçası, buraya taşındılar (yukarıdaki tabloda, kendi durum/not'larıyla). ── */}
      <div className="space-y-2">
        <div>
          <h3 className="text-base font-bold text-foreground">B Katmanı — Ayrı Additive Mekanizma (2)</h3>
          <p className="text-xs text-muted-foreground">
            A&apos;nın ortak regresyonuna hiç girmez — softmax&apos;a girmeden hemen önce skora ayrı
            eklenen 2 terim (Sire Oranı, Zemin+Mesafe Deneyimi). İkisi de kanıtsız/kural istisnası
            olarak eklendi, kendi durum/not alanlarında detaylı.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-amber-500/20">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-amber-500/20 bg-[#0d0d14] text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Sinyal</th>
                <th className="px-3 py-2">Düşük-şart</th>
                <th className="px-3 py-2">Diğer</th>
              </tr>
            </thead>
            <tbody>
              {CANLI_SINYALLER.filter((s) => s.katman === "B").map((s) => (
                <tr key={s.kod} className="border-b border-amber-500/10 last:border-0 hover:bg-[#0d0d14]/60">
                  <td className="px-3 py-2.5 align-top">
                    <div className="font-semibold text-foreground">{s.ad}</div>
                    <div className="font-mono text-[10.5px] text-muted-foreground">{s.kod}</div>
                    <div className="mt-1 max-w-xs text-[11px] leading-snug text-muted-foreground">{s.aciklama}</div>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <KatsayiHucre {...s.dusukSart} />
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <KatsayiHucre {...s.diger} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sıralama kuralları ── */}
      <div className="space-y-3 pt-2">
        <div>
          <h3 className="text-base font-bold text-foreground">Sıralama Kuralları (post-processing, olasılığı değiştirmez)</h3>
          <p className="text-xs text-muted-foreground">
            Kodda MEVCUT olmak, production&apos;da AKTİF olmak anlamına gelmez — her kartın etiketi
            (AÇIK/GERİ AÇILDI vs KAPALI) hangi durumda olduğunu gösterir; şu an yalnız AGF Trend
            Terfisi ve Saf Model Değer Terfisi aktif, AGF Favorisi İlk-3 Garantisi ve Derin
            AGF-Longshot Düzeltmesi koda gömülü ama KAPALI.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SIRALAMA_KURALLARI.map((k) => (
            <div key={k.ad} className="rounded-lg border border-brand/20 bg-[#0d0d14] p-4 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-semibold text-foreground">{k.ad}</div>
                <span className="font-mono text-[10px] text-amber-400">{k.etiket}</span>
              </div>
              <p className="text-xs text-muted-foreground">{k.aciklama}</p>
              <div className="border-t border-brand/10 pt-2 font-mono text-[11px] text-foreground/80">{k.backtestOzet}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Aday sinyaller ── */}
      <div className="space-y-3 pt-2">
        <h3 className="text-base font-bold text-foreground">Aday / Test Edilmiş Sinyaller</h3>
        <p className="text-sm text-muted-foreground">Canlıda değil — reddedildi, yetersiz güçte kaldı, ya da veri/karar eksikliğiyle beklemede.</p>
        <div className="space-y-2.5">
          {ADAY_SINYALLER.map((a) => (
            <div key={a.ad} className={`rounded-lg border border-brand/20 border-l-4 bg-[#0d0d14] p-4 ${ADAY_STIL[a.durum].rail}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="font-semibold text-foreground">{a.ad}</div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ADAY_STIL[a.durum].tag}`}>
                  {a.etiket}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{a.aciklama}</p>
              {a.metrik && <div className="mt-1.5 font-mono text-[10.5px] text-foreground/70">{a.metrik}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
