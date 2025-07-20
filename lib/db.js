import { Client } from 'pg';

// Create a reusable client for authentication
let authClient = null;

export async function getAuthClient() {
  if (!authClient) {
    authClient = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    await authClient.connect();
  }
  return authClient;
}

export async function closeAuthClient() {
  if (authClient) {
    await authClient.end();
    authClient = null;
  }
}

// Authentication functions using direct pg
export async function findUserByEmail(email) {
  const client = await getAuthClient();
  const result = await client.query(
    'SELECT id, email, password, name FROM "User" WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

export async function createUser(email, hashedPassword, name) {
  const client = await getAuthClient();
  const result = await client.query(
    'INSERT INTO "User" (id, email, password, name, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $5) RETURNING id, email, name',
    [generateId(), email, hashedPassword, name, new Date()]
  );
  return result.rows[0];
}

// Generate a CUID-like ID
function generateId() {
  return 'cuid_' + Math.random().toString(36).substr(2, 9);
} 