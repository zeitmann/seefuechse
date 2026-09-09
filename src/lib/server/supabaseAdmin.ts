import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

/**
 * Supabase-Client mit Service-Role-Key.
 *
 * ⚠️ NUR serverseitig verwenden – ausschließlich in +page.server.ts / Actions.
 * Der Service-Role-Key umgeht Row Level Security und hat volle DB-Rechte.
 * Er darf niemals in Client-Code (oder in an den Client gesendete Daten) gelangen.
 *
 * Gedacht für administrative Auth-Operationen, die der normale Server-Client
 * mit Anon-Key nicht ausführen darf (z. B. supabaseAdmin.auth.admin.updateUserById
 * zum Ändern der E-Mail-Adresse eines Users).
 */
export const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});
