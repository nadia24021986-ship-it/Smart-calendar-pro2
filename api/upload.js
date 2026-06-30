const { getSupabase } = require('../lib/supabase');
const { getUserFromRequest } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  }

  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Belum login / sesi tidak valid' });

  try {
    const { filename, dataBase64 } = req.body || {};
    if (!filename || !dataBase64) {
      return res.status(400).json({ error: 'File tidak lengkap' });
    }

    const supabase = getSupabase();
    const ext = filename.includes('.') ? filename.split('.').pop() : '';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? '.' + ext : ''}`;
    const buffer = Buffer.from(dataBase64, 'base64');

    const contentTypeMap = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
    };

    const { error: uploadErr } = await supabase.storage
      .from('attachments')
      .upload(path, buffer, {
        contentType: contentTypeMap[ext.toLowerCase()] || 'application/octet-stream',
        upsert: false,
      });
    if (uploadErr) throw uploadErr;

    const { data: publicUrlData } = supabase.storage.from('attachments').getPublicUrl(path);

    return res.status(201).json({
      url: publicUrlData.publicUrl,
      filename,
      storedAs: path,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server' });
  }
};
