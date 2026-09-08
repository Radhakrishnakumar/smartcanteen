const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://jscsmzjdbjxfjrexohog.supabase.co';
const supabaseKey = 'sb_publishable_XweBdg3knTROfQad9dKwrg_hTeCZ8jE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('--- FETCHING MENU ITEMS ---');
  const { data: menuItems, error: menuErr } = await supabase.from('menu_items').select('*');
  console.log('Menu items:', JSON.stringify(menuItems, null, 2), 'Error:', menuErr);

  console.log('--- LISTING BUCKETS ---');
  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  console.log('Buckets:', JSON.stringify(buckets, null, 2), 'Error:', bucketErr);
}

test();
