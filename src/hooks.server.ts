import { createServerClient } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// '/passwort-aendern' ist testweise öffentlich: Der Reset-Link aus der
// Supabase-Mail wird ohne reguläre Session aufgerufen – die Recovery-Session
// entsteht erst clientseitig aus dem URL-Fragment.
const PUBLIC_ROUTES = ['/login', '/registrieren', '/passwort-aendern'];
const WARTE_ROUTE = '/warten';
// Cron-Endpoint: ohne Login erreichbar, schützt sich selbst per Bearer-Token (CRON_SECRET).
const CRON_ROUTE = '/api/cron/spielplan-sync';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookies) => {
				for (const { name, value, options } of cookies) {
					event.cookies.set(name, value, { ...options, path: '/' });
				}
			}
		}
	});

	event.locals.safeGetSession = async () => {
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error || !user) return { session: null, user: null };
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		return { session, user };
	};

	const { user } = await event.locals.safeGetSession();
	const path = event.url.pathname;
	const ohneLogin = PUBLIC_ROUTES.includes(path) || path === CRON_ROUTE;

	if (!user) {
		if (!ohneLogin) {
			redirect(303, '/login');
		}
	} else {
		if (!ohneLogin && path !== WARTE_ROUTE) {
			const { db } = await import('$lib/server/db');
			const { mitglieder } = await import('$lib/server/db/schema');
			const { eq } = await import('drizzle-orm');
			const rows = await db
				.select({ status: mitglieder.status })
				.from(mitglieder)
				.where(eq(mitglieder.id, user.id))
				.limit(1);
			const status = rows[0]?.status;
			if (status !== 'aktiv') {
				redirect(303, WARTE_ROUTE);
			}
		}
	}

	return resolve(event, {
		filterSerializedResponseHeaders: (name) => name === 'content-range' || name === 'x-supabase-api-version'
	});
};
