"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

// v6.45 — kullanıcının kendi tarayıcısından, kendi kontrolünde, ek maliyet olmadan
// (yalnız kendi tıkladığında) yeni V1-V22/A-E motorunu (Faz2) ve Kanıt Ağırlıklı Katman
// puanlamasını (Faz3) test edebilmesi için TAMAMEN İZOLE bir sayfa. Mevcut hiçbir admin
// sayfasına/rotasına dokunmuyor. Artık tüm 6 kategoriyi (1a/1b/2/3/4/5) destekliyor.
// v6.45 eklendi (kullanıcı talebi 2026-08-03): "faz1'in neleri çektiğini ve faz2'nin
// neleri muhakeme ettiğini tikli olarak görmek istiyorum. Muhakeme edilmediği halde
// edilmiş gibi göstermemeli" — Faz1 Veri Denetimi (her at × her V-kodu, veri var mı) ve
// Faz2 Muhakeme Dürüstlük Denetimi (Claude'un gösterdiği kanıt çiftleri gerçek veriye mi
// dayanıyor) tabloları eklendi, ikisi de mekanik/koddur, ek Claude çağrısı yapmaz.
// v6.47 — kompakt tek-alan "muhakeme" formatına geçildi (maliyet: madde sayısı değil
// çıktı hacmi belirleyici, bkz. eski çok-alanlı şemanın kaldırılması).
type Faz2Pick = { no: number; ad: string; teknikSira: number; karar: string; muhakeme: string };

type Faz1VeriSatiri = { no: number; ad: string; kodlar: { kod: string; veriVar: boolean }[] };
type Faz2DenetimSatiri = { no: number; ad: string; supheliCiftler: { cift: string; kod: string; sebep: string }[] };
type Faz2KaliteUyariSatiri = { no: number; ad: string; uyarilar: string[] };
type Faz2BankoAdayiSonuc = {
  bankoAdayi: boolean; sebep: string;
  birinci?: { no: number; ad: string; karar: string };
  ikinci?: { no: number; ad: string; karar: string };
};

type Faz3PickRow = {
  rank: number; no: number; name: string; score: number;
  pedigreeRating: string; isTarget: boolean; details: string[]; note: string;
};
type KuralKontrolRow = { kural: string; durum: "GECTI" | "IHLAL" | "UYGULANMADI"; detay: string };
type Faz3Data = {
  kategori: string;
  picks: Faz3PickRow[];
  confidence: string;
  isBanko: boolean;
  bankoNote: string;
  notes: string;
  tempo: string;
  couponNarrow: string; couponNormal: string; couponWide: string;
  kuralKontrolleri: KuralKontrolRow[];
};

