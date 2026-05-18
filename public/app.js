const CATEGORY_LABELS = {
  'black-and-white': 'Black and White',
  'nature': 'Nature',
  'abstract': 'Abstract'
};

let currentCategory = 'black-and-white';

const gallery = document.getElementById('gallery');
const title = document.getElementById('category-title');
const emptyMsg = document.getElementById('empty-msg');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');
const lightboxClose = document.getElementById('lightbox-close');
const hamburger = document.getElementById('hamburger');
const nav = document.getElementById('nav');

async function loadGallery(category) {
  currentCategory = category;
  title.textContent = CATEGORY_LABELS[category];

  document.querySelectorAll('.nav-link').forEach(btn => {
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

document.querySelectorAll('.nav-link').forEach(btn => {
  btn.addEventListener('click', () => {
    loadGallery(btn.dataset.category);
    nav.classList.remove('open');
  });
});

hamburger.addEventListener('click', () => {
  nav.classList.toggle('open');
});

loadGallery('black-and-white');
