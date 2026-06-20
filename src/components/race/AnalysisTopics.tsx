"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { TOPICS, CHECKLIST_6 } from "@/lib/methodology/topics";
import {
  computeAutoScores,
  AUTO_TOPIC_NOTES,
  type ScorerRunner,
  type RaceCtx,
} from "@/lib/methodology/scorer";

export type AnalysisRunner = ScorerRunner;

type Props = {
  runners: AnalysisRunner[];
  raceCtx: RaceCtx;
  raceNo?: number;
  hippodrome?: string;
};

type Score = -1 | 0 | 1 | 2 | 3;
const SCORE_OPTS: Score[] = [-1, 0, 1, 2, 3];

function scoreLabel(v: Score | number): string {
  return v > 0 ? `+${v}` : String(v);
}

export default function AnalysisTopics({ runners, raceCtx, raceNo, hippodrome }: Props) {
  // Auto-computed initial scores
  const autoScores = useMemo(
    () => computeAutoScores(runners, raceCtx),
    [runners, raceCtx]
  );

  // User overrides: topicKey → runnerNo → score
  const [overrides, setOverrides] = useState<
    Record<string, Record<number, Score>>
  >({});

  const [active, setActive] = useState<string | null>(null);
  const [checks, setChecks] = useState<boolean[]>(
    CHECKLIST_6.map(() => false)
  );
  const [showFinal, setShowFinal] = useState(false);

  // Merged score: override > auto
  function getScore(topicKey: string, runnerNo: number): number {
    const ov = overrides[topicKey]?.[runnerNo];
    if (ov !== undefined) return ov;
    return autoScores[topicKey]?.[runnerNo] ?? 0;
  }

  function setOverride(topicKey: string, runnerNo: number, val: Score) {
    setOverrides((prev) => ({
      ...prev,
      [topicKey]: { ...(prev[topicKey] ?? {}), [runnerNo]: val },
    }));
  }

  function isAutoFilled(topicKey: string): boolean {
    const auto = autoScores[topicKey];
    return !!auto && Object.values(auto).some((s) => s !== 0);
  }

  function hasAnyScore(topicKey: string): boolean {
    return runners.some((r) => getScore(topicKey, r.no) !== 0);
  }

  // Final ranking: sum all topics
  const ranked = useMemo(
    () =>
      [...runners]
        .map((r) => ({
          ...r,
          total: TOPICS.reduce(
            (sum, t) => sum + getScore(t.key, r.no),
            0
          ),
          breakdown: TOPICS.map((t) => ({
            key: t.key,
            label: t.label,
            score: getScore(t.key, r.no),
          })),
        }))
        .sort((a, b) => b.total - a.total),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runners, overrides, autoScores]
  );

  const activeTopic = TOPICS.find((t) => t.key === active);
  const filledCount = TOPICS.filter((t) => hasAnyScore(t.key)).length;

  function shareOnX() {
    const top6 = ranked.slice(0, 6);
    const prefixes = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];
    const lines = top6.map(
      (r, i) =>
        `${prefixes[i]} ${r.no}. ${r.name}${r.total !== 0 ? ` (${r.total > 0 ? "+" : ""}${r.total})` : ""}`
    );
    const header =
      hippodrome && raceNo
        ? `🏇 ${hippodrome} ${raceNo}. Koşu Analizi`
        : "🏇 Koşu Analizi";
    const text = [header, ...lines, "", "#TJK #Rotaganyan #AtYarışı"].join("\n");
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=400");
  }

  function toggleTopic(key: string) {
    setShowFinal(false);
    setActive((prev) => (prev === key ? null : key));
  }

  return (
    <div className="mb-5 space-y-2.5">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        Analiz Kontrol Listesi
      </p>

      {/* ── Buttons ── */}
      <div className="flex flex-wrap gap-1.5">
        {TOPICS.map((topic) => {
          const auto = isAutoFilled(topic.key);
          const isActive = active === topic.key;
          return (
            <button
              key={topic.key}
              onClick={() => toggleTopic(topic.key)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "border-brand bg-brand/10 text-brand"
                  : auto
                  ? "border-hit/40 bg-hit/5 text-hit"
                  : "border-border text-muted-foreground hover:border-brand/40 hover:text-foreground"
              )}
            >
              {topic.label}
              {auto && <span className="ml-1 text-[9px]">●</span>}
            </button>
          );
        })}

        {/* Final Analiz */}
        <button
          onClick={() => {
            setShowFinal((v) => !v);
            setActive(null);
          }}
          className={cn(
            "rounded-md border px-3 py-1 text-xs font-bold transition-colors",
            showFinal
              ? "border-brand bg-brand text-black"
              : "border-brand/60 text-brand hover:bg-brand/10"
          )}
        >
          ⚡ Final Analiz
          {filledCount > 0 && (
            <span className="ml-1.5 rounded-full bg-brand/20 px-1.5 text-[9px] font-normal text-brand">
              {filledCount}/{TOPICS.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Topic Panel ── */}
      {activeTopic && !showFinal && (
        <div className="rounded-lg border border-brand/20 bg-card p-4 space-y-4">
          {/* Header */}
          <div>
            <h4 className="text-sm font-semibold">{activeTopic.title}</h4>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {activeTopic.guidance}
            </p>
          </div>

          {/* Checklist questions */}
          <div className="space-y-1.5">
            {activeTopic.questions.map((q, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 shrink-0 text-brand">→</span>
                <span className="text-muted-foreground">{q}</span>
              </div>
            ))}
          </div>

          {/* Warning */}
          {activeTopic.warning && (
            <div className="rounded-md border border-miss/20 bg-miss/5 px-3 py-2 text-[11px] leading-relaxed text-miss">
              ⚠ {activeTopic.warning}
            </div>
          )}

          {/* Auto-score note */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-medium",
                isAutoFilled(activeTopic.key)
                  ? "bg-hit/10 text-hit"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isAutoFilled(activeTopic.key) ? "Otomatik" : "Manuel"}
            </span>
            <span>{AUTO_TOPIC_NOTES[activeTopic.key]}</span>
          </div>

          {/* Runner scoring */}
          {runners.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                At Puanları — tıklayarak override yapabilirsin
              </p>
              <div className="space-y-1.5">
                {runners.map((r) => {
                  const auto = autoScores[activeTopic.key]?.[r.no] ?? 0;
                  const current = getScore(activeTopic.key, r.no);
                  const hasOverride = overrides[activeTopic.key]?.[r.no] !== undefined;

                  return (
                    <div key={r.id} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-right text-xs font-mono text-muted-foreground">
                        {r.no}
                      </span>
                      <span className="flex-1 truncate text-xs font-medium">
                        {r.name}
                      </span>
                      {/* Auto badge */}
                      {!hasOverride && auto !== 0 && (
                        <span className="text-[9px] text-hit">auto</span>
                      )}
                      {hasOverride && (
                        <button
                          onClick={() => {
                            setOverrides((prev) => {
                              const copy = { ...prev };
                              const t = { ...(copy[activeTopic.key] ?? {}) };
                              delete t[r.no];
                              copy[activeTopic.key] = t;
                              return copy;
                            });
                          }}
                          className="text-[9px] text-brand hover:underline"
                        >
                          reset
                        </button>
                      )}
                      {/* Score buttons */}
                      <div className="flex shrink-0 gap-1">
                        {SCORE_OPTS.map((val) => (
                          <button
                            key={val}
                            onClick={() =>
                              setOverride(activeTopic.key, r.no, val)
                            }
                            className={cn(
                              "h-6 min-w-[26px] rounded border px-1 text-[10px] font-bold transition-colors",
                              current === val
                                ? val < 0
                                  ? "border-miss bg-miss/20 text-miss"
                                  : val === 0
                                  ? "border-border bg-muted text-foreground"
                                  : "border-brand bg-brand/20 text-brand"
                                : "border-border text-muted-foreground hover:border-brand/40"
                            )}
                          >
                            {scoreLabel(val)}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Final Analiz ── */}
      {showFinal && (
        <div className="rounded-lg border border-brand/30 bg-card p-4 space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-brand">
              ⚡ Final Analiz — Önerilen Sıralama
            </h4>
            <button
              onClick={shareOnX}
              className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.912-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Paylaş
            </button>
          </div>

          {/* Ranking */}
          <div className="space-y-1.5">
            {ranked.map((r, i) => (
              <div
                key={r.id}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-2",
                  i === 0
                    ? "border-brand/40 bg-brand/5"
                    : i === 1
                    ? "border-muted-foreground/20"
                    : "border-border/50"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    i === 0
                      ? "bg-brand text-black"
                      : i === 1
                      ? "bg-muted-foreground/20 text-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {i + 1}
                </span>
                <span className="w-6 shrink-0 text-right text-xs font-mono text-muted-foreground">
                  #{r.no}
                </span>
                <span className="flex-1 text-sm font-medium">{r.name}</span>
                {/* Breakdown chips */}
                <div className="hidden gap-1 sm:flex flex-wrap justify-end max-w-[200px]">
                  {r.breakdown
                    .filter((b) => b.score !== 0)
                    .map((b) => (
                      <span
                        key={b.key}
                        title={b.label}
                        className={cn(
                          "rounded px-1 text-[9px] font-bold",
                          b.score > 0
                            ? "bg-hit/10 text-hit"
                            : "bg-miss/10 text-miss"
                        )}
                      >
                        {b.label.replace(/①|②|③|④|⑤|⑥/g, "").trim()}{" "}
                        {b.score > 0 ? `+${b.score}` : b.score}
                      </span>
                    ))}
                </div>
                <span
                  className={cn(
                    "shrink-0 text-sm font-bold",
                    r.total > 0
                      ? "text-hit"
                      : r.total < 0
                      ? "text-miss"
                      : "text-muted-foreground"
                  )}
                >
                  {r.total > 0 ? `+${r.total}` : r.total}
                </span>
              </div>
            ))}
          </div>

          {/* 6-step checklist */}
          <div className="border-t pt-4">
            <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              Analiz Öncesi 6 Adım — Kontrol
            </p>
            <div className="space-y-2">
              {CHECKLIST_6.map((item, i) => (
                <label
                  key={i}
                  className="flex cursor-pointer items-start gap-2.5 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={checks[i]}
                    onChange={() =>
                      setChecks((prev) =>
                        prev.map((v, idx) => (idx === i ? !v : v))
                      )
                    }
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand"
                  />
                  <span
                    className={cn(
                      checks[i]
                        ? "text-muted-foreground/40 line-through"
                        : "text-muted-foreground"
                    )}
                  >
                    {item}
                  </span>
                </label>
              ))}
            </div>
            {checks.every(Boolean) && (
              <div className="mt-3 rounded-md border border-hit/30 bg-hit/5 px-3 py-2 text-xs font-medium text-hit">
                ✓ 6 adımın tamamı kontrol edildi — analize hazır.
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Otomatik: AGF · Galop · Jokey (sarı üçgen) · Takı · Kilo değişimi.{" "}
            Manuel: Derece · Sicil · Tempo · Tüm Atlar. Her puanı override
            yapabilirsin.
          </p>
        </div>
      )}
    </div>
  );
}
