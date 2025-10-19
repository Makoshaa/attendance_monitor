"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const pg_1 = require("pg");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app = (0, express_1.default)();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const rootDir = path_1.default.resolve(__dirname, '..', '..');
const staticDir = path_1.default.join(rootDir, 'dist', 'client');
const publicDir = rootDir;
// Basic config
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const pgConfig = {
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    host: process.env.PGHOST || '127.0.0.1',
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    database: process.env.PGDATABASE || 'alibi_db',
};
const pool = new pg_1.Pool(pgConfig);
async function ensureUsersTable() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE`);
}
ensureUsersTable().catch((err) => {
    console.error('Failed to ensure users table:', err);
});
async function ensureUserPhotosTable() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS user_photos (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      descriptor BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
    // Add descriptor column if upgrading existing table
    try { await pool.query(`ALTER TABLE user_photos ADD COLUMN IF NOT EXISTS descriptor BYTEA`); } catch (_e) {}
    // Migrate legacy json descriptor to binary if present
    try {
        const { rows } = await pool.query(`SELECT id, descriptor_json FROM user_photos WHERE descriptor IS NULL AND descriptor_json IS NOT NULL LIMIT 50`);
        for (const r of rows) {
            try {
                const arr = JSON.parse(r.descriptor_json);
                if (Array.isArray(arr) && arr.length > 0) {
                    const float32 = new Float32Array(arr);
                    const buf = Buffer.from(float32.buffer);
                    await pool.query('UPDATE user_photos SET descriptor = $1 WHERE id = $2', [buf, r.id]);
                }
            } catch {}
        }
    } catch (_e) {}
    // Drop legacy columns if exist
    try { await pool.query(`ALTER TABLE user_photos DROP COLUMN IF EXISTS image_base64`); } catch (_e) {}
    try { await pool.query(`ALTER TABLE user_photos DROP COLUMN IF EXISTS descriptor_json`); } catch (_e) {}
    // Enforce one descriptor per user
    try { await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS user_photos_user_id_unique ON user_photos(user_id)`); } catch (_e) {}
}
ensureUserPhotosTable().catch((err) => {
    console.error('Failed to ensure user_photos table:', err);
});

// Attendance table
async function ensureAttendanceTable() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
ensureAttendanceTable().catch((err) => {
    console.error('Failed to ensure attendance table:', err);
});

