const token = localStorage.getItem('csc_token');
const username = localStorage.getItem('csc_user');
if (!token) { window.location.href = '/index.html'; }

document.getElementById('userLabel').textContent = username ? `Masuk sebagai ${username}` : '';
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('csc_token');
  localStorage.removeItem('csc_user');
  window.location.href = '/index.html';
});

function authHeaders() { return { Authorization: `Bearer ${token}` }; }

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(options.headers || {}) },
  });
  if (res.status === 401) { localStorage.removeItem('csc_token'); window.location.href = '/index.html'; throw new Error('Sesi berakhir'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

// ---------- STATE ----------
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let selectedDate = null;
let allEntries = [];

// ---------- KALENDER ----------
const DAYS = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function renderCalendar(entries) {
  const grid = document.getElementById('calGrid');
  const label = document.getElementById('monthLabel');
  label.textContent = `${MONTHS[currentMonth-1]} ${currentYear}`;

  const countByDate = {};
  entries.forEach(e => { countByDate[e.date] = (countByDate[e.date] || 0) + 1; });

  const today = new Date().toISOString().slice(0,10);
  const firstDay = new Date(currentYear, currentMonth-1, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const prevDays = new Date(currentYear, currentMonth-1, 0).getDate();

  let html = DAYS.map(d => `<div class="cal-day-header">${d}</div>`).join('');

  for (let i = 0; i < firstDay; i++) {
    const d = prevDays - firstDay + i + 1;
    html += `<div class="cal-day other-month"><span class="cal-num">${d}</span></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const count = countByDate[iso] || 0;
    const isToday = iso === today;
    const isSel = iso === selectedDate;
    const cls = ['cal-day', count ? 'has-data' : '', isToday ? 'today' : '', isSel ? 'selected' : ''].filter(Boolean).join(' ');
    html += `<div class="${cls}" onclick="selectDate('${iso}')">
      <span class="cal-num">${d}</span>
      ${count ? `<span class="cal-count">${count}</span>` : ''}
    </div>`;
  }

  const remaining = 42 - firstDay - daysInMonth;
  for (let d = 1; d <= remaining; d++) {
    html += `<div class="cal-day other-month"><span class="cal-num">${d}</span></div>`;
  }

  grid.innerHTML = html;
}

document.getElementById('prevMonth').addEventListener('click', () => {
  currentMonth--; if (currentMonth < 1) { currentMonth = 12; currentYear--; }
  loadMonth();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  currentMonth++; if (currentMonth > 12) { currentMonth = 1; currentYear++; }
  loadMonth();
});
document.getElementById('showAllBtn').addEventListener('click', () => {
  selectedDate = null;
  renderTable(allEntries);
  document.querySelectorAll('.cal-day.selected').forEach(el => el.classList.remove('selected'));
});

window.selectDate = function(iso) {
  selectedDate = iso;
  renderCalendar(allEntries);
  const filtered = allEntries.filter(e => e.date === iso);
  renderTable(filtered);
  document.getElementById('f_date') && (document.getElementById('f_date').value = iso);
};

async function loadMonth() {
  try {
    const { entries } = await api(`/api/entries?month=${currentMonth}&year=${currentYear}`);
    allEntries = entries;
    renderCalendar(entries);
    if (selectedDate) {
      renderTable(entries.filter(e => e.date === selectedDate));
    } else {
      renderTable(entries);
    }
    updateSummary(entries);
    populateFilter(entries);
  } catch(err) {
    document.getElementById('tableWrap').innerHTML = `<div class="empty-state">Gagal memuat: ${err.message}</div>`;
  }
}

function updateSummary(entries) {
  document.getElementById('totalTamu').textContent = entries.length;
  const total = entries.reduce((s, e) => s + (e.pagi||0) + (e.siang||0) + (e.malam||0), 0);
  document.getElementById('totalMakanan').textContent = total;
}

function populateFilter(entries) {
  const sel = document.getElementById('filterPeace');
  const current = sel.value;
  const places = [...new Set(entries.map(e => e.peace).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Semua Mess</option>' + places.map(p => `<option value="${p}">${p}</option>`).join('');
  if (current) sel.value = current;
}

// ---------- SEARCH & FILTER ----------
document.getElementById('searchInput').addEventListener('input', applyFilter);
document.getElementById('filterPeace').addEventListener('change', applyFilter);

function applyFilter() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const peace = document.getElementById('filterPeace').value;
  let data = selectedDate ? allEntries.filter(e => e.date === selectedDate) : allEntries;
  if (q) data = data.filter(e =>
    (e.namaTamu||'').toLowerCase().includes(q) ||
    (e.peace||'').toLowerCase().includes(q) ||
    (e.petugas||'').toLowerCase().includes(q)
  );
  if (peace) data = data.filter(e => e.peace === peace);
  renderTable(data);
}

// ---------- TABEL ----------
function esc(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function porsi(n) {
  return n ? `<span class="porsi-badge">${n}</span>` : `<span class="porsi-badge empty">-</span>`;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return `${['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
}

function renderTable(entries) {
  const wrap = document.getElementById('tableWrap');
  document.getElementById('badgeTotal').textContent = `Total Saringan (Pagi+Siang+Malam): ${entries.reduce((s,e)=>s+(e.pagi||0)+(e.siang||0)+(e.malam||0),0)}`;

  if (!entries.length) {
    wrap.innerHTML = `<div class="empty-state">${selectedDate ? 'Tidak ada data untuk tanggal ini.' : 'Belum ada data bulan ini.'}</div>`;
    return;
  }

  wrap.innerHTML = `<table class="record-table">
    <thead><tr>
      <th>Tamu</th>
      <th>Tanggal</th>
      <th>Pagi (B)</th>
      <th>Siang (L)</th>
      <th>Malam (D)</th>
      <th>Mess / Lokasi</th>
      <th>Petugas</th>
      <th>Aksi</th>
    </tr></thead>
    <tbody>
      ${entries.map(e => `<tr>
        <td><strong>${esc(e.namaTamu)}</strong>${e.requestor ? `<br><small style="color:var(--muted)">${esc(e.requestor)}</small>` : ''}</td>
        <td style="white-space:nowrap;font-size:12px;">${formatDate(e.date)}</td>
        <td style="text-align:center">${porsi(e.pagi)}</td>
        <td style="text-align:center">${porsi(e.siang)}</td>
        <td style="text-align:center">${porsi(e.malam)}</td>
        <td>${esc(e.peace)}</td>
        <td>${esc(e.petugas)}</td>
        <td class="actions-cell">
          <button onclick="openEdit('${e.id}')" title="Edit">✏️</button>
          <button onclick="deleteEntry('${e.id}')" title="Hapus">🗑️</button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

// ---------- EXPORT ----------
document.getElementById('exportBtn').addEventListener('click', () => {
  document.getElementById('exportMenu').classList.toggle('open');
});
document.addEventListener('click', e => {
  if (!e.target.closest('.export-wrap')) document.getElementById('exportMenu').classList.remove('open');
});

window.exportData = function(range) {
  document.getElementById('exportMenu').classList.remove('open');
  const today = new Date();
  let data = allEntries;

  if (range === 'today') {
    const iso = today.toISOString().slice(0,10);
    data = allEntries.filter(e => e.date === iso);
  } else if (range === 'week') {
    const start = new Date(today); start.setDate(today.getDate() - today.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 6);
    data = allEntries.filter(e => e.date >= start.toISOString().slice(0,10) && e.date <= end.toISOString().slice(0,10));
  }

  const header = ['No','Nama Tamu','Requestor','Tanggal','Pagi','Siang','Malam','Mess/Lokasi','Petugas'];
  const rows = data.map((e,i) => [i+1, e.namaTamu, e.requestor, e.date, e.pagi, e.siang, e.malam, e.peace, e.petugas]);
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `catering-${range}-${today.toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
};

// ---------- MODAL ----------
const modalOverlay = document.getElementById('modalOverlay');
const itemsList = document.getElementById('itemsList');
const attachmentsList = document.getElementById('attachmentsList');
let editingId = null;
let currentAttachments = [];

function emptyItemRow(v = {}) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input type="text" class="it-time" placeholder="Jam" value="${esc(v.time||'')}"/>
    <input type="text" class="it-item" placeholder="Item" value="${esc(v.item||'')}"/>
    <input type="text" class="it-qty" placeholder="Qty" value="${esc(v.qty||'')}"/>
    <input type="text" class="it-remarks" placeholder="Remarks" value="${esc(v.remarks||'')}"/>
    <button type="button">✕</button>`;
  row.querySelector('button').onclick = () => row.remove();
  return row;
}

document.getElementById('addItemBtn').addEventListener('click', () => itemsList.appendChild(emptyItemRow()));
document.getElementById('addBtn').addEventListener('click', () => openModal());
document.getElementById('cancelBtn').addEventListener('click', closeModal);

function openModal(entry = null) {
  editingId = entry ? entry.id : null;
  document.getElementById('modalTitle').textContent = entry ? 'Edit Data' : 'Tambah Data';
  document.getElementById('f_no').value = entry?.no || '';
  document.getElementById('f_date').value = entry?.date || (selectedDate || new Date().toISOString().slice(0,10));
  document.getElementById('f_namaTamu').value = entry?.namaTamu || '';
  document.getElementById('f_requestor').value = entry?.requestor || '';
  document.getElementById('f_peace').value = entry?.peace || '';
  document.getElementById('f_petugas').value = entry?.petugas || username || '';
  document.getElementById('f_pagi').value = entry?.pagi || 0;
  document.getElementById('f_siang').value = entry?.siang || 0;
  document.getElementById('f_malam').value = entry?.malam || 0;

  itemsList.innerHTML = '';
  const items = entry?.items?.length ? entry.items : [{}];
  items.forEach(it => itemsList.appendChild(emptyItemRow(it)));

  currentAttachments = entry?.attachments ? [...entry.attachments] : [];
  renderAttachments();
  modalOverlay.style.display = 'flex';
}

function closeModal() {
  modalOverlay.style.display = 'none';
  editingId = null;
  document.getElementById('entryForm').reset();
}

function renderAttachments() {
  attachmentsList.innerHTML = currentAttachments.map((a,i) =>
    `<span class="attachment-chip">
      <a href="${a.url}" target="_blank">${esc(a.filename)}</a>
      <button type="button" data-idx="${i}">✕</button>
    </span>`
  ).join('');
  attachmentsList.querySelectorAll('button').forEach(btn =>
    btn.addEventListener('click', () => { currentAttachments.splice(+btn.dataset.idx,1); renderAttachments(); })
  );
}

document.getElementById('fileInput').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = await api('/api/upload', { method:'POST', body:JSON.stringify({ filename:file.name, dataBase64:reader.result.split(',')[1] }) });
      currentAttachments.push({ url:data.url, filename:data.filename });
      renderAttachments();
    } catch(err) { alert('Gagal upload: ' + err.message); }
    e.target.value = '';
  };
  reader.readAsDataURL(file);
});

document.getElementById('entryForm').addEventListener('submit', async e => {
  e.preventDefault();
  const items = [...itemsList.querySelectorAll('.item-row')].map(row => ({
    time: row.querySelector('.it-time').value,
    item: row.querySelector('.it-item').value,
    qty: row.querySelector('.it-qty').value,
    remarks: row.querySelector('.it-remarks').value,
  })).filter(it => it.time || it.item || it.qty || it.remarks);

  const payload = {
    no: document.getElementById('f_no').value ? +document.getElementById('f_no').value : undefined,
    date: document.getElementById('f_date').value,
    namaTamu: document.getElementById('f_namaTamu').value,
    requestor: document.getElementById('f_requestor').value,
    peace: document.getElementById('f_peace').value,
    petugas: document.getElementById('f_petugas').value,
    pagi: +document.getElementById('f_pagi').value || 0,
    siang: +document.getElementById('f_siang').value || 0,
    malam: +document.getElementById('f_malam').value || 0,
    items, attachments: currentAttachments,
  };

  try {
    if (editingId) {
      await api(`/api/entries/${editingId}`, { method:'PUT', body:JSON.stringify(payload) });
    } else {
      await api('/api/entries', { method:'POST', body:JSON.stringify(payload) });
    }
    closeModal();
    loadMonth();
  } catch(err) { alert('Gagal menyimpan: ' + err.message); }
});

window.openEdit = async (id) => {
  const entry = allEntries.find(e => e.id === id);
  if (entry) openModal(entry);
};

window.deleteEntry = async (id) => {
  if (!confirm('Hapus data ini?')) return;
  try {
    await api(`/api/entries/${id}`, { method:'DELETE' });
    loadMonth();
  } catch(err) { alert('Gagal menghapus: ' + err.message); }
};

// ---------- INIT ----------
loadMonth();
