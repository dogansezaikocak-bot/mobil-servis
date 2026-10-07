Ekzen Servis Takip V5.3.0 Native Navigation - yeşil ekran düzeltmeli. V5.2.4.3 stabil sürüm tabanlıdır. Servis ve kasa sayfaları sağdan gelir, geri dönüşte sağa çıkar.


## V5.3.1 Mobil Geri Dönüş
- Servis detayında üstte sabit `‹ Geri` butonu eklendi.
- Mobil tarayıcı geri hareketi/tuşu servis detayını kapatır.

## V5.3.2 Mobil Servis Detayı Katman Düzeltmesi
- Servis kartına dokununca detay ekranı artık anında en üst katmanda açılır.
- Native Navigation katmanının arkasında kalma sorunu giderildi.
- V5.3.1 sabit Geri butonu korundu.


## V5.3.3 Mobil Servis Listesi Görsel Düzeltme
- Kartlar ekran içine alındı ve yatay taşma engellendi.
- Kart kenarları daha belirgin, gölge daha sade yapıldı.
- İç boşluklar ve tipografi dengelendi.
- Uzun adres/not satırları kartı büyütmeden üç nokta ile sınırlandı.


## V5.3.4 Mobil Liste Gerçek Düzeltme
- Önceki V5.3.3 yaması yanlış kapsayıcı kimliğini hedefliyordu.
- Gerçek `#mobileServiceList` hedeflenerek kartlar ekrandan 14px içeri alındı.
- Kart ölçüleri, yazılar ve alt eylemler sadeleştirildi.

## V5.3.5 Mobil Kasa İşlemleri
- Mobil Günlük Kasa sayfasına para hareketleri listesi eklendi.
- Seçilen tarihin hasılat, komisyon, malzeme, diğer gider ve net kazanç sayaçları korunur.
- Aynı tarihteki kasa hareketleri tutar ve kaynak bilgisiyle mobilde listelenir.

## V5.3.6 Tam Mobil Kasa
- Ana sayfaya belirgin Kasa / Para Hareketleri giriş kartı eklendi.
- Bugün, Bu Hafta, Bu Ay ve Tümü hızlı filtreleri eklendi.
- Başlangıç/bitiş tarih aralığı ve kaynak filtresi eklendi.
- Geçmiş kasa hareketleri seçilen döneme göre listelenir.
- Hasılat, komisyon, malzeme, diğer gider ve net hakediş birlikte güncellenir.

## V5.3.7 Mobil Kasa Filtre Düzeltmesi
- Kasa ekranındaki kaynak filtresi servis listesi filtresinden tamamen ayrıldı.
- Kasa açıkken servis ekranının Kaynaklar/Bugün kontrolleri gizlenir.
- Kaynak seçimi para hareketlerini ve kasa sayaçlarını anında filtreler.
- Başlangıç/bitiş tarihleri değişince filtre anında uygulanır.
- `Tümü` filtresinin yanlışlıkla bugüne dönmesi düzeltildi.
- Kaynak seçenekleri ayarlar, servis kayıtları ve kasa kayıtlarından birlikte oluşturulur.

## V5.3.8 Mobil Gelir / Gider Girişi
- Mobil Kasa ekranına Gelir Ekle ve Gider Ekle menüsü eklendi.
- Mevcut masaüstü Para Hareketi formu kullanılır; veri yapısı aynıdır.
- Açılan form seçilen işlem tipini, kasa tarihini ve kaynak filtresini otomatik taşır.
- Kayıttan sonra mobil kasa özeti ve hareket listesi yenilenir.

## V5.3.9 Erteleme Tarihi Düzeltmesi
- Ertelenen servis artık hem eski gün hem yeni gün üzerinde görünmez.
- Planlama tarihi varsa servis yalnızca `availableDate/visitDate/date` gününde listelenir.
- `createdAt` yalnızca hiç planlama tarihi olmayan eski kayıtlar için yedek tarihtir.
- Erteleme kaydedilince ekran otomatik yeni tarihe atlamaz; servis bugünkü listeden hemen çıkar.

## V5.3.10 Mobil Sayaç Erteleme Düzeltmesi
- Ana sayfadaki servis sayaçları artık servis listesiyle aynı tarih kuralını kullanır.
- Ertelenen servis eski günün sayaç adedinden hemen düşer.
- Servis yalnızca yeni planlanan tarihin sayacına dahil olur.
