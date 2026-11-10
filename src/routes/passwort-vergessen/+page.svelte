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
		{#if form?.gesendet}
			<div class="erfolg-box" role="status">
				<p class="erfolg-titel">E-Mail unterwegs</p>
				<p class="erfolg-text">
					Falls ein Konto mit dieser Adresse existiert, haben wir dir eine E-Mail mit einem Link
					zum Zurücksetzen geschickt. Bitte prüfe auch den Spam-Ordner.
				</p>
			</div>
		{:else}
			<h2 class="form-heading">Passwort vergessen</h2>
			<p class="hinweis">
				Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, mit dem du ein neues Passwort
				festlegen kannst.
			</p>

			{#if form?.fehler}
				<p class="fehler-text" role="alert">{form.fehler}</p>
			{:else if data.linkUngueltig}
				<p class="fehler-text" role="alert">
					Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.
				</p>
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
					<label for="email">E-Mail</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						required
						value={form?.email ?? ''}
						placeholder="deine@email.de"
					/>
				</div>

				<button type="submit" class="btn-primary" disabled={laden}>
					{laden ? 'Senden…' : 'Link anfordern'}
				</button>
			</form>
		{/if}

		<p class="link-hint">
			Zurück zur <a href="/login">Anmeldung</a>
		</p>
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
		margin: 0 0 8px;
		font-size: 18px;
		font-weight: 700;
	}

	.hinweis {
		margin: 0 0 20px;
		font-size: 14px;
		color: var(--color-text-muted);
		line-height: 1.5;
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

	.erfolg-box {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.erfolg-titel {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
		color: var(--color-success);
	}

	.erfolg-text {
		margin: 0;
		font-size: 14px;
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	.link-hint {
		margin: 16px 0 0;
		text-align: center;
		font-size: 14px;
		color: var(--color-text-muted);
	}

	.link-hint a {
		color: var(--color-accent);
		font-weight: 600;
	}
</style>
