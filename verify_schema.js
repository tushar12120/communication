import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hpahonoaxeiorhfhtuhj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwYWhvbm9heGVpb3JoZmh0dWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NjQ3MTEsImV4cCI6MjA4MTQ0MDcxMX0.vuXwnYip8CigHTdS08cn9vQAF6WVp4BUfDJHGcxZsR8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking 'contacts' table...");
    const { error: contactsError } = await supabase.from('contacts').select('count', { count: 'exact', head: true });
    if (contactsError) {
        console.error("Contacts table ERROR:", contactsError.message);
    } else {
        console.log("Contacts table exists.");
    }

    console.log("Checking 'status_stories' table...");
    const { error: statusError } = await supabase.from('status_stories').select('count', { count: 'exact', head: true });
    if (statusError) {
        console.error("Status Stories table ERROR:", statusError.message);
    } else {
        console.log("Status Stories table exists.");
    }

    console.log("Checking 'profiles' columns...");
    const { data, error: profileError } = await supabase.from('profiles').select('phone, about').limit(1);
    if (profileError) {
        console.error("Profiles columns ERROR:", profileError.message);
    } else {
        console.log("Profiles columns (phone, about) exist.");
    }
}

check();
