# Ekzen Servis Takip V6.1.2

## Güvenli AI bağlantısı

Bu sürümde OpenAI API anahtarı uygulamaya veya telefona girilmez. Fotoğraf okuma yalnızca Cloudflare Worker üzerinden çalışır.

### Uygulama kullanımı
1. Dağıtım > Fotoğraftan AI Oku bölümünü açın.
2. Cloudflare Worker adresini bir kez girin. Adres cihazda saklanır.
3. Fotoğrafları seçin ve AI ile Oku düğmesine basın.

### Cloudflare Worker kurulumu
1. `cloudflare-worker-openai-proxy.js` dosyasını Cloudflare Workers içine yapıştırın.
2. Worker ayarlarında `OPENAI_API_KEY` adlı encrypted secret oluşturun.
3. Worker URL adresini uygulamadaki Güvenli AI bağlantı adresi alanına girin.

API anahtarı uygulama kodunda, tarayıcıda veya localStorage içinde tutulmaz.


## V6.1.3
- iPhone HEIC/HEIF fotoğrafları uygulama içinde JPEG'e çevrilir.
- OpenAI'a yalnızca geçerli JPEG veri adresi gönderilir.
- Bozuk önizleme ve 'valid image' hatası giderildi.
