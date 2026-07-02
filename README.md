# PaperPack Web MVP v12

PaperPack, küçük HTML/TXT/kod dosyalarını A4 üzerinde basılabilir veri karelerine dönüştüren ve aynı web uygulamasıyla geri okuyan statik, bağımlılıksız bir web uygulamasıdır.

## v12 öne çıkanlar

- Telefon için canlı kamera okuma modu eklendi.
- `Kamerayı aç`, `Şimdi tara`, `Otomatik tara`, `Kamerayı kapat` akışı eklendi.
- Fotoğraf ve kamera okumasında perspektif düzeltme denemesi eklendi.
- Yamuk çekilen kareyi düz kareye çevirip okuma denemesi yapar.
- Otomatik tarama 1.2 saniyede bir görüntü alıp çözer.
- v11’deki esnek çoklu dosya/kart yapısı korundu.
- Maksimum 9 kare/dosya, zorunlu 9 değil.
- Her kare için ayrı dosya adı, açıklama, şifre ve gösterim ayarı korunur.

## Kurulum

Hiçbir kurulum gerekmez. GitHub Pages üzerinde yayınlanabilir.

Dosyalar:

- `index.html`
- `style.css`
- `app.js`
- `README.md`
- opsiyonel PWA dosyaları: `manifest.webmanifest`, `sw.js`

## Kullanım

### Encode

1. Dosya seç veya manuel HTML/metin kartı ekle.
2. Gerekirse kare bazlı şifre/açıklama ayarlarını yap.
3. A4 oluştur.
4. PNG/SVG indir veya yazdır.

### Decode

#### Fotoğraf ile

1. Okuma bölümünden fotoğraf yükle/çek.
2. Oku butonuna bas.
3. Şifre varsa gir.
4. HTML yeni sekmede açılır.

#### Canlı kamera ile

1. Kamerayı aç.
2. Veri karesini ekrandaki kılavuz çerçeveye getir.
3. `Şimdi tara` ya da `Otomatik tara` kullan.
4. Paket bulununca sonuç kartı çıkar.
5. Şifre varsa gir; doğruysa HTML yeni sekmede açılır.

## Notlar

- Google Lens seviyesinde garanti değildir; ancak v12 ile canlı kamera ve perspektif düzeltme eklendi.
- En iyi sonuç için kare net, ışık dengeli ve kadrajda büyük olmalıdır.
- Çok eğik, bulanık, gölgeli veya kesilmiş çekimler başarısız olabilir.
- Güvenlik için 20+ karakter karışık, tahmin edilemeyen şifre önerilir.

