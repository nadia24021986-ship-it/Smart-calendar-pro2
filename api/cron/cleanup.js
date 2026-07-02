const { getSupabase } = require('../../lib/supabase');

module.exports = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const supabase = getSupabase();
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    const { error } = await supabase.from('entries').delete().lt('date', cutoffDate);
    if (error) throw error;
    return res.status(200).json({ ok: true, deleted_before: cutoffDate });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
