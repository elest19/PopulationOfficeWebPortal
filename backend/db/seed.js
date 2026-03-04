const bcrypt = require('bcryptjs');
const db = require('../src/config/db');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    if (String(sql).trim()) {
      // eslint-disable-next-line no-await-in-loop
      await db.query(sql);
    }
  }
}

async function seed() {
  try {
    await runMigrations();
    console.log('Seeding database...');

    const password = 'Admin123!';
    const passwordHash = await bcrypt.hash(password, 10);

    const officerPassword = 'Officer123!';
    const officerPasswordHash = await bcrypt.hash(officerPassword, 10);

    const barangayResult = await db.query(
      `INSERT INTO barangays (name, code)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code
       RETURNING id`,
      ['Barangay Uno', 'B1']
    );
    const barangayId = barangayResult.rows[0].id;

    const adminResult = await db.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'ADMIN', true)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      ['Admin User', 'admin@municipality.gov.ph', passwordHash]
    );

    const officerResult = await db.query(
      `INSERT INTO users (full_name, email, password_hash, role, barangay_id, contact_number, is_active)
       VALUES ($1, $2, $3, 'BARANGAY_OFFICER', $4, $5, true)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      ['Barangay Officer', 'officer@barangay.gov.ph', officerPasswordHash, barangayId, '09171234567']
    );

    await db.query(
      `INSERT INTO services (name, slug, description, is_active)
       VALUES
         ('Pre-Marriage Orientation', 'pre-marriage-orientation', 'Pre-marriage counseling and orientation services.', true),
         ('Usapan-Series', 'usapan-series', 'Usapan-series sessions for barangay officers and constituents.', true)
       ON CONFLICT (slug) DO NOTHING`
    );

    console.log('Seed completed.');
    console.log('Admin credentials: admin@municipality.gov.ph / Admin123!');
    console.log('Officer credentials: officer@barangay.gov.ph / Officer123!');
  } catch (err) {
    console.error('Seed failed', err);
  } finally {
    db.pool.end();
  }
}

seed();
