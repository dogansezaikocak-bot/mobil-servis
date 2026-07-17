# Ekzen Servis Takip V9.6 — Firma ve Adres İçe Aktarma

## V9.6 içe aktarma

- Dağıtım içe aktarma şablonu yalnızca `Firma İsmi | Adres` biçimindedir.
- Malzeme sütunları kaldırıldı.
- Mahalle grupları adres metninden otomatik oluşturulur.
- Mahalle ve arama filtreleri korunmuştur.

## V9.5 ortak sistem

- Dağıtım kayıtları servislerle aynı Firebase state kaydına bağlandı.
- Ayrı Worker, ayrı bulut ayarı ve ayrı senkronize düğmesi kullanılmaz.
- Servisler gibi otomatik olarak diğer cihazlara aktarılır.
- Yerel kayıt yedeği korunur ve eski dağıtım listesi ilk açılışta ortak sisteme taşınır.

## V9.3 dağıtım düzenlemesi

- Operasyon Özeti ve Yakınımdaki Dükkânlar kaldırıldı.
- Dükkân kartları isim ve adres odaklı sadeleştirildi.
- Konuma Git, Düzenle ve İşlem Tamam işlemleri bırakıldı.
- İşlem Tamam ile kayıt Bekleyen İşler'den çıkar ve Teslim Edilenler'e geçer.

## Uygulama kurulumu
GitHub Pages'e ZIP içindeki uygulama dosyalarının tamamını yükleyin. Ek bir bağlantı ayarı yapılmaz; servis ve dağıtım kayıtları aynı Firebase bağlantısıyla otomatik çalışır.
