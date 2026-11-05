<script lang="ts">
	import { enhance } from '$app/forms';
	import Header from '$lib/components/Header.svelte';
	import Card from '$lib/components/Card.svelte';
	import FreigabeZeile from '$lib/components/FreigabeZeile.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const heimAuswaertsText = $derived(data.spiel.heimAuswaerts === 'heim' ? 'HEIM' : 'AUSWÄRTS');

	function formatDatum(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('de-DE', {
			weekday: 'long',
			day: '2-digit',
			month: 'long',
			year: 'numeric'
		});
	}

	function getDay(dateStr: string): string {
		return new Date(dateStr).getDate().toString().padStart(2, '0');
	}

	function getMonthShort(dateStr: string): string {
		const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
		return months[new Date(dateStr).getMonth()];
	}

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

		<!-- Spiel-Hero -->
		<Card>
			<div class="spiel-hero">
				<div class="hero-date">
					<span class="hero-day">{getDay(data.spiel.datum)}</span>
					<span class="hero-month">{getMonthShort(data.spiel.datum)}</span>
				</div>
				<div class="hero-content">
					<div class="hero-badges">
						<span class="badge badge-heim">{heimAuswaertsText}</span>
						<span class="badge badge-wettbewerb">{data.spiel.wettbewerb.toUpperCase()}</span>
					</div>
					<h2 class="hero-gegner">{data.spiel.gegner}</h2>
					<p class="hero-datum-long">{formatDatum(data.spiel.datum)}</p>
				</div>
			</div>
		</Card>

		<!-- Dauerkarte-Abschnitt -->
		{#if data.hasDauerkarte}
			<section class="freigabe-section">
				<h3 class="section-title">Deine Dauerkarte für dieses Spiel</h3>
				<FreigabeZeile spiel={data.spiel} freigabe={data.freigabe} zeigeBewerber={false} />
			</section>
		{/if}

		<!-- Interesse anmelden – ausgeblendet, wenn der Nutzer selbst eine Freigabe
		     (offen/vergeben) hat; ein bestehender Eintrag bleibt zurückziehbar. -->
		{#if !data.interesseGesperrt || data.hatInteresseAngemeldet}
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
					<form method="POST" action="?/toggleInteresse" use:enhance>
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
									<form method="POST" action="?/vergebenAusInteresse" use:enhance>
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

							{#if freigabe.status === 'offen' && !freigabe.istBesitzer}
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
											{#if freigabe.istBesitzer && freigabe.status === 'offen' && bewerber.status === 'angefragt'}
												<form method="POST" action="?/vergeben" use:enhance>
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

	.hero-month {
		font-size: 13px;
		color: var(--color-text-muted);
		margin-top: 4px;
	}

	.hero-content {
		flex: 1;
		min-width: 0;
	}

	.hero-badges {
		display: flex;
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
