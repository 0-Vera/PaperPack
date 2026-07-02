# PaperPack v14

Statik, bağımlılıksız PaperPack web uygulaması.

## v14 değişiklikleri

- Canlı kamera modu kaldırıldı. Telefon kullanımında fotoğraf çek/yükle akışı hedeflenir.
- Okuma motoru hızlandırıldı; eski sürümdeki ağır çoklu tarama azaltıldı.
- Fotoğraf okuma tarafında önce seçili/otomatik alan denenir, başarısız olursa daha sınırlı fallback yapılır.
- Yamuk/gölgeli fotoğraf düzeltme seçeneği eklendi.
- Görsel yüklenirken maksimum işleme boyutu düşürüldü, mobil kasma azaltıldı.
- Hücre okuma 5 noktalı hızlı örneklemeye geçirildi.

## Siyah çerçeve notu

Siyah okuma çerçevesi varsayılan olarak açık kalmalıdır. Çerçeve, fotoğrafta veri karesinin otomatik bulunmasını ve perspektif düzeltme denemesini kolaylaştırır. Görsel olarak istenmezse kapatılabilir; ancak telefonla okuma güvenilirliği düşebilir.

## Kullanım

1. Dosya veya manuel HTML ekle.
2. A4 oluştur.
3. PNG/SVG indir veya yazdır.
4. Telefonda siteyi aç, fotoğraf çek/yükle.
5. Gerekirse şifreyi gir, HTML yeni sekmede açılsın.

## Yayınlama

GitHub Pages ile `index.html`, `app.js`, `style.css` dosyalarını doğrudan yayınlayabilirsin. npm, build, backend veya CDN gerekmez.
