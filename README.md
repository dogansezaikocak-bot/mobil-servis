# Ekzen Servis Takip V9.2 — Doğru Bulut Mimarisi

Bu sürümde telefon/masaüstü uygulaması D1 veya R2'ye doğrudan erişmez. Tüm işlemler HTTPS üzerinden Cloudflare Worker API'sine gönderilir.

## Worker kurulumu
1. `cloudflare-worker-v9.js` içeriğini mevcut Worker kodunun tamamının yerine yapıştırın ve Deploy edin.
2. Worker binding adları tam olarak:
   - D1: `DB` → `ekzen-servis-db`
   - R2: `PHOTOS` → `ekzen-servis-fotograflar`
   - Secret: `APP_TOKEN`
3. Test:
   `https://WORKER-ADRESI/api/health?token=UYGULAMA_ANAHTARI`
4. Doğru yanıt içinde `"version":"9.2.0"` ve `"bindings":{"DB":true,"PHOTOS":true}` görünmelidir.

Worker gerekli tabloları ve eksik kolonları otomatik kontrol eder. D1 Console'da yeniden SQL çalıştırmanız gerekmez.

## Uygulama kurulumu
GitHub Pages'e ZIP içindeki uygulama dosyalarının tamamını yükleyin. Dağıtım sayfasında `Bulut Ayarları` butonuna Worker adresini ve APP_TOKEN değerini girin. Bağlantı test edilmeden ayarlar kaydedilmez.

İlk bağlantıda:
- Bulutta kayıt varsa cihaz buluttaki listeyi alır.
- Bulut boş, cihazda liste varsa cihazdaki liste otomatik D1'e yüklenir.
- Cihazda bulunan yerel teslim fotoğrafları R2'ye taşınır.
