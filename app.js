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
  const total = entries.reduce((s,e) => {
    const sess = e.sessions && e.sessions.length ? e.sessions : [];
    return s + sess.reduce((a,b) => a + (b.jumlah||0), 0);
  }, 0);
  document.getElementById('totalJumlah').textContent = total;
}

function populateFilter(entries) {
  const sel = document.getElementById('filterPeace');
  const cur = sel.value;
  const places = new Set();
  entries.forEach(e => {
    (e.sessions||[]).forEach(s => { if(s.peace) places.add(s.peace); });
  });
  sel.innerHTML = '<option value="">Semua Mess</option>' + [...places].sort().map(p => `<option value="${p}">${p}</option>`).join('');
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
    (e.requestor||'').toLowerCase().includes(q) ||
    (e.sessions||[]).some(s =>
      (s.peace||'').toLowerCase().includes(q) ||
      (s.keterangan||'').toLowerCase().includes(q)
    )
  );
  if (peace) data = data.filter(e => (e.sessions||[]).some(s => s.peace === peace));
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

function getSessions(entry) {
  if (entry.sessions && entry.sessions.length) return entry.sessions;
  // backward compat: convert old flat fields
  return [{
    waktu: entry.waktu || (entry.waktuList && entry.waktuList[0]) || '',
    jumlah: entry.jumlah || 0,
    ekstra: entry.ekstra || [],
    peace: entry.peace || '',
    keterangan: entry.keterangan || '',
  }];
}

