"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { saveSireStatBulk } from "@/server/actions/sire-stat.actions";

const IRK_OPTIONS = ["İNGİLİZ", "ARAP"];
const CINS_OPTIONS = ["Hepsi", "Erkek", "Dişi", "İğdiş"];
const PIST_OPTIONS = ["Hepsi", "Çim", "Kum", "Sentetik"];
const GRUP_OPTIONS = ["Hepsi", "Grup 1", "Grup", "Listed"];
const YAS_OPTIONS = ["Hepsi", "(2y)", "(3y)", "(3+)", "(4+)"];

function FieldSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border bg-transparent px-2 py-1.5 text-sm"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function FieldText({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md border bg-transparent px-2 py-1.5 text-sm"
      />
    </label>
  );
}

export default function SireStatForm() {
  const [irk, setIrk] = useState("İNGİLİZ");
  const [yil, setYil] = useState("2026");
  const [cins, setCins] = useState("Hepsi");
  const [sehir, setSehir] = useState("Hepsi");
  const [mesafe, setMesafe] = useState("800-1400");
  const [pist, setPist] = useState("Çim");
  const [grup, setGrup] = useState("Hepsi");
  const [yas, setYas] = useState("Hepsi");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ kaydedilen: number; hatali: string[] } | null>(null);

  async function handleSave() {
    setSaving(true);
    setResult(null);
    try {
      const r = await saveSireStatBulk(text, {
        irk, filtreYil: yil, filtreCins: cins, filtreSehir: sehir,
        filtreMesafe: mesafe, filtrePist: pist, filtreGrupListed: grup, filtreYasGrubu: yas,
      });
      setResult(r);
      if (r.kaydedilen > 0) setText("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">Bu Yapıştırma hipodromx.com&apos;daki Hangi Filtreye Ait?</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          hipodromx.com/Aygirlar.aspx sayfasındaki dropdown&apos;larla BİREBİR aynı seçin — aşağıdaki tabloyu bu filtrelerle
          etiketleyip kaydedeceğiz. (Bu site robots.txt ile botları engelliyor, bu yüzden yalnız elle yapıştırmayla
          besleniyor — otomatik çekilmiyor.)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FieldSelect label="Irk" value={irk} onChange={setIrk} options={IRK_OPTIONS} />
        <FieldText label="Yıl" value={yil} onChange={setYil} placeholder="2026" />
        <FieldSelect label="Cins (yavru)" value={cins} onChange={setCins} options={CINS_OPTIONS} />
        <FieldText label="Şehir" value={sehir} onChange={setSehir} placeholder="Hepsi" />
        <FieldText label="Mesafe" value={mesafe} onChange={setMesafe} placeholder="800-1400" />
        <FieldSelect label="Pist" value={pist} onChange={setPist} options={PIST_OPTIONS} />
        <FieldSelect label="Grup/Listed" value={grup} onChange={setGrup} options={GRUP_OPTIONS} />
        <FieldSelect label="Yaş Grubu" value={yas} onChange={setYas} options={YAS_OPTIONS} />
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Tabloyu Yapıştırın</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Expand\tTOUCH THE WOLF\n7\t-22\n%31\t44\t9\t%20\t10\t5\t3\t4\t20.653.800\t3,34\n..."}
          rows={12}
          className="w-full rounded-md border bg-transparent px-2 py-1.5 text-xs font-mono"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!text.trim() || saving}
        className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Ayrıştır ve Kaydet
      </button>

      {result && (
        <div className="space-y-1 text-xs">
          <p className="text-hit">{result.kaydedilen} aygır kaydedildi.</p>
          {result.hatali.length > 0 && (
            <p className="text-miss">Ayrıştırılamayan {result.hatali.length} satır: {result.hatali.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
