const { getSupabase } = require('../lib/supabase');
const { hashPassword, makeSalt, createToken } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  }

  try {
    const { username, password } = req.body || {};
    const cleanUsername = (username || '').trim();
    if (!cleanUsername) {
      return res.status(400).json({ error: 'Nama pengguna wajib diisi' });
    }

    const supabase = getSupabase();

    const { data: existingUser, error: findErr } = await supabase
      .from('users')
      .select('*')
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (findErr) throw findErr;

    let user = existingUser;

    if (!user) {
      const salt = makeSalt();
      const { data: created, error: insertErr } = await supabase
        .from('users')
        .insert({
          username: cleanUsername,
          salt,
          password_hash: password ? hashPassword(password, salt) : null,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;
      user = created;
    } else if (user.password_hash) {
      if (!password || hashPassword(password, user.salt) !== user.password_hash) {
        return res.status(401).json({ error: 'Kata sandi salah' });
      }
    }

    const token = createToken({ sub: user.id, username: user.username });
    return res.status(200).json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan server' });
  }
};
