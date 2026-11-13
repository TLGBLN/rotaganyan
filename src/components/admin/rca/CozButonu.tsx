"use client";
import { useState } from "react";
import { COZUM_BILGI, type CozumKodu } from "@/lib/rca/rca-cekirdek";

/** Tek tıkla çözüm: sunucuya POST eder, sonucu yerinde gösterir. Uzun işler arka planda sürer (202). */
export function CozButonu({ kod }: { kod: CozumKodu }) {
  const [durum, setDurum] = useState<"bekle" | "calisiyor" | "bitti" | "hata">("bekle");
  const [mesaj, setMesaj] = useState("");
  const b = COZUM_BILGI[kod];
  async function calistir() {
    setDurum("calisiyor"); setMesaj("");
    try {
      const r = await fetch("/api/admin/rca/coz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kod }) });
      const j = (await r.json().catch(() => ({}))) as { mesaj?: string; error?: string };
      if (!r.ok) { setDurum("hata"); setMesaj(j.error ?? `Hata (${r.status})`); return; }
      setDurum("bitti"); setMesaj(j.mesaj ?? "Tamamlandı.");
    } catch (e) { setDurum("hata"); setMesaj(String(e)); }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" onClick={calistir} disabled={durum === "calisiyor"}
        className="inline-flex w-fit items-center rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
        {durum === "calisiyor" ? "Çalışıyor…" : `${b.etiket} (${b.sure})`}
      </button>
      <p className="text-[11px] text-muted-foreground">{b.aciklama}</p>
      {mesaj && <p className={`text-xs ${durum === "hata" ? "text-risk" : "text-hit"}`}>{mesaj}</p>}
    </div>
  );
}
