const MAX_CATEGORIES = 6;

let token = null;
let categories = [];
let currentCategory = null;
let pendingFiles = [];

const loginScreen = document.getElementById('login-screen');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('password-input');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

const dropZone = document.getElementById('drop-zone');
const uploadFileInput = document.getElementById('upload-file');
const fileQueue = document.getElementById('file-queue');
const fileEntries = document.getElementById('file-entries');
const bulkMeta = document.getElementById('bulk-meta');
const bulkDate = document.getElementById('bulk-date');
const bulkLocation = document.getElementById('bulk-location');
const applyAllBtn = document.getElementById('apply-all-btn');
const uploadActions = document.getElementById('upload-actions');
const uploadBtn = document.getElementById('upload-btn');
const clearBtn = document.getElementById('clear-btn');
const uploadStatus = document.getElementById('upload-status');
const progressWrap = document.getElementById('progress-wrap');
const progressBar = document.getElementById('progress-bar');
const adminGallery = document.getElementById('admin-gallery');
const adminEmpty = document.getElementById('admin-empty');
const adminTabs = document.getElementById('admin-tabs');
const categoryForm = document.getElementById('category-form');
const newCategoryName = document.getElementById('new-category-name');
const addCategoryBtn = document.getElementById('add-category-btn');
const categoryCount = document.getElementById('category-count');
const categoryStatus = document.getElementById('category-status');
const deleteCategoryBtn = document.getElementById('delete-category-btn');
const galleryAdminView = document.getElementById('gallery-admin-view');
const aboutEditorSection = document.getElementById('about-editor');
const navGalleries = document.getElementById('nav-galleries');
const navAbout = document.getElementById('nav-about');

function showAdminSection(section) {
  const isAbout = section === 'about';
  galleryAdminView.hidden = isAbout;
  aboutEditorSection.hidden = !isAbout;
  navGalleries.classList.toggle('active', !isAbout);
  navAbout.classList.toggle('active', isAbout);
  if (isAbout) {
    window.location.hash = 'about';
  } else {
    history.replaceState(null, '', window.location.pathname);
  }
}

navGalleries.addEventListener('click', () => showAdminSection('galleries'));
navAbout.addEventListener('click', () => showAdminSection('about'));

window.addEventListener('hashchange', () => {
  if (token) applyAdminSectionFromHash();
});

function applyAdminSectionFromHash() {
  showAdminSection(window.location.hash === '#about' ? 'about' : 'galleries');
}

// ── Auth ──

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  loginError.textContent = '';

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput.value })
    });

    if (!res.ok) {
      loginError.textContent = 'Incorrect password.';
      return;
    }

    const data = await res.json();
    token = data.token;
    loginScreen.style.display = 'none';
    adminPanel.style.display = 'block';
    applyAdminSectionFromHash();
    initCategories();
    initAboutEditor();
  } catch {
    loginError.textContent = 'Connection error.';
  }
});

logoutBtn.addEventListener('click', () => {
  token = null;
  adminPanel.style.display = 'none';
  loginScreen.style.display = 'flex';
  passwordInput.value = '';
});

// ── Categories ──

function getCategoryLabel(slug) {
  const cat = categories.find(c => c.slug === slug);
  return cat ? cat.label : slug;
}

function updateCategoryControls() {
  categoryCount.textContent = `${categories.length} of ${MAX_CATEGORIES} galleries`;
  const atMax = categories.length >= MAX_CATEGORIES;
  addCategoryBtn.disabled = atMax;
  newCategoryName.disabled = atMax;
  deleteCategoryBtn.disabled = categories.length <= 1;
  deleteCategoryBtn.title = categories.length <= 1
    ? 'At least one gallery must remain'
    : 'Delete this gallery and all its photos';
}

function renderTabs() {
  adminTabs.innerHTML = '';
  categories.forEach(cat => {
    const tab = document.createElement('button');
    tab.className = 'tab' + (cat.slug === currentCategory ? ' active' : '');
    tab.dataset.category = cat.slug;
    tab.textContent = cat.label;
    tab.addEventListener('click', () => {
      currentCategory = cat.slug;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadAdminGallery();
    });
    adminTabs.appendChild(tab);
  });
}

async function fetchCategories() {
  const res = await fetch('/api/categories');
  if (!res.ok) throw new Error('Failed to load galleries');
  return res.json();
}

async function initCategories() {
  try {
    categories = await fetchCategories();
    if (!currentCategory && categories.length) {
      currentCategory = categories[0].slug;
    }
    renderTabs();
    updateCategoryControls();
    loadAdminGallery();
  } catch {
    categoryStatus.textContent = 'Failed to load galleries.';
  }
}

