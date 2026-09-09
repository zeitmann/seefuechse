<script lang="ts">
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
				<FreigabeZeile spiel={data.spiel} freigabe={data.freigabe} />
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
</style>
