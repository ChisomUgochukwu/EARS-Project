let currentUser = null;

// ==================== AUTH ====================

function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
    document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email, password})
        });
        const data = await res.json();
        if (res.ok) {
            showMessage('authMessage', 'Login successful!', 'success');
            setTimeout(() => loadDashboard(), 500);
        } else {
            showMessage('authMessage', data.error || 'Login failed', 'error');
        }
    } catch (err) {
        showMessage('authMessage', 'Network error', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const full_name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole').value;
    
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({full_name, email, password, role})
        });
        const data = await res.json();
        if (res.ok) {
            showMessage('authMessage', 'Registration successful! Please login.', 'success');
            showTab('login');
        } else {
            showMessage('authMessage', data.error || 'Registration failed', 'error');
        }
    } catch (err) {
        showMessage('authMessage', 'Network error', 'error');
    }
}

async function logout() {
    await fetch('/api/logout', {method: 'POST'});
    location.reload();
}

function showMessage(id, msg, type) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.className = type;
}

// ==================== DASHBOARD ====================

async function loadDashboard() {
    const res = await fetch('/api/me');
    if (!res.ok) return;
    currentUser = await res.json();
    
    document.getElementById('authView').classList.add('hidden');
    document.getElementById('navbar').classList.remove('hidden');
    document.getElementById('userInfo').textContent = `${currentUser.full_name} (${currentUser.role})`;
    
    if (currentUser.role === 'applicant') {
        document.getElementById('applicantView').classList.remove('hidden');
        loadJobs();
        loadMyApplications();
        loadMyInterviews();
    } else if (currentUser.role === 'reviewer') {
        document.getElementById('reviewerView').classList.remove('hidden');
        loadAllApplications();
    } else if (currentUser.role === 'admin') {
        document.getElementById('adminView').classList.remove('hidden');
        loadAdminJobs();
        loadSystemStats();
    }
}

// ==================== APPLICANT ====================

async function loadJobs() {
    const res = await fetch('/api/jobs?status=open');
    const jobs = await res.json();
    const container = document.getElementById('jobsList');
    container.innerHTML = jobs.length ? '' : '<p>No open positions.</p>';
    
    jobs.forEach(job => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div>
                <h4>${job.title}</h4>
                <p>${job.department} | ${job.description.substring(0, 80)}...</p>
            </div>
            <button class="btn-small btn-apply" onclick="applyJob(${job.id})">Apply</button>
        `;
        container.appendChild(div);
    });
}

async function applyJob(jobId) {
    const cover = prompt('Enter cover letter (optional):') || '';
    const formData = new FormData();
    formData.append('job_id', jobId);
    formData.append('cover_letter', cover);
    // For demo, we skip file upload. In real app, append file.
    
    const res = await fetch('/api/applications', {
        method: 'POST',
        body: formData
    });
    const data = await res.json();
    alert(data.message || data.error);
    loadMyApplications();
}

async function loadMyApplications() {
    const res = await fetch('/api/my-applications');
    const apps = await res.json();
    const container = document.getElementById('myApplications');
    container.innerHTML = apps.length ? '' : '<p>No applications yet.</p>';
    
    apps.forEach(app => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div>
                <h4>${app.job_title}</h4>
                <p>${app.department} | Applied: ${new Date(app.applied_at).toLocaleDateString()}</p>
            </div>
            <span class="badge badge-${app.status}">${app.status.replace('_', ' ')}</span>
        `;
        container.appendChild(div);
    });
}

async function loadMyInterviews() {
    const res = await fetch('/api/interviews');
    const interviews = await res.json();
    const container = document.getElementById('myInterviews');
    container.innerHTML = interviews.length ? '' : '<p>No interviews scheduled.</p>';
    
    interviews.forEach(iv => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div>
                <h4>${iv.job_title}</h4>
                <p>${new Date(iv.scheduled_date).toLocaleString()} | ${iv.interview_type} | ${iv.location}</p>
            </div>
            <span class="badge badge-${iv.status}">${iv.status}</span>
        `;
        container.appendChild(div);
    });
}

// ==================== REVIEWER ====================

async function loadAllApplications() {
    const res = await fetch('/api/applications');
    const apps = await res.json();
    const container = document.getElementById('allApplications');
    container.innerHTML = apps.length ? '' : '<p>No applications.</p>';
    
    apps.forEach(app => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div>
                <h4>${app.applicant_name} - ${app.job_title}</h4>
                <p>Applied: ${new Date(app.applied_at).toLocaleDateString()} | Status: ${app.status}</p>
            </div>
            <div>
                <button class="btn-small btn-eval" onclick="openEval(${app.id})">Evaluate</button>
                <button class="btn-small btn-schedule" onclick="openInterview(${app.id})">Schedule</button>
                <select class="btn-small btn-status" onchange="updateStatus(${app.id}, this.value)">
                    <option value="">Change Status</option>
                    <option value="pending">Pending</option>
                    <option value="under_review">Under Review</option>
                    <option value="interview">Interview</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>
        `;
        container.appendChild(div);
    });
}

