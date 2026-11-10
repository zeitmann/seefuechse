<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import Card from '$lib/components/Card.svelte';
	import Header from '$lib/components/Header.svelte';
	import FehlerHinweis from '$lib/components/FehlerHinweis.svelte';
	import SpielFormular from './SpielFormular.svelte';
	import SpielZeile from './SpielZeile.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let neuOffen = $state(false);
	// Nur ein Spiel gleichzeitig in Bearbeitung; null = keins.
	let bearbeiteteId = $state<string | null>(null);

	// Wie /spielplan: Vergleich der ISO-Datumsstrings.
	const heute = new Date().toISOString().slice(0, 10);

	const spielIds = $derived(new Set(data.spiele.map((s) => s.id)));

	// Fehler zu einem Spiel, das nicht mehr in der Liste steht (z. B. zwischenzeitlich
	// gelöscht), oben anzeigen – die Zeile mit dem Formular gibt es dann nicht mehr.
	const allgemeinerFehler = $derived(
		form?.fehler && form.ziel !== 'neu' && !spielIds.has(form.ziel ?? '') ? form.fehler : null
	);

	function fehlerFuer(ziel: string): string | null {
		return form?.fehler && form.ziel === ziel ? form.fehler : null;
	}

	function neuUmschalten() {
		neuOffen = !neuOffen;
		if (neuOffen) bearbeiteteId = null;
	}
</script>

<div class="page-container">
	<Header />

	<header class="page-header">
		<h1>Spielplan verwalten</h1>
	</header>

	<main class="main-content">
		<section class="section">
			{#if neuOffen}
				<Card>
					<h2 class="karten-titel">Neues Spiel</h2>
					<SpielFormular
						aktion="?/spielAnlegen"
						startwerte={{
							datum: '',
							gegner: '',
							wettbewerb: data.wettbewerbe[0],
							heimAuswaerts: data.heimAuswaertsWerte[0]
						}}
						wettbewerbe={data.wettbewerbe}
						heimAuswaertsWerte={data.heimAuswaertsWerte}
						fehler={fehlerFuer('neu')}
						absendeText="Anlegen"
						onerfolg={() => (neuOffen = false)}
						onabbrechen={() => (neuOffen = false)}
					/>
				</Card>
			{:else}
				<button type="button" class="btn-neu" onclick={neuUmschalten}>
					<Plus size={16} aria-hidden="true" />
					Neues Spiel
				</button>
			{/if}
		</section>

		<section class="section">
			<div class="section-header">
				<h2>Spiele</h2>
				<span class="badge">{data.spiele.length}</span>
			</div>

			<FehlerHinweis nachricht={allgemeinerFehler} />

			{#if form?.erfolg}
				<p class="meldung" role="status">{form.erfolg}</p>
			{/if}

			{#if data.spiele.length === 0}
				<p class="empty-state">Noch keine Spiele angelegt</p>
			{:else}
				<Card>
					<ul class="spiel-liste">
						{#each data.spiele as spiel (spiel.id)}
							<SpielZeile
								{spiel}
								vergangen={spiel.datum < heute}
								bearbeiten={bearbeiteteId === spiel.id}
								fehler={fehlerFuer(spiel.id)}
								wettbewerbe={data.wettbewerbe}
								heimAuswaertsWerte={data.heimAuswaertsWerte}
								onbearbeiten={() => {
									bearbeiteteId = spiel.id;
									neuOffen = false;
								}}
								onschliessen={() => (bearbeiteteId = null)}
							/>
						{/each}
					</ul>
				</Card>
			{/if}
		</section>
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

	.karten-titel {
		margin: 0 0 12px;
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

	.btn-neu {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		padding: 12px 16px;
		border-radius: var(--radius-md);
		border: none;
		background: var(--color-accent);
		color: #fff;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		transition: opacity 0.15s;
	}

	.btn-neu:hover {
		opacity: 0.85;
	}

	.meldung {
		margin: 0 0 12px;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-success);
	}

	.empty-state {
		margin: 0;
		font-size: 14px;
		color: var(--color-text-muted);
		padding: 16px 0;
	}

	.spiel-liste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
</style>
