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
	time,
	integer,
	timestamp,
	boolean,
	index,
	primaryKey,
	unique
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

export const mitgliedStatusEnum = pgEnum('mitglied_status', ['ausstehend', 'aktiv', 'abgelehnt']);
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

export const benachrichtigungTypEnum = pgEnum('benachrichtigung_typ', [
	'neue_anfrage',
	'anfrage_angenommen',
	'anfrage_abgelehnt',
	'karte_freigegeben',
	'neues_interesse'
]);

/** Mögliche Werte von benachrichtigung_typ, z. B. 'neue_anfrage'. */
export type BenachrichtigungTyp = (typeof benachrichtigungTypEnum.enumValues)[number];

export const rollen = pgTable('rollen', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: text('name').notNull().unique()
});

export const mitglieder = pgTable('mitglieder', {
	id: uuid('id')
		.primaryKey()
		.references(() => authUsers.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	status: mitgliedStatusEnum('status').notNull().default('ausstehend')
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
	// Alle Karten liegen im selben Block, daher keine Block-/Reihe-Spalten.
	// Platz ist optional (null = nicht erfasst).
	platz: text('platz')
});

/**
 * ACHTUNG: Der UNIQUE-Index `spiele_openligadb_id_uniq` auf openligadb_id existiert
 * nur in der Datenbank (manuell angelegt) und ist hier nicht deklariert. Der
 * OpenLigaDB-Sync braucht ihn für `on conflict (openligadb_id)`. Deshalb KEIN
 * `drizzle-kit push` ausführen – das würde den Index entfernen.
 */
export const spiele = pgTable('spiele', {
	id: uuid('id').defaultRandom().primaryKey(),
	datum: date('datum').notNull(),
	// Anpfiff als Ortszeit (Europe/Berlin), 'HH:MM:SS'; null = noch unbekannt
	uhrzeit: time('uhrzeit'),
	gegner: text('gegner').notNull(),
	wettbewerb: text('wettbewerb').notNull(),
	heimAuswaerts: heimAuswaertsEnum('heim_auswaerts').notNull(),
	// matchID aus OpenLigaDB; null bei von Hand angelegten Spielen (z. B. Testspiele
	// oder Europa League – Freiburg spielt 2026/27 Conference League, die Europa
	// League wird nicht synchronisiert)
	openligadbId: text('openligadb_id'),
	// true = von Hand gepflegt, der OpenLigaDB-Sync überschreibt das Spiel nicht
	manuellUeberschrieben: boolean('manuell_ueberschrieben').notNull().default(false),
	// lastUpdateDateTime aus OpenLigaDB beim letzten übernommenen Stand
	openligadbAktualisiertAm: timestamp('openligadb_aktualisiert_am', { withTimezone: true })
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

export const bewerbungen = pgTable(
	'bewerbungen',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		freigabeId: uuid('freigabe_id')
			.notNull()
			.references(() => freigaben.id, { onDelete: 'cascade' }),
		mitgliedId: uuid('mitglied_id')
			.notNull()
			.references(() => mitglieder.id, { onDelete: 'cascade' }),
		status: bewerbungStatusEnum('status').notNull().default('angefragt'),
		erstelltAm: timestamp('erstellt_am', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => ({
		// Ein Mitglied kann sich pro Freigabe nur einmal bewerben.
		freigabeMitgliedUnique: unique().on(table.freigabeId, table.mitgliedId)
	})
);

/**
 * Interessensbekundung eines Mitglieds für ein Spiel – unabhängig von einer
 * konkreten Freigabe/Bewerbung. Ermöglicht eine "Warteliste" für Spiele, für
 * die (noch) keine Dauerkarte freigegeben wurde.
 */
export const interesse = pgTable(
	'interesse',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		mitgliedId: uuid('mitglied_id')
			.notNull()
			.references(() => mitglieder.id, { onDelete: 'cascade' }),
		spielId: uuid('spiel_id')
			.notNull()
			.references(() => spiele.id, { onDelete: 'cascade' }),
		erstelltAm: timestamp('erstellt_am', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => ({
		// Ein Mitglied kann pro Spiel nur einmal Interesse anmelden.
		mitgliedSpielUnique: unique().on(table.mitgliedId, table.spielId)
	})
);

/**
 * In-App-Benachrichtigungen (Glocke). Push-Versand baut später darauf auf.
 */
export const benachrichtigungen = pgTable(
	'benachrichtigungen',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		mitgliedId: uuid('mitglied_id')
			.notNull()
			.references(() => mitglieder.id, { onDelete: 'cascade' }),
		typ: benachrichtigungTypEnum('typ').notNull(),
		titel: text('titel').notNull(),
		text: text('text').notNull(),
		link: text('link').notNull(),
		// NULL = ungelesen
		gelesenAm: timestamp('gelesen_am', { withTimezone: true }),
		erstelltAm: timestamp('erstellt_am', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => ({
		mitgliedErstelltIdx: index('benachrichtigungen_mitglied_erstellt_idx').on(
			table.mitgliedId,
			table.erstelltAm.desc()
		)
	})
);

/**
 * Web-Push-Abos (ein Eintrag pro Gerät/Browser). endpoint ist eindeutig.
 */
export const pushAbos = pgTable(
	'push_abos',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		mitgliedId: uuid('mitglied_id')
			.notNull()
			.references(() => mitglieder.id, { onDelete: 'cascade' }),
		endpoint: text('endpoint').notNull().unique(),
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		// Optionale Gerätebeschreibung, z. B. aus dem User-Agent
		geraet: text('geraet'),
		erstelltAm: timestamp('erstellt_am', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => ({
		mitgliedIdx: index('push_abos_mitglied_idx').on(table.mitgliedId)
	})
);

/**
 * Push-Einstellung pro Mitglied und Typ. Fehlt eine Zeile, gilt der
 * Standardwert (push_aktiv = true).
 */
export const benachrichtigungEinstellungen = pgTable(
	'benachrichtigung_einstellungen',
	{
		mitgliedId: uuid('mitglied_id')
			.notNull()
			.references(() => mitglieder.id, { onDelete: 'cascade' }),
		typ: benachrichtigungTypEnum('typ').notNull(),
		pushAktiv: boolean('push_aktiv').notNull().default(true)
	},
	(table) => ({
		pk: primaryKey({ columns: [table.mitgliedId, table.typ] })
	})
);

/**
 * Protokoll der Spielplan-Syncs (täglicher Cron und Button in /verwaltung).
 * Nur Abbild der manuell angelegten DB-Tabelle: der CHECK auf `quelle` und der
 * Index sync_laeufe_gestartet_am_idx existieren nur in der Datenbank.
 */
export const syncLaeufe = pgTable('sync_laeufe', {
	id: uuid('id').defaultRandom().primaryKey(),
	gestartetAm: timestamp('gestartet_am', { withTimezone: true }).notNull().defaultNow(),
	quelle: text('quelle', { enum: ['cron', 'manuell'] }).notNull(),
	saison: integer('saison').notNull(),
	erfolgreich: boolean('erfolgreich').notNull(),
	neu: integer('neu').notNull().default(0),
	geaendert: integer('geaendert').notNull().default(0),
	unveraendert: integer('unveraendert').notNull().default(0),
	uebersprungen: integer('uebersprungen').notNull().default(0),
	// Zeilenweise zusammengefügte Hinweise des Laufs; null = keine
	hinweise: text('hinweise')
});

// --- Relations: ermöglichen komfortable Queries mit db.query.x.findMany({ with: {...} }) ---

export const mitgliederRelations = relations(mitglieder, ({ many }) => ({
	rollenZuordnungen: many(mitgliedRollen),
	dauerkarten: many(dauerkarten),
	bewerbungen: many(bewerbungen),
	interesse: many(interesse),
	benachrichtigungen: many(benachrichtigungen),
	pushAbos: many(pushAbos),
	benachrichtigungEinstellungen: many(benachrichtigungEinstellungen)
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
	freigaben: many(freigaben),
	interesse: many(interesse)
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

export const interesseRelations = relations(interesse, ({ one }) => ({
	mitglied: one(mitglieder, {
		fields: [interesse.mitgliedId],
		references: [mitglieder.id]
	}),
	spiel: one(spiele, {
		fields: [interesse.spielId],
		references: [spiele.id]
	})
}));

export const benachrichtigungenRelations = relations(benachrichtigungen, ({ one }) => ({
	mitglied: one(mitglieder, {
		fields: [benachrichtigungen.mitgliedId],
		references: [mitglieder.id]
	})
}));

export const pushAbosRelations = relations(pushAbos, ({ one }) => ({
	mitglied: one(mitglieder, {
		fields: [pushAbos.mitgliedId],
		references: [mitglieder.id]
	})
}));

export const benachrichtigungEinstellungenRelations = relations(
	benachrichtigungEinstellungen,
	({ one }) => ({
		mitglied: one(mitglieder, {
			fields: [benachrichtigungEinstellungen.mitgliedId],
			references: [mitglieder.id]
		})
	})
);
