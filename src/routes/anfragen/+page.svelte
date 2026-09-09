<script lang="ts">
	import Header from '$lib/components/Header.svelte';
</script>

<div class="page-container">
	<Header />

	<main class="main-content">
		<h1>Meine Anfragen</h1>
		<p>
			Übersicht offener Bewerbungen für Mitglieder ohne eigene Dauerkarte folgt im nächsten
			Schritt.
		</p>
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
		gap: 12px;
		padding: 20px 16px 100px;
		max-width: var(--container-max);
		margin: 0 auto;
	}

	h1 {
		margin: 0;
		font-size: 22px;
		font-weight: 700;
	}

	p {
		margin: 0;
		font-size: 14px;
		color: var(--color-text-muted);
	}
</style>
