<script lang="ts">
	import { enhance } from '$app/forms';
	import Header from '$lib/components/Header.svelte';
	import Card from '$lib/components/Card.svelte';
	import FreigabeZeile from '$lib/components/FreigabeZeile.svelte';
	import FehlerHinweis from '$lib/components/FehlerHinweis.svelte';
	import { mitNeuladenBeiFehler } from '$lib/enhance';
	import { formatiereUhrzeit } from '$lib/zeit';
	import {
		datumGross,
		datumLang,
		gastteamName,
		hatErgebnis,
		heimteamName,
		rundeAnzeige
	} from '$lib/spielAnzeige';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const uhrzeit = $derived(formatiereUhrzeit(data.spiel.uhrzeit));
	const heimAuswaertsText = $derived(data.spiel.heimAuswaerts === 'heim' ? 'HEIM' : 'AUSWÄRTS');
	const rundeBlock = $derived(rundeAnzeige(data.spiel.runde));
	const datumBlock = $derived(datumGross(data.spiel.datum));
	const mitErgebnis = $derived(hatErgebnis(data.spiel));

	const STATUS_LABEL: Record<string, string> = {
		offen: 'Offen',
		vergeben: 'Vergeben',
		zurueckgezogen: 'Zurückgezogen'
	};
</script>

