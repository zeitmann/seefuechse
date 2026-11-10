<script lang="ts">
	import { enhance } from '$app/forms';
	import { BellOff } from '@lucide/svelte';
	import Header from '$lib/components/Header.svelte';
	import Card from '$lib/components/Card.svelte';
	import { relativeZeit } from '$lib/zeit';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const hatUngelesene = $derived(data.benachrichtigungen.some((b) => b.gelesenAm === null));
</script>

<div class="page-container">
	<Header />

	<main class="main-content">
		<div class="kopf">
			<h1>Benachrichtigungen</h1>
			{#if hatUngelesene}
				<form method="POST" action="?/alleGelesen" use:enhance>
					<button type="submit" class="btn-sekundaer">Alle als gelesen</button>
				</form>
			{/if}
		</div>

		{#if data.benachrichtigungen.length === 0}
			<div class="leer">
				<BellOff size={32} />
				<p>Noch keine Benachrichtigungen.</p>
			</div>
		{:else}
			<ul class="liste">
				{#each data.benachrichtigungen as eintrag (eintrag.id)}
					{@const ungelesen = eintrag.gelesenAm === null}
					<li class="eintrag" class:ungelesen>
						<Card>
							<!-- Ohne JS: normaler POST, der Server leitet auf den Link weiter. -->
							<form method="POST" action="?/oeffnen" use:enhance>
								<input type="hidden" name="id" value={eintrag.id} />
								<button type="submit" class="eintrag-btn">
									<span class="eintrag-kopf">
										<span class="titel">{eintrag.titel}</span>
										<time class="zeit" datetime={new Date(eintrag.erstelltAm).toISOString()}>
											{relativeZeit(eintrag.erstelltAm)}
										</time>
									</span>
									<span class="text">{eintrag.text}</span>
									{#if ungelesen}
										<span class="sr-only">(ungelesen)</span>
									{/if}
								</button>
							</form>
						</Card>
					</li>
				{/each}
			</ul>
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

	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.kopf form {
		margin: 0;
	}

	h1 {
		margin: 0;
		font-size: 22px;
		font-weight: 700;
	}

	.leer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 48px 0;
		color: var(--color-text-muted);
	}

	.leer p {
		margin: 0;
		font-size: 14px;
	}

	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	/* Linke Akzentlinie für ungelesene Einträge, über die Card gelegt */
	.eintrag {
		position: relative;
	}

	.eintrag.ungelesen::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 4px;
		border-radius: var(--radius-lg) 0 0 var(--radius-lg);
		background: var(--color-accent);
		pointer-events: none;
	}

	.eintrag form {
		margin: 0;
	}

	/* Ganze Card klickbar: Button gleicht das Card-Padding (16px) aus */
	.eintrag-btn {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: calc(100% + 32px);
		margin: -16px;
		padding: 16px;
		background: none;
		border: none;
		border-radius: var(--radius-lg);
		color: var(--color-text-muted);
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}

	.eintrag-btn:hover .titel {
		text-decoration: underline;
	}

	.eintrag-kopf {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}

	.titel {
		font-size: 15px;
		font-weight: 500;
	}

	.zeit {
		flex-shrink: 0;
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.text {
		font-size: 13px;
		line-height: 1.4;
	}

	.ungelesen .eintrag-btn {
		color: var(--color-text);
	}

	.ungelesen .titel {
		font-weight: 700;
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

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