export default function TestV2Page() {
  // v6.46 — kullanıcı direkt link isteyince eklendi: ?raceId=... ile sayfa açıldığında
  // kutuyu otomatik doldurur, elle kopyala-yapıştır gerekmez.
  const searchParams = useSearchParams();
  const [raceId, setRaceId] = useState(searchParams.get("raceId") ?? "cmsbc259j007504i8a0kdnpsq"); // Elazığ 4.Koşu (Maiden)
  const [loadingFaz2, setLoadingFaz2] = useState(false);
  const [loadingFaz3, setLoadingFaz3] = useState(false);
  const [faz2Error, setFaz2Error] = useState<string>("");
  const [faz2Atlar, setFaz2Atlar] = useState<Faz2Pick[] | null>(null);
  const [faz1VeriDenetimi, setFaz1VeriDenetimi] = useState<Faz1VeriSatiri[] | null>(null);
  const [faz2Denetim, setFaz2Denetim] = useState<Faz2DenetimSatiri[] | null>(null);
  const [faz2KaliteUyarilari, setFaz2KaliteUyarilari] = useState<Faz2KaliteUyariSatiri[] | null>(null);
  const [faz2BankoAdayi, setFaz2BankoAdayi] = useState<Faz2BankoAdayiSonuc | null>(null);
  const [faz3Error, setFaz3Error] = useState<string>("");
  const [faz3Data, setFaz3Data] = useState<Faz3Data | null>(null);

  async function calistirFaz2() {
    setLoadingFaz2(true);
    setFaz2Error("");
    setFaz2Atlar(null);
    setFaz1VeriDenetimi(null);
    setFaz2Denetim(null);
    setFaz2KaliteUyarilari(null);
    setFaz2BankoAdayi(null);
    setFaz3Error("");
    setFaz3Data(null);
    try {
      const res = await fetch("/api/admin/test-v2-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raceId }),
      });
      const text = await res.text();
      if (!res.ok) {
        setFaz2Error(`Status: ${res.status}\n\n${text}`);
        return;
      }
      const data = JSON.parse(text);
      if (data.parsed?.atlar) setFaz2Atlar(data.parsed.atlar);
      else setFaz2Error(`Yanıt parse edilemedi:\n\n${text}`);
      if (data.faz1VeriDenetimi) setFaz1VeriDenetimi(data.faz1VeriDenetimi);
      if (data.faz2Denetim) setFaz2Denetim(data.faz2Denetim);
      if (data.faz2KaliteUyarilari) setFaz2KaliteUyarilari(data.faz2KaliteUyarilari);
      if (data.faz2BankoAdayi) setFaz2BankoAdayi(data.faz2BankoAdayi);
    } catch (e) {
      setFaz2Error("HATA: " + String(e));
    } finally {
      setLoadingFaz2(false);
    }
  }

  async function calistirFaz3() {
    if (!faz2Atlar) return;
    setLoadingFaz3(true);
    setFaz3Error("");
    setFaz3Data(null);
    try {
      const res = await fetch("/api/admin/test-v3-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raceId, faz2Atlar }),
      });
      const text = await res.text();
      if (!res.ok) {
        setFaz3Error(`Status: ${res.status}\n\n${text}`);
        return;
      }
      const data = JSON.parse(text);
      setFaz3Data(data);
    } catch (e) {
      setFaz3Error("HATA: " + String(e));
    } finally {
      setLoadingFaz3(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-6">
      <h1 className="text-lg font-bold">Yeni Motor Testi — V3 (V1-V22 + Çapraz-Okuma X1-X7, tüm kategoriler)</h1>
      <p className="text-sm text-muted-foreground">
        Her adım (Faz2, Faz3) yalnız kendi butonuna bastığınızda gerçek bir Claude çağrısı yapar (maliyetli). Faz3,
        Faz2&apos;nin ürettiği muhakemeyi kullanır — Faz2&apos;yi tekrar çalıştırmaz.
      </p>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border px-3 py-2 text-sm font-mono"
          value={raceId}
          onChange={(e) => setRaceId(e.target.value)}
          placeholder="raceId"
        />
        <Button onClick={calistirFaz2} disabled={loadingFaz2}>
          {loadingFaz2 ? "Faz2 çalışıyor…" : "1) Faz2 Çalıştır"}
        </Button>
      </div>

      {faz2Error && (
        <pre className="whitespace-pre-wrap rounded-md border border-red-400 bg-red-50 p-3 text-xs overflow-x-auto max-h-96 overflow-y-auto text-red-900">
          {faz2Error}
        </pre>
      )}

      {faz1VeriDenetimi && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Faz1 Veri Denetimi — hangi at, hangi V-kodunda gerçek veri var</h2>
          <div className="overflow-x-auto border rounded-md">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="p-1.5 text-left sticky left-0 bg-muted/50">At</th>
                  {faz1VeriDenetimi[0]?.kodlar.map((k) => (
                    <th key={k.kod} className="p-1.5 text-center">{k.kod}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {faz1VeriDenetimi.map((satir) => (
                  <tr key={satir.no} className="border-t">
                    <td className="p-1.5 whitespace-nowrap sticky left-0 bg-background">#{satir.no} {satir.ad}</td>
                    {satir.kodlar.map((k) => (
                      <td key={k.kod} className={`p-1.5 text-center ${k.veriVar ? "text-green-600" : "text-muted-foreground"}`}>
                        {k.veriVar ? "✓" : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {faz2Denetim && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Faz2 Muhakeme Dürüstlük Denetimi — gösterilen kanıt çiftleri gerçek veriye mi dayanıyor</h2>
          <div className="space-y-1">
            {faz2Denetim.map((satir) => (
              <div key={satir.no} className="text-xs border rounded-md p-2">
                <span className="font-medium">#{satir.no} {satir.ad}: </span>
                {satir.supheliCiftler.length === 0 ? (
                  <span className="text-green-600">✓ tüm gösterilen çiftler gerçek veriye dayanıyor</span>
                ) : (
                  <span className="text-red-600">
                    ✗ {satir.supheliCiftler.map((s) => `"${s.cift}" — ${s.sebep}`).join("; ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {faz2BankoAdayi && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Banko Adayı (mekanik işaret, ücretsiz — nihai karar sizde)</h2>
          <div className={`text-xs border rounded-md p-3 ${faz2BankoAdayi.bankoAdayi ? "border-green-500 bg-green-50" : ""}`}>
            <span className={faz2BankoAdayi.bankoAdayi ? "text-green-700 font-medium" : "text-muted-foreground"}>
              {faz2BankoAdayi.bankoAdayi ? "★ BANKO ADAYI: " : "Banko adayı yok: "}
            </span>
            {faz2BankoAdayi.sebep}
          </div>
        </section>
      )}

      {faz2KaliteUyarilari && faz2KaliteUyarilari.some((k) => k.uyarilar.length > 0) && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Kaçırma Uyarıları (mekanik, ücretsiz — Elazığ 8.Koşu dersi)</h2>
          <div className="space-y-1">
            {faz2KaliteUyarilari.filter((k) => k.uyarilar.length > 0).map((k) => (
              <div key={k.no} className="text-xs border border-amber-400 bg-amber-50 rounded-md p-2 text-amber-900">
                <span className="font-medium">#{k.no} {k.ad}: </span>
                {k.uyarilar.join(" ")}
              </div>
            ))}
          </div>
        </section>
      )}

      {faz2Atlar && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Faz2 Muhakeme Çıktısı</h2>
          <div className="space-y-2">
            {faz2Atlar.map((a) => (
              <div key={a.no} className="text-xs border rounded-md p-2 space-y-1">
                <div className="font-medium">#{a.no} {a.ad} — ön teknik sıra: {a.teknikSira} — karar: {a.karar}</div>
                <div className="text-muted-foreground">{a.muhakeme}</div>
              </div>
            ))}
          </div>

          {/* v6.49 — kullanıcı talebi 2026-08-03: önceki sürüm iki ayrı sistemi (niteliksel
              adımlar + 5-katman-toplama+katsayı) art arda veriyordu, kullanıcı gerçekte
              TEK bandı kullanan basitleştirilmiş bir hesap yaptı (5 bandı toplamadı) — bu,
              kafa karışıklığına yol açtı. NİHAİ, TEK, tutarlı sürüm: kullanıcının fiilen
              uyguladığı tek-taban+ekle/çıkar yöntemi, artık eksi puanlarla TAMAMLANMIŞ ve
              banko eşiği bu ölçeğe (max ~33, 100 değil) göre YENİDEN ölçeklenmiş halde. */}
          <div className="text-xs border rounded-md p-3 space-y-1.5 bg-muted/20">
            <h3 className="font-semibold">Manuel Puanlama Şablonu (Faz3 yerine, ücretsiz, NİHAİ SÜRÜM)</h3>
            <p>Her at için TEK bir hesap — muhakeme metnindeki EN GÜÇLÜ kanıtı esas al:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li><b>Taban puanı</b> — en güçlü kanıtın türüne göre: TAM eşleşme+kazanmış/net üstünlük → <b>23</b> · güçlü ama net galibiyet değil (iyi form/Son800 vb.) → <b>17</b> · orta düzey/destekleyici tek başına (yalnız AGF veya yalnız HP gibi) → <b>13</b> · zayıf/dolaylı → <b>9</b> · hemen hiç güçlü kanıt yok → <b>5</b>.</li>
              <li><b>Artılar</b> (uygun olan her biri için ekle): TAM eşleşme +3 · olumlu/kazanan sonuç +2 · geniş örneklem (n≥5) +2 · çapraz doğrulanmış (<code>[Vx+Vy]:destek</code>) +2 · taze olumlu değişiklik (takı/kilo/jokey) +1.</li>
              <li><b>Eksiler</b> (uygun olan her biri için çıkar): ciddi/tekrarlayan olumsuz sinyal (ör. tekrarlayan geç çıkış, tekrarlayan yenilgi serisi, <code>[Vx+Vy]:risk</code> güçlü) −3 · hafif risk/çelişki (kilo artışı, enerji maliyeti riski, form geriliyor gibi tek işaret) −1 · birden fazla risk aynı atta üst üste binmişse ek −1.
                <div className="pl-4 pt-1"><b>ÖNEMLİ (gerçek bulgu, Elazığ 8.Koşu 2026-08-03):</b> geniş örneklemli (n≥5) güçlü bir Son800/Accurace tempo sinyeli TEK bir risk etiketi (ör. tekrarlayan geç çıkış, sahanın genel V12 stil uyumsuzluğu) yüzünden tabana kadar çekilmemeli. O koşuda OLGUNADAM (Accurace %71,n=7) ve FISILTIKAYA (Son800 n=10, iyi) tam bunun kurbanı oldu, ikisi de son sıralara düşürüldü ama gerçekte üst 3&apos;te bitirdi. Kural: −3&apos;lük eksi, yalnız Taban+Artılar toplamının EN FAZLA YARISINI götürebilir — güçlü bir n≥5 sinyali tek bir risk asla sıfırlamamalı.</div>
              </li>
              <li><b>Toplam</b> = Taban + Artılar − Eksiler (alt/üst sınır yok, pratikte ~0-33 arası çıkar).</li>
              <li><b>Sırala:</b> toplam puana göre yüksekten düşüğe. Eşitlikte AGF sırası düşük (favoriye yakın) olan öne geçer.</li>
              <li><b>AGF çapraz kontrolü:</b> AGF sırası 1/2 olan at top-6 dışına düşüyorsa, muhakeme metninde bunun somut bir nedeni yazılı olmalı — yoksa gözden kaçan bir sinyal olabilir.</li>
              <li><b>Banko eşiği (bu ölçeğe göre — 100 değil ~33 üzerinden):</b> #1&apos;in puanı ≥26 VE #1-#2 arası fark ≥2 VE AGF çelişkisi yok VE kendi güveniniz yüksek. İkisi/üçü eksikse &quot;Banko Adayı&quot; (temkinli).</li>
              <li><b>Kupon dilimi:</b> sıraladığın liste — ilk 3 Ekonomik, 4-6 Normal, kalanı Geniş.</li>
              <li><b>ÖNEMLİ — sadece YUKARI taşı kuralı:</b> Faz2&apos;nin kendi &quot;ön teknik sıra&quot;sı zaten bir atı yüksekte koymuşsa (ör. 2.), bu puanlama hiçbir gerekçeyle onu daha geriye (ör. 4.&apos;e) İTMEMELİ — düzeltme kuralları (★ Hedef, AGF gibi) yalnız düşük sıradaki gözden kaçan bir atı YUKARI çekmek içindir, zaten yüksekteki bir atı aşağı çekme gerekçesi OLAMAZ. (Gerçek bulgu, 2026-08-03: GÜVENABİ Faz2&apos;de 2.yken, Faz3&apos;ün ★ Hedef kuralı onu mekanik olarak 4.&apos;e düşürmüştü — bu bir iyileştirme değil, kuralın yanlış uygulanmasıydı.)</li>
            </ol>

            <h3 className="font-semibold pt-2">Örnek (Elazığ 8.Koşu, gerçek veriyle)</h3>
            <table className="text-xs w-full border-collapse">
              <thead><tr className="bg-muted/40"><th className="text-left p-1">At</th><th className="text-right p-1">Taban</th><th className="text-right p-1">Artı</th><th className="text-right p-1">Eksi</th><th className="text-right p-1">Toplam</th><th className="text-left p-1">Not</th></tr></thead>
              <tbody>
                <tr className="border-t"><td className="p-1">VİTAL</td><td className="p-1 text-right">23</td><td className="p-1 text-right">+3+2+2+2</td><td className="p-1 text-right">0</td><td className="p-1 text-right font-medium">32</td><td className="p-1">Tam eşleşme+galibiyet, AGF+Son800 çapraz destekliyor.</td></tr>
                <tr className="border-t"><td className="p-1">FISILTIKAYA</td><td className="p-1 text-right">13</td><td className="p-1 text-right">+2</td><td className="p-1 text-right">−3−1</td><td className="p-1 text-right font-medium">11</td><td className="p-1">Son800 geniş örneklem iyi (+2) AMA tekrarlayan geç çıkış (%38, ciddi, −3) ve zayıf galop (−1) — eksiler unutulursa yanlışlıkla yüksek kalır.</td></tr>
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button onClick={calistirFaz3} disabled={loadingFaz3} variant="outline">
              {loadingFaz3 ? "Faz3 çalışıyor…" : "(opsiyonel, ek ücretli) Faz3'e Gönder — Claude sıralasın"}
            </Button>
          </div>
        </section>
      )}

      {faz3Error && (
        <pre className="whitespace-pre-wrap rounded-md border border-red-400 bg-red-50 p-3 text-xs overflow-x-auto max-h-96 overflow-y-auto text-red-900">
          {faz3Error}
        </pre>
      )}

      {faz3Data && (
        <section className="space-y-4">
          <h2 className="font-semibold text-sm">Faz3 — Nihai Sıralama (Kategori {faz3Data.kategori})</h2>

          <div className="text-xs border rounded-md p-3 space-y-1">
            <div>
              <span className="font-medium">Banko: </span>
              {faz3Data.isBanko ? <span className="text-green-600 font-medium">EVET</span> : <span className="text-muted-foreground">verilmedi</span>}
              {" — "}{faz3Data.bankoNote}
            </div>
            <div><span className="font-medium">Confidence: </span>{faz3Data.confidence}</div>
            <div><span className="font-medium">Ekonomik kupon: </span>{faz3Data.couponNarrow}</div>
            <div><span className="font-medium">Normal kupon: </span>{faz3Data.couponNormal}</div>
            <div><span className="font-medium">Geniş kupon: </span>{faz3Data.couponWide}</div>
            <div><span className="font-medium">Genel değerlendirme: </span>{faz3Data.notes}</div>
            <div><span className="font-medium">Tempo: </span>{faz3Data.tempo}</div>
          </div>

          <div className="overflow-x-auto border rounded-md">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="p-1.5 text-left">Sıra</th>
                  <th className="p-1.5 text-left">At</th>
                  <th className="p-1.5 text-right">Puan</th>
                  <th className="p-1.5 text-left">Pedigri</th>
                  <th className="p-1.5 text-center">★</th>
                  <th className="p-1.5 text-left">Gerekçe (public)</th>
                  <th className="p-1.5 text-left">Detaylar (iç)</th>
                </tr>
              </thead>
              <tbody>
                {faz3Data.picks.map((p) => (
                  <tr key={p.no} className="border-t align-top">
                    <td className="p-1.5 font-medium">{p.rank}</td>
                    <td className="p-1.5 whitespace-nowrap">#{p.no} {p.name}</td>
                    <td className="p-1.5 text-right font-medium">{p.score}</td>
                    <td className="p-1.5">{p.pedigreeRating}</td>
                    <td className="p-1.5 text-center">{p.isTarget ? "★" : ""}</td>
                    <td className="p-1.5">{p.note}</td>
                    <td className="p-1.5 text-muted-foreground">{p.details.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Kural Kontrolleri (mekanik denetim)</h3>
            <div className="space-y-1">
              {faz3Data.kuralKontrolleri.map((k, i) => (
                <div key={i} className="text-xs border rounded-md p-2">
                  <span className={
                    k.durum === "GECTI" ? "text-green-600 font-medium" :
                    k.durum === "IHLAL" ? "text-red-600 font-medium" : "text-muted-foreground font-medium"
                  }>
                    [{k.durum}]
                  </span>{" "}
                  <span className="font-medium">{k.kural}:</span> {k.detay}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
