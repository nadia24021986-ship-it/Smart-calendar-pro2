const token = localStorage.getItem('csc_token');
const username = localStorage.getItem('csc_user');

if (!token) {
  window.location.href = '/index.html';
}

document.getElementById('userLabel').textContent = username ? `Masuk sebagai ${username}` : '';

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('csc_token');
  localStorage.removeItem('csc_user');
  window.location.href = '/index.html';
});

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
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

const datePicker = document.getElementById('datePicker');
const dateLabel = document.getElementById('dateLabel');
const tableWrap = document.getElementById('tableWrap');

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatTanggalIndo(isoDate) {
  const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', "JUM'AT", 'SABTU'];
  const months = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
  const d = new Date(isoDate + 'T00:00:00');
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

datePicker.value = todayISO();

document.getElementById('todayBtn').addEventListener('click', () => {
  datePicker.value = todayISO();
  loadEntries();
});

datePicker.addEventListener('change', loadEntries);

async function loadEntries() {
  dateLabel.textContent = formatTanggalIndo(datePicker.value);
  try {
    const { entries } = await api(`/api/entries?date=${datePicker.value}`);
    renderTable(entries);
  } catch (err) {
    tableWrap.innerHTML = `<div class="empty-state">Gagal memuat data: ${err.message}</div>`;
  }
}

function renderTable(entries) {
  if (!entries.length) {
    tableWrap.innerHTML = `<div class="empty-state">Belum ada data untuk tanggal ini. Klik "+ Tambah Data" untuk mulai.</div>`;
    return;
  }

  let rows = '';
  entries.forEach((entry) => {
    const items = entry.items && entry.items.length ? entry.items : [{ time: '', item: '', qty: '', remarks: '' }];
    items.forEach((it, idx) => {
      const isFirst = idx === 0;
      rows += `<tr class="${isFirst ? 'group-start' : ''}">
        <td class="no-cell">${isFirst ? (entry.no ?? '') : ''}</td>
        <td class="nama-cell">${isFirst ? escapeHtml(entry.namaTamu) : ''}</td>
        <td class="req-cell">${isFirst ? escapeHtml(entry.requestor) : ''}</td>
        <td class="peace-cell">${isFirst ? escapeHtml(entry.peace) : ''}</td>
        <td>${escapeHtml(it.time)}</td>
        <td>${escapeHtml(it.item)}</td>
        <td class="qty-cell">${escapeHtml(it.qty)}</td>
        <td>${escapeHtml(it.remarks)}</td>
        <td class="actions-cell">${isFirst ? `
          <button title="Edit" onclick="openEdit('${entry.id}')">✏️</button>
          <button title="Hapus" onclick="deleteEntry('${entry.id}')">🗑️</button>
        ` : ''}</td>
      </tr>`;
    });
    if (entry.attachments && entry.attachments.length) {
      rows += `<tr><td></td><td colspan="8" style="font-size:12px;color:var(--muted);">
        Lampiran: ${entry.attachments.map(a => `<a href="${a.url}" target="_blank">${escapeHtml(a.filename)}</a>`).join(', ')}
      </td></tr>`;
    }
  });

  tableWrap.innerHTML = `
    <table class="record-table">
      <thead>
        <tr>
          <th style="width:36px;">No</th>
          <th>Nama Tamu</th>
          <th>Requestor</th>
          <th>Pleace</th>
          <th style="width:60px;">Time</th>
          <th>Item</th>
          <th style="width:55px;">Qty</th>
          <th>Remarks</th>
          <th style="width:70px;">Aksi</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const modalOverlay = document.getElementById('modalOverlay');
const entryForm = document.getElementById('entryForm');
const itemsList = document.getElementById('itemsList');
const attachmentsList = document.getElementById('attachmentsList');
let editingId = null;
let currentAttachments = [];

function emptyItemRow(values = {}) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input type="text" placeholder="Jam" class="it-time" value="${escapeHtml(values.time || '')}" />
    <input type="text" placeholder="Item" class="it-item" value="${escapeHtml(values.item || '')}" />
    <input type="text" placeholder="Qty" class="it-qty" value="${escapeHtml(values.qty || '')}" />
    <input type="text" placeholder="Remarks" class="it-remarks" value="${escapeHtml(values.remarks || '')}" />
    <button type="button" title="Hapus item">✕</button>
  `;
  row.querySelector('button').addEventListener('click', () => row.remove());
  return row;
}

document.getElementById('addItemBtn').addEventListener('click', () => {
  itemsList.appendChild(emptyItemRow());
});

document.getElementById('addBtn').addEventListener('click', () => openModal());
document.getElementById('cancelBtn').addEventListener('click', closeModal);

function openModal(entry = null) {
  editingId = entry ? entry.id : null;
  document.getElementById('modalTitle').textContent = entry ? 'Edit Data' : 'Tambah Data';
  document.getElementById('f_no').value = entry ? (entry.no || '') : '';
  document.getElementById('f_date').value = entry ? entry.date : datePicker.value;
  document.getElementById('f_namaTamu').value = entry ? entry.namaTamu : '';
  document.getElementById('f_requestor').value = entry ? entry.requestor : '';
  document.getElementById('f_peace').value = entry ? entry.peace : '';

  itemsList.innerHTML = '';
  const items = entry && entry.items && entry.items.length ? entry.items : [{}];
  items.forEach((it) => itemsList.appendChild(emptyItemRow(it)));

  currentAttachments = entry && entry.attachments ? [...entry.attachments] : [];
  renderAttachments();

  modalOverlay.style.display = 'flex';
}

function closeModal() {
  modalOverlay.style.display = 'none';
  entryForm.reset();
  editingId = null;
}

function renderAttachments() {
  attachmentsList.innerHTML = currentAttachments.map((a, i) => `
    <span class="attachment-chip">
      <a href="${a.url}" target="_blank">${escapeHtml(a.filename)}</a>
      <button type="button" data-idx="${i}">✕</button>
    </span>
  `).join('');
  attachmentsList.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentAttachments.splice(Number(btn.dataset.idx), 1);
      renderAttachments();
    });
  });
}

