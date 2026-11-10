<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '$lib/components/Card.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let laden = $state(false);
</script>

<main class="auth-page">
	<div class="auth-header">
		<h1 class="auth-title">Seefüchse</h1>
		<p class="auth-subtitle">Mitglieder-App</p>
	</div>

	<Card>
		<h2 class="form-heading">Neues Passwort festlegen</h2>

		{#if form?.fehler}
			<p class="fehler-text" role="alert">{form.fehler}</p>
		{/if}

		<form
			method="POST"
			use:enhance={() => {
				laden = true;
				return async ({ update }) => {
					laden = false;
					await update();
				};
			}}
		>
			<div class="field">
				<label for="passwort">Neues Passwort</label>
				<input
					id="passwort"
					name="passwort"
					type="password"
					autocomplete="new-password"
					required
					minlength={data.minLaenge}
					placeholder="Mindestens {data.minLaenge} Zeichen"
				/>
			</div>

			<div class="field">
				<label for="passwort_wdh">Passwort wiederholen</label>
				<input
					id="passwort_wdh"
					name="passwort_wdh"
					type="password"
					autocomplete="new-password"
					required
					minlength={data.minLaenge}
					placeholder="••••••••"
				/>
			</div>

			<button type="submit" class="btn-primary" disabled={laden}>
				{laden ? 'Speichern…' : 'Passwort speichern'}
			</button>
		</form>
	</Card>
</main>

<style>
	.auth-page {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 24px;
		padding: 24px 0 40px;
	}

	.auth-header {
		text-align: center;
	}

	.auth-title {
		margin: 0;
		font-size: 28px;
		font-weight: 800;
		color: var(--color-accent);
	}

	.auth-subtitle {
		margin: 4px 0 0;
		color: var(--color-text-muted);
		font-size: 14px;
	}

	.form-heading {
		margin: 0 0 20px;
		font-size: 18px;
		font-weight: 700;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 16px;
	}

	label {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	input {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		font-size: 15px;
		padding: 12px 14px;
		outline: none;
		transition: border-color 0.15s;
		width: 100%;
	}

	input:focus {
		border-color: var(--color-accent);
	}

	input::placeholder {
		color: var(--color-text-muted);
	}

	.btn-primary {
		width: 100%;
		background: var(--color-accent);
		color: #fff;
		border: none;
		border-radius: var(--radius-md);
		font-size: 15px;
		font-weight: 700;
		padding: 14px;
		cursor: pointer;
		margin-top: 8px;
		transition: opacity 0.15s;
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.fehler-text {
		background: var(--color-accent-muted);
		border: 1px solid var(--color-accent);
		border-radius: var(--radius-md);
		color: var(--color-accent);
		font-size: 14px;
		padding: 10px 14px;
		margin: 0 0 16px;
	}
</style>
