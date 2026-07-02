# PaperPack v6

PaperPack, küçük HTML/TXT/kod dosyalarını A4 üzerine basılabilir siyah-beyaz veri desenine çeviren ve aynı sayfayı tekrar okuyarak dosyayı geri açan bağımlılıksız statik web uygulamasıdır.

## Özellikler

- npm, build, backend, veritabanı, CDN yok.
- GitHub Pages uyumlu statik dosyalar.
- Tek büyük A4 modu ve 9 kutulu A4 modu.
- Opsiyonel AES-GCM şifreleme.
- Destekleyen tarayıcılarda gzip sıkıştırma.
- PNG/SVG çıktı.
- A4 üstüne opsiyonel okuyucu link QR'ı.
- Fotoğraf/görsel yükleyerek okuma.
- Otomatik veri alanı algılama + manuel alan seçimi.
- Şifre doğruysa HTML/dosya yeni sekmede Blob URL ile açılır.

## Önemli okuma notu

Manuel seçim gerekirse **kalın siyah çerçeveli veri karesini** seçin. Siyah kalın çerçeve dahil olmalı; dıştaki ince kart/sayfa çizgisi ve başlık dahil edilmemeli.

## GitHub Pages

Repo kök dizininde `index.html`, `style.css`, `app.js`, `manifest.webmanifest`, `sw.js` dosyaları varsa:

1. GitHub repo → Settings → Pages
2. Source: Deploy from a branch
3. Branch: main / root
4. Save

## Local test

Dosyaya çift tıklamak (`file://`) manifest/PWA tarafında tarayıcı kısıtlarına takılabilir. Gerçek kullanımda GitHub Pages `https://` üzerinden çalışır. Local test için geçici olarak:

```bash
python -m http.server 8080
```

sonra `http://localhost:8080` açılabilir.
