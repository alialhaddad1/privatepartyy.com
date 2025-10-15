/**
 * Setup script for image uploads
 * This creates the storage bucket and database table needed for uploads
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ekdqncrticnmckxgqmha.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
  console.log('Please set it in your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createStorageBucket() {
  console.log('\n📦 Creating storage bucket...');

  try {
    // Check if bucket already exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === 'event-images');

    if (bucketExists) {
      console.log('✅ Storage bucket "event-images" already exists');
      return true;
    }

    // Create bucket
    const { data, error } = await supabase.storage.createBucket('event-images', {
      public: true,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    });

    if (error) {
      console.error('❌ Error creating bucket:', error.message);
      return false;
    }

    console.log('✅ Storage bucket "event-images" created successfully');
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function createEventPostsTable() {
  console.log('\n📋 Creating event_posts table...');

  try {
    // Read SQL file
    const sqlPath = join(__dirname, 'create-event-posts-table.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Execute SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(async () => {
      // If RPC doesn't exist, try direct execution
      const { error: directError } = await supabase
        .from('event_posts')
        .select('id')
        .limit(1);

      if (directError && directError.code === '42P01') {
        // Table doesn't exist, need to create it manually via SQL editor
        console.log('⚠️  Cannot create table via API.');
        console.log('📝 Please run the SQL manually:');
        console.log('   1. Go to Supabase Dashboard > SQL Editor');
        console.log('   2. Copy the contents of: infra/create-event-posts-table.sql');
        console.log('   3. Paste and click Run');
        return false;
      } else if (!directError || directError.code === 'PGRST116') {
        console.log('✅ Table "event_posts" already exists or was created');
        return true;
      }

      return directError;
    });

    if (error) {
      console.log('⚠️  Table creation via API failed');
      console.log('📝 Please run the SQL manually in Supabase Dashboard');
      return false;
    }

    console.log('✅ Table "event_posts" created successfully');
    return true;
  } catch (error) {
    console.log('⚠️  ' + error.message);
    console.log('📝 Please create the table manually:');
    console.log('   1. Go to Supabase Dashboard > SQL Editor');
    console.log('   2. Copy the contents of: infra/create-event-posts-table.sql');
    console.log('   3. Paste and click Run');
    return false;
  }
}

async function main() {
  console.log('🚀 Setting up image upload functionality...');
  console.log(`📍 Supabase URL: ${supabaseUrl}`);

  const bucketOk = await createStorageBucket();
  const tableOk = await createEventPostsTable();

  console.log('\n' + '='.repeat(50));
  if (bucketOk && tableOk) {
    console.log('✅ Setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart your dev server');
    console.log('   2. Go to an event page');
    console.log('   3. Try uploading an image');
  } else {
    console.log('⚠️  Setup partially completed');
    console.log('\n📝 Manual steps required:');
    if (!tableOk) {
      console.log('   - Create event_posts table (see instructions above)');
    }
    console.log('\n📖 See UPLOAD_SETUP.md for detailed instructions');
  }
  console.log('='.repeat(50) + '\n');
}

main().catch(console.error);
