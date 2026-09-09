<script lang="ts">
	import MitgliedKarte from './MitgliedKarte.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Nur eine Karte gleichzeitig aufgeklappt; null = alle zu.
	let offeneId = $state<string | null>(null);

	function toggle(id: string) {
		offeneId = offeneId === id ? null : id;
	}
</script>

<div class="page-container">
	<header class="page-header">
		<h1>Rollen verwalten</h1>
	</header>

	<main class="main-content">
		<section class="section">
			<div class="section-header">
				<h2>Mitglieder</h2>
				<span class="badge">{data.mitgliederListe.length}</span>
			</div>

			{#if data.mitgliederListe.length === 0}
				<p class="empty-state">Keine Mitglieder vorhanden</p>
			{:else}
				<div class="member-cards">
					{#each data.mitgliederListe as mitglied (mitglied.id)}
						<MitgliedKarte
							{mitglied}
							alleRollen={data.alleRollen}
							{form}
							offen={offeneId === mitglied.id}
							ontoggle={() => toggle(mitglied.id)}
						/>
					{/each}
				</div>
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

	.member-cards {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
</style>
