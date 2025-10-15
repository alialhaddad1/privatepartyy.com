const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually set credentials from .env.local
const supabaseUrl = 'https://ekdqncrticnmckxgqmha.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrZHFuY3J0aWNubWNreGdxbWhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODMyNzM1OSwiZXhwIjoyMDczOTAzMzU5fQ.nsbsF7hjH0shIlXtWsxFzIxNrrEwO1ZJ-k7-C8gx4zU';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyFix() {
  console.log('🔧 Applying fix to remove foreign key constraint from user_profiles...');

  try {
    // Drop the foreign key constraint
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE user_profiles
        DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

        COMMENT ON TABLE user_profiles IS 'User profiles that can exist independently of auth.users for anonymous event participants';
      `
    });

    if (error) {
      console.error('❌ Error applying fix:', error);

      // Try alternative approach using raw SQL
      console.log('🔧 Trying direct SQL approach...');

      const { error: sqlError } = await supabase
        .from('user_profiles')
        .select('count')
        .limit(0);

      if (sqlError) {
        console.error('❌ Cannot connect to database:', sqlError);
        process.exit(1);
      }

      console.log('\n⚠️  Could not apply fix automatically.');
      console.log('📋 Please run this SQL manually in Supabase SQL Editor:');
      console.log('\n' + '-'.repeat(60));
      console.log(fs.readFileSync(path.join(__dirname, 'remove-user-profiles-foreign-key.sql'), 'utf8'));
      console.log('-'.repeat(60) + '\n');
      console.log('🔗 SQL Editor: https://supabase.com/dashboard/project/ekdqncrticnmckxgqmha/sql/new');
      process.exit(1);
    }

    console.log('✅ Fix applied successfully!');
    console.log('✨ User profiles can now be created without requiring auth.users');

  } catch (err) {
    console.error('❌ Unexpected error:', err);
    console.log('\n⚠️  Could not apply fix automatically.');
    console.log('📋 Please run this SQL manually in Supabase SQL Editor:');
    console.log('\n' + '-'.repeat(60));
    console.log(fs.readFileSync(path.join(__dirname, 'remove-user-profiles-foreign-key.sql'), 'utf8'));
    console.log('-'.repeat(60) + '\n');
    console.log('🔗 SQL Editor: https://supabase.com/dashboard/project/ekdqncrticnmckxgqmha/sql/new');
    process.exit(1);
  }
}

applyFix();
