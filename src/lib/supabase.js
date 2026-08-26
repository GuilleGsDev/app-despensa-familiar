import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://txjovtniuhhgsrejdetr.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_cKm0tldA7Hl12Glzolk2EA_i_76zTB-';

export const supabase = createClient(supabaseUrl, supabaseKey);