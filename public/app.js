let categories = [];
let currentCategory = null;

const gallery = document.getElementById('gallery');
const emptyMsg = document.getElementById('empty-msg');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');
const lightboxClose = document.getElementById('lightbox-close');
const hamburger = document.getElementById('hamburger');
const nav = document.getElementById('nav');

function renderNav() {
  const aboutLink = nav.querySelector('[data-nav="about"]');
  nav.querySelectorAll('.nav-link[data-category]').forEach(el => el.remove());

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'nav-link';
    btn.dataset.category = cat.slug;
    btn.textContent = cat.label;
    btn.addEventListener('click', () => {
      loadGallery(cat.slug);
      nav.classList.remove('open');
    });
    nav.insertBefore(btn, aboutLink);
  });
}

async function loadGallery(category) {
  currentCategory = category;

  document.querySelectorAll('.nav-link[data-category]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });

  gallery.innerHTML = '';
  emptyMsg.style.display = 'none';

  try {
    const res = await fetch(`/api/images/${category}`);
    const images = await res.json();

    if (!images.length) {
      emptyMsg.style.display = 'block';
      return;
    }

    images.forEach(img => {
      const item = document.createElement('div');
      const size = img.size || 'medium';
      item.className = `gallery-item gallery-${size}`;

      const imgEl = document.createElement('img');
      imgEl.src = img.url;
      imgEl.alt = img.title;
      imgEl.loading = 'lazy';

      const caption = document.createElement('div');
      caption.className = 'caption';
      caption.textContent = formatCaption(img);

      item.appendChild(imgEl);
      item.appendChild(caption);

      item.addEventListener('click', () => openLightbox(img.url, formatCaption(img)));

      gallery.appendChild(item);
    });
  } catch (err) {
    console.error('Failed to load gallery:', err);
  }
}

function formatCaption(img) {
  const parts = [img.title];
  if (img.date) parts.push(img.date);
  if (img.location) parts.push(img.location);
  return parts.join(', ');
}

function openLightbox(url, captionText) {
  lightboxImg.src = url;
  lightboxCaption.textContent = captionText;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  lightboxImg.src = '';
  document.body.style.overflow = '';
}

lightboxClose.addEventListener('click', e => {
  e.stopPropagation();
  closeLightbox();
});

lightbox.addEventListener('click', closeLightbox);

lightboxImg.addEventListener('click', e => e.stopPropagation());

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLightbox();
});

hamburger.addEventListener('click', () => {
  nav.classList.toggle('open');
});

async function init() {
  try {
    const res = await fetch('/api/categories');
    categories = await res.json();
    renderNav();

    if (categories.length) {
      await loadGallery(categories[0].slug);
    } else {
      emptyMsg.style.display = 'block';
    }
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

init();
