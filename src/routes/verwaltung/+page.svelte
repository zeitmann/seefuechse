<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Card from '$lib/components/Card.svelte';
	import FehlerHinweis from '$lib/components/FehlerHinweis.svelte';
	import Header from '$lib/components/Header.svelte';
	import { mitNeuladenBeiFehler } from '$lib/enhance';
	import SpielplanSyncKarte from './SpielplanSyncKarte.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Inline-Bestätigung statt window.confirm (zuverlässig auch in der iPhone-PWA):
	// ID der Dauerkarte, deren Entfernen gerade bestätigt werden soll.
	let entfernenBestaetigenId = $state<string | null>(null);

	const entfernenAbsenden: SubmitFunction = async (eingabe) => {
		const nachher = await mitNeuladenBeiFehler(eingabe);
		return async (ergebnis) => {
			if (nachher) await nachher(ergebnis);
			entfernenBestaetigenId = null;
		};
	};
</script>

<div class="page-container">
	<Header />

	<header class="page-header">
		<h1>Verwaltung</h1>
	</header>

	<main class="main-content">
		{#if !data.kannVerwalten}
			<Card>
				<div class="no-access">
					<span class="no-access-icon" aria-hidden="true">🔒</span>
					<p>Kein Zugriff. Diese Seite ist nur für Vorstand und Admin sichtbar.</p>
				</div>
			</Card>
		{:else}
			<SpielplanSyncKarte
				ergebnis={form?.sync ?? null}
				terminierungsStichtag={data.terminierungsStichtag}
				letzterSync={data.letzterSync}
				saison={data.syncSaison}
			/>

			<!-- Ausstehende Freischaltungen (nur für Admin/Vorstand) -->
			<section class="section">
				<div class="section-header">
					<h2>Ausstehende Freischaltungen</h2>
					{#if data.ausstehendeMitglieder.length > 0}
						<span class="badge">{data.ausstehendeMitglieder.length}</span>
					{/if}
				</div>

				{#if data.ausstehendeMitglieder.length === 0}
					<p class="empty-state">Keine ausstehenden Freischaltungen</p>
				{:else}
					<Card>
						<ul class="member-list">
							{#each data.ausstehendeMitglieder as mitglied (mitglied.id)}
								<li class="member-item">
									<div class="member-info">
										<span class="member-name">{mitglied.name}</span>
										<span class="member-email">{mitglied.email}</span>
									</div>
									<div class="member-actions">
										<form method="POST" action="?/freischalten" use:enhance>
											<input type="hidden" name="mitgliedId" value={mitglied.id} />
											<button type="submit" class="btn-aktivieren">Aktivieren</button>
										</form>
										<form
											method="POST"
											action="?/ablehnen"
											use:enhance={({ cancel }) => {
												if (!confirm(`${mitglied.name} wirklich ablehnen?`)) cancel();
											}}
										>
											<input type="hidden" name="mitgliedId" value={mitglied.id} />
											<button type="submit" class="btn-ablehnen">Ablehnen</button>
										</form>
									</div>
								</li>
							{/each}
						</ul>
					</Card>
				{/if}
			</section>

			<!-- Dauerkarten: Kontrolle der bei der Registrierung angegebenen Karten -->
			<section class="section">
				<div class="section-header">
					<h2>Dauerkarten</h2>
					{#if data.dauerkarten.length > 0}
						<span class="badge badge-neutral">{data.dauerkarten.length}</span>
					{/if}
				</div>

				<FehlerHinweis nachricht={form?.dauerkarteFehler} />
				{#if form?.dauerkarteMeldung}
					<p class="meldung" role="status">{form.dauerkarteMeldung}</p>
				{/if}

				{#if data.dauerkarten.length === 0}
					<p class="empty-state">Noch keine Dauerkarten.</p>
				{:else}
					<Card>
						<ul class="member-list">
							{#each data.dauerkarten as karte (karte.id)}
								<li class="member-item dk-item">
									<div class="member-info">
										<span class="member-name">{karte.bezeichnung}</span>
										<span class="dk-details">
											<span class="dk-besitzer">{karte.besitzer.name}</span>
											{#if karte.platz}
												<span>· Platz {karte.platz}</span>
											{/if}
										</span>
										<span class="status-badge status-{karte.besitzer.status}">
											{karte.besitzer.status}
										</span>
									</div>

									{#if entfernenBestaetigenId === karte.id}
										<form
											method="POST"
											action="?/dauerkarteEntfernen"
											class="bestaetigung"
											use:enhance={entfernenAbsenden}
										>
											<input type="hidden" name="dauerkarteId" value={karte.id} />
											<p class="bestaetigung-text">
												Wirklich entfernen? Löscht auch alle Freigaben und Anfragen zu dieser
												Karte.
											</p>
											<div class="member-actions">
												<button type="submit" class="btn-gefahr">Ja, entfernen</button>
												<button
													type="button"
													class="btn-ablehnen"
													onclick={() => (entfernenBestaetigenId = null)}
												>
													Abbrechen
												</button>
											</div>
										</form>
									{:else}
										<div class="member-actions">
											<button
												type="button"
												class="btn-ablehnen"
												onclick={() => (entfernenBestaetigenId = karte.id)}
											>
												Entfernen
											</button>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					</Card>
				{/if}
			</section>

			<section class="section">
				<div class="section-header">
					<h2>Spielplan</h2>
				</div>
				<a class="verwaltungs-link" href="/verwaltung/spielplan">Spielplan verwalten</a>
			</section>

			{#if data.istAdmin}
				<section class="section">
					<div class="section-header">
						<h2>Administration</h2>
					</div>
					<a class="verwaltungs-link" href="/verwaltung/rollen">Rollen verwalten</a>
				</section>
			{/if}
		{/if}
	</main>
</div>

<style>
	.page-container {
		min-height: 100vh;
		background: var(--color-bg);
		color: var(--color-text);
	}

	.page-header {
		padding: 20px 16px 0;
	}

	.page-header h1 {
		margin: 0;
		font-size: 22px;
		font-weight: 700;
	}

	.main-content {
		display: flex;
		flex-direction: column;
		gap: 28px;
		padding: 20px 16px 100px;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 12px;
	}

	.section-header h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		padding: 0 6px;
		border-radius: var(--radius-full);
		background: var(--color-accent);
		color: #fff;
		font-size: 12px;
		font-weight: 700;
	}

	.empty-state {
		margin: 0;
		font-size: 14px;
		color: var(--color-text-muted);
		padding: 16px 0;
	}

	.member-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.member-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 0;
		border-bottom: 1px solid var(--color-border);
	}

	.member-item:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.member-item:first-child {
		padding-top: 0;
	}

	.member-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.member-name {
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.member-email {
		font-size: 12px;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.member-actions {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
	}

	.member-actions form {
		margin: 0;
	}

	.btn-aktivieren {
		padding: 6px 14px;
		border-radius: var(--radius-md);
		border: none;
		background: var(--color-success);
		color: #000;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		transition: opacity 0.15s;
	}

	.btn-aktivieren:hover {
		opacity: 0.85;
	}

	.btn-ablehnen {
		padding: 6px 14px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text-muted);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		transition:
			border-color 0.15s,
			color 0.15s;
	}

	.btn-ablehnen:hover {
		border-color: var(--color-text-muted);
		color: var(--color-text);
	}

	.badge-neutral {
		background: var(--color-surface-raised);
		color: var(--color-text-muted);
	}

	.meldung {
		margin: 0 0 12px;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-success);
	}

	/* Dauerkarten: Bestätigung bricht auf schmalen Displays in eine eigene Zeile um */
	.dk-item {
		flex-wrap: wrap;
	}

	.dk-item .member-info {
		flex: 1;
	}

	.dk-details {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		font-size: 13px;
		color: var(--color-text-muted);
	}

	.dk-besitzer {
		color: var(--color-text);
	}

	.status-badge {
		align-self: flex-start;
		margin-top: 4px;
		padding: 2px 8px;
		border-radius: var(--radius-full);
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.status-aktiv {
		background: var(--color-success-muted);
		color: var(--color-success);
	}

	.status-ausstehend {
		background: var(--color-warning-muted);
		color: var(--color-warning);
	}

	.status-abgelehnt {
		background: var(--color-accent-muted);
		color: var(--color-accent);
	}

	.bestaetigung {
		flex-basis: 100%;
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0;
	}

	.bestaetigung-text {
		margin: 0;
		font-size: 13px;
		color: var(--color-text);
		line-height: 1.4;
	}

	.btn-gefahr {
		padding: 6px 14px;
		border-radius: var(--radius-md);
		border: none;
		background: var(--color-accent);
		color: #fff;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		transition: opacity 0.15s;
	}

	.btn-gefahr:hover {
		opacity: 0.85;
	}

	.dk-item .member-actions button {
		min-height: 36px;
	}

	.verwaltungs-link {
		display: inline-flex;
		align-items: center;
		padding: 10px 16px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
		transition:
			border-color 0.15s,
			color 0.15s;
	}

	.verwaltungs-link:hover {
		border-color: var(--color-text-muted);
		color: var(--color-accent);
	}

	.no-access {
		text-align: center;
		color: var(--color-text-muted);
		font-size: 15px;
	}

	.no-access-icon {
		display: block;
		font-size: 28px;
		margin-bottom: 8px;
	}

	.no-access p {
		margin: 0;
	}
</style>
