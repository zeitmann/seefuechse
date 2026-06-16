// src/lib/server/db/schema.ts
//
// Drizzle-Schema für die Seefüchse-App, abgeleitet aus dem ER-Diagramm
// (seefuechse_er_diagramm_V2.html). Zielsystem: PostgreSQL via Supabase.

import {
	pgTable,
	pgSchema,
	pgEnum,
	uuid,
	text,
	date,
	timestamp,
	primaryKey
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Supabase verwaltet auth.users selbst. Wir bilden die Tabelle hier nur ab,
 * damit mitglieder.id per Foreign Key darauf verweisen kann – ein eigenes
 * Passwort-Feld brauchen wir dadurch nicht mehr (übernimmt Supabase Auth).
 */
const authSchema = pgSchema('auth');
export const authUsers = authSchema.table('users', {
	id: uuid('id').primaryKey()
});

export const heimAuswaertsEnum = pgEnum('heim_auswaerts', ['heim', 'auswaerts']);
export const freigabeStatusEnum = pgEnum('freigabe_status', [
	'offen',
	'vergeben',
	'zurueckgezogen'
]);
export const bewerbungStatusEnum = pgEnum('bewerbung_status', [
	'angefragt',
	'angenommen',
	'abgelehnt'
]);

export const rollen = pgTable('rollen', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: text('name').notNull().unique()
});

export const mitglieder = pgTable('mitglieder', {
	id: uuid('id')
		.primaryKey()
		.references(() => authUsers.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	email: text('email').notNull().unique()
});

export const mitgliedRollen = pgTable(
	'mitglied_rollen',
	{
		mitgliedId: uuid('mitglied_id')
			.notNull()
			.references(() => mitglieder.id, { onDelete: 'cascade' }),
		rolleId: uuid('rolle_id')
			.notNull()
			.references(() => rollen.id, { onDelete: 'cascade' })
	},
	(table) => ({
		pk: primaryKey({ columns: [table.mitgliedId, table.rolleId] })
	})
);

export const dauerkarten = pgTable('dauerkarten', {
	id: uuid('id').defaultRandom().primaryKey(),
	besitzerId: uuid('besitzer_id')
		.notNull()
		.references(() => mitglieder.id, { onDelete: 'restrict' }),
	// Unterscheidet mehrere Karten desselben Besitzers, z. B. persönliche
	// Dauerkarte vs. Fanclubkarte beim Präsidenten ("DK 1", "Fanclubkarte 1" ...).
	bezeichnung: text('bezeichnung').notNull(),
	block: text('block').notNull(),
	reihe: text('reihe').notNull(),
	platz: text('platz').notNull()
});

export const spiele = pgTable('spiele', {
	id: uuid('id').defaultRandom().primaryKey(),
	datum: date('datum').notNull(),
	gegner: text('gegner').notNull(),
	wettbewerb: text('wettbewerb').notNull(),
	heimAuswaerts: heimAuswaertsEnum('heim_auswaerts').notNull(),
	// Europa-League-Spiele haben keine OpenLigaDB-ID -> nullable
	openligadbId: text('openligadb_id')
});

export const freigaben = pgTable('freigaben', {
	id: uuid('id').defaultRandom().primaryKey(),
	dauerkarteId: uuid('dauerkarte_id')
		.notNull()
		.references(() => dauerkarten.id, { onDelete: 'cascade' }),
	spielId: uuid('spiel_id')
		.notNull()
		.references(() => spiele.id, { onDelete: 'cascade' }),
	status: freigabeStatusEnum('status').notNull().default('offen'),
	vergebenAn: uuid('vergeben_an').references(() => mitglieder.id, { onDelete: 'set null' })
});

export const bewerbungen = pgTable('bewerbungen', {
	id: uuid('id').defaultRandom().primaryKey(),
	freigabeId: uuid('freigabe_id')
		.notNull()
		.references(() => freigaben.id, { onDelete: 'cascade' }),
	mitgliedId: uuid('mitglied_id')
		.notNull()
		.references(() => mitglieder.id, { onDelete: 'cascade' }),
	status: bewerbungStatusEnum('status').notNull().default('angefragt'),
	erstelltAm: timestamp('erstellt_am', { withTimezone: true }).notNull().defaultNow()
});

// --- Relations: ermöglichen komfortable Queries mit db.query.x.findMany({ with: {...} }) ---

export const mitgliederRelations = relations(mitglieder, ({ many }) => ({
	rollenZuordnungen: many(mitgliedRollen),
	dauerkarten: many(dauerkarten),
	bewerbungen: many(bewerbungen)
}));

export const rollenRelations = relations(rollen, ({ many }) => ({
	mitgliederZuordnungen: many(mitgliedRollen)
}));

export const mitgliedRollenRelations = relations(mitgliedRollen, ({ one }) => ({
	mitglied: one(mitglieder, {
		fields: [mitgliedRollen.mitgliedId],
		references: [mitglieder.id]
	}),
	rolle: one(rollen, {
		fields: [mitgliedRollen.rolleId],
		references: [rollen.id]
	})
}));

export const dauerkartenRelations = relations(dauerkarten, ({ one, many }) => ({
	besitzer: one(mitglieder, {
		fields: [dauerkarten.besitzerId],
		references: [mitglieder.id]
	}),
	freigaben: many(freigaben)
}));

export const spieleRelations = relations(spiele, ({ many }) => ({
	freigaben: many(freigaben)
}));

export const freigabenRelations = relations(freigaben, ({ one, many }) => ({
	dauerkarte: one(dauerkarten, {
		fields: [freigaben.dauerkarteId],
		references: [dauerkarten.id]
	}),
	spiel: one(spiele, {
		fields: [freigaben.spielId],
		references: [spiele.id]
	}),
	vergebenAnMitglied: one(mitglieder, {
		fields: [freigaben.vergebenAn],
		references: [mitglieder.id]
	}),
	bewerbungen: many(bewerbungen)
}));

export const bewerbungenRelations = relations(bewerbungen, ({ one }) => ({
	freigabe: one(freigaben, {
		fields: [bewerbungen.freigabeId],
		references: [freigaben.id]
	}),
	mitglied: one(mitglieder, {
		fields: [bewerbungen.mitgliedId],
		references: [mitglieder.id]
	})
}));