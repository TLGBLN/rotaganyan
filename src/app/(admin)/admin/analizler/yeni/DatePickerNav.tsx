"use client";

import { useRouter } from "next/navigation";

type Props = { selectedDate: string; today: string; tomorrow: string };

export default function DatePickerNav({ selectedDate, today, tomorrow }: Props) {
  const router = useRouter();

  const nav = (date: string) => router.push(`/admin/analizler/yeni?tarih=${date}`);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => nav(today)}
        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
          selectedDate === today
            ? "bg-brand text-black border-brand"
            : "hover:bg-muted text-muted-foreground"
        }`}
      >
        Bugün
      </button>
      <button
        type="button"
        onClick={() => nav(tomorrow)}
        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
          selectedDate === tomorrow
            ? "bg-brand text-black border-brand"
            : "hover:bg-muted text-muted-foreground"
        }`}
      >
        Yarın
      </button>
      <input
        type="date"
        value={selectedDate}
        onChange={(e) => { if (e.target.value) nav(e.target.value); }}
        className="rounded-md border bg-background px-2 py-1.5 text-xs [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:brightness-200"
      />
    </div>
  );
}
