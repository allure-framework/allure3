#!/usr/bin/env node
/**
 * Test DB connection with same config as app (run with tsx - same as migration).
 * Usage: tsx scripts/test-db-connect.ts
 */
import { AppDataSource } from '../src/config/database.js';

async function main() {
  try {
    await AppDataSource.initialize();
    console.log('DB connected OK');
    await AppDataSource.destroy();
    process.exit(0);
  } catch (e) {
    console.error('DB connect failed:', (e as Error).message);
    console.error((e as Error).stack);
    process.exit(1);
  }
}
main();
