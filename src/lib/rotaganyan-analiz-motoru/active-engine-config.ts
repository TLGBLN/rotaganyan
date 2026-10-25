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
