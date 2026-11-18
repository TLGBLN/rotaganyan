// RAN F6 — admin analiz ekranı (kullanıcı kararı 2026-11-18). Beş sinyal ailesinin (ACC_HIZ, J_SEVIYE, GALOP_KAPASITE, H2H_NET, SON_YARIS_SONUCU) altı bileşeniyle
// yarış başına kalibre olasılık, sıralama ve sinyal kırılımı. Mevcut banko/kupon/V5.46.1 akışlarından BAĞIMSIZ; yalnız burada gösterilir. Geri alma: aşağıdaki anahtar.
import Link from "next/link";
import { db } from "@/lib/db";
import RanF6YarisPaneli from "@/components/admin/RanF6YarisPaneli";
import { F6_SINYAL_ADLARI, F6_SINYALLER, TUR_AYAR, type TurGrubu } from "@/lib/methodology/ran-f6/ran-f6-model";
import { RAN_F6_EGITIM, RAN_F6_KATSAYI_SURUMU } from "@/lib/methodology/ran-f6/ran-f6-katsayilar";
import { ranF6Aktif, ranF6Hesapla, ranF6KayitliOku } from "@/server/services/ran-f6.service";
import { ranF6BayrakDegistirAction } from "@/server/actions/ran-f6.actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const metadata = { title: "RAN F6 — Admin" };

