import { NextResponse, type NextRequest } from "next/server";

/**
 * v6.109 — kullanıcı talebi 2026-08-11 ("uçtan uca dışarıdan gelebilecek tüm
 * saldırılara karşı koruyucu önlemler al"): tüm /api/cron/* ve /api/ingest
 * rotaları aynı "if (CRON_SECRET && auth !== ...)" desenini tekrarlıyordu —
 * bu FAIL-OPEN bir desen: CRON_SECRET ortam değişkeni herhangi bir sebeple
 * tanımsız kalırsa (yanlış deploy, env sıfırlanması vb.) kontrol tamamen
 * atlanıyor, rota KİMLİK DOĞRULAMASIZ herkese açık kalıyordu — veri
 * senkronizasyonlarını (sonuç, program, AGF) tetikleyip veri bütünlüğünü
 * bozabilir veya maliyetli işleri (agf-sync, maxDuration=800) tekrar tekrar
 * çağırıp kaynak tüketebilirdi. Bu fonksiyon FAIL-CLOSED: secret tanımsızsa
 * istek REDDEDİLİR, asla sessizce izin verilmez.
 */
function verifySharedSecret(req: NextRequest, secret: string | undefined, envVarName: string): NextResponse | null {
  if (!secret) {
    console.error(`[cron-auth] ${envVarName} tanımlı değil — istek reddedildi (fail-closed).`);
    return NextResponse.json({ error: "Sunucu yapılandırma hatası" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function verifyCronRequest(req: NextRequest): NextResponse | null {
  return verifySharedSecret(req, process.env.CRON_SECRET, "CRON_SECRET");
}

/** /api/ingest için — ayrı bir ortam değişkeni (INGEST_SECRET) kullanıyor, aynı fail-closed mantık. */
export function verifyIngestRequest(req: NextRequest): NextResponse | null {
  return verifySharedSecret(req, process.env.INGEST_SECRET, "INGEST_SECRET");
}
