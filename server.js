const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

const MAX_CATEGORIES = 6;
const PERSISTENT_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(PERSISTENT_DIR, 'uploads');
const DATA_FILE = path.join(PERSISTENT_DIR, 'data.json');
const CATEGORIES_FILE = path.join(PERSISTENT_DIR, 'categories.json');
const ABOUT_FILE = path.join(PERSISTENT_DIR, 'about.json');
const ABOUT_UPLOAD_DIR = path.join(UPLOADS_DIR, 'about');

function migrateLegacyStorage() {
  fs.mkdirSync(PERSISTENT_DIR, { recursive: true });

  const legacyFiles = ['data.json', 'categories.json', 'about.json'];
  for (const file of legacyFiles) {
    const legacyPath = path.join(__dirname, file);
    const newPath = path.join(PERSISTENT_DIR, file);
    if (fs.existsSync(legacyPath) && !fs.existsSync(newPath)) {
      fs.copyFileSync(legacyPath, newPath);
    }
  }

  const legacyUploads = path.join(__dirname, 'uploads');
  if (fs.existsSync(legacyUploads)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    for (const entry of fs.readdirSync(legacyUploads)) {
      const from = path.join(legacyUploads, entry);
      const to = path.join(UPLOADS_DIR, entry);
      if (!fs.existsSync(to)) {
        fs.cpSync(from, to, { recursive: true });
      }
    }
  }
}

const DEFAULT_ABOUT = {
  description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.\n\nSunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.',
  image: null,
  contacts: [
    { label: 'Email', value: 'placeholder@example.com' }
  ]
};

const DEFAULT_CATEGORIES = [
  { slug: 'black-and-white', label: 'Black and White' },
  { slug: 'nature', label: 'Nature' },
  { slug: 'abstract', label: 'Abstract' }
];

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function loadCategories() {
  if (fs.existsSync(CATEGORIES_FILE)) {
    return JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf-8'));
  }
  saveCategories(DEFAULT_CATEGORIES);
  return [...DEFAULT_CATEGORIES];
}

function saveCategories(categories) {
  fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(categories, null, 2));
}

function getCategorySlugs() {
  return loadCategories().map(c => c.slug);
}

function categoryExists(slug) {
  return getCategorySlugs().includes(slug);
}

function uniqueSlug(base, existingSlugs) {
  let slug = base || 'gallery';
  let n = 2;
  while (existingSlugs.includes(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

function ensureUploadDirs() {
  fs.mkdirSync(ABOUT_UPLOAD_DIR, { recursive: true });
  for (const slug of getCategorySlugs()) {
    fs.mkdirSync(path.join(UPLOADS_DIR, slug), { recursive: true });
  }
}

function loadAbout() {
  if (fs.existsSync(ABOUT_FILE)) {
    return JSON.parse(fs.readFileSync(ABOUT_FILE, 'utf-8'));
  }
  saveAbout(DEFAULT_ABOUT);
  return { ...DEFAULT_ABOUT };
}

function saveAbout(about) {
  fs.writeFileSync(ABOUT_FILE, JSON.stringify(about, null, 2));
}

function deleteAboutImage(about) {
  if (!about.image) return;
  const filepath = path.join(ABOUT_UPLOAD_DIR, about.image.filename);
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  about.image = null;
}

function loadData() {
  const categories = loadCategories();
  if (fs.existsSync(DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    for (const cat of categories) {
      if (!data[cat.slug]) data[cat.slug] = [];
    }
    return data;
  }
  const empty = {};
  for (const cat of categories) empty[cat.slug] = [];
  return empty;
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function deleteCategoryImages(slug) {
  const data = loadData();
  const images = data[slug] || [];

  for (const img of images) {
    const filepath = path.join(UPLOADS_DIR, slug, img.filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }

  delete data[slug];
  saveData(data);

  const dir = path.join(UPLOADS_DIR, slug);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

migrateLegacyStorage();
ensureUploadDirs();
if (!fs.existsSync(DATA_FILE)) saveData(loadData());

function getPassword() {
  if (process.env.ADMIN_PASSWORD) {
    return process.env.ADMIN_PASSWORD.trim();
  }
  const dataPassword = path.join(PERSISTENT_DIR, 'password.txt');
  if (fs.existsSync(dataPassword)) {
    return fs.readFileSync(dataPassword, 'utf-8').trim();
  }
  const legacyPassword = path.join(__dirname, 'password.txt');
  if (fs.existsSync(legacyPassword)) {
    return fs.readFileSync(legacyPassword, 'utf-8').trim();
  }
  throw new Error('No admin password configured. Set ADMIN_PASSWORD or create password.txt');
}

function authMiddleware(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token === getPassword()) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const cat = req.params.category;
    cb(null, path.join(UPLOADS_DIR, cat));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});

function imageFileFilter(req, file, cb) {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype.split('/')[1]);
  cb(null, ext && mime);
}

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }
});

const aboutStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(ABOUT_UPLOAD_DIR, { recursive: true });
    cb(null, ABOUT_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname));
  }
});

const aboutUpload = multer({
  storage: aboutStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (password === getPassword()) {
    return res.json({ token: password });
  }
  res.status(401).json({ error: 'Wrong password' });
});