function renderTable(entries) {
  const wrap = document.getElementById('tableWrap');
  const badge = document.getElementById('badgeDate');
  badge.textContent = selectedDate ? `📅 ${formatDate(selectedDate)}` : `📅 ${MONTHS[currentMonth-1]} ${currentYear}`;

  if (!entries.length) {
    wrap.innerHTML = `<div class="empty-state">${selectedDate ? 'Tidak ada data untuk tanggal ini.' : 'Belum ada data bulan ini.'}</div>`;
    return;
  }

  let rows = '';
  entries.forEach((e, i) => {
    const sessions = getSessions(e);
    sessions.forEach((sess, sIdx) => {
      const isFirst = sIdx === 0;
      const ekstraHtml = (sess.ekstra||[]).map(x =>
        `<span class="ekstra-chip">${esc(typeof x === 'string' ? x : x.nama)}</span>`
      ).join('') || '<span style="color:#ccc">-</span>';
      const waktuHtml = sess.waktu ? `<span class="waktu-badge">⏰ ${esc(sess.waktu)}</span>` : '<span style="color:#ccc">-</span>';
      rows += `<tr class="${isFirst ? 'entry-first' : 'entry-cont'}">
        <td style="text-align:center;font-weight:800;color:var(--primary);">${isFirst ? (e.no||i+1) : ''}</td>
        <td>${isFirst ? `<strong>${esc(e.namaTamu)}</strong>${e.requestor ? `<br><small style="color:var(--muted);font-size:11px;">📋 ${esc(e.requestor)}</small>` : ''}` : ''}</td>
        <td>${waktuHtml}</td>
        <td style="text-align:center;font-weight:800;font-size:15px;color:var(--primary);">${sess.jumlah||0}</td>
        <td>${ekstraHtml}</td>
        <td>${esc(sess.peace)}</td>
        <td style="font-size:12px;color:var(--muted);">${esc(sess.keterangan)}</td>
        <td class="actions-cell">${isFirst ? `
          <button onclick="openEdit('${e.id}')" title="Edit">✏️</button>
          <button onclick="deleteEntry('${e.id}')" title="Hapus">🗑️</button>
        ` : ''}</td>
      </tr>`;
    });
  });

  wrap.innerHTML = `<table class="record-table">
    <thead><tr>
      <th>No</th><th>Tamu</th><th>Waktu</th>
      <th>Jumlah</th><th>Ekstra</th>
      <th>Mess / Lokasi</th><th>Keterangan</th><th>Aksi</th>
    </tr></thead>
    <tbody>${rows}</tbody>
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
  } else {
    data = allEntries;
    rangeLabel = `${MONTHS[currentMonth-1]} ${currentYear}`;
  }

  if (format === 'jpg') { exportJPG(data, rangeLabel); return; }

  // CSV: expand sessions
  const header = ['No','Nama Tamu','Requester','Waktu','Jumlah','Ekstra','Mess/Lokasi','Keterangan'];
  const rows = [];
  data.forEach((e, i) => {
    const sessions = getSessions(e);
    sessions.forEach((sess, sIdx) => {
      rows.push([
        sIdx === 0 ? (e.no||i+1) : '',
        sIdx === 0 ? e.namaTamu : '',
        sIdx === 0 ? e.requestor : '',
        sess.waktu||'',
        sess.jumlah||0,
        (sess.ekstra||[]).map(x => typeof x === 'string' ? x : x.nama).join('; '),
        sess.peace||'',
        sess.keterangan||''
      ]);
    });
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

  let tableRows = '';
  let totalJml = 0;
  data.forEach((e, i) => {
    const sessions = getSessions(e);
    sessions.forEach((sess, sIdx) => {
      const isFirst = sIdx === 0;
      const eks = (sess.ekstra||[]).map(x => typeof x === 'string' ? x : x.nama).join(', ') || '-';
      totalJml += sess.jumlah || 0;
      tableRows += `<tr style="background:${(i % 2 === 0) ? '#f5f7fd' : 'white'}">
        <td style="padding:7px 9px;border:1px solid #c5d5f5;text-align:center;font-weight:800;color:#1e2d5a;">${isFirst ? (e.no||i+1) : ''}</td>
        <td style="padding:7px 9px;border:1px solid #c5d5f5;font-weight:${isFirst?'700':'400'}">${isFirst ? (e.namaTamu||'') : ''}<br>${isFirst && e.requestor ? `<small style="color:#6b7396;font-size:10px;">${e.requestor}</small>` : ''}</td>
        <td style="padding:7px 9px;border:1px solid #c5d5f5;font-weight:700;color:#1e2d5a;">${sess.waktu||'-'}</td>
        <td style="padding:7px 9px;border:1px solid #c5d5f5;text-align:center;font-weight:800;color:#1e2d5a;">${sess.jumlah||0}</td>
        <td style="padding:7px 9px;border:1px solid #c5d5f5;font-size:11px;">${eks}</td>
        <td style="padding:7px 9px;border:1px solid #c5d5f5;">${sess.peace||''}</td>
        <td style="padding:7px 9px;border:1px solid #c5d5f5;font-size:11px;color:#6b7396;">${sess.keterangan||''}</td>
      </tr>`;
    });
  });

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;top:-9999px;left:-9999px;background:white;padding:28px;width:980px;font-family:Arial,sans-serif;';
  wrap.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;border-bottom:3px solid #1e2d5a;padding-bottom:14px;">
      <div>
        <div style="font-size:20px;font-weight:900;color:#1e2d5a;letter-spacing:1px;">DAILY RECORD FOOD & DRINK</div>
        <div style="font-size:13px;font-weight:700;margin-top:5px;color:#6b7396;">${rangeLabel}</div>
      </div>
      <div style="text-align:right;">
        <img src="/logo.png" style="height:40px;object-fit:contain;" onerror="this.style.display='none'"/>
        <div style="font-size:11px;color:#c9a84c;font-weight:700;margin-top:4px;">hendrosapp.com</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;border:2px solid #1e2d5a;">
      <thead>
        <tr style="background:#1e2d5a;color:white;">
          <th style="padding:9px 9px;border:1px solid #2d4080;text-align:left;">No</th>
          <th style="padding:9px 9px;border:1px solid #2d4080;text-align:left;">Tamu</th>
          <th style="padding:9px 9px;border:1px solid #2d4080;text-align:left;">Waktu</th>
          <th style="padding:9px 9px;border:1px solid #2d4080;text-align:center;">Jumlah</th>
          <th style="padding:9px 9px;border:1px solid #2d4080;text-align:left;">Ekstra</th>
          <th style="padding:9px 9px;border:1px solid #2d4080;text-align:left;">Mess/Lokasi</th>
          <th style="padding:9px 9px;border:1px solid #2d4080;text-align:left;">Keterangan</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
      <tfoot>
        <tr style="background:#e8f0fe;font-weight:800;">
          <td colspan="3" style="padding:9px;border:1px solid #c5d5f5;color:#1e2d5a;">TOTAL</td>
          <td style="padding:9px;border:1px solid #c5d5f5;text-align:center;color:#1e2d5a;font-weight:900;">${totalJml}</td>
          <td colspan="3" style="padding:9px;border:1px solid #c5d5f5;"></td>
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

// MODAL — SESSION BLOCKS
const modalOverlay = document.getElementById('modalOverlay');
const sessionsList = document.getElementById('sessionsList');
let editingId = null;

function makeEkstraRow(nama = '') {
  const row = document.createElement('div');
  row.className = 'ekstra-row';
  row.innerHTML = `<input type="text" class="ek-nama" placeholder="Nama ekstra" value="${esc(nama)}"/><button type="button">✕</button>`;
  row.querySelector('button').onclick = () => row.remove();
  return row;
}

function makeSessionBlock(sess = {}) {
  const block = document.createElement('div');
  block.className = 'session-block';
  block.innerHTML = `
    <div class="session-top">
      <div>
        <label>Waktu</label>
        <input type="time" class="sess-waktu" value="${esc(sess.waktu||'')}"/>
      </div>
      <div>
        <label>Jumlah</label>
        <input type="number" class="sess-jumlah" min="0" value="${sess.jumlah||0}"/>
      </div>
    </div>
    <div class="session-bottom">
      <div>
        <label>Mess / Lokasi</label>
        <input type="text" class="sess-peace" placeholder="Mess atau lokasi" value="${esc(sess.peace||'')}"/>
      </div>
      <div>
        <label>Keterangan</label>
        <input type="text" class="sess-keterangan" placeholder="Catatan..." value="${esc(sess.keterangan||'')}"/>
      </div>
    </div>
    <div class="session-ekstra-wrap">
      <label>Ekstra</label>
      <div class="sess-ekstra-list"></div>
    </div>
    <div class="session-footer">
      <button type="button" class="add-ekstra-btn-sm">+ Ekstra</button>
      <button type="button" class="remove-session-btn">✕ Hapus Waktu Ini</button>
    </div>
  `;

  // Populate existing ekstra
  const ekList = block.querySelector('.sess-ekstra-list');
  (sess.ekstra||[]).forEach(x => {
    const nama = typeof x === 'string' ? x : x.nama;
    ekList.appendChild(makeEkstraRow(nama));
  });

  block.querySelector('.add-ekstra-btn-sm').onclick = () => ekList.appendChild(makeEkstraRow());
  block.querySelector('.remove-session-btn').onclick = () => {
    if (sessionsList.querySelectorAll('.session-block').length > 1) {
      block.remove();
    } else {
      showToast('Minimal satu waktu makan harus ada');
    }
  };

  return block;
}

document.getElementById('addSessionBtn').addEventListener('click', () => {
  sessionsList.appendChild(makeSessionBlock());
});

document.getElementById('cancelBtn').addEventListener('click', closeModal);

window.openModal = function(entry = null) {
  editingId = entry ? entry.id : null;
  document.getElementById('modalTitle').textContent = entry ? 'Edit Data' : 'Tambah Data';
  document.getElementById('f_date').value = entry?.date || selectedDate || todayISO();
  document.getElementById('f_date_end').value = '';
  document.getElementById('f_namaTamu').value = entry?.namaTamu || '';
  document.getElementById('f_requestor').value = entry?.requestor || '';

  sessionsList.innerHTML = '';
  const sessions = entry ? getSessions(entry) : [{}];
  sessions.forEach(s => sessionsList.appendChild(makeSessionBlock(s)));

  modalOverlay.style.display = 'flex';
};

function closeModal() {
  modalOverlay.style.display = 'none';
  editingId = null;
  document.getElementById('entryForm').reset();
}

function readSessions() {
  return [...sessionsList.querySelectorAll('.session-block')].map(block => {
    const ekstra = [...block.querySelectorAll('.ek-nama')].map(inp => ({ nama: inp.value })).filter(x => x.nama.trim());
    return {
      waktu: block.querySelector('.sess-waktu').value,
      jumlah: +block.querySelector('.sess-jumlah').value || 0,
      peace: block.querySelector('.sess-peace').value,
      keterangan: block.querySelector('.sess-keterangan').value,
      ekstra,
    };
  });
}

document.getElementById('entryForm').addEventListener('submit', async e => {
  e.preventDefault();
  const sessions = readSessions();
  const dateStart = document.getElementById('f_date').value;
  const dateEndVal = document.getElementById('f_date_end').value;
  const base = {
    namaTamu: document.getElementById('f_namaTamu').value,
    requestor: document.getElementById('f_requestor').value,
    sessions,
    petugas: username || '',
  };

  const dates = [];
  const startD = new Date(dateStart + 'T00:00:00');
  const endD = dateEndVal ? new Date(dateEndVal + 'T00:00:00') : new Date(dateStart + 'T00:00:00');
  if (endD < startD) { alert('Tanggal keluar tidak boleh sebelum tanggal masuk'); return; }
  const cur = new Date(startD);
  while (cur <= endD) { dates.push(localISO(cur)); cur.setDate(cur.getDate() + 1); }

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
