const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { db, initDatabase } = require('./database');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'ears_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 60 * 1000 } // 30 minutes
}));

// Static files
app.use(express.static('public'));

// File upload setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.doc', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    }
});

initDatabase();

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/register', (req, res) => {
    const { full_name, email, password, role } = req.body;
    if (!full_name || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields required' });
    }
    if (!['applicant', 'reviewer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }
    const hash = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
        [full_name, email, hash, role], function(err) {
            if (err) return res.status(400).json({ error: 'Email already exists' });
            res.json({ message: 'Registration successful', userId: this.lastID });
        });
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
        if (!bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.userName = user.full_name;
        res.json({ 
            message: 'Login successful', 
            user: { id: user.id, name: user.full_name, role: user.role, email: user.email } 
        });
    });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out' });
});

// Get current user
app.get('/api/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    db.get('SELECT id, full_name, email, role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    });
});

// ==================== JOB ROUTES ====================

// Get all jobs (with filter for applicants)
app.get('/api/jobs', (req, res) => {
    const { status } = req.query;
    let sql = 'SELECT * FROM jobs';
    const params = [];
    if (status) {
        sql += ' WHERE status = ?';
        params.push(status);
    }
    db.all(sql, params, (err, rows) => res.json(rows || []));
});

// Create job (admin only)
app.post('/api/jobs', requireAuth, requireRole('admin'), (req, res) => {
    const { title, department, description, requirements } = req.body;
    db.run('INSERT INTO jobs (title, department, description, requirements, posted_by) VALUES (?, ?, ?, ?, ?)',
        [title, department, description, requirements, req.session.userId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Job created', jobId: this.lastID });
        });
});

// Update job status
app.put('/api/jobs/:id', requireAuth, requireRole('admin'), (req, res) => {
    const { status } = req.body;
    db.run('UPDATE jobs SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Job updated' });
    });
});

// ==================== APPLICATION ROUTES ====================

// Submit application
app.post('/api/applications', requireAuth, requireRole('applicant'), upload.single('resume'), (req, res) => {
    const { job_id, cover_letter } = req.body;
    const resume_path = req.file ? '/uploads/' + req.file.filename : null;
    
    db.run('INSERT INTO applications (applicant_id, job_id, cover_letter, resume_path) VALUES (?, ?, ?, ?)',
        [req.session.userId, job_id, cover_letter, resume_path], function(err) {
            if (err) return res.status(400).json({ error: 'Already applied to this job' });
            res.json({ message: 'Application submitted', applicationId: this.lastID });
        });
});

// Get my applications (applicant)
app.get('/api/my-applications', requireAuth, requireRole('applicant'), (req, res) => {
    db.all(`SELECT a.*, j.title as job_title, j.department 
            FROM applications a JOIN jobs j ON a.job_id = j.id 
            WHERE a.applicant_id = ? ORDER BY a.applied_at DESC`, [req.session.userId], 
        (err, rows) => res.json(rows || []));
});

// Get all applications (reviewer/admin)
app.get('/api/applications', requireAuth, (req, res) => {
    let sql = `SELECT a.*, u.full_name as applicant_name, j.title as job_title 
               FROM applications a 
               JOIN users u ON a.applicant_id = u.id 
               JOIN jobs j ON a.job_id = j.id`;
    const params = [];
    
    if (req.session.role === 'reviewer') {
        // For demo: reviewers see all, but in production would filter by assignment
        sql += ' WHERE a.status != ?';
        params.push('draft');
    }
    sql += ' ORDER BY a.applied_at DESC';
    
    db.all(sql, params, (err, rows) => res.json(rows || []));
});

// Update application status
app.put('/api/applications/:id/status', requireAuth, requireRole('reviewer', 'admin'), (req, res) => {
    const { status } = req.body;
    db.run('UPDATE applications SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Status updated' });
    });
});

// ==================== EVALUATION ROUTES ====================

// Create evaluation
app.post('/api/evaluations', requireAuth, requireRole('reviewer', 'admin'), (req, res) => {
    const { application_id, technical_skills, communication, experience_match, culture_fit, comments } = req.body;
    const total = (parseInt(technical_skills) + parseInt(communication) + parseInt(experience_match) + parseInt(culture_fit)) / 4;
    
    db.run(`INSERT INTO evaluations (application_id, reviewer_id, technical_skills, communication, experience_match, culture_fit, comments) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [application_id, req.session.userId, technical_skills, communication, experience_match, culture_fit, comments], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Evaluation saved', evaluationId: this.lastID, average: total.toFixed(2) });
        });
});

// Get evaluations for application
app.get('/api/evaluations/:applicationId', requireAuth, (req, res) => {
    db.all(`SELECT e.*, u.full_name as reviewer_name 
            FROM evaluations e JOIN users u ON e.reviewer_id = u.id 
            WHERE e.application_id = ?`, [req.params.applicationId],
        (err, rows) => res.json(rows || []));
});

// ==================== INTERVIEW ROUTES ====================

// Schedule interview
app.post('/api/interviews', requireAuth, requireRole('reviewer', 'admin'), (req, res) => {
    const { application_id, scheduled_date, interview_type, location } = req.body;
    db.run('INSERT INTO interviews (application_id, scheduled_date, interview_type, location) VALUES (?, ?, ?, ?)',
        [application_id, scheduled_date, interview_type, location], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Interview scheduled', interviewId: this.lastID });
        });
});

// Get interviews
app.get('/api/interviews', requireAuth, (req, res) => {
    let sql = `SELECT i.*, a.applicant_id, j.title as job_title, u.full_name as applicant_name
               FROM interviews i 
               JOIN applications a ON i.application_id = a.id
               JOIN jobs j ON a.job_id = j.id
               JOIN users u ON a.applicant_id = u.id`;
    
    if (req.session.role === 'applicant') {
        sql += ' WHERE a.applicant_id = ?';
        db.all(sql, [req.session.userId], (err, rows) => res.json(rows || []));
    } else {
        db.all(sql, [], (err, rows) => res.json(rows || []));
    }
});

// ==================== MIDDLEWARE ====================

function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.session.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        next();
    };
}

// Start server
app.listen(PORT, () => {
    console.log(`EARS Server running at http://localhost:${PORT}`);
    console.log('Open your browser and go to http://localhost:3000');
});