document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result.split(',')[1];
    try {
      const data = await api('/api/upload', {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, dataBase64: base64 }),
      });
      currentAttachments.push({ url: data.url, filename: data.filename });
      renderAttachments();
    } catch (err) {
      alert('Gagal mengunggah berkas: ' + err.message);
    }
    e.target.value = '';
  };
  reader.readAsDataURL(file);
});

entryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const items = [...itemsList.querySelectorAll('.item-row')].map((row) => ({
    time: row.querySelector('.it-time').value,
    item: row.querySelector('.it-item').value,
    qty: row.querySelector('.it-qty').value,
    remarks: row.querySelector('.it-remarks').value,
  })).filter((it) => it.time || it.item || it.qty || it.remarks);

  const payload = {
    no: document.getElementById('f_no').value ? Number(document.getElementById('f_no').value) : undefined,
    date: document.getElementById('f_date').value,
    namaTamu: document.getElementById('f_namaTamu').value,
    requestor: document.getElementById('f_requestor').value,
    peace: document.getElementById('f_peace').value,
    items,
    attachments: currentAttachments,
  };

  try {
    if (editingId) {
      await api(`/api/entries/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/entries', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeModal();
    datePicker.value = payload.date;
    loadEntries();
  } catch (err) {
    alert('Gagal menyimpan: ' + err.message);
  }
});

window.openEdit = async (id) => {
  try {
    const { entries } = await api(`/api/entries?date=${datePicker.value}`);
    const entry = entries.find((e) => e.id === id);
    if (entry) openModal(entry);
  } catch (err) {
    alert('Gagal memuat data: ' + err.message);
  }
};

window.deleteEntry = async (id) => {
  if (!confirm('Hapus data ini?')) return;
  try {
    await api(`/api/entries/${id}`, { method: 'DELETE' });
    loadEntries();
  } catch (err) {
    alert('Gagal menghapus: ' + err.message);
  }
};

loadEntries();
