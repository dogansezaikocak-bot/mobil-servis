Ekzen Servis Takip V7.1.1

- Manuel düzenleme kayıt sorunu giderildi.
- Kaydet butonu doğrudan kayıt fonksiyonunu çalıştırır.
- Müşteri, adres, mahalle, telefon, durum, malzemeler ve not localStorage üzerine kalıcı yazılır.
- Elle girilen mahalle korunur; yalnızca boşsa adresten otomatik çıkarılır.

# Ekzen Servis Takip V7.0.7

- Teslim edilen kayıtlar doğrudan “Beklemeye Al” düğmesiyle geri alınabilir.
- Düzenle ekranında durum Bekliyor seçilince tüm teslim işaretleri ve teslim zamanı temizlenir.
- Teslim filtresindeyken kayıt geri alınırsa görünürlük için filtre otomatik Tüm Durumlar'a döner.


## V7.0.7
- `Mah.`, `Mh.`, `Mahallesi` ve `Mahalle` ifadelerinin tamamı kesin mahalle işaretçisi olarak tanınır.
- Düzeltilmiş adreste mahalle bulunamazsa fotoğraftan okunan ham adres de kontrol edilir.
- Eski yanlış veya boş grup bilgileri uygulama açılırken adres üzerinden yeniden hesaplanır.


V7.0.9 düzeltmesi:
- Manuel toplu içe aktarmada `Müşteri | Adres` biçimi doğrudan desteklenir.
- Adresteki `Mahallesi`, `Mah.`, `Mah` veya `Mh.` ifadesinden mahalle grubu otomatik oluşturulur.
- Eski `Müşteri | Grup | Adres | Malzeme` biçimi de çalışmaya devam eder.


V7.1.0 yenilikleri:
- 7 sütunlu standart içe aktarma: Müşteri | Adres | LED 1 | Adet | LED 2 | Adet | Baskı Levhası
- LED ölçüleri ve adetleri ayrı malzeme olarak kaydedilir.
- Baskı levhası ayrı malzeme türü ve ayrı bölüm olarak gösterilir.
- Aynı müşteri/adresteki dolap satırları tek kartta doğru adetlerle birleştirilir.
- Mahalle adres içinden otomatik çıkarılır.


V7.1.1 düzeltmesi:
- Baskı levhası adedi, kısa LED (ikinci LED) adedinden otomatik hesaplanır.
- Örnek: 140 cm x4 + 52,5 cm x2 + 1600 2D => Baskı Levhası 1600 2D x2.
