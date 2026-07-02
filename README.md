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
3. Çıktı butonları ham kare iç testi ve A4 otomatik okuma testi başarılı olana kadar kapalı kalır.
4. 1-9 dosya esnek yerleşir. Boş kutular basılmaz.
5. Dosya adı gizlenirse çıktı üzerinde `gizli` gibi bir yazı çıkmaz; tamamen boş kalır.
6. HTML uygulama içinde viewer/iframe ile açılmaz. Doğru şifre sonrası Blob URL ile yeni sekmede açılır.
7. Şifreleme Web Crypto API ile PBKDF2-SHA256 + AES-GCM kullanır.
8. Sıkıştırma desteklenirse CompressionStream/DecompressionStream kullanılır; destek yoksa uygulama bozulmadan sıkıştırmasız devam eder.

## Kullanım

1. Dosya seçin veya manuel HTML/metin ekleyin.
2. Her dosya için açıklama, görünürlük ve şifre ayarını yapın.
3. Veri yoğunluğu seçin.
4. `A4 veri sayfası oluştur` butonuna basın.
5. İç test başarılıysa PNG/SVG/yazdırma butonları açılır.
6. Daha sonra `Oku / Aç` bölümünden PNG/JPG yükleyin.
7. Şifreli paketlerde şifreyi girip `Aç` butonuna basın.

## Telefon fotoğrafı için öneriler

- Siyah dış çerçeveyi açık bırakın.
- A4'ü çok eğik çekmeyin; hafif perspektif tolere edilir.
- Parlama ve sert gölgeyi azaltın.
- Ultra yoğunlukta baskı ve fotoğraf kalitesi daha kritik olur.
- Otomatik okuma başarısız olursa 4 köşe seçme modunu kullanın.

## Sınırlar

Bu ilk çalışan sürüm küçük HTML/TXT/CSS/JS/JSON dosyaları için tasarlandı. Çok büyük dosyalarda kapasite uyarısı verir ve sessizce bozuk çıktı üretmez. Canlı kamera tarama bilinçli olarak eklenmedi; öncelik görsel yükleyip güvenilir okumadır.
