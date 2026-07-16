# Ekzen Servis Takip V9.1 — Bulut Veri Katmanı

- Dağıtım kayıtları D1 üzerinde cihazlar arasında ortak okunur.
- Tek kayıt düzenleme ve teslim durumu değişiklikleri ilgili D1 kaydını doğrudan günceller.
- Bir kayıt silindiğinde D1 kaydı, malzemeleri ve R2 fotoğrafları birlikte kalıcı silinir.
- Yerel kopya çevrimdışı güvenlik yedeği olarak korunur.
- İlk bağlantıda bulut boşsa mevcut yerel liste otomatik buluta aktarılır.

Kurulum: `cloudflare-worker-v9.js` dosyasını Worker editörüne yeniden yapıştırıp Deploy edin. Health sürümü `9.1.0` görünmelidir.
