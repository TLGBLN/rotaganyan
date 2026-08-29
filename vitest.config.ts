import path from "node:path";
import { defineConfig } from "vitest/config";

// 2026-08-29 — bu projenin ilk gerçek test dosyasıyla (v5-engine.test.ts, V6 Aşama 2)
// birlikte eklendi. tsconfig.json'daki "@/*" -> "./src/*" alias'ını vitest'e de tanıtır,
// yoksa src içindeki modüller (v5-engine.ts gibi) "@/..." importlarında çözülemiyor.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // src/lib/db.ts modül yüklenirken (import zamanında) DATABASE_URL'in var olmasını
    // ZORUNLU kılıyor (Prisma adapter'ı kurmak için) ama gerçekten BAĞLANMIYOR (havuz
    // lazy) — v5-engine.ts gibi db.ts'i import eden modülleri test edebilmek için sahte
    // ama sözdizimsel olarak geçerli bir değer yeterli, gerçek bir veritabanı gerekmiyor.
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    },
  },
});
