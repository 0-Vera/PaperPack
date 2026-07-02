# PaperPack Web v7

Bağımlılıksız statik web uygulaması. HTML/TXT/kod dosyasını A4 üzerinde basılabilir veri desenine çevirir; aynı uygulama fotoğraf/görselden geri okuyup dosyayı açar.

## Kullanım

1. `index.html`, `app.js`, `style.css`, `manifest.webmanifest`, `sw.js` dosyalarını GitHub deposuna yükle.
2. GitHub Pages ile yayınla.
3. Siteyi HTTPS üzerinden aç.
4. Dosya seç, A4 oluştur, PNG/SVG indir veya yazdır.
5. Okuma bölümünde görsel yükle/fotoğraf çek. Uygulama kalın siyah veri karesini otomatik seçmeye çalışır.
6. Yeşil çerçeve doğru alanı kapsıyorsa doğrudan **Oku** de. Gerekirse elle sadece kalın siyah çerçeveli veri karesini seç.

## v7 değişiklikleri

- Görsel yüklenince kalın siyah veri karesini otomatik seçme eklendi.
- Okuma daha hızlı hale getirildi; ilk denemelerde en olası grid boyutları önce deneniyor.
- Grid örnekleme Otsu adaptif eşik ile yapılıyor; sabit eşik yerine görüntünün kendi siyah/beyaz dağılımına göre karar veriyor.
- Print/PDF CSS düzeltildi.
- Okuyucu link QR alanı ve stilleri toparlandı.

## Notlar

- Kendi üretilen PNG/SVG en güvenilir testtir.
- Gerçek baskıda netlik, ışık ve perspektif hâlâ önemli.
- HTML yeni sekmede Blob URL ile açılır; yalnızca güvendiğin PaperPack verilerini aç.
