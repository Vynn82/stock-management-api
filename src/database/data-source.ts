// import 'dotenv/config';
// import { DataSource } from 'typeorm';
//
// export const AppDataSource = new DataSource({
//   type: 'postgres',
//
//   host: process.env.DB_HOST,
//   port: Number(process.env.DB_PORT),
//
//   username: process.env.DB_USERNAME,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_DATABASE,
//
//   entities: ['src/**/*.entity.ts'],
//
//   migrations: ['src/database/migrations/*.ts'],
// });

import 'dotenv/config';
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Neon cloud connection
  },
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
});