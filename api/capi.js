// Conversions API لفيسبوك: بيبلّغ فيسبوك بكل حجز من السيرفر، عشان الحجوزات اللي البيكسل بيتوهها (آيفون / مانع إعلانات) متضيعش.
// بيستقبل كود الحجز من صفحة الحجز أو من الموقع، يتأكد إن الحجز موجود فعلاً في قاعدة البيانات، وبعدين يبعت "Lead" لفيسبوك
// بنفس الـ eventID اللي البيكسل بعته (كود الحجز)، ففيسبوك بيحسبهم حجز واحد مش اتنين.
// مفيش أي بيانات صحية بتتبعت (لا خدمة ولا تخصص) — بس رقم التليفون متشفّر SHA-256 زي ما فيسبوك بيطلب.
// الإعدادات في Vercel (Environment Variables): META_CAPI_TOKEN (لازم)، META_PIXEL_ID (اختياري)، META_TEST_CODE (اختياري للتجربة).
const crypto = require('crypto');

const PIXEL = process.env.META_PIXEL_ID || '865216456362855';
const FS = 'https://firestore.googleapis.com/v1/projects/new-era-dental-center/databases/(default)/documents';
const FS_KEY = 'AIzaSyDQ17UevaMBy2aVYxsrLNpdQCvn92uSKi0'; // نفس مفتاح الويب العام اللي في الصفحة
const ORIGINS = ['https://neweradentalcenter.com', 'https://www.neweradentalcenter.com', 'https://newera-booking.vercel.app'];
const sha = v => crypto.createHash('sha256').update(v).digest('hex');
const egPhone = p => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('0020')) d = d.slice(2); if (d.startsWith('01') && d.length === 11) d = '20' + d.slice(1); return /^201\d{9}$/.test(d) ? d : ''; };

module.exports = async (req, res) => {
  const o = req.headers.origin || '';
  if (ORIGINS.includes(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return res.status(204).end(); // لسه متظبطش — الصفحة بتكمل عادي
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const code = String(b.code || '').toUpperCase();
    if (!/^[A-Z0-9]{6,12}$/.test(code)) return res.status(400).json({ ok: false });
    // الحجز لازم يكون موجود فعلاً (محدش يقدر يبعت حجوزات وهمية لفيسبوك)
    const chk = await fetch(`${FS}/online_bookings/${code}?key=${FS_KEY}`);
    // لو قراءات Firebase خلصت (429) أو السيرفر واقع، منقدرش نتأكد — بنبعت الحدث برضه بدل ما يضيع. 404 بس هو اللي بيترفض
    if (!chk.ok && chk.status !== 429 && chk.status < 500) return res.status(404).json({ ok: false });
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ph = egPhone(b.phone);
    const user_data = { client_user_agent: String(req.headers['user-agent'] || '').slice(0, 400) };
    if (ip) user_data.client_ip_address = ip;
    if (ph) user_data.ph = [sha(ph)];
    if (/^fb\.\d\.\d+\./.test(b.fbp || '')) user_data.fbp = String(b.fbp).slice(0, 200);
    if (/^fb\.\d\.\d+\./.test(b.fbc || '')) user_data.fbc = String(b.fbc).slice(0, 300);
    const url = /^https:\/\/(www\.)?(neweradentalcenter\.com|newera-booking\.vercel\.app)\//.test(b.url || '') ? String(b.url).split('?')[0] : 'https://newera-booking.vercel.app/';
    const body = { data: [{ event_name: 'Lead', event_time: Math.floor(Date.now() / 1000), event_id: code, action_source: 'website', event_source_url: url, user_data }] };
    if (process.env.META_TEST_CODE) body.test_event_code = process.env.META_TEST_CODE;
    const r = await fetch(`https://graph.facebook.com/v21.0/${PIXEL}/events?access_token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) console.error('capi', r.status, JSON.stringify(j).slice(0, 300));
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok });
  } catch (e) { console.error('capi', e.message); return res.status(500).json({ ok: false }); }
};
