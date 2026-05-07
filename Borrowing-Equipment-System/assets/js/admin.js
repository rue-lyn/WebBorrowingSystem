let currentUser    = { username: 'admin', password: 'admin' };
let equipment      = [];
let borrows        = [];
let violations     = [];
let penaltyPerDay  = 50;
let gracePeriod    = 1;
let currentBorrowTab   = 'pending';
let analyticsFilter    = 'all';

let freqChart   = null;
let activeChart = null;
let catChart    = null;

const CHART_COLORS = [
  '#D4AF37','#27ae60','#c0392b','#2980b9','#8e44ad',
  '#16a085','#e67e22','#2c3e50','#f39c12','#1abc9c'
];

function save() {
  localStorage.setItem('sb_equipment',  JSON.stringify(equipment));
  localStorage.setItem('sb_borrows',    JSON.stringify(borrows));
  localStorage.setItem('sb_violations', JSON.stringify(violations));
  localStorage.setItem('sb_user',       JSON.stringify(currentUser));
  localStorage.setItem('sb_rules',      JSON.stringify({ penaltyPerDay, gracePeriod }));
}

function load() {
  const eq = localStorage.getItem('sb_equipment');
  const br = localStorage.getItem('sb_borrows');
  const vi = localStorage.getItem('sb_violations');
  const us = localStorage.getItem('sb_user');
  const ru = localStorage.getItem('sb_rules');
  if (eq) equipment   = JSON.parse(eq);
  if (br) borrows     = JSON.parse(br);
  if (vi) violations  = JSON.parse(vi);
  if (us) currentUser = JSON.parse(us);
  if (ru) {
    const r = JSON.parse(ru);
    penaltyPerDay = r.penaltyPerDay ?? 50;
    gracePeriod   = r.gracePeriod   ?? 1;
  }
}

function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');

  if (u === currentUser.username && p === currentUser.password) {
    errEl.style.display = 'none';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('sidebar-username').textContent = currentUser.username;
    document.getElementById('user-avatar-letter').textContent = currentUser.username[0].toUpperCase();
    document.getElementById('settings-username').textContent = currentUser.username;
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    document.getElementById('penalty-per-day').value = penaltyPerDay;
    document.getElementById('grace-period').value     = gracePeriod;
    refreshAll();
  } else {
    errEl.style.display = 'block';
  }
}

function doLogout() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').style.display = 'none';
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    const ls = document.getElementById('login-screen');
    if (ls && ls.style.display !== 'none') doLogin();
  }
});

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  equipment: 'Equipment',
  borrows:   'Borrow Requests',
  violations:'Violations',
  analytics: 'Analytics',
  settings:  'Settings'
};

function showPage(name, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  if (el)   el.classList.add('active');
  document.getElementById('page-title').textContent = PAGE_TITLES[name] || name;

  if (name === 'dashboard')  refreshDashboard();
  if (name === 'equipment')  renderEquipmentTable();
  if (name === 'borrows')    renderBorrowTable();
  if (name === 'violations') renderViolationsTable();
  if (name === 'analytics')  renderAnalytics();
}

function openModal(id) {
  if (id === 'add-borrow-modal') populateBorrowEquipmentSelect();
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function closeModalOutside(e, id) {
  if (e.target.id === id) closeModal(id);
}

let _toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.style.display = 'none'; }, 3200);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysOverdue(dueDateStr) {
  const due = new Date(dueDateStr);
  const now = new Date();
  due.setHours(0,0,0,0);
  now.setHours(0,0,0,0);
  return Math.max(0, Math.floor((now - due) / 86400000));
}

function statusBadge(status) {
  const map = {
    pending:  '<span class="badge badge-yellow">Pending</span>',
    approved: '<span class="badge badge-green">Approved</span>',
    returned: '<span class="badge badge-gray">Returned</span>',
    overdue:  '<span class="badge badge-red">Overdue</span>',
    unpaid:   '<span class="badge badge-red">Unpaid</span>',
    resolved: '<span class="badge badge-green">Resolved</span>',
  };
  return map[status] || `<span class="badge badge-gray">${status}</span>`;
}

