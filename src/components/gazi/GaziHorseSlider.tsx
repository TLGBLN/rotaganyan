"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GaziHorse } from "@/server/services/ingest/tjk-gazi.adapter";

type Props = { horses: GaziHorse[] };

/** anaBilgiler: "(no) (d.e/tarih)\r\nBaba – Anne / Anaerkek\r\n<bio paragrafı>" */
function splitBio(anaBilgiler: string | null) {
  if (!anaBilgiler) return { reg: null, pedigree: null, bio: null };
  const lines = anaBilgiler.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return {
    reg: lines[0] ?? null,
    pedigree: lines[1] ?? null,
    bio: lines.slice(2).join(" ") || null,
  };
}

function HorseCard({ horse }: { horse: GaziHorse }) {
  const { reg, pedigree, bio } = splitBio(horse.anaBilgiler);

  return (
    <div className="w-full shrink-0 px-1">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="relative aspect-[16/10] w-full bg-muted">
          {horse.imgAt ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={horse.imgAt} alt={horse.atAdi} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Fotoğraf yok
            </div>
          )}
          {horse.imgForma && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={horse.imgForma}
              alt="Forma"
              className="absolute bottom-2 right-2 h-12 w-12 rounded-full border-2 border-background bg-background object-contain shadow"
            />
          )}
          {horse.hp && (
            <span className="absolute top-2 left-2 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-brand-foreground shadow">
              HP {horse.hp}
            </span>
          )}
        </div>

        <div className="space-y-3 p-4">
          <div>
            <h3 className="text-lg font-bold leading-tight">{horse.atAdi}</h3>
            {pedigree && <p className="text-xs text-muted-foreground">{pedigree}</p>}
            {reg && <p className="text-[11px] text-muted-foreground/70">{reg}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Field label="Sahibi" value={horse.atSahibi} />
            <Field label="Yetiştirici" value={horse.yetistici} />
            <Field label="Antrenör" value={horse.antrenor} />
            <div className="flex items-center gap-2">
              {horse.imgJokey && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={horse.imgJokey}
                  alt={horse.jokey ?? "Jokey"}
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
              )}
              <Field label="Jokey" value={horse.jokey} />
            </div>
          </div>

          {bio && (
            <p className="line-clamp-5 text-xs leading-relaxed text-muted-foreground">{bio}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <p className="truncate font-medium">{value ?? "—"}</p>
    </div>
  );
}

export default function GaziHorseSlider({ horses }: Props) {
  const [index, setIndex] = useState(0);
  if (horses.length === 0) return null;

  const go = (delta: number) => {
    setIndex((i) => (i + delta + horses.length) % horses.length);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">
          Kayıtlı Adaylar <span className="text-sm font-normal text-muted-foreground">({horses.length} at)</span>
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {index + 1} / {horses.length}
          </span>
          <button
            onClick={() => go(-1)}
            aria-label="Önceki at"
            className="flex h-7 w-7 items-center justify-center rounded-full border hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Sonraki at"
            className="flex h-7 w-7 items-center justify-center rounded-full border hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {horses.map((h) => (
            <HorseCard key={h.atAdi} horse={h} />
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {horses.map((h, i) => (
          <button
            key={h.atAdi}
            onClick={() => setIndex(i)}
            aria-label={`${h.atAdi} göster`}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index ? "w-6 bg-brand" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            )}
          />
        ))}
      </div>
    </div>
  );
}
