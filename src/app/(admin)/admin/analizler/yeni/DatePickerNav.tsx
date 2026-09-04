"use client";

// 2026-09-03 kullanıcı bulgusu ("tarihlere tıkladığımda çok yavaş değişiyor sayfa") —
// eskiden burada router.push tam sayfa navigasyonu tetikliyordu (force-dynamic sayfa,
// her tıklamada sunucu round-trip'i, ~700-1100ms). Artık tarih seçimi AnalizYeniClient'ın
// verdiği onDateChange callback'ine devrediliyor — o, hafif bir server action ile veriyi
// çekip yalnız state güncelliyor, sayfa hiç yeniden yüklenmiyor.
type Props = { selectedDate: string; today: string; tomorrow: string; onDateChange: (date: string) => void };

export default function DatePickerNav({ selectedDate, today, tomorrow, onDateChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => onDateChange(today)}
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
        onClick={() => onDateChange(tomorrow)}
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
        onChange={(e) => { if (e.target.value) onDateChange(e.target.value); }}
        className="rounded-md border bg-background px-2 py-1.5 text-xs [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:brightness-200"
      />
    </div>
  );
}
