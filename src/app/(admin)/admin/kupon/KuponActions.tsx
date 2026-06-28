"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  setActiveHomeKupon,
  deactivateHomeKupon,
  deleteHomeKupon,
  shareHomeKuponOnX,
  type HomeKuponLegInput,
} from "@/server/actions/home-kupon.actions";

type Width = "narrow" | "normal" | "wide";
const WIDTH_LABEL: Record<Width, string> = { narrow: "Ekonomik", normal: "Normal", wide: "Geniş" };

/** Genişlik için at numaralarını seçer — boşsa bir alt seviyeye düşer (Geniş→Normal→Ekonomik), anasayfa mantığıyla aynı. */
function nosForWidth(leg: HomeKuponLegInput, width: Width): number[] {
  if (width === "narrow") return leg.narrow;
  if (width === "normal") return leg.normal.length > 0 ? leg.normal : leg.narrow;
  return leg.wide.length > 0 ? leg.wide : leg.normal.length > 0 ? leg.normal : leg.narrow;
}

function buildShareText(hippodromeName: string, date: Date, legs: HomeKuponLegInput[], width: Width): string {
  const dateLabel = format(date, "d MMMM yyyy", { locale: tr });
  const lines = legs
    .map((l) => ({ raceNo: l.raceNo, nos: nosForWidth(l, width) }))
    .filter((l) => l.nos.length > 0)
    .map((l) => `${l.raceNo}. Ayak: ${l.nos.join("-")}`);
  return `${hippodromeName} ${dateLabel} ${WIDTH_LABEL[width]} Kupon Önerisi 🏇\n\n${lines.join("\n")}\n\nrotaganyan.com`;
}

type Props = {
  id: string;
  isActive: boolean;
  hippodromeName: string;
  date: Date;
  legs: HomeKuponLegInput[];
};

export default function KuponActions({ id, isActive, hippodromeName, date, legs }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function shareOnX(width: Width) {
    const text = buildShareText(hippodromeName, date, legs, width);
    startTransition(async () => {
      const result = await shareHomeKuponOnX(text);
      if (result.ok) {
        toast.success(`${WIDTH_LABEL[width]} kupon X hesabından paylaşıldı`);
      } else {
        toast.error(result.error ?? "X'te paylaşılamadı");
      }
    });
  }

  async function shareOnInstagram(width: Width) {
    const text = buildShareText(hippodromeName, date, legs, width);
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${WIDTH_LABEL[width]} kupon metni kopyalandı — Instagram'da yapıştırıp paylaşabilirsin`);
    } catch {
      toast.error("Metin kopyalanamadı");
    }
    window.open("https://www.instagram.com/", "_blank");
  }

  function toggleActive() {
    startTransition(async () => {
      if (isActive) {
        await deactivateHomeKupon(id);
        toast.success("Yayından kaldırıldı");
      } else {
        await setActiveHomeKupon(id);
        toast.success("Anasayfada yayınlandı");
      }
      router.refresh();
    });
  }

  function remove() {
    if (!confirm("Bu kuponu silmek istediğine emin misin?")) return;
    startTransition(async () => {
      await deleteHomeKupon(id);
      toast.success("Kupon silindi");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {(["narrow", "normal", "wide"] as Width[]).map((width) => (
        <div key={width} className="flex items-center gap-1.5 text-[10px]">
          <span className="w-16 text-right text-muted-foreground">{WIDTH_LABEL[width]}</span>
          <button
            onClick={() => shareOnX(width)}
            disabled={pending}
            className="rounded border px-1.5 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
            title={`${WIDTH_LABEL[width]} — X hesabından paylaş`}
          >
            X
          </button>
          <button
            onClick={() => shareOnInstagram(width)}
            className="rounded border px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
            title={`${WIDTH_LABEL[width]} — Instagram'da paylaş`}
          >
            IG
          </button>
        </div>
      ))}

      <div className="mt-1 flex items-center gap-3">
        <button
          onClick={toggleActive}
          disabled={pending}
          className="text-xs text-brand hover:underline disabled:opacity-50"
        >
          {pending ? "…" : isActive ? "Yayından Kaldır" : "Yayınla"}
        </button>
        <button
          onClick={remove}
          disabled={pending}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Sil
        </button>
      </div>
    </div>
  );
}
