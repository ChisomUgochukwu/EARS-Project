const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database(path.join(__dirname, 'ears.db'));

function initDatabase() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('applicant', 'reviewer', 'admin')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Job postings table
        db.run(`CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            department TEXT NOT NULL,
            description TEXT NOT NULL,
            requirements TEXT NOT NULL,
            status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed')),
            posted_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (posted_by) REFERENCES users(id)
        )`);

        // Applications table
        db.run(`CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            applicant_id INTEGER,
            job_id INTEGER,
            cover_letter TEXT,
            resume_path TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'under_review', 'interview', 'accepted', 'rejected')),
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (applicant_id) REFERENCES users(id),
            FOREIGN KEY (job_id) REFERENCES jobs(id),
            UNIQUE(applicant_id, job_id)
        )`);

        // Evaluations table
        db.run(`CREATE TABLE IF NOT EXISTS evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER,
            reviewer_id INTEGER,
            technical_skills INTEGER CHECK(technical_skills BETWEEN 1 AND 5),
            communication INTEGER CHECK(communication BETWEEN 1 AND 5),
            experience_match INTEGER CHECK(experience_match BETWEEN 1 AND 5),
            culture_fit INTEGER CHECK(culture_fit BETWEEN 1 AND 5),
            comments TEXT,
            evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (application_id) REFERENCES applications(id),
            FOREIGN KEY (reviewer_id) REFERENCES users(id)
        )`);

        // Interviews table
        db.run(`CREATE TABLE IF NOT EXISTS interviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER,
            scheduled_date TEXT NOT NULL,
            interview_type TEXT CHECK(interview_type IN ('phone', 'technical', 'final', 'panel')),
            location TEXT,
            status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'confirmed', 'declined', 'completed')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (application_id) REFERENCES applications(id)
        )`);

        // Seed admin user
        const adminPass = bcrypt.hashSync('admin123', 10);
        db.run(`INSERT OR IGNORE INTO users (id, full_name, email, password, role) VALUES (1, 'System Admin', 'admin@ears.com', ?, 'admin')`, [adminPass]);

        // Seed reviewer user
        const reviewerPass = bcrypt.hashSync('reviewer123', 10);
        db.run(`INSERT OR IGNORE INTO users (id, full_name, email, password, role) VALUES (2, 'John Reviewer', 'reviewer@ears.com', ?, 'reviewer')`, [reviewerPass]);

        // Seed sample jobs
        db.run(`INSERT OR IGNORE INTO jobs (id, title, department, description, requirements, status, posted_by) VALUES 
            (1, 'Software Engineer', 'Engineering', 'Develop web applications using modern frameworks.', 'BSc in CS, 2+ years experience with JavaScript', 'open', 1),
            (2, 'Data Analyst', 'Analytics', 'Analyze business data and create reports.', 'BSc in Statistics, SQL proficiency', 'open', 1),
            (3, 'HR Coordinator', 'Human Resources', 'Coordinate recruitment and onboarding.', 'BBA, strong communication skills', 'closed', 1)`);
    });
}

module.exports = { db, initDatabase };