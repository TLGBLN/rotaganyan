import {
  parsePistRejimi,
  type PistYuzeyi,
} from "./pist-durum-01";

import {
  parseHistoryRows,
  rowsBeforeCutoff,
  parseTjkDate,
  finishPosToPosition,
  type HistoryRow,
  type FieldSizeResolverFn,
} from "./history-source";

import type {
  HistoricalGoingPerformance,
} from "./pist-durum-score";

export function parseHistoryGoing(
  raw: string | null | undefined
): { surface: PistYuzeyi; going: string } | null {
  if (!raw) return null;

  const match = /^\s*([KkÇçSs]):\s*(.*?)\s*$/u.exec(raw);
  if (!match) return null;

  const prefix = match[1].toLocaleUpperCase("tr-TR");

  const surface: PistYuzeyi =
    prefix === "K" ? "KUM" :
    prefix === "Ç" ? "CIM" :
    "SENTETIK";

  const going = match[2].trim();

  if (parsePistRejimi(going) == null) return null;

  return { surface, going };
}

export function historyRowToGoing(
  row: HistoryRow,
  fieldSize: number
): HistoricalGoingPerformance | null {
  const parsed = parseHistoryGoing(row.surface);
  const date = parseTjkDate(row.date);
  const finish = finishPosToPosition(row.finishPos);

  if (
    !parsed ||
    !date ||
    finish == null ||
    !Number.isInteger(fieldSize) ||
    fieldSize < 2 ||
    finish > fieldSize
  ) return null;

  return {
    raceDate: date.toISOString().slice(0, 10),
    surface: parsed.surface,
    going: parsed.going,
    finishPosition: finish,
    fieldSize,
  };
}

export async function buildGoingHistory(
  rowsJson: unknown,
  cutoff: Date,
  resolver: FieldSizeResolverFn
) {
  const rows = rowsBeforeCutoff(
    parseHistoryRows(rowsJson),
    cutoff
  );

  const history: HistoricalGoingPerformance[] = [];

  let skippedFormat = 0;
  let skippedResolver = 0;
  let skippedResult = 0;

  for (const row of rows) {
    if (!parseHistoryGoing(row.surface)) {
      skippedFormat++;
      continue;
    }

    const resolved = await resolver(row);

    if (!resolved) {
      skippedResolver++;
      continue;
    }

    const converted = historyRowToGoing(
      row,
      resolved.fieldSize
    );

    if (!converted) {
      skippedResult++;
      continue;
    }

    history.push(converted);
  }

  return {
    history,
    diagnostics: {
      pastRows: rows.length,
      accepted: history.length,
      skippedFormat,
      skippedResolver,
      skippedResult,
    },
  };
}