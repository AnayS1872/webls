document.addEventListener('DOMContentLoaded', checkAuth);

async function checkAuth() {
    try {
        const res = await fetch('/api/me');
        if (res.ok) {
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('app-shell').classList.remove('hidden');
            nav('dashboard');
        } else {
            document.getElementById('login-view').classList.remove('hidden');
            document.getElementById('app-shell').classList.add('hidden');
        }
    } catch (e) { console.error(e); }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const res = await fetch('/api/login', {
        method: 'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({username: u, password: p})
    });
    if (res.ok) { checkAuth(); } 
    else {
        const err = document.getElementById('login-error');
        err.textContent = "Invalid credentials";
        err.classList.remove('hidden');
    }
});

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.reload();
}

function nav(view) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    
    if(view === 'dashboard') loadDashboard();
    if(view === 'grants') loadGrants();
    if(view === 'team') loadTeam();
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3000);
}

async function loadDashboard() {
    const res = await fetch('/api/dashboard');
    const data = await res.json();
    
    document.getElementById('dash-total').textContent = data.metrics.totalGrants;
    document.getElementById('dash-active').textContent = data.metrics.activeGrants;
    document.getElementById('dash-high').textContent = data.metrics.highPriority;

    const list = document.getElementById('dash-deadlines');
    list.innerHTML = data.upcomingDeadlines.length ? '' : '<li class="py-3 text-slate-500">No upcoming deadlines</li>';
    
    data.upcomingDeadlines.forEach(g => {
        const d = new Date(g.deadline).toLocaleDateString();
        list.innerHTML += `<li class="py-3 flex justify-between items-center">
            <span class="font-medium text-slate-700">${g.name}</span>
            <span class="text-sm text-red-600 font-bold">${d}</span>
        </li>`;
    });
}

async function loadGrants() {
    const res = await fetch('/api/grants');
    const data = await res.json();
    const tbody = document.getElementById('grants-table-body');
    tbody.innerHTML = '';

    data.forEach(g => {
        const deadlineText = g.deadline ? new Date(g.deadline).toLocaleDateString() : 'None';
        const isOverdue = g.deadline && new Date(g.deadline) < new Date();
        
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition">
                <td class="p-4 font-medium text-slate-800">
                    ${g.name}
                    ${g.website_url ? `<a href="${g.website_url}" target="_blank" class="ml-2 text-blue-500"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ''}
                </td>
                <td class="p-4 text-slate-600">${g.owner_name || '-'}</td>
                <td class="p-4"><span class="badge badge-${g.status.replace(' ', '')}">${g.status}</span></td>
                <td class="p-4"><span class="badge badge-${g.priority}">${g.priority}</span></td>
                <td class="p-4 ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-600'}">${deadlineText}</td>
                <td class="p-4 text-right">
                    <button onclick="deleteGrant(${g.id})" class="text-red-500 hover:text-red-700 p-2"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function toggleModal(id) {
    const el = document.getElementById(id);
    el.classList.toggle('hidden');
    el.classList.toggle('flex');
}

document.getElementById('add-grant-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('g-name').value,
        owner_name: document.getElementById('g-owner').value,
        deadline: document.getElementById('g-deadline').value,
        priority: document.getElementById('g-priority').value,
        status: document.getElementById('g-status').value,
        website_url: document.getElementById('g-url').value
    };

    const res = await fetch('/api/grants', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });

    if(res.ok) {
        toggleModal('grant-modal');
        e.target.reset();
        showToast('Grant saved successfully!');
        loadGrants();
        loadDashboard();
    }
});

async function deleteGrant(id) {
    if(!confirm("Are you sure you want to permanently delete this grant?")) return;
    const res = await fetch(`/api/grants/${id}`, { method: 'DELETE' });
    if(res.ok) {
        showToast('Grant deleted');
        loadGrants();
        loadDashboard();
    }
}

async function loadTeam() {
    const res = await fetch('/api/team');
    const data = await res.json();
    const grid = document.getElementById('team-cards');
    grid.innerHTML = data.length ? '' : '<p class="text-slate-500">No team members added yet.</p>';
    
    data.forEach(t => {
        grid.innerHTML += `
            <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
                <div>
                    <h3 class="font-bold text-lg text-slate-800">${t.name}</h3>
                    <p class="text-sm text-blue-600 font-medium mb-2">${t.role || 'Member'}</p>
                    <p class="text-sm text-slate-500"><i class="fa-solid fa-envelope w-4"></i> ${t.email || '-'}</p>
                    <p class="text-sm text-slate-500"><i class="fa-solid fa-phone w-4"></i> ${t.phone || '-'}</p>
                </div>
            </div>`;
    });
}