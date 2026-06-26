"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  setActiveHomeKupon,
  deactivateHomeKupon,
  deleteHomeKupon,
  type HomeKuponLegInput,
} from "@/server/actions/home-kupon.actions";

function buildShareText(hippodromeName: string, date: Date, legs: HomeKuponLegInput[]): string {
  const dateLabel = format(date, "d MMMM yyyy", { locale: tr });
  const lines = legs
    .filter((l) => l.normal.length > 0 || l.narrow.length > 0 || l.wide.length > 0)
    .map((l) => `${l.raceNo}. Ayak: ${(l.normal.length > 0 ? l.normal : l.narrow.length > 0 ? l.narrow : l.wide).join("-")}`);
  return `${hippodromeName} ${dateLabel} Kombine Kupon Önerisi 🏇\n\n${lines.join("\n")}\n\nrotaganyan.com`;
}

type Props = {
  id: string;
  isActive: boolean;
  hippodromeName: string;
  date: Date;
  legs: HomeKuponLegInput[];
};

export default function KuponActions({ id, isActive, hippodromeName, date, legs }: Props) {
  const [pending, startTransition] = useTransition();

  async function shareOnX() {
    const text = buildShareText(hippodromeName, date, legs);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Kupon metni kopyalandı — X'te yapıştırıp paylaşabilirsin");
    } catch {
      toast.error("Metin kopyalanamadı");
    }
    window.open("https://x.com/home", "_blank");
  }

  async function shareOnInstagram() {
    const text = buildShareText(hippodromeName, date, legs);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Kupon metni kopyalandı — Instagram'da yapıştırıp paylaşabilirsin");
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
    });
  }

  function remove() {
    if (!confirm("Bu kuponu silmek istediğine emin misin?")) return;
    startTransition(async () => {
      await deleteHomeKupon(id);
      toast.success("Kupon silindi");
    });
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        onClick={shareOnX}
        className="text-xs text-muted-foreground hover:text-foreground"
        title="X'te paylaş"
      >
        X
      </button>
      <button
        onClick={shareOnInstagram}
        className="text-xs text-muted-foreground hover:text-foreground"
        title="Instagram'da paylaş"
      >
        Instagram
      </button>
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
  );
}
