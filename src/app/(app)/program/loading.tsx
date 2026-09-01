export default function ProgramLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 space-y-4">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-muted/40" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />
        ))}
      </div>
    </div>
  );
}
