import { ingestForAllStaleUsers } from '../../../lib/ingestContent.js';

export default async function handler(req, res) {
  // Protect with Authorization header as recommended by Vercel
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    await ingestForAllStaleUsers();
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
} 