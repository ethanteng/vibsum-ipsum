import cron from 'node-cron';
import { ingestForAllStaleUsers } from '../lib/ingestContent.js';

cron.schedule('0 * * * *', async () => {
  console.log('Running scheduled ingestion for all users...');
  await ingestForAllStaleUsers();
  console.log('Ingestion complete.');
});

// Keep the process alive
setInterval(() => {}, 1 << 30);