const { getSupabase } = require('../../lib/supabase');
const { getUserFromRequest } = require('../../lib/auth');

function mapEntry(row) {
  return {
    id: row.id,
    date: row.date,
    no: row.no,
    namaTamu: row.nama_tamu,
    requestor: row.requestor,
    peace: row.peace,
    items: row.items || [],
    attachments: row.attachments || [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = async (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Belum login / sesi tidak valid' });

  const supabase = getSupabase();

  try {
    if (req.method === 'GET') {
      const { date } = req.query;
      let query = supabase.from('entries').select('*').order('no', { ascending: true });
      if (date) query = query.eq('date', date);
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json({ entries: data.map(mapEntry) });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.date || !body.namaTamu) {
        return res.status(400).json({ error: 'Tanggal dan Nama Tamu wajib diisi' });
      }

      let no = body.no;
      if (!no) {
        const { data: sameDate, error: cntErr } = await supabase
          .from('entries')
          .select('no')
          .eq('date', body.date);
        if (cntErr) throw cntErr;
        const maxNo = sameDate.reduce((m, r) => Math.max(m, r.no || 0), 0);
        no = maxNo + 1;
      }

      const { data, error } = await supabase
        .from('entries')
        .insert({
          date: body.date,
          no,
          nama_tamu: body.namaTamu,
          requestor: body.requestor || '',
          peace: body.peace || '',
          items: body.items || [],
          attachments: body.attachments || [],
          created_by: user.username,
        })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json({ entry: mapEntry(data) });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server' });
  }
};
