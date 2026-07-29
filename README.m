# EARS - Employment Application Review System

## Team Members
- Chisom Ugochukwu (5148780) - Frontend Development, UI Implementation, QA
- Yinka Akingbaso (5142977) - Backend Development, Authentication, Database

## Tech Stack
- Backend: Node.js, Express.js, SQLite3
- Frontend: HTML5, CSS3, Vanilla JavaScript
- Security: bcryptjs (password hashing), express-session (session management)
- File Upload: multer (resume uploads)

## Setup Instructions (MacBook)

1. Open Terminal
2. cd ~/Desktop/EARS_Project
3. npm install
4. node server.js
5. Open browser to http://localhost:3000

## Demo Accounts
- Admin: admin@ears.com / admin123
- Reviewer: reviewer@ears.com / reviewer123
- Applicant: Register a new account

## Features
- User Registration & Authentication with role-based access
- Job posting and management (Admin)
- Application submission with duplicate protection (Applicant)
- Application review and evaluation with scoring rubric (Reviewer)
- Interview scheduling with multiple types
- Real-time status tracking