async function updateStatus(appId, status) {
    if (!status) return;
    const res = await fetch(`/api/applications/${appId}/status`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({status})
    });
    const data = await res.json();
    alert(data.message || data.error);
    loadAllApplications();
}

function openEval(appId) {
    document.getElementById('evalAppId').value = appId;
    document.getElementById('evalModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('evalModal').classList.add('hidden');
}

async function submitEvaluation(e) {
    e.preventDefault();
    const body = {
        application_id: parseInt(document.getElementById('evalAppId').value),
        technical_skills: document.getElementById('techSkills').value,
        communication: document.getElementById('commSkills').value,
        experience_match: document.getElementById('expMatch').value,
        culture_fit: document.getElementById('cultureFit').value,
        comments: document.getElementById('evalComments').value
    };
    
    const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    });
    const data = await res.json();
    alert(data.message + (data.average ? ` | Average: ${data.average}` : ''));
    closeModal();
}

function openInterview(appId) {
    document.getElementById('interviewAppId').value = appId;
    document.getElementById('interviewModal').classList.remove('hidden');
}

function closeInterviewModal() {
    document.getElementById('interviewModal').classList.add('hidden');
}

async function scheduleInterview(e) {
    e.preventDefault();
    const body = {
        application_id: parseInt(document.getElementById('interviewAppId').value),
        scheduled_date: document.getElementById('interviewDate').value,
        interview_type: document.getElementById('interviewType').value,
        location: document.getElementById('interviewLocation').value
    };
    
    const res = await fetch('/api/interviews', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    });
    const data = await res.json();
    alert(data.message || data.error);
    closeInterviewModal();
}

// ==================== ADMIN ====================

async function createJob(e) {
    e.preventDefault();
    const body = {
        title: document.getElementById('jobTitle').value,
        department: document.getElementById('jobDept').value,
        description: document.getElementById('jobDesc').value,
        requirements: document.getElementById('jobReq').value
    };
    
    const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    });
    const data = await res.json();
    alert(data.message || data.error);
    loadAdminJobs();
}

async function loadAdminJobs() {
    const res = await fetch('/api/jobs');
    const jobs = await res.json();
    const container = document.getElementById('adminJobs');
    container.innerHTML = jobs.length ? '' : '<p>No jobs posted.</p>';
    
    jobs.forEach(job => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div>
                <h4>${job.title}</h4>
                <p>${job.department} | ${job.status}</p>
            </div>
            <select class="btn-small btn-status" onchange="updateJobStatus(${job.id}, this.value)">
                <option value="">Set Status</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
            </select>
        `;
        container.appendChild(div);
    });
}

async function updateJobStatus(jobId, status) {
    if (!status) return;
    const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({status})
    });
    const data = await res.json();
    alert(data.message || data.error);
    loadAdminJobs();
}

async function loadSystemStats() {
    const [users, jobs, apps, interviews] = await Promise.all([
        fetch('/api/jobs').then(r => r.json()),
        fetch('/api/jobs').then(r => r.json()),
        fetch('/api/applications').then(r => r.json()),
        fetch('/api/interviews').then(r => r.json())
    ]);
    
    const container = document.getElementById('systemStats');
    container.innerHTML = `
        <div class=\"stat-box\"><h4>${jobs.length}</h4><p>Total Jobs</p></div>
        <div class=\"stat-box\"><h4>${apps.length}</h4><p>Applications</p></div>
        <div class=\"stat-box\"><h4>${interviews.length}</h4><p>Interviews</p></div>
        <div class=\"stat-box\"><h4>${apps.filter(a => a.status === 'accepted').length}</h4><p>Hired</p></div>
    `;
}

// ==================== INIT ====================

window.onload = () => {
    fetch('/api/me').then(res => {
        if (res.ok) loadDashboard();
    });
};