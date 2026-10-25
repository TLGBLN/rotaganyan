// RAN RCA başlangıç teşhisi. Üretim yolunu değiştirmez, RCA yarışı hesaplamaz.
// Tüm süreç 20 saniyede kapanır; stdout tamponlamasına bağımlı olmayan durum dosyası üretir.
import fs from "node:fs";

const path = "C:/tmp/ran-rca-probe-status.log";
process.env.RAN_RCA_DIAG_FILE = path;
process.env.RAN_RCA_LIMIT = "1";
process.env.RAN_RCA_PROBE_ONLY = "1";
fs.writeFileSync(path, "[BOOT] Node script launched, RCA module is NOT imported yet.\n");
const started = Date.now();

const watchdog = setTimeout(() => {
  const line = `[TIME_LIMIT] ${Date.now() - started}ms: startup or archive preload not finished.\n`;
  fs.appendFileSync(path, line);
  process.stderr.write(line);
  process.exit(124);
}, 20000);

try {
  fs.appendFileSync(path, "[IMPORT_START] Loading RCA script dependencies...\n");
  await import("./arac-ran-rca-calistir.mts");
  // Imported script runs main() asynchronously and calls process.exit() when complete.
} catch (error) {
  const line = `[IMPORT_ERROR] ${String(error)}\n`;
  fs.appendFileSync(path, line);
  process.stderr.write(line);
  process.exitCode = 1;
} finally {
  // Watchdog remains active until RCA main() exits or the 20-second bound hits.
  void watchdog;
}
