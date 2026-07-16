# Ekzen Servis Takip V9.0 — Bulut Sürümü

## Yeni özellikler
- Dağıtım kayıtları Cloudflare D1 üzerinde saklanır.
- Teslim fotoğrafları Cloudflare R2 üzerinde saklanır.
- iPhone, Android ve bilgisayar aynı kayıtları açar.
- Yerel kayıtlar korunur; internet kesilirse uygulama yerel veriden çalışmaya devam eder.
- İlk bulut bağlantısında bulut boşsa telefondaki mevcut liste otomatik yüklenir.

## Worker binding adları
- D1 binding: `DB` → `ekzen-servis-db`
- R2 binding: `PHOTOS` → `ekzen-servis-fotograflar`
- Secret: `APP_TOKEN` → kullanıcı tarafından belirlenecek güçlü erişim anahtarı

## Kurulum
1. `cloudflare-worker-v9.js` içeriğini yeni veya mevcut Cloudflare Worker koduna yapıştırıp Deploy et.
2. Worker Settings / Bindings bölümünde D1 ve R2 bindinglerini yukarıdaki adlarla ekle.
3. Settings / Variables and Secrets bölümünde `APP_TOKEN` adlı Secret oluştur.
4. GitHub Pages'e diğer uygulama dosyalarını yükle.
5. Dağıtım ekranında “Bulut Ayarları”na basıp Worker adresini ve aynı APP_TOKEN değerini gir.
