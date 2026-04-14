import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;


export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // ✅ REQUIRED for Neon
  },
});

// ✅ Get client
export const getClient = async () => {
  return await pool.connect();
};

// ✅ Test connection
pool.query('SELECT NOW()')
  .then(res => {
    console.log('✅ DB Connected:', res.rows[0]);
  })
  .catch(err => {
    console.error('❌ DB Connection Failed:', err);
  });