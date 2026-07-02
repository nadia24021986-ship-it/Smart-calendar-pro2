const { getSupabase } = require('../../lib/supabase');
const { getUserFromRequest } = require('../../lib/auth');

function mapEntry(row) {
  return {
    id: row.id, date: row.date, no: row.no,
    namaTamu: row.nama_tamu,
    requestor: row.requestor || '',
    peace: row.peace || '',
    waktuList: row.waktu_list || [],
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
  const { id } = req.query;
  const supabase = getSupabase();
  try {
    if (req.method === 'PUT') {
      const body = req.body || {};
      const update = { updated_at: new Date().toISOString() };
      if (body.date !== undefined) update.date = body.date;
      if (body.no !== undefined) update.no = body.no;
      if (body.namaTamu !== undefined) update.nama_tamu = body.namaTamu;
      if (body.requestor !== undefined) update.requestor = body.requestor;
      if (body.peace !== undefined) update.peace = body.peace;
      if (body.waktuList !== undefined) update.waktu_list = body.waktuList;
      if (body.jumlah !== undefined) update.jumlah = body.jumlah;
      if (body.keterangan !== undefined) update.keterangan = body.keterangan;
      if (body.ekstra !== undefined) update.makanan_tambahan = body.ekstra;
      if (body.items !== undefined) update.items = body.items;
      if (body.attachments !== undefined) update.attachments = body.attachments;
      const { data, error } = await supabase.from('entries').update(update).eq('id', id).select().single();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Data tidak ditemukan' });
      return res.status(200).json({ entry: mapEntry(data) });
    }
    if (req.method === 'DELETE') {
      const { error } = await supabase.from('entries').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
