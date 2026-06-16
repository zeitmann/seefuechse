// drizzle.config.ts
//
// Wird von der drizzle-kit-CLI ausgeführt (npm run db:push / db:generate / db:migrate),
// NICHT im SvelteKit-Vite-Kontext – deshalb hier "dotenv" statt $env/dynamic/private.

import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL ist nicht gesetzt. Bitte .env prüfen.');
}

export default defineConfig({
	out: './drizzle',
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL
	},
	verbose: true,
	strict: true
});