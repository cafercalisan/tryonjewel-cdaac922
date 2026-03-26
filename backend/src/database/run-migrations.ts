import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { AddPrdTables1711468800000 } from './migrations/1711468800000-AddPrdTables';

// Load env from project root
dotenv.config({ path: '../.env' });

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  migrations: [AddPrdTables1711468800000],
  logging: true,
});

async function run() {
  try {
    await dataSource.initialize();
    console.log('Running migrations...');
    await dataSource.runMigrations();
    console.log('Migrations completed successfully.');
    await dataSource.destroy();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
