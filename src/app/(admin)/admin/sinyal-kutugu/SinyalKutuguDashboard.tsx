"use client";

import { useMemo, useState } from "react";
import type { CanliSinyal, SiralamaKurali, AdaySinyal, SinyalAnlamlilik, AdaySinyalDurum } from "@/server/services/sinyal-kutugu.service";
import type { AnalystBreakdown } from "@/server/services/admin.service";
import "./sinyal-kutugu.css";

type Sekme = "hepsi" | "A" | "B" | "kural" | "aday";
type Secim = { tur: "canli"; kod: string } | { tur: "kural"; ad: string } | { tur: "aday"; ad: string } | null;

const DURUM_ETIKET: Record<SinyalAnlamlilik, string> = { anlamli: "anlamlı", sinirda: "sınırda", anlamsiz: "anlamsız", override: "elle 0", "veri-yok": "veri yok" };
const DURUM_ACIKLAMA: Record<SinyalAnlamlilik, string> = {
  anlamli: "İstatistiksel olarak güvenilir katkı (güven aralığı sıfırı dışlıyor).",
  sinirda: "Sınırda: katkı var gibi ama kanıt zayıf, izlemede.",
  anlamsiz: "Katkısı kanıtlanamadı (güven aralığı sıfırı içeriyor); kullanıcı kararıyla ya da izlemek için duruyor.",
  override: "Katsayı bilerek elle sıfıra sabitlendi (bu segmentte zararlı/ters çıktığı için).",
  "veri-yok": "Bu segmentte uygulanmıyor ya da veri yok.",
};
const ADAY_ETIKET: Record<AdaySinyalDurum, string> = { acik: "AÇIK", reddedildi: "REDDEDİLDİ", beklemede: "BEKLEMEDE" };

