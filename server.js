const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

const CATEGORIES = ['black-and-white', 'nature', 'abstract'];
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_FILE = path.join(__dirname, 'data.json');

for (const cat of CATEGORIES) {
  fs.mkdirSync(path.join(UPLOADS_DIR, cat), { recursive: true });
}

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  }
  const empty = {};
  for (const cat of CATEGORIES) empty[cat] = [];
  return empty;
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

if (!fs.existsSync(DATA_FILE)) saveData(loadData());

function getPassword() {
  return fs.readFileSync(path.join(__dirname, 'password.txt'), 'utf-8').trim();
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

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype.split('/')[1]);
    cb(null, ext && mime);
  },
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

app.get('/api/images/:category', (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  const data = loadData();
  res.json(data[category] || []);
});

app.post('/api/images/:category', authMiddleware, upload.array('images', 50), (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category)) {
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
  if (!CATEGORIES.includes(category)) {
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
  if (!CATEGORIES.includes(category)) {
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
  if (!CATEGORIES.includes(category)) {
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
