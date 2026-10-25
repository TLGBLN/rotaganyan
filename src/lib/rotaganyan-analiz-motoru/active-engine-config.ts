// ROTAGANYAN ANALİZ MOTORU — aktif tahmin motoru seçici (TEK config sabiti).
//
// NE İŞE YARAR: hangi motorun "aktif" sayıldığını belirten TEK kaynak. Bu dosya KASITLI
// OLARAK hiçbir route tarafından henüz OKUNMUYOR — var olması tek başına hiçbir production
// davranışını DEĞİŞTİRMEZ (kullanıcı talimatı madde 1). Yeni motor (Rotaganyan Analiz
// Motoru) şu an yalnız izole test route'undan (/api/admin/test-ran-engine) çalıştırılabilir
// — bu sabit o route'un bile henüz zorunlu okuduğu bir şey DEĞİL, ileride production
// akışları (prediction.actions.ts/admin-analiz.actions.ts) bu motora geçerken DANIŞACAĞI
// anahtar nokta olması için şimdiden var ediliyor.
//
// VARSAYILAN DEĞER KESİNLİKLE "v546-1" OLMALI — bu, mevcut production motorunun (V5.46.1,
// scoreV461) hâlâ TEK gerçek karar verici olduğu anlamına gelir. "rotaganyan-analiz-motoru"
// değerine geçiş, yalnız kullanıcının AÇIKÇA onayladığı bir sonraki fazda yapılır (bkz.
// teslim raporu "production geçişinden önce kalan işler").

export type ActivePredictionEngine = "v546-1" | "rotaganyan-analiz-motoru";

/** DEĞİŞTİRİLMEYECEK varsayılan: "v546-1". Bu değer elle "rotaganyan-analiz-motoru" yapılsa
 *  bile (henüz) hiçbir route bunu okumadığı için gerçek davranış değişmez — bu sabit şu an
 *  salt kayıt/hazırlık amaçlı. */
export const ACTIVE_PREDICTION_ENGINE: ActivePredictionEngine = "v546-1";

// FAZ 4 (2026-10-25, "KONTROLLÜ geçiş mekanizmasını TAMAMLA — ama varsayılan motoru
// DEĞİŞTİRME" — kullanıcı talimatı): resolveActivePredictionEngine(), ACTIVE_PREDICTION_ENGINE
// sabitinin KENDİSİNİ asla değiştirmeden, İSTEĞE BAĞLI bir ortam değişkeni (RAN_FORCE_ACTIVE_ENGINE)
// ile GEÇİCİ/İZOLE bir geçersiz kılma imkânı sağlar — yalnız bu ortam değişkeni AÇIKÇA
// ayarlanmışsa devreye girer, ayarlanmamışsa (production'daki HER durumda, çünkü bu env var
// HİÇBİR .env/deploy dosyasında TANIMLI DEĞİL — bkz. teslim raporu statik doğrulama) sabit
// değer DEĞİŞMEDEN döner. Bu, "motoru production'da fiilen DEĞİŞTİRMEDEN, izole bir
// admin-only test akışında (örn. /api/admin/test-ran-engine'in İLERİDE bu fonksiyonu
// okuyabilecek bir varyantı) kontrollü şekilde deneyebilme" mekanizmasının TAMAMLANMIŞ
// hali — ama şu an HİÇBİR route bunu ÇAĞIRMIYOR (grep ile doğrulanabilir), bu yüzden var
// olması TEK BAŞINA hiçbir production davranışını değiştirmiyor (madde 1 ile ÇELİŞMEZ).
//
// GEÇERLİ env değerleri SADECE ActivePredictionEngine'in kendisi — başka bir string
// verilirse (yazım hatası/eski bir değer) SESSİZCE yok sayılır ve varsayılana DÜŞÜLÜR
// (bu motor şimdilik "deneysel/opsiyonel" statüsünde — snapshot/model yüklemenin KATI
// throw disiplininden FARKLI olarak, burada geçersiz bir env değeri production'ı
// DURDURMAMALI, yalnız yoksayılmalı).
const VALID_ENGINES: readonly ActivePredictionEngine[] = ["v546-1", "rotaganyan-analiz-motoru"];

export function resolveActivePredictionEngine(env: Record<string, string | undefined> = process.env): ActivePredictionEngine {
  const override = env.RAN_FORCE_ACTIVE_ENGINE;
  if (override != null && (VALID_ENGINES as readonly string[]).includes(override)) {
    return override as ActivePredictionEngine;
  }
  return ACTIVE_PREDICTION_ENGINE;
}