export default async function RanF6Sayfasi({ searchParams }: { searchParams: Promise<{ tarih?: string; yaris?: string }> }) {
  const sp = await searchParams; const aktif = await ranF6Aktif();
  const sonGun = await db.raceDay.findFirst({ orderBy: { date: "desc" }, select: { date: true } }); const tarih = /^\d{4}-\d{2}-\d{2}$/.test(sp.tarih ?? "") ? sp.tarih! : (sonGun?.date.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const yarislar = await db.race.findMany({ where: { raceDay: { date: new Date(tarih + "T00:00:00.000Z") } }, orderBy: [{ raceDay: { hippodrome: { name: "asc" } } }, { raceNo: "asc" }], select: { id: true, raceNo: true, classType: true, raceDay: { select: { hippodrome: { select: { name: true } } } } } });
  const sec = sp.yaris && yarislar.some((r) => r.id === sp.yaris) ? sp.yaris : null;
  let hesap = null as Awaited<ReturnType<typeof ranF6Hesapla>> | null; let kayitli = null as Awaited<ReturnType<typeof ranF6KayitliOku>>; let hata: string | null = null;
  if (aktif && sec) { kayitli = await ranF6KayitliOku(sec); if (!kayitli) { try { hesap = await ranF6Hesapla([sec]); } catch (e) { hata = String((e as Error).message ?? e); } } }
  const y = kayitli ?? hesap?.yarislar[0] ?? null;

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <h1 className="text-lg font-bold">RAN F6 <span className="text-sm font-normal text-muted-foreground">— beş sinyal ailesi, altı bileşen</span></h1>
        <p className="text-xs text-muted-foreground">
          ACC_HIZ, J_SEVIYE, GALOP_KAPASITE, H2H_NET, SON_YARIS_SONUCU (Y_son + T_son). <strong>SON6 yok; AGF bu hesaba girmez</strong> (AGF yalnız ayrı referanstır). Dondurulmuş katsayılar ({RAN_F6_KATSAYI_SURUMU}; eğitim {RAN_F6_EGITIM.yarisSayisi} yarış, {RAN_F6_EGITIM.bitis}&apos;e kadar).
          Bu ekran <strong>mevcut banko ve kupon kararlarını değiştirmez</strong>; sonuçlar keşif dönemidir (bağımsız doğrulama değil).
        </p>
      </div>

      <form action={ranF6BayrakDegistirAction} className="flex items-center gap-3 rounded-lg border p-3 text-xs">
        <span>Durum: <strong className={aktif ? "text-hit" : "text-miss"}>{aktif ? "AÇIK" : "KAPALI (geri alındı)"}</strong></span>
        <input type="hidden" name="aktif" value={aktif ? "0" : "1"} />
        <button type="submit" className="rounded border px-2 py-1 hover:bg-muted">{aktif ? "Kapat (geri al)" : "Aç"}</button>
        <span className="text-muted-foreground">Kapalıyken RAN F6 hesaplanmaz ve gösterilmez; başka hiçbir akış etkilenmez.</span>
      </form>

      <section className="space-y-2">
        <h2 className="text-sm font-bold">Yarış tiplerine göre sinyal kullanımı</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead><tr className="border-b bg-muted/30 text-muted-foreground"><th className="px-2 py-1.5 text-left">Yarış tipi</th><th className="px-2 py-1.5 text-left">Etki düzeyi</th>{F6_SINYALLER.map((c) => <th key={c} className="px-2 py-1.5 text-center">{F6_SINYAL_ADLARI[c]}</th>)}<th className="px-2 py-1.5 text-left">Not</th></tr></thead>
            <tbody>
              {(Object.keys(TUR_AYAR) as TurGrubu[]).map((t) => { const a = TUR_AYAR[t]; const kul = a.ilkStart ? (["S", "kap"] as const).slice() as string[] : F6_SINYALLER.filter((c) => !a.kapali.includes(c)) as string[];
                return (<tr key={t} className="border-b last:border-0 align-top"><td className="px-2 py-1.5 font-medium">{a.ad}</td><td className="px-2 py-1.5">{a.etki}</td>
                  {F6_SINYALLER.map((c) => <td key={c} className="px-2 py-1.5 text-center">{kul.includes(c) ? <span className="text-hit">kullanılır</span> : <span className="text-muted-foreground/60">{a.ilkStart ? "kullanılamaz" : "kapalı"}</span>}</td>)}
                  <td className="px-2 py-1.5 text-[11px] text-muted-foreground">{a.not}</td></tr>); })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground">Kural (önceden bildirildi): sinyal bir tipte AKTİF = özgün katkı ΔLL% noktası &gt; 0 (GALOP için galop kapsamlı dönem); ≤ 0 → kapalı; örneklemi yetersiz tipte (Şartlı 2/19) maske yok; Şartlı 1/27 yalnız J_SEVIYE + GALOP. Keşif dönemi verisiyle türetildi; ileri-yönlü izleme gerekir.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold">Yarış seç</h2>
        <form className="flex items-center gap-2 text-xs"><label>Tarih <input type="date" name="tarih" defaultValue={tarih} className="rounded border bg-background px-2 py-1" /></label><button type="submit" className="rounded border px-2 py-1 hover:bg-muted">Göster</button></form>
        <div className="flex flex-wrap gap-1.5 text-[11px]">{yarislar.map((r) => <Link key={r.id} href={`/admin/ran-f6?tarih=${tarih}&yaris=${r.id}`} className={r.id === sec ? "rounded bg-brand px-2 py-1 text-brand-foreground" : "rounded border px-2 py-1 hover:bg-muted"}>{r.raceDay.hippodrome.name} {r.raceNo}</Link>)}{!yarislar.length && <span className="text-muted-foreground">Bu tarihte yarış yok.</span>}</div>
      </section>

      {!aktif && <p className="text-xs text-muted-foreground">RAN F6 kapalı: hesap yapılmaz.</p>}
      {aktif && sec && hata && <p className="text-xs text-miss">Hesap hatası: {hata}</p>}
      {aktif && sec && !y && !hata && <p className="text-xs text-muted-foreground">Bu yarış için F6 üretilemedi{hesap?.atlananlar[0] ? ` (${hesap.atlananlar[0].neden})` : ""}.</p>}
      {y && <RanF6YarisPaneli y={y} />}
      {y && kayitli && <p className="text-[10px] text-muted-foreground">Kayıtlı analizden gösterildi ({y.hesaplamaZamani}).</p>}
      {y && !kayitli && hesap && <p className="text-[10px] text-muted-foreground">Anlık hesaplandı (popülasyon verisi {hesap.populasyonSn.toFixed(1)} sn). Kalıcı kayıt için gün sonunda &quot;günü hesapla ve kaydet&quot; çalıştırılır (RanF6Analiz tablosu gerekir).</p>}
    </div>
  );
}
