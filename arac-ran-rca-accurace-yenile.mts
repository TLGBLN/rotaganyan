// RAN RCA — eski immutable Accurace snapshot için AÇIK/manuel delta yenileme.
// Production/DB yazılmaz; yeni dosya yalnız geçici worktree-özel yerel önbelleğe yazılır.
// Aynı günün tüm yarışlarını yeniden çekerek sınırdaki yarışı iki kez saymaz.
// Tam kaynakla eşitlik garantisi için retroaktif tarihli DB düzeltmeleri ayrıca
// denetlenmelidir (bu işlem yalnız snapshot günü ve sonrasını yeniler).
import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  loadRcaAccuraceSnapshot,
  rcaAccuraceSnapshotPath,
  rcaAccuraceRefreshedPath,
  rcaAccuraceRefreshDay,
  mergeRcaAccuraceRuns,
} from "./src/lib/rotaganyan-analiz-motoru/rca/accurace-snapshot";
import { accuraceKosulari } from "./src/lib/accurace/loader";
import { db } from "./src/lib/db";

async function main() {
  const t0 = Date.now();
  const inputPath = rcaAccuraceSnapshotPath();
  const old = loadRcaAccuraceSnapshot([], inputPath);
  const from = rcaAccuraceRefreshDay(old.builtAt);
  console.log(`[RCA REFRESH] source=${inputPath}`);
  console.log(`[RCA REFRESH] rebuilt window: ${from.toISOString()} onwards (not full 4573-race archive)`);
  const latest = await accuraceKosulari({ fromDate: from });
  if (latest.length === 0) {
    throw new Error("RCA_ACCURACE_REFRESH_EMPTY: no matched Accurace records, old snapshot unchanged");
  }
  const runs = mergeRcaAccuraceRuns(old.runs, latest, from);
  const builtAt = new Date().toISOString();
  const output = {
    builtAt,
    runs,
    refresh: {
      kind: "DATE_WINDOW_INCREMENTAL",
      sourceSha256: old.sha256,
      sourceBuiltAt: old.builtAt,
      rebuiltFrom: from.toISOString(),
      rebuiltRuns: latest.length,
      keptRuns: runs.length - latest.length,
      note: "DB late backfills/edits dated earlier than rebuiltFrom are not included; full archive refresh required for strict whole-history identity.",
    },
  };
  const destination = rcaAccuraceRefreshedPath();
  const tmp = `${destination}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(output));
    const check = loadRcaAccuraceSnapshot([], tmp);
    if (check.runs.length !== runs.length || check.builtAt !== builtAt) {
      throw new Error("RCA_ACCURACE_REFRESH_VERIFY_FAILED");
    }
    fs.renameSync(tmp, destination);
  } finally {
    if (fs.existsSync(tmp)) fs.rmSync(tmp);
  }
  const sha = createHash("sha256").update(fs.readFileSync(destination)).digest("hex");
  console.log(`[RCA REFRESH OK] totalRuns=${runs.length} rebuilt=${latest.length} retained=${runs.length - latest.length}`);
  console.log(`[RCA REFRESH OK] builtAt=${builtAt} sha256=${sha.slice(0, 16)} elapsedMs=${Date.now() - t0}`);
  console.log(`[RCA REFRESH OK] localFile=${destination}`);
  console.log("[RCA REFRESH] Next RCA/probe picks up this file automatically. No full archive scan during RCA.");
}

main()
  .catch((error) => { console.error("[RCA REFRESH FAILED]", error); process.exitCode = 1; })
  .finally(async () => { await db.$disconnect(); });
