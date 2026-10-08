import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mac@localhost:5432/rota_dev',
});

export const query = (text: string, params?: unknown[]) => pool.query(text, params);
