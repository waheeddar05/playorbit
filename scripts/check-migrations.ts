import { execSync } from 'child_process';
import { prisma } from '../src/lib/prisma';

async function runMigrations() {
  console.log('--- Migration Execution Check ---');
  try {
    console.log('Checking migration status...');
    
    // We can use prisma.$queryRaw to check if the _prisma_migrations table exists
    const migrationTableExists = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE  table_schema = 'public'
        AND    table_name   = '_prisma_migrations'
      );
    `;

    if (migrationTableExists[0].exists) {
      console.log('Migration table found. Fetching applied migrations...');
      const migrations = await prisma.$queryRaw<{ migration_name: string, finished_at: string }[]>`
        SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at DESC
      `;
      
      if (migrations.length > 0) {
        console.log(`Last applied migration: ${migrations[0].migration_name} at ${migrations[0].finished_at}`);
      } else {
        console.log('No migrations have been applied yet.');
      }
    } else {
      console.log('No migration table found. The database might be empty.');
    }

    console.log('Executing migration (prisma migrate deploy)...');
    // Using execSync to run the prisma command
    // deploy is safer than dev for automated scripts as it doesn't try to create new migrations
    try {
      const output = execSync('npx prisma migrate deploy', { encoding: 'utf-8' });
      console.log('Prisma Migrate Output:');
      console.log(output);
      console.log('✅ Migration step completed.');
    } catch (migrateError: any) {
      console.error('❌ Migration execution failed:');
      console.error(migrateError.stdout || migrateError.message);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error during migration check:');
    console.error(error);
    process.exit(1);
  } finally {
    console.log('---------------------------------');
    await prisma.$disconnect();
  }
}

runMigrations();
