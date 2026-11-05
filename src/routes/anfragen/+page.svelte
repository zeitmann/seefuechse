<script lang="ts">
	import { enhance } from '$app/forms';
	import Header from '$lib/components/Header.svelte';
	import Card from '$lib/components/Card.svelte';
	import FehlerHinweis from '$lib/components/FehlerHinweis.svelte';
	import { mitNeuladenBeiFehler } from '$lib/enhance';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const STATUS_LABEL: Record<string, string> = {
		angefragt: 'Angefragt',
		angenommen: 'Angenommen',
		abgelehnt: 'Abgelehnt'
	};

	function formatDatum(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('de-DE', {
			weekday: 'short',
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}

	function metaZeile(wettbewerb: string, datum: string): string {
		return `${wettbewerb.toUpperCase()} · ${formatDatum(datum)}`;
	}
</script>

<div class="page-container">
	<Header />

	<main class="main-content">
		<h1>Meine Anfragen</h1>
		<FehlerHinweis nachricht={form?.fehler} />

		<!-- 1. Interesse-Anmeldungen -->
		<section class="section">
			<h2 class="section-title">Deine Interesse-Anmeldungen</h2>
			{#if data.meineInteressen.length === 0}
				<p class="empty-state">Du hast für kein kommendes Spiel Interesse angemeldet.</p>
			{:else}
				<div class="liste">
					{#each data.meineInteressen as eintrag (eintrag.spielId)}
						<Card>
							<div class="zeile">
								<div class="zeile-info">
									<p class="zeile-titel">{eintrag.gegner}</p>
									<p class="zeile-sub">{metaZeile(eintrag.wettbewerb, eintrag.datum)}</p>
								</div>
								<form method="POST" action="?/interesseZurueckziehen" use:enhance>
									<input type="hidden" name="spielId" value={eintrag.spielId} />
									<button
										type="button"
										class="btn-sekundaer"
										onclick={(e) => e.currentTarget.closest('form')?.requestSubmit()}
									>
										Zurückziehen
									</button>
								</form>
							</div>
						</Card>
					{/each}
				</div>
			{/if}
		</section>

		<!-- 2. Bewerbungen -->
		<section class="section">
			<h2 class="section-title">Deine Bewerbungen</h2>
			{#if data.meineBewerbungen.length === 0}
				<p class="empty-state">Du hast dich noch auf keine Freigabe beworben.</p>
			{:else}
				<div class="liste">
					{#each data.meineBewerbungen as bewerbung (bewerbung.id)}
						<Card>
							<div class="zeile">
								<div class="zeile-info">
									<p class="zeile-titel">{bewerbung.gegner}</p>
									<p class="zeile-sub">{metaZeile(bewerbung.wettbewerb, bewerbung.datum)}</p>
									<p class="zeile-sub">Karte von {bewerbung.besitzerName}</p>
								</div>
								<div class="zeile-aktion">
									<span class="status-badge status-{bewerbung.status}">
										{STATUS_LABEL[bewerbung.status] ?? bewerbung.status}
									</span>
									{#if bewerbung.status === 'angefragt'}
										<form method="POST" action="?/bewerbungZurueckziehen" use:enhance>
											<input type="hidden" name="freigabeId" value={bewerbung.freigabeId} />
											<button
												type="button"
												class="btn-sekundaer"
												onclick={(e) => e.currentTarget.closest('form')?.requestSubmit()}
											>
												Zurückziehen
											</button>
										</form>
									{/if}
								</div>
							</div>
						</Card>
					{/each}
				</div>
			{/if}
		</section>

		<!-- 3. Eigene offene Karten -->
		{#if data.eigeneOffeneFreigaben.length > 0}
			<section class="section">
				<h2 class="section-title">Deine offenen Karten</h2>
				<div class="liste">
					{#each data.eigeneOffeneFreigaben as freigabe (freigabe.id)}
						<Card>
							<div class="zeile-info">
								<p class="zeile-titel">{freigabe.gegner}</p>
								<p class="zeile-sub">
									{metaZeile(freigabe.wettbewerb, freigabe.datum)} · {freigabe.kartenBezeichnung}
								</p>
							</div>

							{#if freigabe.bewerberListe.length > 0}
								<div class="bewerber-liste">
									{#each freigabe.bewerberListe as bewerber (bewerber.id)}
										<div class="bewerber-zeile">
											<span class="bewerber-text">
												{bewerber.name}
												<span class="bewerber-status">({bewerber.status})</span>
											</span>
											{#if bewerber.status === 'angefragt'}
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
							{:else}
								<p class="empty-state">Noch keine Bewerbungen.</p>
							{/if}
						</Card>
					{/each}
				</div>
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
		gap: 28px;
		padding: 20px 16px 100px;
		max-width: var(--container-max);
		margin: 0 auto;
	}

	h1 {
		margin: 0;
		font-size: 22px;
		font-weight: 700;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-title {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}

	.empty-state {
		margin: 0;
		font-size: 14px;
		color: var(--color-text-muted);
	}

	.liste {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.zeile {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}

	.zeile-info {
		flex: 1;
		min-width: 0;
	}

	.zeile-titel {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}

	.zeile-sub {
		margin: 3px 0 0;
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.zeile-aktion {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
		flex-shrink: 0;
	}

	.zeile form {
		margin: 0;
	}

	.status-badge {
		display: inline-block;
		padding: 4px 8px;
		border-radius: 6px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.5px;
		white-space: nowrap;
	}

	.status-angefragt {
		background: var(--color-warning-muted);
		color: var(--color-warning);
	}

	.status-angenommen {
		background: var(--color-success-muted);
		color: var(--color-success);
	}

	.status-abgelehnt {
		background: var(--color-surface);
		color: var(--color-text-muted);
	}

	.btn-sekundaer {
		padding: 5px 12px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text-muted);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		white-space: nowrap;
		transition:
			border-color 0.15s,
			color 0.15s;
	}

	.btn-sekundaer:hover {
		border-color: var(--color-accent);
		color: var(--color-accent);
	}

	.bewerber-liste {
		margin-top: 12px;
		padding-top: 10px;
		border-top: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.bewerber-zeile {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: 13px;
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
</style>
