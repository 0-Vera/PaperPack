# PaperPack v13

Statik, bağımlılıksız web uygulaması. Dosyayı A4 üzerindeki veri desenine çevirir; fotoğraf/kamera ile geri okur.

## v13 düzeltmeleri

- v12 çıktılarının okunamamasına yol açan grid okuma uyumsuzluğu giderildi.
- Okuyucu artık veri alanı, siyah çerçeve alanı, tam kod alanı ve elde fazla seçilmiş alan gibi birkaç geometriyi dener.
- Siyah okuma çerçevesi opsiyonel hale geldi. Varsayılan açık kalır; kapatırsan sadece köşe hedefleri basılır.
- Adaptif eşik ve kare merkez örnekleme iyileştirildi.

## Not

Telefon okuması için siyah çerçeve genelde yardımcıdır; tamamen kaldırmak estetik olarak daha sade olabilir ama otomatik algılamayı zorlaştırabilir.

## Yayın

GitHub Pages ile doğrudan yayınlanır; npm/backend/CDN gerekmez.
