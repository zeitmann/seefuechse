<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import MatchCard from '$lib/components/MatchCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Tab = 'kommend' | 'vergangen';
	type Filter = 'alle' | 'liga' | 'pokal' | 'europa';

	let aktiveTab: Tab = $state('kommend');
	let aktiveFilter: Filter = $state('alle');

	const wettbewerbMap: Record<Exclude<Filter, 'alle'>, string> = {
		liga: 'Bundesliga',
		pokal: 'DFB-Pokal',
		europa: 'Europa League'
	};

	const gefilterteSpiele = $derived.by(() => {
		const heute = new Date().toISOString().slice(0, 10);

		const nachTab =
			aktiveTab === 'kommend'
				? data.spiele.filter((s) => s.datum >= heute)
				: [...data.spiele].filter((s) => s.datum < heute).reverse();

		if (aktiveFilter === 'alle') return nachTab;
		return nachTab.filter((s) => s.wettbewerb === wettbewerbMap[aktiveFilter]);
	});
</script>

<div class="page-container">
	<Header />

	<main class="main-content">
		<div class="page-title">
			<h2>Spielplan</h2>
			<p class="subtitle">Saison 2025/26</p>
		</div>

		<!-- Tab-Umschalter -->
		<div class="tab-bar">
			<button
				class="tab-btn"
				class:active={aktiveTab === 'kommend'}
				onclick={() => (aktiveTab = 'kommend')}
			>
				Kommende
			</button>
			<button
				class="tab-btn"
				class:active={aktiveTab === 'vergangen'}
				onclick={() => (aktiveTab = 'vergangen')}
			>
				Vergangene
			</button>
		</div>

		<!-- Filter-Leiste -->
		<div class="filter-bar">
			{#each [['alle', 'Alle'], ['liga', 'Liga'], ['pokal', 'Pokal'], ['europa', 'Europa']] as [key, label] (key)}
				<button
					class="filter-btn"
					class:active={aktiveFilter === key}
					onclick={() => (aktiveFilter = key as Filter)}
				>
					{label}
				</button>
			{/each}
		</div>

		<!-- Spiele-Liste -->
		<div class="spiele-liste">
			{#if gefilterteSpiele.length === 0}
				<p class="empty-state">Keine Spiele in dieser Kategorie.</p>
			{:else}
				{#each gefilterteSpiele as spiel (spiel.id)}
					<a href="/spielplan/{spiel.id}" style="display:contents">
						<MatchCard
							datum={spiel.datum}
							heimAuswaerts={spiel.heimAuswaerts}
							wettbewerb={spiel.wettbewerb}
							gegner={spiel.gegner}
							statusBadge={spiel.freeCount > 0 ? `${spiel.freeCount} frei` : undefined}
						/>
					</a>
				{/each}
			{/if}
		</div>
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
		gap: 16px;
		padding: 20px 16px 100px;
		max-width: var(--container-max);
		margin: 0 auto;
	}

	.page-title h2 {
		margin: 0;
		font-size: 22px;
		font-weight: 700;
	}

	.subtitle {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--color-text-muted);
	}

	/* TABS */
	.tab-bar {
		display: flex;
		gap: 4px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 4px;
	}

	.tab-btn {
		flex: 1;
		padding: 8px 12px;
		border: none;
		border-radius: calc(var(--radius-md) - 4px);
		background: transparent;
		color: var(--color-text-muted);
		font-size: 14px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s;
	}

	.tab-btn.active {
		background: var(--color-surface-raised);
		color: var(--color-text);
	}

	/* FILTER */
	.filter-bar {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding-bottom: 2px;
	}

	.filter-bar::-webkit-scrollbar {
		display: none;
	}

	.filter-btn {
		padding: 6px 14px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--color-text-muted);
		font-size: 13px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		white-space: nowrap;
		transition:
			border-color 0.15s,
			color 0.15s,
			background 0.15s;
	}

	.filter-btn.active {
		border-color: var(--color-accent);
		color: var(--color-accent);
		background: var(--color-accent-muted);
	}

	/* SPIELE */
	.spiele-liste {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.empty-state {
		margin: 20px 0 0;
		font-size: 14px;
		color: var(--color-text-muted);
		text-align: center;
	}
</style>
