# PaperPack Web v10

Dosyayı/metni A4 üzerine basılabilir veri desenine çevirir; sonra fotoğraf/görsel olarak okutunca dosyayı geri çıkarır. Tamamen statik çalışır.

## Kurulum / Yayın

GitHub Pages için dosyaları depoya yükle:

- `index.html`
- `app.js`
- `style.css`
- `README.md`

Sonra GitHub → Settings → Pages → Deploy from branch → `main` / `/root`.

> Not: v10'de service worker/PWA cache geçici olarak kapatıldı. Eski sürümlerde app.js cache'te kaldığı için okuma motoru güncellemesi görünmeyebiliyordu.

## v10 değişiklikleri

- Varsayılan yoğunluk `Otomatik / önerilen` oldu.
- Küçük dosyalarda 256×256 yerine gerekli en küçük grid seçilir. Bu, hücreleri büyütür ve okumayı kolaylaştırır.
- Okuma motorunda hücre örnekleme daha toleranslı hale getirildi.
- Eski service worker cache'i temizleyen kod eklendi.
- `app.js?v=8` ve `style.css?v=8` cache kırma eklendi.

## Kullanım

1. Dosya seç veya HTML/metin yapıştır.
2. Yoğunluk olarak `Otomatik / önerilen` bırak.
3. A4 oluştur.
4. PNG/SVG indir veya yazdır.
5. Okuma bölümünde görseli yükle.
6. Normalde manuel seçim gerekmez. Gerekirse sadece kalın siyah çerçeveli veri karesini seç.

## Notlar

- Şifreli dosyada şifre doğru girilirse HTML yeni sekmede açılır.
- Viewer yoktur; HTML doğrudan Blob URL ile açılır.
- Güvenmediğin HTML dosyalarını açma.
- npm, backend, CDN veya harici kütüphane yoktur.


## v10 mobil güncelleme

- Mobilde A4 önizleme gizlendi.
- Mobilde manuel seçim/önizleme alanı gizlendi; okuyucu otomatik okuma akışına indirildi.
- Butonlar, inputlar ve paneller telefon ekranına göre yeniden düzenlendi.
- iOS zoom sorununu azaltmak için form yazı boyutları mobilde 16px yapıldı.

Güçlü şifre önerisi: en az 20 karakter, tahmin edilemeyen ve karışık bir parola kullanın. Zayıf parola kullanılırsa şifreleme algoritması güçlü olsa bile offline parola denemelerine açık kalır.


## v10 çıktı düzeni

- A4 sayfa yapısı artık Sade / Açıklamalı / Standart / Tam bilgi olarak seçilebilir.
- Dosya adı ve teknik bilgiler tamamen opsiyoneldir. Gizlenirse 'gizli' yazısı basılmaz.
- Okuyucu QR bölümü kaldırılabilir ve daha temiz görünecek şekilde düzenlenmiştir.
- Açıklama metni veri karesinin altına eklenebilir.
