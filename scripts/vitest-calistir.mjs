// Windows tuzağı (2026-11-14 bulundu): çalışma dizini küçük harfli sürücü harfiyle ("c:\...") açılınca
// (VS Code terminali / bazı araçlar) vitest, `vitest` modülünü İKİ KEZ yükler ve her test dosyası
// "TypeError: Cannot read properties of undefined (reading 'config')" ile açılamaz. Büyük harfli "C:\..."
// ile aynı testler geçer. Bu sarmalayıcı sürücü harfini büyütüp vitest'i öyle çalıştırır.
import { spawnSync } from "node:child_process";
import path from "node:path";

let cwd = process.cwd();
if (process.platform === "win32" && /^[a-z]:/.test(cwd)) cwd = cwd[0].toUpperCase() + cwd.slice(1);
const bin = path.join(cwd, "node_modules", "vitest", "vitest.mjs");
const r = spawnSync(process.execPath, [bin, "run", ...process.argv.slice(2)], { cwd, stdio: "inherit" });
process.exit(r.status ?? 1);