async function ensureAdminUser() {
    const adminEmail = 'admin@mail.ru';
    const adminPassword = 'admin123';
    const adminFirst = 'admin';
    const adminLast = '';
    const passwordHash = await bcrypt_1.default.hash(adminPassword, 10);
    // Upsert admin by email and force is_admin true
    await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, is_admin)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (email)
         DO UPDATE SET password_hash = EXCLUDED.password_hash,
                       first_name = EXCLUDED.first_name,
                       last_name = EXCLUDED.last_name,
                       is_admin = TRUE`,
        [adminEmail, passwordHash, adminFirst, adminLast]
    );
}

ensureAdminUser().catch((err) => {
    console.error('Failed to ensure admin user:', err);
});
// Serve compiled client assets
app.use('/assets', express_1.default.static(staticDir));
// Serve wasm and other top-level static files
app.use(express_1.default.static(publicDir));
// Middlewares
app.use((0, cors_1.default)());
app.use(express_1.default.json());

// Auth routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName } = req.body || {};
        if (typeof email !== 'string' || typeof password !== 'string' || email.length < 3 || password.length < 6) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        if (typeof firstName !== 'string' || typeof lastName !== 'string' || firstName.trim().length === 0 || lastName.trim().length === 0) {
            return res.status(400).json({ error: 'First and last name are required' });
        }
        const normalizedEmail = email.trim().toLowerCase();
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const insertSql = 'INSERT INTO users (email, password_hash, first_name, last_name, is_admin) VALUES ($1, $2, $3, $4, FALSE) RETURNING id, email, first_name, last_name, is_admin, created_at';
        const { rows } = await pool.query(insertSql, [normalizedEmail, passwordHash, firstName.trim(), lastName.trim()]);
        const user = rows[0];
        const token = jsonwebtoken_1.default.sign({ sub: user.id, email: user.email, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ token, user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, isAdmin: user.is_admin } });
    }
    catch (err) {
        if (err && err.code === '23505') {
            return res.status(409).json({ error: 'Email already registered' });
        }
        console.error('Register error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ error: 'Invalid payload' });
        }
        const normalizedEmail = email.trim().toLowerCase();
        const { rows } = await pool.query('SELECT id, email, password_hash, first_name, last_name, is_admin FROM users WHERE email = $1', [normalizedEmail]);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = rows[0];
        const ok = await bcrypt_1.default.compare(password, user.password_hash);
        if (!ok) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ sub: user.id, email: user.email, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ token, user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, isAdmin: user.is_admin } });
    }
    catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/auth/me', async (req, res) => {
    try {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (!token) return res.status(401).json({ error: 'Missing token' });
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const { rows } = await pool.query('SELECT id, email, first_name, last_name, is_admin FROM users WHERE id = $1', [payload.sub]);
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const user = rows[0];
        return res.json({ userId: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, isAdmin: user.is_admin });
    }
    catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
});

// Attendance: status for today
app.get('/api/attendance/status', async (req, res) => {
    try {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (!token) return res.status(401).json({ error: 'Missing token' });
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const { rows } = await pool.query(
            `SELECT 1 FROM attendance WHERE user_id = $1 AND marked_at::date = NOW()::date LIMIT 1`,
            [payload.sub]
        );
        return res.json({ marked: rows.length > 0 });
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
});

// Attendance: mark if face matches stored descriptor set
app.post('/api/attendance/mark', async (req, res) => {
    try {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (!token) return res.status(401).json({ error: 'Missing token' });
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const { descriptor } = req.body || {};
        if (!Array.isArray(descriptor) || descriptor.length === 0) {
            return res.status(400).json({ error: 'Descriptor required' });
        }
        const input = new Float32Array(descriptor);
        const { rows } = await pool.query('SELECT descriptor FROM user_photos WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [payload.sub]);
        if (rows.length === 0 || !rows[0].descriptor) return res.status(404).json({ error: 'No reference descriptor' });
        const buf = rows[0].descriptor;
        const ref = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
        let sum = 0; const len = Math.min(ref.length, input.length);
        for (let i = 0; i < len; i++) { const d = ref[i] - input[i]; sum += d * d; }
        const distance = Math.sqrt(sum);
        if (distance >= 0.6) {
            return res.status(401).json({ error: 'Face mismatch', distance });
        }
        await pool.query('INSERT INTO attendance (user_id) VALUES ($1)', [payload.sub]);
        return res.json({ ok: true, distance });
    } catch (err) {
        console.error('Attendance mark error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Admin: upload reference photo for a user
app.post('/api/admin/users/:id/photo', async (req, res) => {
    try {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (!token) return res.status(401).json({ error: 'Missing token' });
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const { rows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [payload.sub]);
        if (rows.length === 0 || rows[0].is_admin !== true) return res.status(403).json({ error: 'Forbidden' });
        const userId = Number(req.params.id);
        const { imageBase64, descriptor } = req.body || {};
        if (!userId) {
            return res.status(400).json({ error: 'Invalid payload' });
        }
        const floatArray = Array.isArray(descriptor) ? new Float32Array(descriptor) : null;
        if (!floatArray) return res.status(400).json({ error: 'Descriptor required' });
        const buf = Buffer.from(floatArray.buffer);
        // Check if descriptor already exists (same face) for any user
        try {
            const { rows: existing } = await pool.query('SELECT user_id, descriptor FROM user_photos');
            const dist = (a, b) => {
                if (!a || !b) return Infinity;
                const len = Math.min(a.length, b.length);
                let s = 0;
                for (let i = 0; i < len; i++) {
                    const d = a[i] - b[i];
                    s += d * d;
                }
                return Math.sqrt(s);
            };
            for (const row of existing) {
                if (!row.descriptor) continue;
                const eb = row.descriptor;
                const arr = new Float32Array(eb.buffer, eb.byteOffset, Math.floor(eb.byteLength / 4));
                const distance = dist(floatArray, arr);
                if (distance < 0.6 && row.user_id !== userId) {
                    return res.status(409).json({ error: `Face already registered for user ${row.user_id}`, conflictUserId: row.user_id, distance });
                }
            }
        } catch (err) {
            console.error('Descriptor precheck failed:', err);
        }
        try {
            await pool.query('INSERT INTO user_photos (user_id, descriptor) VALUES ($1, $2)', [userId, buf]);
        } catch (e) {
            if (e && e.code === '23505') {
                return res.status(409).json({ error: 'Descriptor already exists for this user' });
            }
            throw e;
        }
        return res.json({ ok: true });
    }
    catch (err) {
        console.error('Admin upload photo error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Admin: delete reference photo/descriptor for a user
app.delete('/api/admin/users/:id/photo', async (req, res) => {
    try {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (!token) return res.status(401).json({ error: 'Missing token' });
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const { rows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [payload.sub]);
        if (rows.length === 0 || rows[0].is_admin !== true) return res.status(403).json({ error: 'Forbidden' });
        const userId = Number(req.params.id);
        if (!userId) return res.status(400).json({ error: 'Invalid user id' });
        const result = await pool.query('DELETE FROM user_photos WHERE user_id = $1', [userId]);
        return res.json({ ok: true, deleted: result.rowCount || 0 });
    }
    catch (err) {
        console.error('Admin delete photo error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Current user's latest reference photo
app.get('/api/me/photo', async (req, res) => {
    try {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (!token) return res.status(401).json({ error: 'Missing token' });
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const { rows } = await pool.query('SELECT image_base64 FROM user_photos WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [payload.sub]);
        if (rows.length === 0) return res.status(404).json({ error: 'No photo' });
        return res.json({ imageBase64: rows[0].image_base64 });
    }
    catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
});

// Fetch latest reference photo by user id (admin: any user, non-admin: only own)
app.get('/api/users/:id/photo', async (req, res) => {
    try {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (!token) return res.status(401).json({ error: 'Missing token' });
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const requestedId = Number(req.params.id);
        if (!requestedId) return res.status(400).json({ error: 'Invalid user id' });
        const { rows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [payload.sub]);
        const isAdmin = rows.length > 0 && rows[0].is_admin === true;
        if (!isAdmin && requestedId !== payload.sub) return res.status(403).json({ error: 'Forbidden' });
        const { rows: photos } = await pool.query('SELECT descriptor FROM user_photos WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [requestedId]);
        if (photos.length === 0) return res.status(404).json({ error: 'No descriptor' });
        const buf = photos[0].descriptor;
        const arr = Array.from(new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4)));
        return res.json({ descriptor: arr });
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
});

// Fetch latest descriptor only
app.get('/api/users/:id/descriptor', async (req, res) => {
    try {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (!token) return res.status(401).json({ error: 'Missing token' });
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const requestedId = Number(req.params.id);
        if (!requestedId) return res.status(400).json({ error: 'Invalid user id' });
        const { rows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [payload.sub]);
        const isAdmin = rows.length > 0 && rows[0].is_admin === true;
        if (!isAdmin && requestedId !== payload.sub) return res.status(403).json({ error: 'Forbidden' });
        const { rows: descRows } = await pool.query('SELECT descriptor FROM user_photos WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [requestedId]);
        if (descRows.length === 0) return res.status(404).json({ error: 'No descriptor' });
        const buf2 = descRows[0].descriptor;
        const arr2 = Array.from(new Float32Array(buf2.buffer, buf2.byteOffset, Math.floor(buf2.byteLength / 4)));
        return res.json({ descriptor: arr2 });
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
});

// Admin-only: list users
app.get('/api/admin/users', async (req, res) => {
    try {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (!token) return res.status(401).json({ error: 'Missing token' });
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const { rows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [payload.sub]);
        if (rows.length === 0 || rows[0].is_admin !== true) return res.status(403).json({ error: 'Forbidden' });
        const { rows: users } = await pool.query('SELECT id, email, first_name, last_name, is_admin, created_at FROM users ORDER BY id ASC');
        return res.json({ users });
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
});
app.get(['/', '/login', '/register', '/dashboard', '/app', '/admin'], (_req, res) => {
    res.sendFile(path_1.default.join(publicDir, 'index.html'));
});
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
