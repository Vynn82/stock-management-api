import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkDbHealth() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5433,
    username: process.env.DB_USERNAME || 'Vynn82',
    password: process.env.DB_PASSWORD || '123',
    database: process.env.DB_DATABASE || 'stock-management-db',
  });

  const start = Date.now();
  await ds.initialize();
  const ping = Date.now() - start;

  console.log('✅ Connected to database in', ping, 'ms');

  const [versionRes] = await ds.query('SELECT version()');
  console.log('PostgreSQL Version:', versionRes.version);

  const [dbSizeRes] = await ds.query(`
    SELECT pg_size_pretty(pg_database_size(current_database())) as size
  `);
  console.log('Database Size:', dbSizeRes.size);

  const [connRes] = await ds.query(`
    SELECT count(*) as active_connections 
    FROM pg_stat_activity 
    WHERE datname = current_database()
  `);
  console.log('Active Connections:', connRes.active_connections);

  const [tablesRes] = await ds.query(`
    SELECT count(*) as table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log('Public Tables Count:', tablesRes.table_count);

  await ds.destroy();
}

checkDbHealth().catch(console.error);
