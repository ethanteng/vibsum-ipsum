import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;

  const { query, dateFrom, dateTo, channel } = req.body || {};
  const filters = {};
  if (dateFrom || dateTo) {
    filters.sentAt = {};
    if (dateFrom) filters.sentAt.gte = new Date(dateFrom);
    if (dateTo) filters.sentAt.lte = new Date(dateTo);
  }

  let results = [];
  try {
    if (channel === 'mailchimp' || channel === 'all' || !channel) {
      const where = {
        userId,
        ...(filters.sentAt ? { sentAt: filters.sentAt } : {}),
      };
      if (query) {
        where.OR = [
          { subject: { contains: query, mode: 'insensitive' } },
          { body: { contains: query, mode: 'insensitive' } },
        ];
      }
      const mailchimp = await prisma.mailchimpContent.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: 20,
      });
      results.push(...mailchimp.map(c => ({
        channel: 'mailchimp',
        date: c.sentAt.toISOString().slice(0, 10),
        title: c.subject,
        preview: c.body.slice(0, 200),
        id: c.id,
      })));
    }
    if (channel === 'intercom' || channel === 'all' || !channel) {
      const where = {
        userId,
        ...(filters.sentAt ? { sentAt: filters.sentAt } : {}),
      };
      if (query) {
        where.OR = [
          { title: { contains: query, mode: 'insensitive' } },
          { body: { contains: query, mode: 'insensitive' } },
        ];
      }
      const intercom = await prisma.intercomContent.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: 20,
      });
      results.push(...intercom.map(c => ({
        channel: 'intercom',
        date: c.sentAt.toISOString().slice(0, 10),
        title: c.title,
        preview: c.body.slice(0, 200),
        id: c.id,
      })));
    }
    if (channel === 'history' || channel === 'all' || !channel) {
      const where = {
        userId,
        ...(dateFrom || dateTo ? { createdAt: filters.sentAt } : {}),
      };
      if (query) {
        where.OR = [
          { prompt: { contains: query, mode: 'insensitive' } },
          { result: { contains: query, mode: 'insensitive' } },
        ];
      }
      const history = await prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      results.push(...history.map(c => ({
        channel: 'history',
        date: c.createdAt.toISOString().slice(0, 10),
        prompt: c.prompt,
        preview: (typeof c.result === 'string' ? c.result : JSON.stringify(c.result)).slice(0, 200),
        id: c.id,
      })));
    }
    // Sort all results by date descending
    results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    res.status(200).json({ results });
  } catch (err) {
    console.error('Smart search error:', err);
    res.status(500).json({ error: err.message });
  }
} 