categoryForm.addEventListener('submit', async e => {
  e.preventDefault();
  categoryStatus.textContent = '';

  const label = newCategoryName.value.trim();
  if (!label) return;

  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ label })
    });

    const data = await res.json();
    if (!res.ok) {
      categoryStatus.textContent = data.error || 'Failed to add gallery.';
      return;
    }

    categories.push(data);
    currentCategory = data.slug;
    newCategoryName.value = '';
    categoryStatus.textContent = `Gallery "${data.label}" created.`;
    renderTabs();
    updateCategoryControls();
    loadAdminGallery();
  } catch {
    categoryStatus.textContent = 'Failed to add gallery.';
  }
});

deleteCategoryBtn.addEventListener('click', async () => {
  const label = getCategoryLabel(currentCategory);
  if (!confirm(`Delete "${label}" and all its photos permanently? This cannot be undone.`)) return;

  categoryStatus.textContent = '';

  try {
    const res = await fetch(`/api/categories/${currentCategory}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': token }
    });

    const data = await res.json();
    if (!res.ok) {
      categoryStatus.textContent = data.error || 'Failed to delete gallery.';
      return;
    }

    categories = await fetchCategories();
    currentCategory = categories.length ? categories[0].slug : null;
    categoryStatus.textContent = `Gallery "${label}" deleted.`;
    renderTabs();
    updateCategoryControls();
    loadAdminGallery();
  } catch {
    categoryStatus.textContent = 'Failed to delete gallery.';
  }
});

// ── Drop zone & file selection ──

dropZone.addEventListener('click', () => uploadFileInput.click());

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  addFiles(e.dataTransfer.files);
});

uploadFileInput.addEventListener('change', () => {
  addFiles(uploadFileInput.files);
  uploadFileInput.value = '';
});

function addFiles(fileList) {
  for (const file of fileList) {
    if (!file.type.startsWith('image/')) continue;
    pendingFiles.push({
      file,
      title: file.name.replace(/\.[^.]+$/, ''),
      date: '',
      location: ''
    });
  }
  renderFileEntries();
}

function renderFileEntries() {
  fileEntries.innerHTML = '';
  const hasFiles = pendingFiles.length > 0;

  bulkMeta.style.display = hasFiles ? 'block' : 'none';
  uploadActions.style.display = hasFiles ? 'flex' : 'none';
  fileQueue.textContent = hasFiles ? `${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''} selected` : '';

  pendingFiles.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'file-entry';

    const thumb = document.createElement('img');
    thumb.className = 'file-entry-thumb';
    thumb.src = URL.createObjectURL(entry.file);

    const fields = document.createElement('div');
    fields.className = 'file-entry-fields';

    const titleInput = document.createElement('input');
    titleInput.className = 'entry-title';
    titleInput.placeholder = 'Title';
    titleInput.value = entry.title;
    titleInput.addEventListener('input', () => { entry.title = titleInput.value; });

    const dateInput = document.createElement('input');
    dateInput.className = 'entry-date';
    dateInput.placeholder = 'Date';
    dateInput.value = entry.date;
    dateInput.addEventListener('input', () => { entry.date = dateInput.value; });

    const locInput = document.createElement('input');
    locInput.className = 'entry-location';
    locInput.placeholder = 'Location';
    locInput.value = entry.location;
    locInput.addEventListener('input', () => { entry.location = locInput.value; });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'file-entry-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', () => {
      pendingFiles.splice(i, 1);
      renderFileEntries();
    });

    fields.appendChild(titleInput);
    fields.appendChild(dateInput);
    fields.appendChild(locInput);
    row.appendChild(thumb);
    row.appendChild(fields);
    row.appendChild(removeBtn);
    fileEntries.appendChild(row);
  });
}

// ── Bulk apply date/location ──

applyAllBtn.addEventListener('click', () => {
  const d = bulkDate.value;
  const l = bulkLocation.value;
  pendingFiles.forEach(entry => {
    if (d) entry.date = d;
    if (l) entry.location = l;
  });
  renderFileEntries();
});

// ── Clear queue ──

clearBtn.addEventListener('click', () => {
  pendingFiles = [];
  renderFileEntries();
  uploadStatus.textContent = '';
  progressWrap.style.display = 'none';
});

// ── Upload ──

uploadBtn.addEventListener('click', async () => {
  if (!pendingFiles.length) return;

  uploadBtn.disabled = true;
  clearBtn.style.display = 'none';
  uploadStatus.textContent = 'Uploading…';
  progressWrap.style.display = 'block';
  progressBar.style.width = '0%';

  const BATCH_SIZE = 10;
  const total = pendingFiles.length;
  let uploaded = 0;

  try {
    for (let start = 0; start < total; start += BATCH_SIZE) {
      const batch = pendingFiles.slice(start, start + BATCH_SIZE);
      const formData = new FormData();

      const metadata = batch.map(entry => ({
        title: entry.title || 'Untitled',
        date: entry.date,
        location: entry.location
      }));

      formData.append('metadata', JSON.stringify(metadata));
      batch.forEach(entry => formData.append('images', entry.file));

      const res = await fetch(`/api/images/${currentCategory}`, {
        method: 'POST',
        headers: { 'x-admin-token': token },
        body: formData
      });

      if (!res.ok) throw new Error('Upload failed');

      uploaded += batch.length;
      progressBar.style.width = `${Math.round((uploaded / total) * 100)}%`;
      uploadStatus.textContent = `Uploaded ${uploaded} of ${total}…`;
    }

    uploadStatus.textContent = `${total} photo${total !== 1 ? 's' : ''} uploaded successfully.`;
    pendingFiles = [];
    renderFileEntries();
    loadAdminGallery();
  } catch {
    uploadStatus.textContent = 'Upload failed. Try again.';
  } finally {
    uploadBtn.disabled = false;
    clearBtn.style.display = '';
    setTimeout(() => {
      progressWrap.style.display = 'none';
      uploadStatus.textContent = '';
    }, 4000);
  }
});

// ── Admin gallery with drag-and-drop reordering ──

let dragSrcCard = null;
let galleryImages = [];

async function loadAdminGallery() {
  adminGallery.innerHTML = '';
  adminEmpty.style.display = 'none';

  if (!currentCategory) {
    adminEmpty.textContent = 'No galleries yet. Add one above.';
    adminEmpty.style.display = 'block';
    return;
  }

  adminEmpty.textContent = 'No photos in this category.';

  try {
    const res = await fetch(`/api/images/${currentCategory}`);
    galleryImages = await res.json();

    if (!galleryImages.length) {
      adminEmpty.style.display = 'block';
      return;
    }

    galleryImages.forEach((img, idx) => {
      const card = document.createElement('div');
      card.className = 'admin-card';
      card.draggable = true;
      card.dataset.id = img.id;
      card.dataset.index = idx;

      const dragHandle = document.createElement('div');
      dragHandle.className = 'drag-handle';
      dragHandle.innerHTML = '&#x2630;';

      const imgEl = document.createElement('img');
      imgEl.src = img.url;
      imgEl.alt = img.title;

      const info = document.createElement('div');
      info.className = 'admin-card-info';

      const details = document.createElement('div');
      details.className = 'admin-card-details';

      const titleEl = document.createElement('span');
      titleEl.className = 'admin-card-title';
      titleEl.textContent = img.title;
      details.appendChild(titleEl);

      const metaParts = [img.date, img.location].filter(Boolean);
      if (metaParts.length) {
        const metaEl = document.createElement('div');
        metaEl.className = 'admin-card-meta';
        metaEl.textContent = metaParts.join(' \u00b7 ');
        details.appendChild(metaEl);
      }

      const actions = document.createElement('div');
      actions.className = 'admin-card-actions';

      const sizeToggle = document.createElement('div');
      sizeToggle.className = 'size-toggle';
      ['S', 'M', 'L'].forEach(label => {
        const sizeVal = { S: 'small', M: 'medium', L: 'large' }[label];
        const btn = document.createElement('button');
        btn.className = 'size-btn' + ((img.size || 'medium') === sizeVal ? ' active' : '');
        btn.textContent = label;
        btn.addEventListener('click', () => updateImageMeta(img.id, { size: sizeVal }));
        sizeToggle.appendChild(btn);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => deleteImage(img.id));

      actions.appendChild(sizeToggle);
      actions.appendChild(delBtn);

      info.appendChild(details);
      info.appendChild(actions);
      card.appendChild(dragHandle);
      card.appendChild(imgEl);
      card.appendChild(info);

      card.addEventListener('dragstart', handleDragStart);
      card.addEventListener('dragover', handleDragOver);
      card.addEventListener('dragenter', handleDragEnter);
      card.addEventListener('dragleave', handleDragLeave);
      card.addEventListener('drop', handleDrop);
      card.addEventListener('dragend', handleDragEnd);

      adminGallery.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load admin gallery:', err);
  }
}

function handleDragStart(e) {
  dragSrcCard = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.id);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
  const card = e.target.closest('.admin-card');
  if (card && card !== dragSrcCard) card.classList.add('drag-over');
}

function handleDragLeave(e) {
  const card = e.target.closest('.admin-card');
  if (card) card.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  const targetCard = e.target.closest('.admin-card');
  if (!targetCard || targetCard === dragSrcCard) return;
  targetCard.classList.remove('drag-over');

  const srcIdx = parseInt(dragSrcCard.dataset.index);
  const tgtIdx = parseInt(targetCard.dataset.index);

  const [moved] = galleryImages.splice(srcIdx, 1);
  galleryImages.splice(tgtIdx, 0, moved);

  saveOrder();
  renderReorderedGallery();
}

function handleDragEnd() {
  this.classList.remove('dragging');
  adminGallery.querySelectorAll('.admin-card').forEach(c => c.classList.remove('drag-over'));
}

function renderReorderedGallery() {
  adminGallery.innerHTML = '';
  galleryImages.forEach((img, idx) => {
    const card = document.createElement('div');
    card.className = 'admin-card';
    card.draggable = true;
    card.dataset.id = img.id;
    card.dataset.index = idx;

    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '&#x2630;';

    const imgEl = document.createElement('img');
    imgEl.src = img.url;
    imgEl.alt = img.title;

    const info = document.createElement('div');
    info.className = 'admin-card-info';

    const details = document.createElement('div');
    details.className = 'admin-card-details';

    const titleEl = document.createElement('span');
    titleEl.className = 'admin-card-title';
    titleEl.textContent = img.title;
    details.appendChild(titleEl);

    const metaParts = [img.date, img.location].filter(Boolean);
    if (metaParts.length) {
      const metaEl = document.createElement('div');
      metaEl.className = 'admin-card-meta';
      metaEl.textContent = metaParts.join(' \u00b7 ');
      details.appendChild(metaEl);
    }

    const actions = document.createElement('div');
    actions.className = 'admin-card-actions';

    const sizeToggle = document.createElement('div');
    sizeToggle.className = 'size-toggle';
    ['S', 'M', 'L'].forEach(label => {
      const sizeVal = { S: 'small', M: 'medium', L: 'large' }[label];
      const btn = document.createElement('button');
      btn.className = 'size-btn' + ((img.size || 'medium') === sizeVal ? ' active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => updateImageMeta(img.id, { size: sizeVal }));
      sizeToggle.appendChild(btn);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => deleteImage(img.id));

    actions.appendChild(sizeToggle);
    actions.appendChild(delBtn);

    info.appendChild(details);
    info.appendChild(actions);
    card.appendChild(dragHandle);
    card.appendChild(imgEl);
    card.appendChild(info);

    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('dragenter', handleDragEnter);
    card.addEventListener('dragleave', handleDragLeave);
    card.addEventListener('drop', handleDrop);
    card.addEventListener('dragend', handleDragEnd);

    adminGallery.appendChild(card);
  });
}

async function saveOrder() {
  const ids = galleryImages.map(img => img.id);
  try {
    await fetch(`/api/images/${currentCategory}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ ids })
    });
  } catch (err) {
    console.error('Failed to save order:', err);
  }
}

