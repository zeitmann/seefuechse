<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from './Card.svelte';

	type SpielProp = {
		id: string;
		datum: string;
		gegner: string;
		wettbewerb: string;
		heimAuswaerts: 'heim' | 'auswaerts';
	};

	type FreigabeProp = {
		id: string;
		status: 'offen' | 'vergeben' | 'zurueckgezogen';
		bewerbungen: Array<{
			mitgliedId: string;
			mitglied: { name: string };
		}>;
		vergebenAnMitglied: { name: string } | null;
	} | null;

	let { spiel, freigabe }: { spiel: SpielProp; freigabe: FreigabeProp } = $props();

	const istVergeben = $derived(freigabe?.status === 'vergeben');
	const istFreigegeben = $derived(freigabe?.status === 'offen');

	function formatDatum(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('de-DE', {
			weekday: 'short',
			day: '2-digit',
			month: 'short'
		});
	}
</script>

<Card>
	<div class="spiel-block">
		<!-- Spiel-Zeile mit Toggle -->
		<div class="spiel-row">
			<div class="spiel-info">
				<div class="spiel-badges">
					<span class="badge badge-wettbewerb">{spiel.wettbewerb.toUpperCase()}</span>
					<span class="badge badge-heim-auswaerts">{spiel.heimAuswaerts === 'heim' ? 'HEIM' : 'AUSWÄRTS'}</span>
				</div>
				<p class="spiel-gegner">{spiel.gegner}</p>
				<p class="spiel-datum">{formatDatum(spiel.datum)}</p>
			</div>

			<form method="POST" action="?/toggleFreigabe" use:enhance>
				<input type="hidden" name="spielId" value={spiel.id} />
				<button
					type="button"
					class="toggle"
					class:on={istFreigegeben || istVergeben}
					disabled={istVergeben}
					aria-label={istFreigegeben ? 'Freigabe zurückziehen' : 'Freigeben'}
					onclick={(e) => e.currentTarget.closest('form')?.requestSubmit()}
				>
					<span class="toggle-thumb"></span>
				</button>
			</form>
		</div>

		<!-- Zusatz-Bereich je nach Status -->
		{#if istVergeben}
			<p class="status-vergeben">
				Vergeben an {freigabe?.vergebenAnMitglied?.name ?? '—'}
			</p>
		{:else if istFreigegeben && freigabe && freigabe.bewerbungen.length > 0}
			<div class="bewerber-liste">
				{#each freigabe.bewerbungen as bewerbung (bewerbung.mitgliedId)}
					<form method="POST" action="?/vergeben" use:enhance>
						<input type="hidden" name="freigabeId" value={freigabe.id} />
						<input type="hidden" name="mitgliedId" value={bewerbung.mitgliedId} />
						<div class="bewerber-row">
							<span class="bewerber-name">{bewerbung.mitglied.name}</span>
							<button type="submit" class="btn-vergeben">Vergeben</button>
						</div>
					</form>
				{/each}
			</div>
		{:else if istFreigegeben}
			<p class="status-warten">Freigegeben – wartet auf Anfragen.</p>
		{/if}
	</div>
</Card>

<style>
	/* SPIEL BLOCK */
	.spiel-block {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.spiel-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.spiel-info {
		flex: 1;
		min-width: 0;
	}

	.spiel-badges {
		display: flex;
		gap: 6px;
		margin-bottom: 6px;
	}

	.badge {
		display: inline-block;
		padding: 3px 7px;
		border-radius: 5px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.5px;
	}

	.badge-wettbewerb {
		background: var(--badge-wettbewerb-bg);
		color: var(--badge-wettbewerb-text);
	}

	.badge-heim-auswaerts {
		background: var(--badge-heim-bg);
		color: var(--badge-heim-text);
	}

	.spiel-gegner {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}

	.spiel-datum {
		margin: 3px 0 0;
		font-size: 12px;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
	}

	/* TOGGLE */
	.toggle {
		width: 48px;
		height: 28px;
		border-radius: var(--radius-full);
		border: none;
		background: var(--color-border);
		cursor: pointer;
		position: relative;
		flex-shrink: 0;
		transition: background 0.2s;
		padding: 0;
	}

	.toggle.on {
		background: var(--color-success);
	}

	.toggle:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toggle-thumb {
		position: absolute;
		width: 22px;
		height: 22px;
		background: #fff;
		border-radius: 50%;
		top: 3px;
		left: 3px;
		transition: left 0.2s;
		pointer-events: none;
	}

	.toggle.on .toggle-thumb {
		left: 23px;
	}

	/* STATUS */
	.status-vergeben {
		margin: 0;
		font-size: 13px;
		color: var(--color-success);
		font-weight: 600;
	}

	.status-warten {
		margin: 0;
		font-size: 13px;
		color: var(--color-text-muted);
	}

	/* BEWERBER */
	.bewerber-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 4px;
		border-top: 1px solid var(--color-border);
	}

	.bewerber-liste form {
		margin: 0;
	}

	.bewerber-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.bewerber-name {
		font-size: 14px;
		font-weight: 500;
	}

	.btn-vergeben {
		padding: 5px 12px;
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
