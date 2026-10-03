require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false })); 
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10,
    message: { error: 'Too many login attempts. Try again later.' }
});

app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
    }
}));

const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

app.post('/api/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    try {
        if (username === process.env.PORTAL_USER && password === process.env.PORTAL_PASS) {
            req.session.userId = 1; 
            return res.json({ success: true });
        }
        res.status(401).json({ error: 'Invalid credentials' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'Could not log out' });
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

app.get('/api/me', (req, res) => {
    if (req.session.userId) res.json({ authenticated: true });
    else res.status(401).json({ authenticated: false });
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
    try {
        const grantsTotal = await pool.query('SELECT COUNT(*) FROM grants');
        const grantsActive = await pool.query("SELECT COUNT(*) FROM grants WHERE status NOT IN ('Closed', 'Rejected', 'Awarded')");
        const grantsHigh = await pool.query("SELECT COUNT(*) FROM grants WHERE priority = 'High'");
        const upcoming = await pool.query("SELECT id, name, deadline, status FROM grants WHERE deadline >= CURRENT_DATE ORDER BY deadline ASC LIMIT 5");
        
        res.json({
            metrics: {
                totalGrants: grantsTotal.rows[0].count,
                activeGrants: grantsActive.rows[0].count,
                highPriority: grantsHigh.rows[0].count
            },
            upcomingDeadlines: upcoming.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/grants', requireAuth, async (req, res) => {
    const result = await pool.query('SELECT * FROM grants ORDER BY deadline ASC NULLS LAST');
    res.json(result.rows);
});

app.post('/api/grants', requireAuth, async (req, res) => {
    const { name, owner_name, priority, status, deadline, amount_available, website_url, notes } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO grants (name, owner_name, priority, status, deadline, amount_available, website_url, notes) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [name, owner_name, priority, status, deadline || null, amount_available || 0, website_url, notes]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/grants/:id', requireAuth, async (req, res) => {
    await pool.query('DELETE FROM grants WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

app.get('/api/team', requireAuth, async (req, res) => {
    const result = await pool.query('SELECT * FROM team_members ORDER BY name ASC');
    res.json(result.rows);
});

app.post('/api/team', requireAuth, async (req, res) => {
    const { name, role, email, phone } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO team_members (name, role, email, phone) VALUES ($1, $2, $3, $4) RETURNING *`,
            [name, role, email, phone]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/team/:id', requireAuth, async (req, res) => {
    await pool.query('DELETE FROM team_members WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => console.log(`Loose Screws Hub running on port ${port}`));