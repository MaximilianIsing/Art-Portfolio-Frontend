function contactHref(contact) {
  const value = contact.value.trim();
  const label = contact.label.toLowerCase();

  if (/^https?:\/\//i.test(value)) return value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  if (label.includes('instagram')) {
    const handle = value.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '');
    return handle ? `https://instagram.com/${handle}` : null;
  }
  if (value.startsWith('@')) return `https://instagram.com/${value.slice(1)}`;
  return null;
}

function renderAbout(data) {
  const portraitEl = document.getElementById('about-portrait');
  const descriptionEl = document.getElementById('about-description');
  const contactsEl = document.getElementById('about-contacts');

  portraitEl.innerHTML = '';
  if (data.image && data.image.url) {
    const img = document.createElement('img');
    img.src = data.image.url;
    img.alt = 'Ava Blavatnik';
    img.className = 'about-portrait-img';
    portraitEl.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'portrait-placeholder';
    portraitEl.appendChild(placeholder);
  }

  descriptionEl.innerHTML = '';
  const paragraphs = (data.description || '').split(/\n\n+/).filter(p => p.trim());
  if (paragraphs.length) {
    paragraphs.forEach(text => {
      const p = document.createElement('p');
      p.textContent = text.trim();
      descriptionEl.appendChild(p);
    });
  }

  contactsEl.innerHTML = '';
  const contacts = data.contacts || [];
  if (!contacts.length) {
    contactsEl.style.display = 'none';
    return;
  }

  contactsEl.style.display = '';
  contacts.forEach(contact => {
    const row = document.createElement('p');
    row.className = 'contact-row';
    const href = contactHref(contact);

    if (href) {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = contact.value;
      if (href.startsWith('http')) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      row.appendChild(document.createTextNode(`${contact.label}: `));
      row.appendChild(link);
    } else {
      row.textContent = `${contact.label}: ${contact.value}`;
    }

    contactsEl.appendChild(row);
  });
}

async function initAboutPage() {
  try {
    const res = await fetch('/api/about');
    const data = await res.json();
    renderAbout(data);
  } catch (err) {
    console.error('Failed to load about page:', err);
  }
}

initAboutPage();
