<script>
	let { children } = $props();
</script>

<div class="card">
	{@render children()}
</div>

<style>
	.card {
		background: var(--color-surface-raised);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: 16px;
	}
</style>
