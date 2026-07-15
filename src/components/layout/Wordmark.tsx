import { cn } from "@/lib/utils";

export default function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-black px-2 py-1 text-sm font-black leading-none tracking-tight",
        className
      )}
    >
      <span className="text-white">ROTA</span>
      <span className="text-brand">GANYAN</span>
    </span>
  );
}
