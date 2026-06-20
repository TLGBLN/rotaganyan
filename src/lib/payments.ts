// Tek anahtar: ödeme akışı UI'dan kaldırıldığında bunu false bırak.
// Geri açmak için true yap — Stripe entegrasyon kodu dokunulmadan kalıyor.
// Client component'lardan da import edilebilmesi için "stripe" paketinden
// (Node-only) bağımsız, ayrı bir dosyada tutuluyor.
export const PAYMENTS_ENABLED = false;
