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
  if (res.status === 401) {
    localStorage.removeItem('csc_token');
    window.location.href = '/index.html';
    throw new Error('Sesi berakhir');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

function localISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function todayISO() { return localISO(new Date()); }

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let selectedDate = null;
let allEntries = [];

const DAYS = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'toast'; }, 2500);
}

function renderCalendar(entries) {
  const grid = document.getElementById('calGrid');
  document.getElementById('monthLabel').textContent = `${MONTHS[currentMonth-1]} ${currentYear}`;
  const countByDate = {};
  entries.forEach(e => { countByDate[e.date] = (countByDate[e.date] || 0) + 1; });
  const today = todayISO();
  const firstDay = new Date(currentYear, currentMonth-1, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const prevDays = new Date(currentYear, currentMonth-1, 0).getDate();
  let html = DAYS.map(d => `<div class="cal-day-header">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day other-month"><span class="cal-num">${prevDays - firstDay + i + 1}</span></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const count = countByDate[iso] || 0;
    const cls = ['cal-day', count ? 'has-data' : '', iso === today ? 'today' : '', iso === selectedDate ? 'selected' : ''].filter(Boolean).join(' ');
    html += `<div class="${cls}" onclick="selectDate('${iso}')">
      <span class="cal-num">${d}</span>
      ${count ? `<span class="cal-count">${count}</span>` : ''}
    </div>`;
  }
  const remaining = 42 - firstDay - daysInMonth;
  for (let d = 1; d <= Math.max(0, remaining); d++) {
    html += `<div class="cal-day other-month"><span class="cal-num">${d}</span></div>`;
  }
  grid.innerHTML = html;
}

document.getElementById('prevMonth').addEventListener('click', () => {
  currentMonth--; if (currentMonth < 1) { currentMonth = 12; currentYear--; }
  selectedDate = null; loadMonth();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  currentMonth++; if (currentMonth > 12) { currentMonth = 1; currentYear++; }
  selectedDate = null; loadMonth();
});
document.getElementById('showAllBtn').addEventListener('click', () => {
  selectedDate = null; renderCalendar(allEntries); renderTable(allEntries);
});

window.selectDate = function(iso) {
  selectedDate = iso;
  renderCalendar(allEntries);
  renderTable(allEntries.filter(e => e.date === iso));
};

async function loadMonth() {
  renderCalendar([]);
  try {
    const { entries } = await api(`/api/entries?month=${currentMonth}&year=${currentYear}`);
    allEntries = entries;
    renderCalendar(entries);
    renderTable(selectedDate ? entries.filter(e => e.date === selectedDate) : entries);
    updateSummary(entries);
    populateFilter(entries);
  } catch(err) {
    document.getElementById('tableWrap').innerHTML = `<div class="empty-state">Gagal memuat: ${err.message}</div>`;
  }
}

function updateSummary(entries) {
  document.getElementById('totalTamu').textContent = entries.length;
  document.getElementById('totalJumlah').textContent = entries.reduce((s,e) => s+(e.jumlah||0), 0);
}

function populateFilter(entries) {
  const sel = document.getElementById('filterPeace');
  const cur = sel.value;
  const places = [...new Set(entries.map(e => e.peace).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Semua Mess</option>' + places.map(p => `<option value="${p}">${p}</option>`).join('');
  if (cur) sel.value = cur;
}

document.getElementById('searchInput').addEventListener('input', applyFilter);
document.getElementById('filterPeace').addEventListener('change', applyFilter);

function applyFilter() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const peace = document.getElementById('filterPeace').value;
  let data = selectedDate ? allEntries.filter(e => e.date === selectedDate) : allEntries;
  if (q) data = data.filter(e =>
    (e.namaTamu||'').toLowerCase().includes(q) ||
    (e.peace||'').toLowerCase().includes(q) ||
    (e.keterangan||'').toLowerCase().includes(q) ||
    (e.requestor||'').toLowerCase().includes(q)
  );
  if (peace) data = data.filter(e => e.peace === peace);
  renderTable(data);
}

function esc(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
}

function renderTable(entries) {
  const wrap = document.getElementById('tableWrap');
  const badge = document.getElementById('badgeDate');
  badge.textContent = selectedDate ? `📅 ${formatDate(selectedDate)}` : `📅 ${MONTHS[currentMonth-1]} ${currentYear}`;

  if (!entries.length) {
    wrap.innerHTML = `<div class="empty-state">${selectedDate ? 'Tidak ada data untuk tanggal ini.' : 'Belum ada data bulan ini.'}</div>`;
    return;
  }

  wrap.innerHTML = `<table class="record-table">
    <thead><tr>
      <th>No</th>
      <th>Tamu</th>
      <th>Mess / Lokasi</th>
      <th>Waktu</th>
      <th>Ekstra</th>
      <th>Jumlah</th>
      <th>Keterangan</th>
      <th>Aksi</th>
    </tr></thead>
    <tbody>
      ${entries.map((e,i) => {
        const waktuList = Array.isArray(e.waktuList) ? e.waktuList : (e.waktu ? [e.waktu] : []);
        const waktuHtml = waktuList.length
          ? waktuList.map(w => `<span class="waktu-badge">⏰ ${esc(w)}</span>`).join('')
          : '<span style="color:#ccc">-</span>';
        const ekstra = (e.ekstra||[]).map(x =>
          `<span class="ekstra-chip">${esc(typeof x === 'string' ? x : x.nama)}</span>`
        ).join('');
        return `<tr>
          <td style="text-align:center;font-weight:800;color:var(--primary);">${e.no||i+1}</td>
          <td>
            <strong>${esc(e.namaTamu)}</strong>
            ${e.requestor ? `<br><small style="color:var(--muted);font-size:11px;">📋 ${esc(e.requestor)}</small>` : ''}
          </td>
          <td>${esc(e.peace)}</td>
          <td>${waktuHtml}</td>
          <td>${ekstra || '<span style="color:#ccc;font-size:12px;">-</span>'}</td>
          <td style="text-align:center;font-weight:800;font-size:15px;color:var(--primary);">${e.jumlah||0}</td>
          <td style="font-size:12px;color:var(--muted);">${esc(e.keterangan)}</td>
          <td class="actions-cell">
            <button onclick="openEdit('${e.id}')" title="Edit">✏️</button>
            <button onclick="deleteEntry('${e.id}')" title="Hapus">🗑️</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

// EXPORT
document.getElementById('exportBtn').addEventListener('click', () => {
  document.getElementById('exportMenu').classList.toggle('open');
});
document.addEventListener('click', e => {
  if (!e.target.closest('.export-wrap')) document.getElementById('exportMenu').classList.remove('open');
});

window.exportData = function(range, format = 'csv') {
  document.getElementById('exportMenu').classList.remove('open');
  const today = new Date();
  let data = [];
  let rangeLabel = '';

  if (range === 'date') {
    const targetDate = selectedDate || todayISO();
    data = allEntries.filter(e => e.date === targetDate);
    rangeLabel = formatDate(targetDate);
  } else if (range === 'week') {
    const start = new Date(today); start.setDate(today.getDate() - today.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 6);
    data = allEntries.filter(e => e.date >= localISO(start) && e.date <= localISO(end));
    rangeLabel = `${localISO(start)} s/d ${localISO(end)}`;
  } else if (range === 'month') {
    data = allEntries;
    rangeLabel = `${MONTHS[currentMonth-1]} ${currentYear}`;
  }

  if (format === 'jpg') { exportJPG(data, rangeLabel); return; }

  const header = ['No','Nama Tamu','Requester','Mess/Lokasi','Waktu','Ekstra','Jumlah','Keterangan'];
  const rows = data.map((e,i) => {
    const waktuList = Array.isArray(e.waktuList) ? e.waktuList : (e.waktu ? [e.waktu] : []);
    return [
      e.no||i+1, e.namaTamu, e.requestor, e.peace,
      waktuList.join('; '),
      (e.ekstra||[]).map(x => typeof x === 'string' ? x : x.nama).join('; '),
      e.jumlah||0, e.keterangan||''
    ];
  });
  const csv = [header,...rows].map(r => r.map(c=>`"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  a.download=`catering-${range}-${todayISO()}.csv`;
  a.click(); URL.revokeObjectURL(url);
};

async function exportJPG(data, rangeLabel) {
  if (!data.length) { showToast('Tidak ada data untuk diekspor'); return; }
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;top:-9999px;left:-9999px;background:white;padding:28px;width:960px;font-family:Arial,sans-serif;';
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;border-bottom:3px solid #1e2d5a;padding-bottom:14px;">
      <div>
        <div style="font-size:20px;font-weight:900;color:#1e2d5a;letter-spacing:1px;">DAILY RECORD FOOD & DRINK</div>
        <div style="font-size:13px;font-weight:700;margin-top:4px;color:#6b7396;">${rangeLabel}</div>
      </div>
      <div style="text-align:right;">
        <img src="/logo.png" style="height:40px;object-fit:contain;" onerror="this.style.display='none'"/>
        <div style="font-size:11px;color:#c9a84c;font-weight:700;margin-top:3px;">hendrosapp.com</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#1e2d5a;color:white;">
          <th style="padding:9px 8px;border:1px solid #2d4080;">No</th>
          <th style="padding:9px 8px;border:1px solid #2d4080;">Nama Tamu</th>
          <th style="padding:9px 8px;border:1px solid #2d4080;">Requester</th>
          <th style="padding:9px 8px;border:1px solid #2d4080;">Mess/Lokasi</th>
          <th style="padding:9px 8px;border:1px solid #2d4080;">Waktu</th>
          <th style="padding:9px 8px;border:1px solid #2d4080;">Ekstra</th>
          <th style="padding:9px 8px;border:1px solid #2d4080;text-align:center;">Jumlah</th>
          <th style="padding:9px 8px;border:1px solid #2d4080;">Keterangan</th>
        </tr>
      </thead>
      <tbody>
        ${data.map((e,i) => {
          const waktuList = Array.isArray(e.waktuList) ? e.waktuList : (e.waktu ? [e.waktu] : []);
          return `<tr style="background:${i%2===0?'#f5f7fd':'white'}">
            <td style="padding:7px 8px;border:1px solid #dde3f0;text-align:center;font-weight:800;color:#1e2d5a;">${e.no||i+1}</td>
            <td style="padding:7px 8px;border:1px solid #dde3f0;font-weight:700;">${e.namaTamu||''}</td>
            <td style="padding:7px 8px;border:1px solid #dde3f0;">${e.requestor||''}</td>
            <td style="padding:7px 8px;border:1px solid #dde3f0;">${e.peace||''}</td>
            <td style="padding:7px 8px;border:1px solid #dde3f0;">${waktuList.join(', ')||'-'}</td>
            <td style="padding:7px 8px;border:1px solid #dde3f0;font-size:11px;">${(e.ekstra||[]).map(x=>typeof x==='string'?x:x.nama).join(', ')||'-'}</td>
            <td style="padding:7px 8px;border:1px solid #dde3f0;text-align:center;font-weight:800;color:#1e2d5a;">${e.jumlah||0}</td>
            <td style="padding:7px 8px;border:1px solid #dde3f0;font-size:11px;">${e.keterangan||''}</td>
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot>
        <tr style="background:#e8f0fe;font-weight:800;">
          <td colspan="6" style="padding:9px 8px;border:1px solid #dde3f0;color:#1e2d5a;">TOTAL</td>
          <td style="padding:9px 8px;border:1px solid #dde3f0;text-align:center;color:#1e2d5a;">${data.reduce((s,e)=>s+(e.jumlah||0),0)}</td>
          <td style="padding:9px 8px;border:1px solid #dde3f0;"></td>
        </tr>
      </tfoot>
    </table>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:#aaa;margin-top:10px;">
      <span>hendrosapp.com | Smart Calendar Pro 2.0</span>
      <span>Dicetak: ${new Date().toLocaleString('id-ID')}</span>
    </div>
  `;
  document.body.appendChild(wrap);
  try {
    showToast('Membuat gambar...');
    const canvas = await html2canvas(wrap, { scale:2, backgroundColor:'#ffffff', useCORS:true });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.95);
    a.download = `catering-${todayISO()}.jpg`;
    a.click();
    showToast('✓ Gambar berhasil diunduh');
  } catch(err) {
    alert('Gagal ekspor: ' + err.message);
  } finally {
    document.body.removeChild(wrap);
  }
}

// MODAL
const modalOverlay = document.getElementById('modalOverlay');
const waktuList = document.getElementById('waktuList');
const ekstraList = document.getElementById('ekstraList');
let editingId = null;

function emptyWaktuRow(val = '') {
  const row = document.createElement('div');
  row.className = 'waktu-row';
  row.innerHTML = `
    <input type="time" class="wk-val" value="${esc(val)}"/>
    <button type="button">✕</button>`;
  row.querySelector('button').onclick = () => row.remove();
  return row;
}

function emptyEkstraRow(val = '') {
  const row = document.createElement('div');
  row.className = 'ekstra-row';
  const nama = typeof val === 'string' ? val : (val.nama || '');
  row.innerHTML = `
    <input type="text" class="ek-nama" placeholder="Nama ekstra makanan" value="${esc(nama)}"/>
    <button type="button">✕</button>`;
  row.querySelector('button').onclick = () => row.remove();
  return row;
}

document.getElementById('addWaktuBtn').addEventListener('click', () => waktuList.appendChild(emptyWaktuRow()));
document.getElementById('addEkstraBtn').addEventListener('click', () => ekstraList.appendChild(emptyEkstraRow()));
document.getElementById('cancelBtn').addEventListener('click', closeModal);

window.openModal = function(entry = null) {
  editingId = entry ? entry.id : null;
  document.getElementById('modalTitle').textContent = entry ? 'Edit Data' : 'Tambah Data';
  document.getElementById('f_date').value = entry?.date || selectedDate || todayISO();
  document.getElementById('f_date_end').value = '';
  document.getElementById('f_namaTamu').value = entry?.namaTamu || '';
  document.getElementById('f_requestor').value = entry?.requestor || '';
  document.getElementById('f_peace').value = entry?.peace || '';
  document.getElementById('f_jumlah').value = entry?.jumlah || 0;
  document.getElementById('f_keterangan').value = entry?.keterangan || '';

  waktuList.innerHTML = '';
  const waktuArr = Array.isArray(entry?.waktuList) ? entry.waktuList
    : (entry?.waktu ? [entry.waktu] : []);
  if (waktuArr.length) {
    waktuArr.forEach(w => waktuList.appendChild(emptyWaktuRow(w)));
  }

  ekstraList.innerHTML = '';
  const eks = entry?.ekstra?.length ? entry.ekstra : [];
  eks.forEach(x => ekstraList.appendChild(emptyEkstraRow(x)));

  modalOverlay.style.display = 'flex';
};

function closeModal() {
  modalOverlay.style.display = 'none';
  editingId = null;
  document.getElementById('entryForm').reset();
}

document.getElementById('entryForm').addEventListener('submit', async e => {
  e.preventDefault();

  const waktuArr = [...waktuList.querySelectorAll('.waktu-row')].map(row =>
    row.querySelector('.wk-val').value
  ).filter(v => v.trim());

  const ekstra = [...ekstraList.querySelectorAll('.ekstra-row')].map(row => ({
    nama: row.querySelector('.ek-nama').value,
  })).filter(x => x.nama.trim());

  const dateStart = document.getElementById('f_date').value;
  const dateEndVal = document.getElementById('f_date_end').value;

  const base = {
    namaTamu: document.getElementById('f_namaTamu').value,
    requestor: document.getElementById('f_requestor').value,
    peace: document.getElementById('f_peace').value,
    jumlah: +document.getElementById('f_jumlah').value || 0,
    keterangan: document.getElementById('f_keterangan').value,
    petugas: username || '',
    waktuList: waktuArr,
    ekstra,
  };

  const dates = [];
  const startD = new Date(dateStart + 'T00:00:00');
  const endD = dateEndVal ? new Date(dateEndVal + 'T00:00:00') : new Date(dateStart + 'T00:00:00');
  if (endD < startD) { alert('Tanggal keluar tidak boleh sebelum tanggal masuk'); return; }
  const cur = new Date(startD);
  while (cur <= endD) {
    dates.push(localISO(cur));
    cur.setDate(cur.getDate() + 1);
  }

  try {
    if (editingId) {
      await api(`/api/entries/${editingId}`, { method:'PUT', body:JSON.stringify({...base, date: dateStart}) });
      showToast('✓ Data berhasil diperbarui');
    } else {
      for (const date of dates) {
        await api('/api/entries', { method:'POST', body:JSON.stringify({...base, date}) });
      }
      showToast(dates.length > 1 ? `✓ ${dates.length} data berhasil disimpan` : '✓ Data berhasil disimpan');
    }
    closeModal();
    loadMonth();
  } catch(err) { alert('Gagal menyimpan: ' + err.message); }
});

window.openEdit = function(id) {
  const entry = allEntries.find(e => e.id === id);
  if (entry) openModal(entry);
};

window.deleteEntry = async function(id) {
  if (!confirm('Hapus data ini?')) return;
  try {
    await api(`/api/entries/${id}`, { method:'DELETE' });
    allEntries = allEntries.filter(e => e.id !== id);
    renderCalendar(allEntries);
    renderTable(selectedDate ? allEntries.filter(e => e.date === selectedDate) : allEntries);
    updateSummary(allEntries);
    showToast('✓ Data berhasil dihapus');
  } catch(err) { alert('Gagal menghapus: ' + err.message); }
};

loadMonth();
