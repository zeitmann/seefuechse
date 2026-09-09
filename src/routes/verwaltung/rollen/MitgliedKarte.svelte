<script lang="ts">
	import { untrack } from 'svelte';
	import { slide } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Card from '$lib/components/Card.svelte';
	import type { PageData, ActionData } from './$types';

	let {
		mitglied,
		alleRollen,
		form,
		offen,
		ontoggle
	}: {
		mitglied: PageData['mitgliederListe'][number];
		alleRollen: PageData['alleRollen'];
		form: ActionData;
		offen: boolean;
		ontoggle: () => void;
	} = $props();

	// Editierbarer lokaler Zustand für die Textfelder. Der Startwert wird bewusst
	// einmalig aus der Prop übernommen – das laufende Nachziehen übernimmt der
	// $effect weiter unten.
	let name = $state(untrack(() => mitglied.name));
	let email = $state(untrack(() => mitglied.email));

	// Merker der zuletzt gesehenen persistierten Werte (nicht reaktiv).
	let letzterName = untrack(() => mitglied.name);
	let letzteEmail = untrack(() => mitglied.email);

	// Re-Sync mit den frischen Prop-Daten nach jedem invalidateAll() (ausgelöst
	// durch use:enhance). Der Guard sorgt dafür, dass nur bei tatsächlich
	// geänderten persistierten Werten überschrieben wird – noch nicht
	// gespeicherte Eingaben in dieser Karte bleiben erhalten, wenn ein
	// invalidateAll aus einer anderen Karte stammt. Gleichzeitig übernimmt die
	// Anzeige so den kanonischen Server-Wert (z. B. kleingeschriebene E-Mail).
	$effect(() => {
		if (mitglied.name !== letzterName) {
			letzterName = mitglied.name;
			name = mitglied.name;
		}
		if (mitglied.email !== letzteEmail) {
			letzteEmail = mitglied.email;
			email = mitglied.email;
		}
	});

	// Kein form.reset() nach dem Submit: sonst leert der Reset die (per bind
	// kontrollierten) Felder im DOM, ohne dass Svelte sie danach neu schreibt,
	// weil sich der zugrunde liegende Wert nicht geändert hat.
	const ohneReset: SubmitFunction = () => async ({ update }) => {
		await update({ reset: false });
	};

	let meldung = $derived.by(() => {
		if (!form || form.mitgliedId !== mitglied.id) return null;
		if ('gespeichert' in form && form.gespeichert)
			return { typ: 'ok' as const, text: 'Daten gespeichert.' };
		if ('rolleGeaendert' in form && form.rolleGeaendert)
			return { typ: 'ok' as const, text: 'Rolle geändert.' };
		if ('erfolg' in form && form.erfolg)
			return { typ: 'ok' as const, text: 'Passwort-Mail gesendet.' };
		if ('message' in form && form.message)
			return { typ: 'fehler' as const, text: form.message };
		return null;
	});
</script>

<Card>
	<div class="member">
		<button
			type="button"
			class="member-header"
			aria-expanded={offen}
			onclick={ontoggle}
		>
			<span class="member-ident">
				<span class="member-name">{mitglied.name}</span>
				<span class="member-email">{mitglied.email}</span>
			</span>
			{#if offen}
				<ChevronUp size={18} aria-hidden="true" />
			{:else}
				<ChevronDown size={18} aria-hidden="true" />
			{/if}
		</button>

		{#if offen}
			<div class="member-body" transition:slide={{ duration: 180 }}>
				<div class="member-top">
					<span class="member-status" data-status={mitglied.status}>
						{mitglied.status}
					</span>
				</div>

				<!-- Name / E-Mail bearbeiten -->
				<form method="POST" action="?/datenAendern" class="daten-form" use:enhance={ohneReset}>
					<input type="hidden" name="mitgliedId" value={mitglied.id} />

					<label class="feld">
						<span class="feld-label">Name</span>
						<input class="feld-input" name="neuerName" type="text" bind:value={name} required />
					</label>

					<label class="feld">
						<span class="feld-label">E-Mail</span>
						<input class="feld-input" name="neueEmail" type="email" bind:value={email} required />
					</label>

					<button type="submit" class="btn-primaer">Speichern</button>
				</form>

				<!-- Rolle wechseln (Auto-Submit bei Änderung) -->
				<form method="POST" action="?/rolleAendern" class="rolle-form" use:enhance={ohneReset}>
					<input type="hidden" name="mitgliedId" value={mitglied.id} />
					<label class="feld">
						<span class="feld-label">Rolle</span>
						<select
							class="feld-input"
							name="neueRolleId"
							onchange={(e) => e.currentTarget.form?.requestSubmit()}
						>
							<option value="" disabled selected={!mitglied.rolleId}>— keine Rolle —</option>
							{#each alleRollen as rolle (rolle.id)}
								<option value={rolle.id} selected={rolle.id === mitglied.rolleId}>
									{rolle.name}
								</option>
							{/each}
						</select>
					</label>
				</form>

				<!-- Passwort-Mail -->
				<form method="POST" action="?/passwortMailSenden" class="mail-form" use:enhance={ohneReset}>
					<input type="hidden" name="mitgliedId" value={mitglied.id} />
					<button type="submit" class="btn-sekundaer">Passwort-Mail senden</button>
				</form>

				{#if meldung}
					<p class="meldung" class:meldung-fehler={meldung.typ === 'fehler'}>
						{meldung.text}
					</p>
				{/if}
			</div>
		{/if}
	</div>
</Card>

<style>
	.member {
		display: flex;
		flex-direction: column;
	}

	.member-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		width: 100%;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--color-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.member-ident {
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

	.member-header :global(svg) {
		flex-shrink: 0;
		color: var(--color-text-muted);
	}

	.member-body {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-top: 14px;
		margin-top: 14px;
		border-top: 1px solid var(--color-border);
	}

	.member-top {
		display: flex;
		justify-content: flex-end;
	}

	.member-status {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.member-status[data-status='aktiv'] {
		color: var(--color-success);
	}

	.daten-form,
	.rolle-form,
	.mail-form {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
	}

	.feld {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.feld-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.feld-input {
		width: 100%;
		padding: 8px 10px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-text);
		font-size: 14px;
		font-family: inherit;
	}

	.feld-input:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	.btn-primaer {
		align-self: flex-start;
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

	.btn-primaer:hover {
		opacity: 0.85;
	}

	.btn-sekundaer {
		align-self: flex-start;
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

	.meldung {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-success);
	}

	.meldung-fehler {
		color: #e5484d;
	}
</style>
