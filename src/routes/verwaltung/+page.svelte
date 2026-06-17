<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '$lib/components/Card.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="page-container">
	<header class="page-header">
		<h1>Verwaltung</h1>
	</header>

	<main class="main-content">
		<!-- Ausstehende Freischaltungen (nur für Admin/Vorstand) -->
		{#if data.kannVerwalten}
			<section class="section">
				<div class="section-header">
					<h2>Ausstehende Freischaltungen</h2>
					{#if data.ausstehendeMitglieder.length > 0}
						<span class="badge">{data.ausstehendeMitglieder.length}</span>
					{/if}
				</div>

				{#if data.ausstehendeMitglieder.length === 0}
					<p class="empty-state">Keine ausstehenden Freischaltungen</p>
				{:else}
					<Card>
						<ul class="member-list">
							{#each data.ausstehendeMitglieder as mitglied (mitglied.id)}
								<li class="member-item">
									<div class="member-info">
										<span class="member-name">{mitglied.name}</span>
										<span class="member-email">{mitglied.email}</span>
									</div>
									<div class="member-actions">
										<form method="POST" action="?/freischalten" use:enhance>
											<input type="hidden" name="mitgliedId" value={mitglied.id} />
											<button type="submit" class="btn-aktivieren">Aktivieren</button>
										</form>
										<form
											method="POST"
											action="?/ablehnen"
											use:enhance={({ cancel }) => {
												if (!confirm(`${mitglied.name} wirklich ablehnen?`)) cancel();
											}}
										>
											<input type="hidden" name="mitgliedId" value={mitglied.id} />
											<button type="submit" class="btn-ablehnen">Ablehnen</button>
										</form>
									</div>
								</li>
							{/each}
						</ul>
					</Card>
				{/if}
			</section>
		{/if}

		<!-- Dauerkarten-Zuordnung (folgt im nächsten Schritt) -->
		<section class="section">
			<div class="section-header">
				<h2>Dauerkarten-Zuordnung</h2>
			</div>
			<p class="placeholder-text">Folgt im nächsten Schritt.</p>
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

	.empty-state {
		margin: 0;
		font-size: 14px;
		color: var(--color-text-muted);
		padding: 16px 0;
	}

	.member-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.member-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 0;
		border-bottom: 1px solid var(--color-border);
	}

	.member-item:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.member-item:first-child {
		padding-top: 0;
	}

	.member-info {
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

	.member-actions {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
	}

	.member-actions form {
		margin: 0;
	}

	.btn-aktivieren {
		padding: 6px 14px;
		border-radius: var(--radius-md);
		border: none;
		background: var(--color-success);
		color: #000;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		transition: opacity 0.15s;
	}

	.btn-aktivieren:hover {
		opacity: 0.85;
	}

	.btn-ablehnen {
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

	.btn-ablehnen:hover {
		border-color: var(--color-text-muted);
		color: var(--color-text);
	}

	.placeholder-text {
		margin: 0;
		font-size: 14px;
		color: var(--color-text-muted);
	}
</style>
