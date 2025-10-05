// Test Supabase connection and check database schema
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Checking Supabase Configuration...\n');
console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Present' : '❌ MISSING');
console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? '✅ Present' : '❌ MISSING');
console.log('');

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testConnection() {
  console.log('🔌 Testing Supabase Connection...\n');

  try {
    // Try to query the events table
    console.log('1️⃣ Checking if "events" table exists...');
    const { data, error, count } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Error querying events table:', error.message);
      console.error('   Code:', error.code);
      console.error('   Details:', error.details);
      console.error('   Hint:', error.hint);

      if (error.code === '42P01') {
        console.log('\n⚠️  The "events" table does not exist!');
        console.log('   You need to create the database schema in Supabase.');
      }
    } else {
      console.log('✅ Events table exists!');
      console.log('   Current row count:', count);
    }

    // Try to get a sample event
    console.log('\n2️⃣ Fetching sample events...');
    const { data: events, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .limit(3);

    if (fetchError) {
      console.error('❌ Error fetching events:', fetchError.message);
    } else {
      console.log('✅ Sample events:', events.length, 'found');
      if (events.length > 0) {
        console.log('   First event:', JSON.stringify(events[0], null, 2));
      }
    }

    // Try to insert a test event
    console.log('\n3️⃣ Testing event creation...');
    const testEvent = {
      title: 'Test Event',
      description: 'This is a test event',
      date: '2025-10-10',
      time: '18:00',
      is_public: true,
      host_id: 'test-host',
      host_name: 'Test Host',
      token: 'test-token-' + Date.now(),
      current_attendees: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newEvent, error: insertError } = await supabase
      .from('events')
      .insert([testEvent])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error creating test event:', insertError.message);
      console.error('   Code:', insertError.code);
      console.error('   Details:', insertError.details);
      console.error('   Hint:', insertError.hint);
    } else {
      console.log('✅ Test event created successfully!');
      console.log('   Event ID:', newEvent.id);

      // Clean up - delete the test event
      console.log('\n4️⃣ Cleaning up test event...');
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', newEvent.id);

      if (deleteError) {
        console.error('❌ Error deleting test event:', deleteError.message);
      } else {
        console.log('✅ Test event deleted successfully!');
      }
    }

    console.log('\n✅ Supabase connection test completed!');

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  }
}

testConnection();
