# PaperPack

PaperPack küçük metin tabanlı dosyaları A4 üzerinde taşınabilir veri karelerine dönüştüren, sonra PNG/JPG görselinden geri okuyabilen saf HTML/CSS/JavaScript uygulamasıdır.

## Kurulum yok

- npm yok
- build sistemi yok
- framework yok
- backend/database yok
- CDN yok
- service worker/manifest yok
- ES module/fetch kullanılmadı

Klasörü GitHub Pages'e koyabilirsiniz veya bilgisayarda `index.html` dosyasını çift tıklayıp açabilirsiniz.

## Dosya yapısı

```text
PaperPack/
├── index.html
├── README.md
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── app.js
│       ├── state.js
│       ├── encoder.js
│       ├── decoder.js
│       ├── crypto.js
│       ├── compression.js
│       ├── renderer.js
│       ├── reader.js
│       ├── perspective.js
│       ├── crc.js
│       ├── ui.js
│       └── tests.js
└── samples/japonca-test.html
```

## Önemli tasarım kararları

1. Veri karesi klasik QR değildir. PaperPack'in kendi sabit `PPCS` formatıdır.
2. Encoder ve decoder aynı modül sabitlerini kullanır.
3. Çıktı üretirken önce ham kare iç testi, sonra A4 otomatik okuma testi çalışır.
4. 1-9 dosya eklenebilir. Büyük dosyalar tek kareye sığmazsa dosya otomatik parçalara ayrılır.
5. Parçalama boş slot veya sahte doldurma karesi üretmez; yalnızca gerçek veri parçaları basılır.
6. 9'dan fazla veri karesi oluşursa çıktı otomatik olarak birden fazla A4 sayfasına bölünür.
7. Dosya adı gizlenirse çıktı üzerinde `gizli` gibi bir yazı çıkmaz; tamamen boş kalır.
8. HTML uygulama içinde viewer/iframe ile açılmaz. Doğru şifre sonrası Blob URL ile yeni sekmede açılır.
9. Şifreleme Web Crypto API ile PBKDF2-SHA256 + AES-GCM kullanır.
10. Sıkıştırma desteklenirse CompressionStream/DecompressionStream kullanılır; destek yoksa uygulama bozulmadan sıkıştırmasız devam eder.

## Büyük dosya mantığı

`Otomatik` yoğunluk modu küçük dosyalarda okunması daha rahat olan gridleri seçer. Paket tek kareye sığmazsa varsayılan olarak okunabilirliği korumak için dosyayı birden fazla veri karesine böler.

Örneğin 20 KB civarı bir dosya, sıkıştırma durumuna göre tek kare yerine birkaç veri karesi olarak basılabilir. Okuma bölümünde tüm parçalar okutulunca dosya otomatik birleşir ve açma/indirme butonları görünür.

Çok fazla parça oluşursa uygulama çıktı üretmeyi engellemez; ancak kamerayla okutmanın zorlaşabileceğini açıkça uyarır.

## Kullanım

1. Dosya seçin veya manuel HTML/metin ekleyin.
2. Her dosya için açıklama, görünürlük ve şifre ayarını yapın.
3. Veri yoğunluğunu seçin. Emin değilseniz `Otomatik` modda bırakın.
4. `A4 veri sayfası oluştur` butonuna basın.
5. İç test başarılıysa PNG/SVG/yazdırma butonları açılır.
6. Daha sonra `Oku / Aç` bölümünden PNG/JPG yükleyin.
7. Parçalı dosyada eksik sayfa/kare varsa uygulama kaç parçanın okunduğunu gösterir.
8. Şifreli paketlerde şifreyi girip `Aç` butonuna basın.

## Telefon fotoğrafı için öneriler

- Siyah dış çerçeveyi açık bırakın.
- A4'ü çok eğik çekmeyin; hafif perspektif tolere edilir.
- Parlama ve sert gölgeyi azaltın.
- Ultra yoğunlukta baskı ve fotoğraf kalitesi daha kritik olur.
- Parçalı dosyada tüm kareleri/sayfaları okutun.
- Otomatik okuma başarısız olursa 4 köşe seçme modunu kullanın.

## Sınırlar

Canlı kamera tarama bilinçli olarak eklenmedi; öncelik görsel yükleyip güvenilir okumadır. Çok büyük dosyalarda PaperPack teknik olarak çok sayıda veri karesi üretebilir, fakat kamerayla okutma pratik olmayabilir. Bu durumda uygulama uyarı verir; dosyayı küçültmek veya daha yüksek yoğunluk seçmek daha mantıklı olabilir.
