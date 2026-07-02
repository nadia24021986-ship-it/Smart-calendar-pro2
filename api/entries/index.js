const { getSupabase } = require('../../lib/supabase');
const { getUserFromRequest } = require('../../lib/auth');

function mapEntry(row) {
  return {
    id: row.id, date: row.date, no: row.no,
    namaTamu: row.nama_tamu,
    requestor: row.requestor || '',
    peace: row.peace || '',
    waktu: row.waktu || '',
    jumlah: row.jumlah || 0,
    keterangan: row.keterangan || '',
    ekstra: row.makanan_tambahan || [],
    items: row.items || [],
    attachments: row.attachments || [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = async (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Belum login' });
  const supabase = getSupabase();
  try {
    if (req.method === 'GET') {
      const { date, month, year } = req.query;
      let query = supabase.from('entries').select('*').order('no', { ascending: true });
      if (date) query = query.eq('date', date);
      if (month && year) {
        const from = `${year}-${String(month).padStart(2,'0')}-01`;
        const last = new Date(year, month, 0).getDate();
        const to = `${year}-${String(month).padStart(2,'0')}-${last}`;
        query = query.gte('date', from).lte('date', to);
      }
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json({ entries: data.map(mapEntry) });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.date || !body.namaTamu) return res.status(400).json({ error: 'Tanggal dan Nama Tamu wajib' });
      let no = body.no;
      if (!no) {
        const { data: same } = await supabase.from('entries').select('no').eq('date', body.date);
        no = same ? Math.max(0, ...same.map(r => r.no || 0)) + 1 : 1;
      }
      const { data, error } = await supabase.from('entries').insert({
        date: body.date, no,
        nama_tamu: body.namaTamu,
        requestor: body.requestor || '',
        peace: body.peace || '',
        waktu: body.waktu || '',
        jumlah: body.jumlah || 0,
        keterangan: body.keterangan || '',
        makanan_tambahan: body.ekstra || [],
        items: body.items || [],
        attachments: body.attachments || [],
        created_by: user.username,
      }).select().single();
      if (error) throw error;
      return res.status(201).json({ entry: mapEntry(data) });
    }
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
