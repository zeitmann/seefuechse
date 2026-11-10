<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import FehlerHinweis from '$lib/components/FehlerHinweis.svelte';
	import { mitNeuladenBeiFehler } from '$lib/enhance';
	import { heimAuswaertsText } from './anzeige';

	type Werte = { datum: string; gegner: string; wettbewerb: string; heimAuswaerts: string };

	let {
		aktion,
		spielId = null,
		startwerte,
		wettbewerbe,
		heimAuswaertsWerte,
		fehler,
		absendeText,
		onerfolg,
		onabbrechen
	}: {
		aktion: '?/spielAnlegen' | '?/spielAendern';
		spielId?: string | null;
		startwerte: Werte;
		wettbewerbe: readonly string[];
		heimAuswaertsWerte: readonly string[];
		fehler: string | null;
		absendeText: string;
		onerfolg: () => void;
		onabbrechen: () => void;
	} = $props();

	// Startwerte einmalig übernehmen; das Formular wird bei jedem Öffnen neu
	// gemountet, ein Nachziehen ist daher nicht nötig. Bei Fehlern bleiben die
	// Eingaben erhalten, weil update() nur bei Erfolg zurücksetzt.
	let datum = $state(untrack(() => startwerte.datum));
	let gegner = $state(untrack(() => startwerte.gegner));
	let wettbewerb = $state(untrack(() => startwerte.wettbewerb));
	let heimAuswaerts = $state(untrack(() => startwerte.heimAuswaerts));

	// Fehler nur zeigen, wenn sie aus einem Absenden dieses Formulars stammen –
	// sonst taucht eine alte Meldung beim erneuten Aufklappen wieder auf.
	let abgeschickt = $state(false);
	let sendet = $state(false);

	const absenden: SubmitFunction = async (eingabe) => {
		abgeschickt = true;
		sendet = true;
		const nachher = await mitNeuladenBeiFehler(eingabe);
		return async (ergebnis) => {
			try {
				if (nachher) await nachher(ergebnis);
			} finally {
				sendet = false;
			}
			if (ergebnis.result.type === 'success') onerfolg();
		};
	};
</script>

<form method="POST" action={aktion} class="spiel-form" use:enhance={absenden}>
	{#if spielId}
		<input type="hidden" name="spielId" value={spielId} />
	{/if}

	{#if abgeschickt}
		<FehlerHinweis nachricht={fehler} />
	{/if}

	<label class="feld">
		<span class="feld-label">Datum</span>
		<input class="feld-input" name="datum" type="date" bind:value={datum} required />
	</label>

	<label class="feld">
		<span class="feld-label">Gegner</span>
		<input
			class="feld-input"
			name="gegner"
			type="text"
			bind:value={gegner}
			minlength="2"
			maxlength="60"
			autocomplete="off"
			required
		/>
	</label>

	<div class="feld-reihe">
		<label class="feld">
			<span class="feld-label">Wettbewerb</span>
			<select class="feld-input" name="wettbewerb" bind:value={wettbewerb} required>
				{#each wettbewerbe as wert (wert)}
					<option value={wert}>{wert}</option>
				{/each}
			</select>
		</label>

		<label class="feld">
			<span class="feld-label">Heim/Auswärts</span>
			<select class="feld-input" name="heimAuswaerts" bind:value={heimAuswaerts} required>
				{#each heimAuswaertsWerte as wert (wert)}
					<option value={wert}>{heimAuswaertsText[wert] ?? wert}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="form-aktionen">
		<button type="submit" class="btn-primaer" disabled={sendet}>{absendeText}</button>
		<button type="button" class="btn-sekundaer" onclick={onabbrechen}>Abbrechen</button>
	</div>
</form>

<style>
	.spiel-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin: 0;
	}

	.spiel-form :global(.fehler-hinweis) {
		margin: 0;
	}

	.feld-reihe {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.feld {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.feld-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.feld-input {
		width: 100%;
		box-sizing: border-box;
		/* 16px verhindert das automatische Hineinzoomen auf dem iPhone */
		font-size: 16px;
		padding: 8px 10px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-text);
		font-family: inherit;
	}

	.feld-input:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	.form-aktionen {
		display: flex;
		gap: 8px;
	}

	.btn-primaer {
		padding: 8px 16px;
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

	.btn-primaer:hover,
	.btn-primaer:disabled {
		opacity: 0.7;
	}

	.btn-sekundaer {
		padding: 8px 16px;
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
</style>
