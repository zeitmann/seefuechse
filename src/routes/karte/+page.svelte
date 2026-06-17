<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Card from '$lib/components/Card.svelte';
	import FreigabeZeile from '$lib/components/FreigabeZeile.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="page-container">
	<Header />

	<main class="main-content">
		{#if !data.hasDauerkarte}
			<div class="no-card">
				<p>Du besitzt keine eigene Dauerkarte.</p>
			</div>
		{:else}
			<div class="page-title">
				<h2>Meine Karte</h2>
				<p class="subtitle">Dauerkarte {data.dauerkarte.bezeichnung}</p>
			</div>

			<!-- Dauerkarten-Info -->
			<Card>
				<div class="dauerkarte-info">
					<div class="dauerkarte-details">
						<p class="dauerkarte-name">{data.dauerkarte.bezeichnung}</p>
						<p class="dauerkarte-ort">{data.dauerkarte.block} · {data.dauerkarte.reihe} · Platz {data.dauerkarte.platz}</p>
					</div>
					{#if data.freigegebenCount > 0}
						<span class="freigegeben-badge">{data.freigegebenCount} FREIGEGEBEN</span>
					{/if}
				</div>
			</Card>

			<!-- Kommende Spiele freigeben -->
			<section class="spiele-section">
				<h3 class="section-title">Kommende Spiele freigeben</h3>

				{#if data.spieleMitFreigabe.length === 0}
					<p class="empty-state">Keine kommenden Spiele.</p>
				{:else}
					<div class="spiele-liste">
						{#each data.spieleMitFreigabe as item (item.spiel.id)}
							<FreigabeZeile spiel={item.spiel} freigabe={item.freigabe} />
						{/each}
					</div>
				{/if}
			</section>
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
		padding: 20px 16px 100px;
		max-width: var(--container-max);
		margin: 0 auto;
	}

	.no-card {
		margin-top: 40px;
		text-align: center;
		color: var(--color-text-muted);
		font-size: 15px;
	}

	.page-title h2 {
		margin: 0;
		font-size: 22px;
		font-weight: 700;
	}

	.subtitle {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--color-text-muted);
	}

	.dauerkarte-info {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.dauerkarte-name {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
	}

	.dauerkarte-ort {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
	}

	.freigegeben-badge {
		font-size: 11px;
		font-weight: 700;
		color: var(--color-success);
		white-space: nowrap;
		letter-spacing: 0.5px;
	}

	.section-title {
		margin: 0 0 12px;
		font-size: 16px;
		font-weight: 600;
	}

	.spiele-liste {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.empty-state {
		font-size: 14px;
		color: var(--color-text-muted);
	}
</style>