async function updateImageMeta(id, updates) {
  try {
    const res = await fetch(`/api/images/${currentCategory}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Update failed');
    const updated = await res.json();
    const idx = galleryImages.findIndex(img => img.id === id);
    if (idx !== -1) galleryImages[idx] = updated;
    renderReorderedGallery();
  } catch {
    alert('Failed to update. Try again.');
  }
}

async function deleteImage(id) {
  if (!confirm('Delete this photo permanently?')) return;

  try {
    const res = await fetch(`/api/images/${currentCategory}/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': token }
    });

    if (!res.ok) throw new Error('Delete failed');
    loadAdminGallery();
  } catch {
    alert('Failed to delete. Try again.');
  }
}

// ── About page editor ──

let aboutContacts = [];

const aboutPortraitPreview = document.getElementById('about-portrait-preview');
const aboutImageInput = document.getElementById('about-image-input');
const aboutImageUploadBtn = document.getElementById('about-image-upload-btn');
const aboutImageRemoveBtn = document.getElementById('about-image-remove-btn');
const aboutImageStatus = document.getElementById('about-image-status');
const aboutDescriptionInput = document.getElementById('about-description-input');
const contactEntries = document.getElementById('contact-entries');
const addContactBtn = document.getElementById('add-contact-btn');
const aboutSaveBtn = document.getElementById('about-save-btn');
const aboutSaveStatus = document.getElementById('about-save-status');

