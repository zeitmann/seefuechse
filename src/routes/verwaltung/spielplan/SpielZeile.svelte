<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import FehlerHinweis from '$lib/components/FehlerHinweis.svelte';
	import { mitNeuladenBeiFehler } from '$lib/enhance';
	import SpielFormular from './SpielFormular.svelte';
	import { datumDeutsch, heimAuswaertsText } from './anzeige';
	import { formatiereUhrzeit } from '$lib/zeit';
	import type { PageData } from './$types';

	let {
		spiel,
		vergangen,
		bearbeiten,
		fehler,
		vorschlag,
		vereinsnamen,
		wettbewerbe,
		heimAuswaertsWerte,
		onbearbeiten,
		onschliessen
	}: {
		spiel: PageData['spiele'][number];
		vergangen: boolean;
		bearbeiten: boolean;
		fehler: string | null;
		vorschlag: { eingegeben: string; vorhanden: string } | null;
		vereinsnamen: string[];
		wettbewerbe: readonly string[];
		heimAuswaertsWerte: readonly string[];
		onbearbeiten: () => void;
		onschliessen: () => void;
	} = $props();

	// Inline-Bestätigung statt window.confirm (zuverlässig auch in der iPhone-PWA).
	let loeschenBestaetigen = $state(false);

	const uhrzeit = $derived(formatiereUhrzeit(spiel.uhrzeit));
	// Löschfehler nur nach eigenem Löschversuch anzeigen.
	let loeschenAbgeschickt = $state(false);

	const loeschenAbsenden: SubmitFunction = async (eingabe) => {
		loeschenAbgeschickt = true;
		const nachher = await mitNeuladenBeiFehler(eingabe);
		return async (ergebnis) => {
			if (nachher) await nachher(ergebnis);
			loeschenBestaetigen = false;
		};
	};

	function bearbeitenStarten() {
		loeschenBestaetigen = false;
		loeschenAbgeschickt = false;
		onbearbeiten();
	}
</script>

<li class="spiel">
	<div class="spiel-info" class:vergangen>
		<span class="spiel-datum">
			{datumDeutsch(spiel.datum)}{#if uhrzeit}&nbsp;· {uhrzeit} Uhr{/if}
		</span>
		<span class="spiel-gegner">{spiel.gegner}</span>
		<span class="spiel-meta">
			{spiel.wettbewerb} · {heimAuswaertsText[spiel.heimAuswaerts] ?? spiel.heimAuswaerts}
		</span>
	</div>

	{#if bearbeiten}
		<SpielFormular
			aktion="?/spielAendern"
			spielId={spiel.id}
			startwerte={{ ...spiel, uhrzeit: uhrzeit ?? '' }}
			{wettbewerbe}
			{heimAuswaertsWerte}
			{fehler}
			{vorschlag}
			{vereinsnamen}
			absendeText="Speichern"
			onerfolg={onschliessen}
			onabbrechen={onschliessen}
		/>
	{:else}
		{#if loeschenAbgeschickt}
			<FehlerHinweis nachricht={fehler} />
		{/if}

		{#if loeschenBestaetigen}
			<form
				method="POST"
				action="?/spielLoeschen"
				class="bestaetigung"
				use:enhance={loeschenAbsenden}
			>
				<input type="hidden" name="spielId" value={spiel.id} />
				<span class="bestaetigung-text">Wirklich löschen?</span>
				<div class="aktionen">
					<button type="submit" class="btn-gefahr">Ja</button>
					<button
						type="button"
						class="btn-sekundaer"
						onclick={() => (loeschenBestaetigen = false)}
					>
						Abbrechen
					</button>
				</div>
			</form>
		{:else}
			<div class="aktionen">
				<button type="button" class="btn-sekundaer" onclick={bearbeitenStarten}>
					Bearbeiten
				</button>
				<button
					type="button"
					class="btn-sekundaer btn-loeschen"
					onclick={() => (loeschenBestaetigen = true)}
				>
					Löschen
				</button>
			</div>
		{/if}
	{/if}
</li>

<style>
	.spiel {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px 0;
		border-bottom: 1px solid var(--color-border);
	}

	.spiel:first-child {
		padding-top: 0;
	}

	.spiel:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.spiel :global(.fehler-hinweis) {
		margin: 0;
	}

	.spiel-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.spiel-info.vergangen {
		opacity: 0.5;
	}

	.spiel-datum {
		font-size: 12px;
		font-family: var(--font-mono);
		color: var(--color-text-muted);
	}

	.spiel-gegner {
		font-size: 15px;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.spiel-meta {
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.aktionen {
		display: flex;
		gap: 8px;
	}

	.bestaetigung {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0;
	}

	.bestaetigung-text {
		font-size: 14px;
		font-weight: 600;
	}

	.btn-sekundaer {
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

	.btn-sekundaer:hover {
		border-color: var(--color-text-muted);
		color: var(--color-text);
	}

	.btn-loeschen:hover {
		border-color: var(--color-accent);
		color: var(--color-accent);
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
</style>
