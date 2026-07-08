(function () {
  var menuBtn = document.querySelector('.menu-btn');
  var nav = document.querySelector('.site-nav');

  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  document.querySelectorAll('img').forEach(function (img) {
    img.addEventListener('error', function () {
      img.classList.add('is-missing');
      var media = img.closest('.media');
      if (media) media.classList.add('is-missing');
    }, { once: true });
  });

  var lightbox = document.querySelector('.lightbox');
  var lightboxImg = document.querySelector('.lightbox img');
  var closeBtn = document.querySelector('.lightbox-close');

  document.querySelectorAll('.gallery-item img').forEach(function (img) {
    img.parentElement.addEventListener('click', function () {
      if (img.classList.contains('is-missing')) return;
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt || 'PalaceGarden galeri görseli';
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });
  });

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxImg.removeAttribute('src');
    document.body.style.overflow = '';
  }

  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeLightbox();
  });
})();
