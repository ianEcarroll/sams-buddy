import pg from 'pg';

const ssl = process.env.DATABASE_SSL === 'false' ? false : (process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false });
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl, max: 5 });

export const q = (text, params) => pool.query(text, params);
export const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;
export const many = async (text, params) => (await pool.query(text, params)).rows;
