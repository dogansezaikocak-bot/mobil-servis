# Ekzen Servis Takip V9.4 — Bulut Senkronizasyonu

Bu sürüm V9.2 Worker + D1 + R2 mimarisini korur ve çevrimdışı işlem kuyruğu ekler.

## Özellikler
- Kayıt ekleme, düzenleme ve silme işlemleri internet yokken cihazda sıraya alınır.
- İnternet geri geldiğinde bekleyen işlemler otomatik olarak Worker API üzerinden D1'e gönderilir.
- Uygulama görünür olduğunda ve her 60 saniyede senkronizasyon kontrol edilir.
- Fotoğraflar cihazda IndexedDB içinde korunur; buluta eksik olanlar otomatik yüklenir.
- Kayıt tamamen silindiğinde D1, malzemeler ve R2 fotoğrafları birlikte silinir.

## Worker testi
`/api/health?token=APP_TOKEN` sonucu aşağıdaki gibi olmalıdır:

```json
{"ok":true,"version":"9.3.0","bindings":{"DB":true,"PHOTOS":true}}
```

Önce `cloudflare-worker-v9.js` dosyasını Worker'a Deploy edin. Ardından diğer uygulama dosyalarını GitHub Pages üzerine yükleyin. Mevcut listeyi silmeyin.