app.get('/api/categories', (req, res) => {
  res.json(loadCategories());
});

app.post('/api/categories', authMiddleware, (req, res) => {
  const { label } = req.body;
  if (!label || !label.trim()) {
    return res.status(400).json({ error: 'Gallery name is required' });
  }

  const categories = loadCategories();
  if (categories.length >= MAX_CATEGORIES) {
    return res.status(400).json({ error: `Maximum of ${MAX_CATEGORIES} galleries allowed` });
  }

  const trimmedLabel = label.trim();
  const baseSlug = slugify(trimmedLabel);
  const slug = uniqueSlug(baseSlug, categories.map(c => c.slug));

  const entry = { slug, label: trimmedLabel };
  categories.push(entry);
  saveCategories(categories);

  fs.mkdirSync(path.join(UPLOADS_DIR, slug), { recursive: true });

  const data = loadData();
  data[slug] = [];
  saveData(data);

  res.status(201).json(entry);
});

app.delete('/api/categories/:slug', authMiddleware, (req, res) => {
  const { slug } = req.params;
  const categories = loadCategories();

  if (!categoryExists(slug)) {
    return res.status(404).json({ error: 'Gallery not found' });
  }

  if (categories.length <= 1) {
    return res.status(400).json({ error: 'At least one gallery must remain' });
  }

  deleteCategoryImages(slug);

  const updated = categories.filter(c => c.slug !== slug);
  saveCategories(updated);

  res.json({ success: true });
});

app.get('/api/images/:category', (req, res) => {
  const { category } = req.params;
  if (!categoryExists(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  const data = loadData();
  res.json(data[category] || []);
});

app.post('/api/images/:category', authMiddleware, upload.array('images', 50), (req, res) => {
  const { category } = req.params;
  if (!categoryExists(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: 'No images uploaded' });
  }

  let metadata = [];
  try {
    metadata = req.body.metadata ? JSON.parse(req.body.metadata) : [];
  } catch { /* ignore parse errors */ }

  const data = loadData();
  const entries = req.files.map((file, i) => {
    const meta = metadata[i] || {};
    return {
      id: uuidv4(),
      title: meta.title || file.originalname.replace(/\.[^.]+$/, ''),
      date: meta.date || '',
      location: meta.location || '',
      size: meta.size || 'medium',
      filename: file.filename,
      url: `/uploads/${category}/${file.filename}`,
      uploadedAt: new Date().toISOString()
    };
  });

  data[category].push(...entries);
  saveData(data);

  res.json(entries);
});

app.put('/api/images/:category/reorder', authMiddleware, (req, res) => {
  const { category } = req.params;
  if (!categoryExists(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids must be an array' });
  }

  const data = loadData();
  const lookup = new Map(data[category].map(img => [img.id, img]));
  const reordered = ids.map(id => lookup.get(id)).filter(Boolean);
  data[category].forEach(img => {
    if (!ids.includes(img.id)) reordered.push(img);
  });

  data[category] = reordered;
  saveData(data);
  res.json({ success: true });
});

app.put('/api/images/:category/:id', authMiddleware, (req, res) => {
  const { category, id } = req.params;
  if (!categoryExists(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const data = loadData();
  const img = data[category].find(i => i.id === id);
  if (!img) return res.status(404).json({ error: 'Image not found' });

  const allowed = ['title', 'date', 'location', 'size'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) img[key] = req.body[key];
  }

  saveData(data);
  res.json(img);
});

app.delete('/api/images/:category/:id', authMiddleware, (req, res) => {
  const { category, id } = req.params;
  if (!categoryExists(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const data = loadData();
  const idx = data[category].findIndex(img => img.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Image not found' });

  const [removed] = data[category].splice(idx, 1);
  saveData(data);

  const filepath = path.join(UPLOADS_DIR, category, removed.filename);
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

  res.json({ success: true });
});

app.get('/api/about', (req, res) => {
  res.json(loadAbout());
});

app.put('/api/about', authMiddleware, (req, res) => {
  const { description, contacts } = req.body;
  const about = loadAbout();

  if (description !== undefined) {
    about.description = typeof description === 'string' ? description : '';
  }

  if (contacts !== undefined) {
    if (!Array.isArray(contacts)) {
      return res.status(400).json({ error: 'contacts must be an array' });
    }
    about.contacts = contacts
      .filter(c => c && c.label && c.value)
      .map(c => ({
        label: String(c.label).trim(),
        value: String(c.value).trim()
      }))
      .slice(0, 12);
  }

  saveAbout(about);
  res.json(about);
});

app.post('/api/about/image', authMiddleware, aboutUpload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  const about = loadAbout();
  deleteAboutImage(about);

  about.image = {
    filename: req.file.filename,
    url: `/uploads/about/${req.file.filename}`
  };
  saveAbout(about);

  res.json(about);
});

app.delete('/api/about/image', authMiddleware, (req, res) => {
  const about = loadAbout();
  deleteAboutImage(about);
  saveAbout(about);
  res.json(about);
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/sitemap.xml', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  const urls = [
    { loc: '/', priority: '1.0' },
    { loc: '/about', priority: '0.8' },
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${base}${u.loc}</loc>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
  res.type('application/xml').send(xml);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