const fmt = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(3)}`;
const kuralAktifMi = (k: SiralamaKurali) => !k.etiket.toUpperCase().startsWith("KAPALI");

export default function SinyalKutuguDashboard({ canli, siralama, adaylar, isabet }: { canli: CanliSinyal[]; siralama: SiralamaKurali[]; adaylar: AdaySinyal[]; isabet: AnalystBreakdown[] }) {
  const [sekme, setSekme] = useState<Sekme>("hepsi");
  const [ara, setAra] = useState("");
  const [secim, setSecim] = useState<Secim>({ tur: "canli", kod: canli[0]?.kod ?? "" });

  const q = ara.trim().toLocaleLowerCase("tr");
  const eslesir = (...alanlar: string[]) => q === "" || alanlar.some((a) => a.toLocaleLowerCase("tr").includes(q));

  const gorunenCanli = useMemo(
    () => canli.filter((s) => (sekme === "hepsi" || sekme === s.katman) && eslesir(s.ad, s.kod, s.aciklama)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canli, sekme, q]
  );
  const gorunenKural = useMemo(() => siralama.filter((k) => (sekme === "hepsi" || sekme === "kural") && eslesir(k.ad, k.aciklama)), [siralama, sekme, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const gorunenAday = useMemo(() => adaylar.filter((a) => (sekme === "hepsi" || sekme === "aday") && eslesir(a.ad, a.aciklama)), [adaylar, sekme, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const aCount = canli.filter((s) => s.katman === "A").length;
  const bCount = canli.filter((s) => s.katman === "B").length;
  const aktifKural = siralama.filter(kuralAktifMi).length;
  const reddedilen = adaylar.filter((a) => a.durum === "reddedildi").length;

  const secili = useMemo(() => {
    if (!secim) return null;
    if (secim.tur === "canli") return { tur: "canli" as const, s: canli.find((x) => x.kod === secim.kod) };
    if (secim.tur === "kural") return { tur: "kural" as const, k: siralama.find((x) => x.ad === secim.ad) };
    return { tur: "aday" as const, a: adaylar.find((x) => x.ad === secim.ad) };
  }, [secim, canli, siralama, adaylar]);

  const SEKMELER: { id: Sekme; ad: string; n: number }[] = [
    { id: "hepsi", ad: "Hepsi", n: canli.length + siralama.length + adaylar.length },
    { id: "A", ad: "A Katmanı (ortak regresyon)", n: aCount },
    { id: "B", ad: "B Katmanı (ayrı terimler)", n: bCount },
    { id: "kural", ad: "Sıralama kuralları", n: siralama.length },
    { id: "aday", ad: "Aday / test edilmiş", n: adaylar.length },
  ];

  const maxRate = Math.max(1, ...isabet.map((i) => i.rate));

  return (
    <main className="sk-page">
      <header className="sk-header">
        <div>
          <div className="sk-brand">ROTAGANYAN</div>
          <h1>Sinyal Kütüğü</h1>
          <p>V5.46 motorunun hangi sinyalleri kullandığı, her birinin katsayısı ve neden eklendi / çıkarıldı / reddedildi kararı.</p>
        </div>
        <div className="sk-counts">
          <div><strong>{canli.length}</strong><span>canlı sinyal</span><small>{aCount} A · {bCount} B</small></div>
          <div><strong>{aktifKural}/{siralama.length}</strong><span>aktif sıralama kuralı</span></div>
          <div><strong>{adaylar.length}</strong><span>aday</span><small>{reddedilen} reddedildi</small></div>
        </div>
      </header>

      <div className="sk-warn">
        ⚠️ Bu sayfa elle bakımı yapılan bir <b>araştırma / karar kütüğüdür</b>: production&apos;da şu an tam olarak hangi sayının çalıştığının kesin kaynağı değildir. Kod-doğrulanmış güncel katsayılar için{" "}
        <code>rotaganyan/SINYAL-FORMULLERI.md</code> esas alınır. Aşağıdaki &quot;sahadaki gerçek isabet&quot; bölümü ise canlı veriden gelir.
      </div>

      <div className="sk-legend">
        {(Object.keys(DURUM_ETIKET) as SinyalAnlamlilik[]).map((d) => (
          <span key={d}><i className={`sk-chip sk-${d}`}>{DURUM_ETIKET[d]}</i> {DURUM_ACIKLAMA[d]}</span>
        ))}
      </div>

      <div className="sk-toolbar">
        <div className="sk-tabs">
          {SEKMELER.map((t) => (
            <button key={t.id} className={sekme === t.id ? "on" : ""} onClick={() => setSekme(t.id)}>{t.ad} <em>{t.n}</em></button>
          ))}
        </div>
        <input className="sk-search" value={ara} onChange={(e) => setAra(e.target.value)} placeholder="Sinyal, kod ya da açıklama ara…" />
      </div>

      <div className="sk-layout">
        <section className="sk-list">
          {gorunenCanli.length > 0 && (
            <>
              <h2>Canlı sinyaller <small>(düşük-şart = Maiden / Şartlı 1-19-27 · diğer = Handikap / Şartlı 2-5 / KV-Grup / Satış)</small></h2>
              <div className="sk-grid">
                {gorunenCanli.map((s) => (
                  <button key={s.kod} className={`sk-card ${secim?.tur === "canli" && secim.kod === s.kod ? "sel" : ""}`} onClick={() => setSecim({ tur: "canli", kod: s.kod })}>
                    <div className="sk-card-top"><strong>{s.ad}</strong><span className={`sk-layer sk-layer-${s.katman}`}>{s.katman}</span></div>
                    <code>{s.kod}</code>
                    <div className="sk-seg">
                      <div><small>Düşük-şart</small><b>{fmt(s.dusukSart.katsayi)}</b><i className={`sk-chip sk-${s.dusukSart.durum}`}>{DURUM_ETIKET[s.dusukSart.durum]}</i></div>
                      <div><small>Diğer</small><b>{fmt(s.diger.katsayi)}</b><i className={`sk-chip sk-${s.diger.durum}`}>{DURUM_ETIKET[s.diger.durum]}</i></div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {gorunenKural.length > 0 && (
            <>
              <h2>Sıralama kuralları <small>(olasılığı değiştirmez; yalnızca sıralamayı düzeltir)</small></h2>
              <div className="sk-grid">
                {gorunenKural.map((k) => (
                  <button key={k.ad} className={`sk-card ${secim?.tur === "kural" && secim.ad === k.ad ? "sel" : ""}`} onClick={() => setSecim({ tur: "kural", ad: k.ad })}>
                    <div className="sk-card-top"><strong>{k.ad}</strong><span className={`sk-layer ${kuralAktifMi(k) ? "sk-on" : "sk-off"}`}>{kuralAktifMi(k) ? "AÇIK" : "KAPALI"}</span></div>
                    <p className="sk-clamp">{k.etiket}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {gorunenAday.length > 0 && (
            <>
              <h2>Aday / test edilmiş sinyaller <small>(canlıda değil)</small></h2>
              <div className="sk-grid">
                {gorunenAday.map((a) => (
                  <button key={a.ad} className={`sk-card ${secim?.tur === "aday" && secim.ad === a.ad ? "sel" : ""}`} onClick={() => setSecim({ tur: "aday", ad: a.ad })}>
                    <div className="sk-card-top"><strong>{a.ad}</strong><span className={`sk-layer sk-aday-${a.durum}`}>{ADAY_ETIKET[a.durum]}</span></div>
                    <p className="sk-clamp">{a.etiket}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {gorunenCanli.length + gorunenKural.length + gorunenAday.length === 0 && <p className="sk-empty">Aramanızla eşleşen kayıt yok.</p>}
        </section>

        <aside className="sk-detail">
          {secili?.tur === "canli" && secili.s && (
            <>
              <h3>{secili.s.ad}</h3>
              <code>{secili.s.kod}</code> <span className={`sk-layer sk-layer-${secili.s.katman}`}>{secili.s.katman} katmanı</span>
              <p className="sk-desc">{secili.s.aciklama}</p>
              {(["dusukSart", "diger"] as const).map((seg) => {
                const v = secili.s![seg];
                return (
                  <div key={seg} className="sk-segdetail">
                    <div className="sk-segtitle">{seg === "dusukSart" ? "Düşük-şart segmenti" : "Diğer segment"}</div>
                    <div className="sk-coef"><b>{fmt(v.katsayi)}</b><i className={`sk-chip sk-${v.durum}`}>{DURUM_ETIKET[v.durum]}</i></div>
                    <small className="sk-hint">{DURUM_ACIKLAMA[v.durum]}</small>
                    {v.not && <p className="sk-note">{v.not}</p>}
                  </div>
                );
              })}
            </>
          )}
          {secili?.tur === "kural" && secili.k && (
            <>
              <h3>{secili.k.ad}</h3>
              <span className={`sk-layer ${kuralAktifMi(secili.k) ? "sk-on" : "sk-off"}`}>{kuralAktifMi(secili.k) ? "AÇIK" : "KAPALI"}</span>
              <p className="sk-note">{secili.k.etiket}</p>
              <h4>Ne yapar?</h4><p className="sk-desc">{secili.k.aciklama}</p>
              <h4>Kanıt / backtest</h4><p className="sk-desc">{secili.k.backtestOzet}</p>
            </>
          )}
          {secili?.tur === "aday" && secili.a && (
            <>
              <h3>{secili.a.ad}</h3>
              <span className={`sk-layer sk-aday-${secili.a.durum}`}>{ADAY_ETIKET[secili.a.durum]}</span>
              <p className="sk-note">{secili.a.etiket}</p>
              <p className="sk-desc">{secili.a.aciklama}</p>
              {secili.a.metrik && (<><h4>Ölçüm</h4><p className="sk-desc sk-mono">{secili.a.metrik}</p></>)}
            </>
          )}
          {!secili && <p className="sk-empty">Soldan bir kayıt seçin.</p>}
        </aside>
      </div>

      <section className="sk-live">
        <h2>Sahada gerçek isabet oranı <small>(canlı — yayınlanmış ve sonuçlanmış V5 tahminlerinde, sinyali taşıyan atın gerçekten kazanma oranı)</small></h2>
        <p className="sk-livelead">Modelin kendi katsayısından ayrı bir ölçüdür: yukarıdaki sayılar &quot;model bu sinyale ne kadar ağırlık veriyor&quot;, buradaki yüzdeler &quot;bu sinyali taşıyan at gerçekte kaç kez kazandı&quot;.</p>
        {isabet.length === 0 ? (
          <p className="sk-empty">Henüz ölçülebilir veri yok.</p>
        ) : (
          <div className="sk-livelist">
            {isabet.map((i) => (
              <div key={i.label} className="sk-liverow">
                <span className="sk-livelabel">{i.label}</span>
                <span className="sk-livebar"><i style={{ width: `${(i.rate / maxRate) * 100}%` }} /></span>
                <span className="sk-livepct">%{i.rate.toFixed(1)} <small>({i.hits}/{i.total})</small></span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