<div class="page-container">
	<Header />

	<main class="main-content">
		<!-- Zurück-Link -->
		<a href="/spielplan" class="back-link">← Spielplan</a>

		<FehlerHinweis nachricht={form?.fehler} />

		<!-- Spiel-Hero -->
		<Card>
			<div class="spiel-hero">
				<div class="hero-date">
					{#if rundeBlock}
						{#if rundeBlock.klein}
							<span class="hero-day">{rundeBlock.gross}</span>
							<span class="hero-month runde-label">{rundeBlock.klein}</span>
						{:else}
							<span class="runde-text" title={rundeBlock.gross}>{rundeBlock.gross}</span>
						{/if}
					{:else}
						<span class="hero-day">{datumBlock.tag}</span>
						<span class="hero-month">{datumBlock.monat}</span>
					{/if}
				</div>
				<div class="hero-content">
					<div class="hero-badges">
						<span class="badge badge-heim">{heimAuswaertsText}</span>
						<span class="badge badge-wettbewerb">{data.spiel.wettbewerb.toUpperCase()}</span>
					</div>
					<h2 class="hero-gegner">{data.spiel.gegner}</h2>
					<p class="hero-datum-long">
						{datumLang(data.spiel.datum)}{#if uhrzeit}&nbsp;· {uhrzeit} Uhr{/if}
						{#if uhrzeit && data.spiel.uhrzeitVorlaeufig}(vorläufig){/if}
					</p>
					{#if uhrzeit && data.spiel.uhrzeitVorlaeufig}
						<p class="vorlaeufig-hinweis">
							Anstoßzeit noch nicht von der DFL bestätigt, kann sich ändern.
						</p>
					{/if}
				</div>
			</div>
			{#if mitErgebnis}
				<!-- Stadion-Reihenfolge: Heimteam links, Gastteam rechts -->
				<p class="hero-ergebnis">
					<span class="ergebnis-team ergebnis-heim">{heimteamName(data.spiel)}</span>
					<span class="ergebnis-tore">{data.spiel.toreHeimteam} : {data.spiel.toreGastteam}</span>
					<span class="ergebnis-team">{gastteamName(data.spiel)}</span>
				</p>
			{/if}
		</Card>

		<!-- Gespieltes Spiel: nur noch lesen und eigene Einträge zurückziehen -->
		{#if !data.spielOffen}
			<p class="gesperrt-hinweis" role="status">Dieses Spiel hat bereits stattgefunden.</p>
		{/if}

		<!-- Dauerkarte-Abschnitt – bei gesperrtem Spiel nur, wenn es eine offene
		     (zurückziehbare) oder vergebene (nur Anzeige) eigene Freigabe gibt -->
		{#if data.hasDauerkarte && (data.spielOffen || data.freigabe?.status === 'offen' || data.freigabe?.status === 'vergeben')}
			<section class="freigabe-section">
				<h3 class="section-title">Deine Dauerkarte für dieses Spiel</h3>
				<FreigabeZeile
					spiel={data.spiel}
					freigabe={data.freigabe}
					zeigeBewerber={false}
					toggleBeschriftung={data.spielOffen ? 'Dauerkarte freigeben' : 'Freigabe zurückziehen'}
				/>
			</section>
		{/if}

		<!-- Interesse anmelden – ausgeblendet, wenn der Nutzer selbst eine Freigabe
		     (offen/vergeben) hat oder das Spiel gesperrt ist; ein bestehender
		     Eintrag bleibt zurückziehbar. -->
		{#if data.hatInteresseAngemeldet || (data.spielOffen && !data.interesseGesperrt)}
		<section class="freigabe-section">
			<h3 class="section-title">Dein Interesse an diesem Spiel</h3>
			<Card>
				<div class="interesse-block">
					<div class="interesse-info">
						<p class="interesse-titel">
							{data.hatInteresseAngemeldet
								? 'Interesse angemeldet ✓'
								: 'Noch kein Interesse angemeldet'}
						</p>
						<p class="interesse-hinweis">
							Zeig an, dass du für dieses Spiel eine Karte suchst – unabhängig davon, ob schon
							eine Dauerkarte freigegeben wurde.
						</p>
					</div>
					<form
						method="POST"
						action={data.hatInteresseAngemeldet ? '?/interesseZurueckziehen' : '?/interesseAnmelden'}
						use:enhance={mitNeuladenBeiFehler}
					>
						<button
							type="button"
							class="btn-interesse"
							class:on={data.hatInteresseAngemeldet}
							onclick={(e) => e.currentTarget.closest('form')?.requestSubmit()}
						>
							{data.hatInteresseAngemeldet ? 'Interesse zurückziehen' : 'Interesse anmelden'}
						</button>
					</form>
				</div>
			</Card>
		</section>
		{/if}

		<!-- Interesse-Liste – Namensliste für alle, "Vergeben" nur für DK-Besitzer,
		     wenn diese Person nicht schon einen Vergeben-Button in den Freigaben hat -->
		{#if data.interesseListe.length > 0}
			<section class="freigabe-section">
				<h3 class="section-title">Interesse an diesem Spiel</h3>
				<Card>
					<div class="interessenten-liste">
						{#each data.interesseListe as person (person.mitgliedId)}
							<div class="interessent-zeile">
								<span class="interessent-name">{person.name}</span>
								{#if person.kannVergeben}
									<form method="POST" action="?/vergebenAusInteresse" use:enhance={mitNeuladenBeiFehler}>
										<input type="hidden" name="dauerkarteId" value={data.eigeneDauerkarteId} />
										<input type="hidden" name="mitgliedId" value={person.mitgliedId} />
										<button
											type="button"
											class="btn-vergeben"
											onclick={(e) => e.currentTarget.closest('form')?.requestSubmit()}
										>
											Vergeben
										</button>
									</form>
								{/if}
							</div>
						{/each}
					</div>
				</Card>
			</section>
		{/if}

		<!-- Dauerkarten-Freigaben – für alle Mitglieder sichtbar -->
		{#if data.freigabenFuerSpiel.length > 0}
			<section class="freigabe-section">
				<h3 class="section-title">Dauerkarten-Freigaben</h3>
				<div class="freigaben-liste">
					{#each data.freigabenFuerSpiel as freigabe (freigabe.id)}
						<Card>
							<div class="freigabe-item">
								<div class="freigabe-info">
									<p class="freigabe-besitzer">{freigabe.besitzerName}</p>
									<p class="freigabe-karte">{freigabe.kartenBezeichnung}</p>
									{#if freigabe.status === 'vergeben' && freigabe.empfaengerName}
										<p class="freigabe-empfaenger">an {freigabe.empfaengerName}</p>
									{/if}
								</div>
								<span class="status-badge status-{freigabe.status}">
									{STATUS_LABEL[freigabe.status] ?? freigabe.status}
								</span>
							</div>

							<!-- Bei gesperrtem Spiel nur noch die eigene Anfrage zurückziehen -->
							{#if freigabe.status === 'offen' && !freigabe.istBesitzer && (data.spielOffen || freigabe.hatSelbstBeworben)}
								<div class="freigabe-aktion">
									{#if freigabe.hatSelbstBeworben}
										<p class="anfrage-status">Angefragt ✓</p>
									{/if}
									<form
										method="POST"
										action={freigabe.hatSelbstBeworben
											? '?/bewerbungZurueckziehen'
											: '?/bewerben'}
										use:enhance
									>
										<input type="hidden" name="freigabeId" value={freigabe.id} />
										<button
											type="button"
											class="btn-anfrage"
											class:on={freigabe.hatSelbstBeworben}
											onclick={(e) => e.currentTarget.closest('form')?.requestSubmit()}
										>
											{freigabe.hatSelbstBeworben ? 'Anfrage zurückziehen' : 'Anfragen'}
										</button>
									</form>
								</div>
							{/if}

							{#if freigabe.bewerberListe.length > 0}
								<div class="bewerber-liste">
									{#each freigabe.bewerberListe as bewerber (bewerber.id)}
										<div class="bewerber-zeile">
											<span class="bewerber-text">
												{bewerber.name}
												<span class="bewerber-status">({bewerber.status})</span>
											</span>
											{#if data.spielOffen && freigabe.istBesitzer && freigabe.status === 'offen' && bewerber.status === 'angefragt'}
												<form method="POST" action="?/vergeben" use:enhance={mitNeuladenBeiFehler}>
													<input type="hidden" name="freigabeId" value={freigabe.id} />
													<input type="hidden" name="bewerbungId" value={bewerber.id} />
													<button
														type="button"
														class="btn-vergeben"
														onclick={(e) => e.currentTarget.closest('form')?.requestSubmit()}
													>
														Vergeben
													</button>
												</form>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</Card>
					{/each}
				</div>
			</section>
		{:else}
			<p class="freigaben-leer">Keine Freigaben für dieses Spiel</p>
		{/if}
	</main>
</div>

<style>
	.page-container {
		min-height: 100vh;
		background: var(--color-bg);
		color: var(--color-text);
	}

	.main-content {
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: 16px 16px 100px;
		max-width: var(--container-max);
		margin: 0 auto;
	}

	.back-link {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-text-muted);
		text-decoration: none;
		transition: color 0.15s;
	}

	.back-link:hover {
		color: var(--color-text);
	}

	/* HERO */
	.spiel-hero {
		display: flex;
		gap: 16px;
		align-items: flex-start;
	}

	.hero-date {
		display: flex;
		flex-direction: column;
		align-items: center;
		font-family: var(--font-mono);
		flex-shrink: 0;
	}

	.hero-day {
		font-size: 40px;
		font-weight: 700;
		line-height: 1;
		color: var(--color-text);
	}

	/* 'Spieltag'/'Runde' unter der Nummer: einzeilig, ohne Trennung */
	.hero-month.runde-label {
		white-space: nowrap;
		hyphens: none;
	}

	/*
	 * Runde ohne Nummer ('Achtelfinale'): einzeilig, ohne Trennung. Der Hero ist
	 * keine Liste, der Block darf dafür breiter werden; erst ab 112px '…'.
	 */
	.runde-text {
		max-width: 112px;
		font-family: var(--font-sans);
		font-size: 13px;
		font-weight: 700;
		line-height: 1.2;
		text-align: center;
		white-space: nowrap;
		hyphens: none;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.hero-month {
		font-size: 13px;
		color: var(--color-text-muted);
		margin-top: 4px;
	}

	/* ERGEBNIS */
	.hero-ergebnis {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 12px;
		margin: 16px 0 0;
		padding-top: 16px;
		border-top: 1px solid var(--color-border);
	}

	.ergebnis-team {
		min-width: 0;
		font-size: 14px;
		font-weight: 600;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.ergebnis-heim {
		text-align: right;
	}

	.ergebnis-tore {
		font-family: var(--font-mono);
		font-size: 28px;
		font-weight: 700;
		white-space: nowrap;
	}

	.hero-content {
		flex: 1;
		min-width: 0;
	}

	.hero-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 10px;
	}

	.badge {
		display: inline-block;
		padding: 4px 8px;
		border-radius: 6px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.5px;
		white-space: nowrap;
	}

	.badge-heim {
		background: var(--badge-heim-bg);
		color: var(--badge-heim-text);
	}

	.badge-wettbewerb {
		background: var(--badge-wettbewerb-bg);
		color: var(--badge-wettbewerb-text);
	}

	.hero-gegner {
		margin: 0 0 6px;
		font-size: 22px;
		font-weight: 700;
		line-height: 1.2;
	}

	.vorlaeufig-hinweis {
		margin: 8px 0 0;
		padding: 6px 10px;
		border-radius: var(--radius-md);
		background: var(--color-warning-muted);
		color: var(--color-warning);
		font-size: 12px;
	}

	.gesperrt-hinweis {
		margin: 0;
		padding: 8px 12px;
		border-radius: var(--radius-md);
		background: var(--color-info-muted);
		color: var(--color-info);
		font-size: 13px;
	}

	.hero-datum-long {
		margin: 0;
		font-size: 13px;
		color: var(--color-text-muted);
	}

	/* FREIGABE */
	.section-title {
		margin: 0 0 12px;
		font-size: 16px;
		font-weight: 600;
	}

	/* DAUERKARTEN-FREIGABEN */
	.freigaben-liste {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.freigabe-item {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}

	.freigabe-info {
		flex: 1;
		min-width: 0;
	}

	.freigabe-besitzer {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}

	.freigabe-karte {
		margin: 3px 0 0;
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.freigabe-empfaenger {
		margin: 4px 0 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-success);
	}

	.status-badge {
		display: inline-block;
		padding: 4px 8px;
		border-radius: 6px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.5px;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.status-offen {
		background: var(--color-info-muted);
		color: var(--color-info);
	}

	.status-vergeben {
		background: var(--color-success-muted);
		color: var(--color-success);
	}

	.status-zurueckgezogen {
		background: var(--color-warning-muted);
		color: var(--color-warning);
	}

	.freigaben-leer {
		margin: 0;
		font-size: 13px;
		color: var(--color-text-muted);
	}

	/* ANFRAGEN / BEWERBER */
	.freigabe-aktion {
		margin-top: 12px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.anfrage-status {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-success);
	}

	.btn-anfrage {
		width: 100%;
		padding: 8px 14px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-info);
		background: var(--color-info-muted);
		color: var(--color-info);
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		font-family: inherit;
		transition:
			background-color 0.15s,
			border-color 0.15s,
			color 0.15s;
	}

	.btn-anfrage:hover {
		background: var(--color-info);
		color: #000;
	}

	.btn-anfrage.on {
		border-color: var(--color-border);
		background: transparent;
		color: var(--color-text-muted);
	}

	.btn-anfrage.on:hover {
		border-color: var(--color-accent);
		color: var(--color-accent);
		background: transparent;
	}

	.bewerber-liste {
		margin-top: 12px;
		padding-top: 10px;
		border-top: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.bewerber-zeile {
		margin: 0;
		font-size: 13px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.bewerber-zeile form {
		margin: 0;
		flex-shrink: 0;
	}

	.bewerber-text {
		min-width: 0;
	}

	.bewerber-status {
		color: var(--color-text-muted);
	}

	.btn-vergeben {
		padding: 4px 10px;
		border-radius: var(--radius-md);
		border: none;
		background: var(--color-success);
		color: #000;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
		font-family: inherit;
		flex-shrink: 0;
		transition: opacity 0.15s;
	}

	.btn-vergeben:hover {
		opacity: 0.85;
	}

	/* INTERESSE-LISTE */
	.interessenten-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.interessent-zeile {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: 13px;
	}

	.interessent-zeile form {
		margin: 0;
		flex-shrink: 0;
	}

	.interessent-name {
		min-width: 0;
	}

	/* INTERESSE */
	.interesse-block {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.interesse-titel {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}

	.interesse-hinweis {
		margin: 4px 0 0;
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.btn-interesse {
		width: 100%;
		padding: 10px 16px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-accent);
		background: var(--color-accent-muted);
		color: var(--color-text);
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
		font-family: inherit;
		transition:
			background-color 0.15s,
			border-color 0.15s;
	}

	.btn-interesse:hover {
		background: var(--color-accent);
	}

	.btn-interesse.on {
		border-color: var(--color-success);
		background: var(--color-success-muted);
		color: var(--color-success);
	}

	.btn-interesse.on:hover {
		background: var(--color-success);
		color: #000;
	}
</style>
