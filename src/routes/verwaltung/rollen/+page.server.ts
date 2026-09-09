import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { mitglieder, mitgliedRollen, rollen } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hatAdminRolle } from '$lib/server/rollen';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import type { PageServerLoad, Actions } from './$types';

/**
 * Stellt sicher, dass der aufrufende Nutzer die Rolle 'admin' hat.
 * Muss in jeder Action erneut aufgerufen werden – der load-Guard schützt
 * nur den Seitenaufruf, nicht die einzeln ansprechbaren Server Actions.
 */
async function assertAdmin(locals: App.Locals) {
	const { user } = await locals.safeGetSession();
	if (!user || !(await hatAdminRolle(user.id))) {
		error(403, 'Keine Berechtigung');
	}
	return user;
}

export const load: PageServerLoad = async ({ locals }) => {
	await assertAdmin(locals);

	// Alle Mitglieder mit ihrer aktuell zugewiesenen Rolle (Left Join – Mitglieder
	// ohne Rolleneintrag erscheinen weiterhin, rolleId/rolleName sind dann null).
	const zeilen = await db
		.select({
			id: mitglieder.id,
			name: mitglieder.name,
			email: mitglieder.email,
			status: mitglieder.status,
			rolleId: rollen.id,
			rolleName: rollen.name
		})
		.from(mitglieder)
		.leftJoin(mitgliedRollen, eq(mitgliedRollen.mitgliedId, mitglieder.id))
		.leftJoin(rollen, eq(rollen.id, mitgliedRollen.rolleId))
		.orderBy(mitglieder.name);

	const mitgliederListe = zeilen.map((z) => ({
		id: z.id,
		name: z.name,
		email: z.email,
		status: z.status,
		rolleId: z.rolleId ?? null,
		rolleName: z.rolleName ?? null
	}));

	// Alle verfügbaren Rollen für das Dropdown (admin, mitglied, vorstand).
	const alleRollen = await db
		.select({ id: rollen.id, name: rollen.name })
		.from(rollen)
		.orderBy(rollen.name);

	return { mitgliederListe, alleRollen };
};

export const actions: Actions = {
	/**
	 * Setzt die (einzige) Rolle eines Mitglieds neu: alle bestehenden Zuordnungen
	 * löschen, dann die neue einfügen. Bewusst ohne Diff-Logik, da jedes Mitglied
	 * laut aktuellem Nutzungsmuster genau eine Rolle hat.
	 */
	rolleAendern: async ({ request, locals }) => {
		await assertAdmin(locals);

		const form = await request.formData();
		const mitgliedId = String(form.get('mitgliedId') ?? '');
		const neueRolleId = String(form.get('neueRolleId') ?? '');
		if (!mitgliedId) return fail(400, { rolleFehler: true, mitgliedId, message: 'Fehlende Mitglied-ID' });
		if (!neueRolleId)
			return fail(400, { rolleFehler: true, mitgliedId, message: 'Keine Rolle ausgewählt' });

		const rolleVorhanden = await db.query.rollen.findFirst({
			where: eq(rollen.id, neueRolleId)
		});
		if (!rolleVorhanden)
			return fail(400, { rolleFehler: true, mitgliedId, message: 'Unbekannte Rolle' });

		await db.delete(mitgliedRollen).where(eq(mitgliedRollen.mitgliedId, mitgliedId));
		await db.insert(mitgliedRollen).values({ mitgliedId, rolleId: neueRolleId });

		return { rolleGeaendert: true, mitgliedId };
	},

	/**
	 * Ändert Name und E-Mail eines Mitglieds. Bei geänderter E-Mail wird zuerst
	 * auth.users über den Service-Role-Client aktualisiert – erst wenn das
	 * erfolgreich war, folgt das DB-Update, damit beide Seiten synchron bleiben.
	 */
	datenAendern: async ({ request, locals }) => {
		await assertAdmin(locals);

		const form = await request.formData();
		const mitgliedId = String(form.get('mitgliedId') ?? '');
		const neuerName = String(form.get('neuerName') ?? '').trim();
		const neueEmail = String(form.get('neueEmail') ?? '').trim().toLowerCase();

		if (!mitgliedId)
			return fail(400, { datenFehler: true, mitgliedId, message: 'Fehlende Mitglied-ID' });
		if (!neuerName)
			return fail(400, { datenFehler: true, mitgliedId, message: 'Name darf nicht leer sein' });
		if (!neueEmail || !neueEmail.includes('@'))
			return fail(400, { datenFehler: true, mitgliedId, message: 'Ungültige E-Mail-Adresse' });

		const bestehendes = await db.query.mitglieder.findFirst({
			where: eq(mitglieder.id, mitgliedId)
		});
		if (!bestehendes)
			return fail(404, { datenFehler: true, mitgliedId, message: 'Mitglied nicht gefunden' });

		const emailGeaendert = bestehendes.email.toLowerCase() !== neueEmail;

		if (emailGeaendert) {
			const { error: authFehler } = await supabaseAdmin.auth.admin.updateUserById(mitgliedId, {
				email: neueEmail
			});
			if (authFehler) {
				// DB NICHT anfassen – Auth und DB bleiben so konsistent.
				return fail(400, {
					datenFehler: true,
					mitgliedId,
					message: `E-Mail konnte nicht geändert werden: ${authFehler.message}`
				});
			}
		}

		await db
			.update(mitglieder)
			.set({ name: neuerName, email: neueEmail })
			.where(eq(mitglieder.id, mitgliedId));

		return { gespeichert: true, mitgliedId };
	},

	/**
	 * Schickt dem Mitglied eine Passwort-Zurücksetzen-Mail.
	 */
	passwortMailSenden: async ({ request, locals, url }) => {
		await assertAdmin(locals);

		const form = await request.formData();
		const mitgliedId = String(form.get('mitgliedId') ?? '');
		if (!mitgliedId)
			return fail(400, { mailFehler: true, mitgliedId, message: 'Fehlende Mitglied-ID' });

		const mitglied = await db.query.mitglieder.findFirst({
			where: eq(mitglieder.id, mitgliedId)
		});
		if (!mitglied)
			return fail(404, { mailFehler: true, mitgliedId, message: 'Mitglied nicht gefunden' });

		const { error: resetFehler } = await locals.supabase.auth.resetPasswordForEmail(mitglied.email, {
			redirectTo: `${url.origin}/passwort-aendern`
		});
		if (resetFehler)
			return fail(400, {
				mailFehler: true,
				mitgliedId,
				message: `Mail konnte nicht gesendet werden: ${resetFehler.message}`
			});

		return { erfolg: true, mitgliedId };
	}
};
