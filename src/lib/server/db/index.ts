// src/lib/server/db/index.ts
//
// DB-Client für die Verwendung innerhalb der SvelteKit-App (nur server-seitig,
// daher unter src/lib/server/). Nutzt den postgres-js-Treiber, den Drizzle für
// Supabase empfiehlt.

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

if (!env.DATABASE_URL) {
	throw new Error('DATABASE_URL ist nicht gesetzt. Bitte .env prüfen.');
}

// prepare: false ist nötig, wenn die DATABASE_URL über Supabases Connection
// Pooler (Supavisor, Port 6543) läuft – was auf Netlify (serverlose Functions)
// empfohlen ist, da jede Function sonst ihre eigene Verbindung offenhalten würde.
const client = postgres(env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });