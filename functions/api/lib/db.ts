// Database helpers for D1
import { nanoid } from 'nanoid';

export interface Trip {
  id: string;
  user_id: string | null;
  template: string;
  title: string | null;
  intake_json: string | null;
  options_json: string | null;
  itinerary_json: string | null;
  variants_json: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface Message {
  id: string;
  trip_id: string;
  role: string;
  content: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  created_at: number;
}

export async function createTrip(db: D1Database, userId: string | null, template: string = 'heritage'): Promise<string> {
  const id = nanoid();
  await db.prepare(
    `INSERT INTO themed_trips (id, user_id, template, status) VALUES (?, ?, ?, ?)`
  ).bind(id, userId, template, 'intake').run();
  return id;
}

export async function getTrip(db: D1Database, id: string): Promise<Trip | null> {
  const result = await db.prepare(`SELECT * FROM themed_trips WHERE id = ?`).bind(id).first();
  return result as Trip | null;
}

export async function updateTrip(db: D1Database, id: string, updates: Partial<Trip>): Promise<void> {
  const fields = Object.keys(updates).filter(k => k !== 'id');
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => updates[f as keyof Trip]);

  await db.prepare(
    `UPDATE themed_trips SET ${setClause}, updated_at = unixepoch() WHERE id = ?`
  ).bind(...values, id).run();
}

export async function listTrips(db: D1Database, userId: string | null, limit: number = 50): Promise<Trip[]> {
  const query = userId
    ? db.prepare(`SELECT * FROM themed_trips WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`).bind(userId, limit)
    : db.prepare(`SELECT * FROM themed_trips ORDER BY created_at DESC LIMIT ?`).bind(limit);

  const result = await query.all();
  return result.results as Trip[];
}

export async function saveMessage(
  db: D1Database,
  tripId: string,
  role: string,
  content: string,
  tokensIn: number,
  tokensOut: number,
  costUsd: number
): Promise<void> {
  const id = nanoid();
  await db.prepare(
    `INSERT INTO themed_messages (id, trip_id, role, content, tokens_in, tokens_out, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, tripId, role, content, tokensIn, tokensOut, costUsd).run();
}

// Simple nanoid polyfill for edge environments
const nanoid = (size: number = 21): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const randomValues = crypto.getRandomValues(new Uint8Array(size));
  for (let i = 0; i < size; i++) {
    id += alphabet[randomValues[i] % alphabet.length];
  }
  return id;
};