function conditionBadge(c) {
  const map = {
    Excellent: 'badge-green',
    Good:      'badge-gold',
    Fair:      'badge-yellow',
    Poor:      'badge-red',
  };
  return `<span class="badge ${map[c] || 'badge-gray'}">${c}</span>`;
}

function addEquipment() {
  const name = document.getElementById('eq-name').value.trim();
  if (!name) { showToast('⚠ Please enter an equipment name.'); return; }
  const qty  = Math.max(1, parseInt(document.getElementById('eq-qty').value) || 1);
  equipment.push({
    id:        Date.now(),
    name,
    category:  document.getElementById('eq-category').value,
    qty,
    available: qty,
    condition: document.getElementById('eq-condition').value,
    notes:     document.getElementById('eq-notes').value.trim(),
  });
  save();
  closeModal('add-equipment-modal');
  clearModal('add-equipment-modal');
  renderEquipmentTable();
  refreshDashboard();
  showToast('✅ Equipment added successfully.');
}

function deleteEquipment(id) {
  if (!confirm('Delete this equipment? This cannot be undone.')) return;
  equipment = equipment.filter(e => e.id !== id);
  save();
  renderEquipmentTable();
  refreshDashboard();
  showToast('🗑 Equipment deleted.');
}

function renderEquipmentTable() {
  const q     = (document.getElementById('eq-search').value || '').toLowerCase();
  const tbody = document.getElementById('equipment-table');
  const list  = equipment.filter(e =>
    e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
  );

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:28px">
      ${q ? 'No equipment matched your search.' : 'No equipment added yet. Click <strong>+ Add Equipment</strong> to get started.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(e => `
    <tr>
      <td><strong>${esc(e.name)}</strong></td>
      <td>${esc(e.category)}</td>
      <td>${e.qty}</td>
      <td style="color:${e.available > 0 ? 'var(--green)' : 'var(--red)'}; font-weight:600;">${e.available}</td>
      <td>${conditionBadge(e.condition)}</td>
      <td style="color:var(--muted); font-size:13px;">${esc(e.notes) || '—'}</td>
      <td>
        <button class="btn-action btn-delete" onclick="deleteEquipment(${e.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

function populateBorrowEquipmentSelect() {
  const sel   = document.getElementById('br-equipment');
  const avail = equipment.filter(e => e.available > 0);
  sel.innerHTML = avail.length
    ? avail.map(e => `<option value="${e.id}">${esc(e.name)} (Available: ${e.available})</option>`).join('')
    : '<option disabled selected>No equipment available right now</option>';
}

function addBorrowRequest() {
  const teacher = document.getElementById('br-teacher').value.trim();
  const eqId    = parseInt(document.getElementById('br-equipment').value);
  const qty     = Math.max(1, parseInt(document.getElementById('br-qty').value) || 1);
  const purpose = document.getElementById('br-purpose').value.trim();
  const date    = document.getElementById('br-date').value;
  const due     = document.getElementById('br-due').value;

  if (!teacher)       { showToast('⚠ Please enter the teacher name.'); return; }
  if (!eqId || isNaN(eqId)) { showToast('⚠ Please select equipment.'); return; }
  if (!date || !due)  { showToast('⚠ Please fill in both dates.'); return; }
  if (due < date)     { showToast('⚠ Due date cannot be before borrow date.'); return; }

  const eq = equipment.find(e => e.id === eqId);
  if (!eq) { showToast('⚠ Selected equipment not found.'); return; }
  if (qty > eq.available) { showToast(`⚠ Only ${eq.available} unit(s) available.`); return; }

  borrows.push({
    id:            Date.now(),
    teacher,
    equipmentId:   eqId,
    equipmentName: eq.name,
    category:      eq.category,
    qty,
    purpose,
    borrowDate:    date,
    dueDate:       due,
    status:        'pending',
  });
  save();
  closeModal('add-borrow-modal');
  clearModal('add-borrow-modal');
  renderBorrowTable();
  refreshDashboard();
  showToast('✅ Borrow request submitted.');
}

function switchBorrowTab(tab, el) {
  currentBorrowTab = tab;
  document.querySelectorAll('#page-borrows .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderBorrowTable();
}

function renderBorrowTable() {
  const list  = borrows.filter(b => b.status === currentBorrowTab);
  const tbody = document.getElementById('borrow-table');

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:28px">
      No <strong>${currentBorrowTab}</strong> requests.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(b => `
    <tr>
      <td>${esc(b.teacher)}</td>
      <td>${esc(b.equipmentName)}</td>
      <td>${b.qty}</td>
      <td>${esc(b.purpose) || '—'}</td>
      <td>${b.borrowDate}</td>
      <td>${b.dueDate}</td>
      <td>${statusBadge(b.status)}</td>
      <td>${borrowActions(b)}</td>
    </tr>
  `).join('');
}

function borrowActions(b) {
  if (b.status === 'pending') {
    return `<button class="btn-action btn-approve" onclick="approveBorrow(${b.id})">Approve</button>
            <button class="btn-action btn-delete"  onclick="rejectBorrow(${b.id})">Reject</button>`;
  }
  if (b.status === 'approved') {
    return `<button class="btn-action btn-return" onclick="returnBorrow(${b.id})">Mark Returned</button>`;
  }
  return `<button class="btn-action btn-delete" onclick="deleteBorrow(${b.id})">Delete</button>`;
}

function approveBorrow(id) {
  const b  = borrows.find(x => x.id === id);
  if (!b) return;
  const eq = equipment.find(e => e.id === b.equipmentId);
  if (eq) {
    if (b.qty > eq.available) { showToast(`⚠ Only ${eq.available} unit(s) available now.`); return; }
    eq.available = Math.max(0, eq.available - b.qty);
  }
  b.status = 'approved';
  save();
  renderBorrowTable();
  refreshDashboard();
  showToast('✅ Request approved.');
}

function rejectBorrow(id) {
  if (!confirm('Reject and remove this borrow request?')) return;
  borrows = borrows.filter(b => b.id !== id);
  save();
  renderBorrowTable();
  refreshDashboard();
  showToast('🗑 Request rejected.');
}

function returnBorrow(id) {
  const b  = borrows.find(x => x.id === id);
  if (!b) return;
  const eq = equipment.find(e => e.id === b.equipmentId);
  if (eq) eq.available = Math.min(eq.qty, eq.available + b.qty);
  b.status = 'returned';
  save();
  renderBorrowTable();
  refreshDashboard();
  showToast('✅ Equipment marked as returned.');
}

function deleteBorrow(id) {
  if (!confirm('Delete this borrow record?')) return;
  borrows = borrows.filter(b => b.id !== id);
  save();
  renderBorrowTable();
  showToast('🗑 Borrow record deleted.');
}

function addViolation() {
  const teacher = document.getElementById('vio-teacher').value.trim();
  const eq      = document.getElementById('vio-equipment').value.trim();
  const due     = document.getElementById('vio-due').value;
  const penalty = parseFloat(document.getElementById('vio-penalty').value) || 0;
  const remarks = document.getElementById('vio-remarks').value.trim();

  if (!teacher || !eq || !due) { showToast('⚠ Please fill in all required fields.'); return; }

  const days = daysOverdue(due);
  violations.push({
    id:          Date.now(),
    teacher,
    equipment:   eq,
    dueDate:     due,
    daysOverdue: days,
    penalty,
    remarks,
    status:      'unpaid',
    manual:      true,
  });
  save();
  closeModal('add-violation-modal');
  clearModal('add-violation-modal');
  renderViolationsTable();
  refreshDashboard();
  showToast('✅ Violation added.');
}

function resolveViolation(id) {
  const v = violations.find(x => x.id === id);
  if (v) v.status = 'resolved';
  save();
  renderViolationsTable();
  refreshDashboard();
  showToast('✅ Violation resolved.');
}

function deleteViolation(id) {
  if (!confirm('Delete this violation?')) return;
  violations = violations.filter(v => v.id !== id);
  save();
  renderViolationsTable();
  refreshDashboard();
  showToast('🗑 Violation deleted.');
}

function renderViolationsTable() {
  const tbody = document.getElementById('violations-table');

  violations.forEach(v => { v.daysOverdue = daysOverdue(v.dueDate); });

  if (!violations.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:28px">
      No violations recorded. Click <strong>+ Add Violation</strong> or run <strong>Check Overdues</strong>.</td></tr>`;
    updateViolationBadge();
    return;
  }

  tbody.innerHTML = violations.map(v => `
    <tr>
      <td>${esc(v.teacher)}</td>
      <td>${esc(v.equipment)}</td>
      <td>${v.dueDate}</td>
      <td style="color:${v.daysOverdue > 0 ? 'var(--red)' : 'var(--muted)'}; font-weight:600;">
        ${v.daysOverdue} day(s)
      </td>
      <td style="color:var(--gold-dark); font-weight:700;">₱${Number(v.penalty).toFixed(2)}</td>
      <td style="font-size:13px; color:var(--muted);">${esc(v.remarks) || '—'}</td>
      <td>${statusBadge(v.status)}</td>
      <td>
        ${v.status !== 'resolved'
          ? `<button class="btn-action btn-resolve" onclick="resolveViolation(${v.id})">Resolve</button>`
          : ''}
        <button class="btn-action btn-delete" onclick="deleteViolation(${v.id})">Delete</button>
      </td>
    </tr>
  `).join('');
  updateViolationBadge();
}

function updateViolationBadge() {
  const unpaid = violations.filter(v => v.status === 'unpaid').length;
  const badge  = document.getElementById('vio-badge');
  badge.textContent = unpaid;
  badge.classList.toggle('show', unpaid > 0);
  document.getElementById('stat-overdue').textContent = unpaid;
}

function runViolationCheck() {
  let created = 0;
  borrows
    .filter(b => b.status === 'approved')
    .forEach(b => {
      const days = daysOverdue(b.dueDate);
      if (days > gracePeriod) {
        const exists = violations.some(v => v.borrowId === b.id && v.status !== 'resolved');
        if (!exists) {
          violations.push({
            id:          Date.now() + Math.random(),
            borrowId:    b.id,
            teacher:     b.teacher,
            equipment:   b.equipmentName,
            dueDate:     b.dueDate,
            daysOverdue: days,
            penalty:     days * penaltyPerDay,
            remarks:     'Auto-detected overdue',
            status:      'unpaid',
            manual:      false,
          });
          created++;
        }
      }
    });
  save();
  refreshDashboard();
  renderViolationsTable();
  showToast(created > 0
    ? `⚠ ${created} new overdue violation(s) detected.`
    : '✅ No new overdues found.');
}

function refreshDashboard() {
  const totalEq  = equipment.reduce((s, e) => s + e.qty, 0);
  const borrowed = borrows.filter(b => b.status === 'approved').reduce((s, b) => s + b.qty, 0);
  const avail    = equipment.reduce((s, e) => s + e.available, 0);
  const unpaid   = violations.filter(v => v.status === 'unpaid').length;

  document.getElementById('stat-total').textContent     = totalEq;
  document.getElementById('stat-borrowed').textContent  = borrowed;
  document.getElementById('stat-overdue').textContent   = unpaid;
  document.getElementById('stat-available').textContent = avail;
  updateViolationBadge();

  /* Recent activity */
  const recent = [...borrows].reverse().slice(0, 10);
  const tbody  = document.getElementById('recent-activity-table');
  tbody.innerHTML = recent.length
    ? recent.map(b => `
        <tr>
          <td>${esc(b.teacher)}</td>
          <td>${esc(b.equipmentName)}</td>
          <td>${b.borrowDate}</td>
          <td>${b.dueDate}</td>
          <td>${statusBadge(b.status)}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">No activity yet.</td></tr>`;

  const overdues = violations.filter(v => v.status === 'unpaid');
  const cont     = document.getElementById('overdue-warn-container');
  cont.innerHTML = overdues.length
    ? overdues.slice(0, 5).map(v => `
        <div class="warn-banner">
          ⚠ <span><strong>${esc(v.teacher)}</strong> — ${esc(v.equipment)} is overdue by
          <strong>${v.daysOverdue} day(s)</strong>. Penalty: <strong>₱${Number(v.penalty).toFixed(2)}</strong></span>
        </div>
      `).join('')
    : '';
}

function saveCredentials() {
  const newU  = document.getElementById('new-username').value.trim();
  const currP = document.getElementById('curr-pass').value;
  const newP  = document.getElementById('new-pass').value;
  const confP = document.getElementById('confirm-pass').value;
  const msgEl = document.getElementById('settings-msg');

  function showMsg(type, text) {
    msgEl.className = `settings-msg ${type}`;
    msgEl.textContent = text;
    msgEl.style.display = 'block';
    setTimeout(() => { msgEl.style.display = 'none'; }, 3500);
  }

  if (!currP) { showMsg('error', 'Please enter your current password.'); return; }
  if (currP !== currentUser.password) { showMsg('error', 'Current password is incorrect.'); return; }
  if (newP && newP !== confP) { showMsg('error', 'New passwords do not match.'); return; }
  if (newP && newP.length < 4) { showMsg('error', 'New password must be at least 4 characters.'); return; }

  if (newU) currentUser.username = newU;
  if (newP) currentUser.password = newP;
  save();

  document.getElementById('sidebar-username').textContent = currentUser.username;
  document.getElementById('user-avatar-letter').textContent = currentUser.username[0].toUpperCase();
  document.getElementById('settings-username').textContent  = currentUser.username;
  showMsg('success', '✅ Credentials updated successfully.');

  document.getElementById('curr-pass').value    = '';
  document.getElementById('new-pass').value     = '';
  document.getElementById('confirm-pass').value = '';
}

function saveViolationRules() {
  penaltyPerDay = parseFloat(document.getElementById('penalty-per-day').value) || 50;
  gracePeriod   = parseInt(document.getElementById('grace-period').value)      || 1;
  if (penaltyPerDay < 0) penaltyPerDay = 0;
  if (gracePeriod   < 0) gracePeriod   = 0;
  save();
  showToast('✅ Violation rules saved.');
}

function setAnalyticsFilter(f, el) {
  analyticsFilter = f;
  document.querySelectorAll('.analytics-filter-row .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderAnalytics();
}

function getFilteredBorrows() {
  if (analyticsFilter === 'all') return borrows;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - parseInt(analyticsFilter));
  return borrows.filter(b => new Date(b.borrowDate) >= cutoff);
}

function buildFreqData(br) {
  const map = {};
  br.forEach(b => { map[b.equipmentName] = (map[b.equipmentName] || 0) + 1; });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return { labels: sorted.map(x => x[0]), data: sorted.map(x => x[1]) };
}

function buildActiveData(br) {
  const active = br.filter(b => b.status === 'approved');
  const map    = {};
  active.forEach(b => { map[b.equipmentName] = (map[b.equipmentName] || 0) + (b.qty || 1); });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 7);
  return { labels: sorted.map(x => x[0]), data: sorted.map(x => x[1]) };
}

function buildCatData(br) {
  const map = {};
  br.forEach(b => { if (b.category) map[b.category] = (map[b.category] || 0) + 1; });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  return { labels: sorted.map(x => x[0]), data: sorted.map(x => x[1]) };
}

function makeLegend(containerId, labels, colors) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = labels.map((l, i) =>
    `<span class="chart-legend-item">
       <span class="chart-legend-dot" style="background:${colors[i % colors.length]}"></span>${esc(l)}
     </span>`
  ).join('');
}

function destroyChart(ref) {
  if (ref) { try { ref.destroy(); } catch (_) {} }
  return null;
}

function emptyCanvas(canvas, msg) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#999';
  ctx.font = '13px DM Sans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
}

function renderAnalytics() {
  const br = getFilteredBorrows();

  const total   = br.length;
  const active  = br.filter(b => b.status === 'approved').length;
  const freq    = buildFreqData(br);
  const topItem = freq.labels[0] || '—';
  const avgDays = br.length
    ? br.reduce((s, b) => {
        if (!b.borrowDate || !b.dueDate) return s;
        return s + Math.max(0, (new Date(b.dueDate) - new Date(b.borrowDate)) / 86400000);
      }, 0) / br.length
    : 0;

  document.getElementById('a-total').textContent = total;
  document.getElementById('a-active').textContent = active;
  document.getElementById('a-top').textContent    = topItem;
  document.getElementById('a-avg').textContent    = Math.round(avgDays);

  const activeData = buildActiveData(br);
  const catData    = buildCatData(br);

  const gridColor   = 'rgba(0,0,0,0.06)';
  const textColor   = '#777777';
  const borderColor = '#e0e0d8';

  freqChart   = destroyChart(freqChart);
  activeChart = destroyChart(activeChart);
  catChart    = destroyChart(catChart);

  const freqCanvas = document.getElementById('freqChart');
  if (freqCanvas) {
    if (freq.labels.length) {
      freqChart = new Chart(freqCanvas, {
        type: 'bar',
        data: {
          labels: freq.labels,
          datasets: [{
            label: 'Times borrowed',
            data:  freq.data,
            backgroundColor: CHART_COLORS.map(c => c + 'bb'),
            borderColor:     CHART_COLORS,
            borderWidth: 1.5,
            borderRadius: 6,
            hoverBackgroundColor: CHART_COLORS,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              ticks:  { color: textColor, font: { size: 11 }, maxRotation: 35 },
              grid:   { color: gridColor },
              border: { color: borderColor }
            },
            y: {
              ticks:  { color: textColor, font: { size: 11 }, stepSize: 1, precision: 0 },
              grid:   { color: gridColor },
              border: { color: borderColor },
              beginAtZero: true
            }
          }
        }
      });
      makeLegend('freq-legend', freq.labels, CHART_COLORS);
    } else {
      emptyCanvas(freqCanvas, 'No borrow data available yet.');
      const fl = document.getElementById('freq-legend');
      if (fl) fl.innerHTML = '';
    }
  }

  const activeCanvas = document.getElementById('activeChart');
  if (activeCanvas) {
    if (activeData.labels.length) {
      const dColors = activeData.labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
      activeChart = new Chart(activeCanvas, {
        type: 'doughnut',
        data: {
          labels: activeData.labels,
          datasets: [{
            data:            activeData.data,
            backgroundColor: dColors.map(c => c + 'bb'),
            borderColor:     dColors,
            borderWidth: 2,
            hoverOffset: 8,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: '60%',
          plugins: { legend: { display: false } }
        }
      });
      makeLegend('active-legend', activeData.labels, CHART_COLORS);
    } else {
      emptyCanvas(activeCanvas, 'No active borrows right now.');
      const al = document.getElementById('active-legend');
      if (al) al.innerHTML = '';
    }
  }

  const catCanvas = document.getElementById('catChart');
  if (catCanvas) {
    if (catData.labels.length) {
      catChart = new Chart(catCanvas, {
        type: 'bar',
        data: {
          labels: catData.labels,
          datasets: [{
            label: 'Borrows',
            data:  catData.data,
            backgroundColor: catData.labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length] + 'bb'),
            borderColor:     catData.labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
            borderWidth: 1.5,
            borderRadius: 6,
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              ticks:  { color: textColor, font: { size: 11 }, precision: 0 },
              grid:   { color: gridColor },
              border: { color: borderColor },
              beginAtZero: true
            },
            y: {
              ticks:  { color: textColor, font: { size: 11 } },
              grid:   { color: gridColor },
              border: { color: borderColor }
            }
          }
        }
      });
    } else {
      emptyCanvas(catCanvas, 'No category data available yet.');
    }
  }
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clearModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.querySelectorAll('input[type=text], input[type=number], textarea').forEach(el => {
    if (el.id === 'eq-qty' || el.id === 'br-qty') {
      el.value = 1;
    } else if (el.id === 'vio-penalty') {
      el.value = penaltyPerDay;
    } else {
      el.value = '';
    }
  });
  m.querySelectorAll('input[type=date]').forEach(el => el.value = '');
}

function refreshAll() {
  refreshDashboard();
  renderEquipmentTable();
  renderBorrowTable();
  renderViolationsTable();
}

function seedSampleData() {
  const today = new Date();
  const daysAgo = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  const sampleEquipment = [
    { id: 1001, name: 'Basketball', category: 'Ball Sports', qty: 10, available: 5, condition: 'Excellent', notes: 'Official size 7' },
    { id: 1002, name: 'Volleyball', category: 'Ball Sports', qty: 8, available: 4, condition: 'Excellent', notes: '' },
    { id: 1003, name: 'Volleyball Net', category: 'Team Sports', qty: 3, available: 2, condition: 'Good', notes: 'Standard regulation net' },
    { id: 1004, name: 'Badminton Racket', category: 'Racket Sports', qty: 12, available: 6, condition: 'Good', notes: '' },
    { id: 1005, name: 'Badminton Shuttlecock (box)', category: 'Racket Sports', qty: 6, available: 6, condition: 'Excellent', notes: '12 pcs per box' },
    { id: 1006, name: 'Jump Rope', category: 'Fitness', qty: 15, available: 7, condition: 'Good', notes: '' },
    { id: 1007, name: 'Soccer Ball', category: 'Ball Sports', qty: 5, available: 5, condition: 'Fair', notes: 'Some wear on surface' },
    { id: 1008, name: 'Stopwatch', category: 'Athletics', qty: 4, available: 2, condition: 'Excellent', notes: 'Digital, waterproof' },
  ];

  const sampleBorrows = [
    { id: 2001, teacher: 'Mr. Santos', equipmentId: 1001, equipmentName: 'Basketball', category: 'Ball Sports', qty: 5, purpose: 'PE Class', borrowDate: daysAgo(13), dueDate: daysAgo(6), status: 'approved' },
    { id: 2002, teacher: 'Ms. Cruz', equipmentId: 1002, equipmentName: 'Volleyball', category: 'Ball Sports', qty: 4, purpose: 'Intramurals', borrowDate: daysAgo(11), dueDate: daysAgo(4), status: 'approved' },
    { id: 2003, teacher: 'Mr. Reyes', equipmentId: 1004, equipmentName: 'Badminton Racket', category: 'Racket Sports', qty: 6, purpose: 'PE Class', borrowDate: daysAgo(8), dueDate: daysAgo(1), status: 'approved' },
    { id: 2004, teacher: 'Ms. Lim', equipmentId: 1006, equipmentName: 'Jump Rope', category: 'Fitness', qty: 8, purpose: 'Fitness Training', borrowDate: daysAgo(5), dueDate: daysAgo(2), status: 'pending' },
    { id: 2005, teacher: 'Mr. Garcia', equipmentId: 1007, equipmentName: 'Soccer Ball', category: 'Ball Sports', qty: 3, purpose: 'Training Session', borrowDate: daysAgo(18), dueDate: daysAgo(11), status: 'returned' },
    { id: 2006, teacher: 'Ms. Torres', equipmentId: 1003, equipmentName: 'Volleyball Net', category: 'Team Sports', qty: 1, purpose: 'Tournament', borrowDate: daysAgo(23), dueDate: daysAgo(16), status: 'approved' },
    { id: 2007, teacher: 'Mr. Dela Cruz', equipmentId: 1008, equipmentName: 'Stopwatch', category: 'Athletics', qty: 2, purpose: 'Track & Field', borrowDate: daysAgo(21), dueDate: daysAgo(13), status: 'approved' },
  ];

  const sampleViolations = [
    { id: 3001, borrowId: 2006, teacher: 'Ms. Torres', equipment: 'Volleyball Net', dueDate: daysAgo(16), daysOverdue: 16, penalty: 800, remarks: 'Auto-detected overdue', status: 'unpaid', manual: false },
    { id: 3002, borrowId: 2007, teacher: 'Mr. Dela Cruz', equipment: 'Stopwatch', dueDate: daysAgo(13), daysOverdue: 13, penalty: 650, remarks: 'Auto-detected overdue', status: 'unpaid', manual: false },
  ];

  localStorage.setItem('sb_equipment',  JSON.stringify(sampleEquipment));
  localStorage.setItem('sb_borrows',    JSON.stringify(sampleBorrows));
  localStorage.setItem('sb_violations', JSON.stringify(sampleViolations));
  localStorage.setItem('sb_seeded',     '1');
}

load();
if (!localStorage.getItem('sb_seeded')) seedSampleData(), load();