/**
 * Database Migration Script
 * Runs SQL migrations from the scripts folder to Supabase
 * 
 * Usage: node scripts/migrate.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
// Prefer `.env.local` if present (common in some deployments), otherwise fall back to `.env`.
const envLocalPath = path.join(__dirname, '../.env.local');
const envPath = path.join(__dirname, '../.env');
const dotenvPath = fs.existsSync(envLocalPath) ? envLocalPath : envPath;
require('dotenv').config({ path: dotenvPath });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '❌ Error: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in `.env` (or `.env.local`).'
  );
  process.exit(1);
}

// Create Supabase client with service role key (allows admin access)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration(filePath) {
  try {
    console.log(`\n📝 Running migration: ${path.basename(filePath)}`);
    
    // Read SQL file
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Execute SQL via RPC function `exec(sql_query text)`.
    // If this RPC does not exist, migration must fail loudly (no false positives).
    const { error } = await supabase.rpc('exec', { sql_query: sql });

    if (error) {
      console.error(`❌ Migration failed: ${error.message}`);
      if (String(error.message || '').includes('Could not find the function public.exec')) {
        console.error(
          '💡 Hint: This project requires a SQL execution RPC for automated migrations.\n' +
          '   Run the migration manually in Supabase SQL Editor, or add an exec(sql_query text) function.'
        );
      }
      return false;
    }

    console.log(`✅ Migration completed: ${path.basename(filePath)}`);
    return true;
  } catch (err) {
    console.error(`❌ Error running migration: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Safe Hands Escrow - Database Migration');
  console.log('==========================================\n');

  const scriptsDir = path.join(__dirname);
  
  // Get all SQL files in order
  const sqlFiles = fs.readdirSync(scriptsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  if (sqlFiles.length === 0) {
    console.log('ℹ️  No SQL migration files found in scripts/');
    return;
  }

  console.log(`📋 Found ${sqlFiles.length} migration file(s):`);
  sqlFiles.forEach(file => console.log(`   • ${file}`));

  let successCount = 0;
  let failureCount = 0;

  // Run each migration
  for (const file of sqlFiles) {
    const filePath = path.join(scriptsDir, file);
    const success = await runMigration(filePath);
    
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  // Summary
  console.log('\n==========================================');
  console.log('📊 Migration Summary');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);
  console.log('==========================================\n');

  if (failureCount > 0) {
    console.log('⚠️  Some migrations failed. Check the errors above.');
    process.exit(1);
  } else {
    console.log('🎉 All migrations completed successfully!');
    process.exit(0);
  }
}

main();
