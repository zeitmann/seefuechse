<script lang="ts">
	let { nachricht }: { nachricht?: string | null } = $props();
</script>

{#if nachricht}
	<p class="fehler-hinweis" role="alert">{nachricht}</p>
{/if}

<style>
	.fehler-hinweis {
		background: color-mix(in srgb, var(--color-accent) 12%, transparent);
		border: 1px solid var(--color-accent);
		border-radius: var(--radius-md);
		color: var(--color-accent);
		font-size: 14px;
		padding: 10px 14px;
		margin: 0 0 16px;
	}
</style>