function renderAboutPortraitPreview(image) {
  aboutPortraitPreview.innerHTML = '';
  if (image && image.url) {
    const img = document.createElement('img');
    img.src = image.url;
    img.alt = 'About portrait preview';
    img.className = 'about-portrait-img';
    aboutPortraitPreview.appendChild(img);
    aboutImageRemoveBtn.style.display = '';
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'portrait-placeholder';
    aboutPortraitPreview.appendChild(placeholder);
    aboutImageRemoveBtn.style.display = 'none';
  }
}

function renderContactEntries() {
  contactEntries.innerHTML = '';

  aboutContacts.forEach((contact, i) => {
    const row = document.createElement('div');
    row.className = 'contact-entry';

    const labelInput = document.createElement('input');
    labelInput.className = 'text-input contact-label';
    labelInput.placeholder = 'Label (e.g. Email)';
    labelInput.value = contact.label;
    labelInput.addEventListener('input', () => { aboutContacts[i].label = labelInput.value; });

    const valueInput = document.createElement('input');
    valueInput.className = 'text-input contact-value';
    valueInput.placeholder = 'Value (e.g. hello@email.com)';
    valueInput.value = contact.value;
    valueInput.addEventListener('input', () => { aboutContacts[i].value = valueInput.value; });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'file-entry-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', () => {
      aboutContacts.splice(i, 1);
      renderContactEntries();
    });

    row.appendChild(labelInput);
    row.appendChild(valueInput);
    row.appendChild(removeBtn);
    contactEntries.appendChild(row);
  });
}

