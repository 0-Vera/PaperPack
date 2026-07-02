# PaperPack Web

Dosyayı A4 üzerindeki siyah-beyaz veri desenine çeviren ve aynı web uygulamasıyla fotoğraftan geri okuyabilen bağımlılıksız statik uygulama.

## Özellikler

- HTML/TXT/JS/CSS/JSON gibi küçük dosyaları alır.
- Manuel metin/HTML girişi destekler.
- Opsiyonel şifreleme: Web Crypto API + AES-GCM + PBKDF2-SHA256.
- Tarayıcı destekliyorsa otomatik gzip sıkıştırma yapar.
- Tek dosya / tek büyük A4 modu.
- 9 dosya / 3x3 A4 modu.
- PNG, gerçek vektörel SVG ve tarayıcıdan yazdır/PDF olarak kaydet desteği.
- Fotoğraf veya görsel yükleyerek geri okuma.
- Okuma önizlemesi ve manuel alan seçimi vardır; kod alanını sürükleyerek seçip daha stabil okutabilirsin.
- Akıllı okuma modu tek kutu ve 9'lu düzeni birlikte dener.
- Çözülen HTML dosyasını uygulama içinde viewer açmadan yeni sekmede Blob URL olarak açar.
- GitHub Pages uyumlu.
- npm, backend, CDN, harici kütüphane yok.
- PWA cache dosyaları eklidir; GitHub Pages/HTTPS üzerinden açıldıktan sonra temel dosyalar offline cache'e alınır.

## Kullanım

1. `index.html` dosyasını aç.
2. Dosya seç veya metin/HTML yapıştır.
3. İstersen şifre gir.
4. A4 oluştur.
5. PNG/SVG indir veya yazdır.
6. Okuma bölümünden basılı A4 fotoğrafını ya da üretilen PNG'yi yükle.
7. Gerekirse önizlemede kodun etrafını sürükleyerek manuel alan seç.
8. Şifre varsa gir.
9. HTML yeni sekmede açılır veya dosya olarak indirilir.

## GitHub Pages

Bu klasörü public bir GitHub deposuna koyup Pages'i root veya `/docs` klasörü üzerinden yayınlayabilirsin. Build işlemi yoktur.

## Önemli notlar

- Bu hâlâ MVP'dir; v5 ile baskı/PDF CSS sorunu düzeltilmiş ve SVG çıktısı PNG gömülü değil, gerçek karelerden oluşan vektörel çıktı haline getirilmiştir.
- En stabil okuma uygulamanın ürettiği PNG/SVG çıktısından veya çok net/düz çekilmiş A4 fotoğrafından alınır.
- Bu sürümde otomatik alan bulma, doğru grid örnekleme, akıllı tek/9'lu okuma, manuel alan seçimi, baskı CSS düzeltmesi ve gerçek vektörel SVG çıktısı geliştirildi.
- Gerçek baskıda gölge, bulanıklık, yamuk açı ve düşük yazıcı kalitesi okuma başarısını düşürebilir.
- Şifre güvenliği kullanılan parolanın gücüne bağlıdır. Zayıf parola offline brute force ile kırılabilir.
