import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../data-source';
import data from './reference-data.json';

// Usage: npm run seed:reference   (run `npm run seed` first so roles exist)
// Idempotent: existing rows (matched by code) are left untouched.

const USER_STAFF_ID = 'KH0001';
const USER_PASSWORD = '12345678';

const slug = (prefix: string, name: string) =>
  `${prefix}-${name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`.slice(0, 50);

async function run() {
  await AppDataSource.initialize();
  try {
    await AppDataSource.transaction(async (m) => {
      for (const name of data.categories) {
        await m.query(
          `INSERT INTO categories (code, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [slug('CAT', name), name],
        );
      }
      for (const name of data.brands) {
        await m.query(
          `INSERT INTO brands (code, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [slug('BR', name), name],
        );
      }
      for (const w of data.warehouses) {
        await m.query(
          `INSERT INTO warehouses (code, name, address) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [slug('WH', w.name), w.name, w.location],
        );
      }
      for (const s of data.suppliers) {
        await m.query(
          `INSERT INTO suppliers (code, name, contact_person, phone, email, address, country)
           VALUES ($1, $2, $3, $4, $5, $6, 'Cambodia') ON CONFLICT DO NOTHING`,
          [slug('SUP', s.name), s.name, s.contactPerson, s.phone, s.email, s.address],
        );
      }

      // ---- user KH0001 (SUPER_ADMIN) ----
      const hash = await bcrypt.hash(USER_PASSWORD, 12);
      const existing = await m.query(`SELECT id FROM users WHERE staff_id = $1`, [USER_STAFF_ID]);
      let userId: string;
      if (existing.length) {
        userId = existing[0].id;
        await m.query(
          `UPDATE users SET password_hash = $1, status = 'ACTIVE', must_change_password = false WHERE id = $2`,
          [hash, userId],
        );
        console.log(`Updated password for ${USER_STAFF_ID}`);
      } else {
        const rows = await m.query(
          `INSERT INTO users (staff_id, password_hash, status, must_change_password)
           VALUES ($1, $2, 'ACTIVE', false) RETURNING id`,
          [USER_STAFF_ID, hash],
        );
        userId = rows[0].id;
        await m.query(
          `INSERT INTO user_profiles (user_id, first_name, last_name, email) VALUES ($1, 'Super', 'Admin', $2)`,
          [userId, process.env.SUPER_ADMIN_EMAIL ?? 'kh0001@example.com'],
        );
        // keep staff_id_seq ahead of the manually inserted KH0001
        await m.query(`SELECT setval('staff_id_seq', GREATEST((SELECT last_value FROM staff_id_seq), 1))`);
        console.log(`Created ${USER_STAFF_ID}`);
      }
      const role = await m.query(`SELECT id FROM roles WHERE name = 'SUPER_ADMIN'`);
      if (!role.length) throw new Error('SUPER_ADMIN role missing — run `npm run seed` first');
      await m.query(
        `INSERT INTO user_roles (user_id, role_id) SELECT $1, $2
         WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2)`,
        [userId, role[0].id],
      );
    });
    console.log('Reference data seeded.');
  } finally {
    await AppDataSource.destroy();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