async function initAboutEditor() {
  try {
    const res = await fetch('/api/about');
    const data = await res.json();
    aboutDescriptionInput.value = data.description || '';
    aboutContacts = (data.contacts || []).map(c => ({ ...c }));
    if (!aboutContacts.length) aboutContacts.push({ label: '', value: '' });
    renderContactEntries();
    renderAboutPortraitPreview(data.image);
  } catch {
    aboutSaveStatus.textContent = 'Failed to load about page content.';
  }
}

aboutImageUploadBtn.addEventListener('click', () => aboutImageInput.click());

aboutImageInput.addEventListener('change', async () => {
  const file = aboutImageInput.files[0];
  aboutImageInput.value = '';
  if (!file) return;

  aboutImageStatus.textContent = 'Uploading…';
  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch('/api/about/image', {
      method: 'POST',
      headers: { 'x-admin-token': token },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) {
      aboutImageStatus.textContent = data.error || 'Upload failed.';
      return;
    }
    renderAboutPortraitPreview(data.image);
    aboutImageStatus.textContent = 'Image uploaded.';
  } catch {
    aboutImageStatus.textContent = 'Upload failed.';
  }
});

aboutImageRemoveBtn.addEventListener('click', async () => {
  if (!confirm('Remove the portrait image?')) return;
  aboutImageStatus.textContent = '';

  try {
    const res = await fetch('/api/about/image', {
      method: 'DELETE',
      headers: { 'x-admin-token': token }
    });
    const data = await res.json();
    if (!res.ok) throw new Error('Remove failed');
    renderAboutPortraitPreview(data.image);
    aboutImageStatus.textContent = 'Image removed.';
  } catch {
    aboutImageStatus.textContent = 'Failed to remove image.';
  }
});

addContactBtn.addEventListener('click', () => {
  aboutContacts.push({ label: '', value: '' });
  renderContactEntries();
});

aboutSaveBtn.addEventListener('click', async () => {
  aboutSaveStatus.textContent = 'Saving…';

  const contacts = aboutContacts
    .map(c => ({ label: c.label.trim(), value: c.value.trim() }))
    .filter(c => c.label && c.value);

  try {
    const res = await fetch('/api/about', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({
        description: aboutDescriptionInput.value,
        contacts
      })
    });
    const data = await res.json();
    if (!res.ok) {
      aboutSaveStatus.textContent = data.error || 'Save failed.';
      return;
    }
    aboutContacts = data.contacts.length ? data.contacts.map(c => ({ ...c })) : [{ label: '', value: '' }];
    renderContactEntries();
    aboutSaveStatus.textContent = 'About page saved.';
  } catch {
    aboutSaveStatus.textContent = 'Save failed.';
  }
});
