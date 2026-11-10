<script lang="ts">
	import { Bell, LogOut } from '@lucide/svelte';
	import { page } from '$app/state';

	// Zähler aus +layout.server.ts – ohne Props, damit die Seiten unverändert bleiben.
	const ungelesen = $derived<number>(page.data.ungelesen ?? 0);
	const badgeText = $derived(ungelesen > 9 ? '9+' : String(ungelesen));
	const glockeLabel = $derived(
		ungelesen > 0 ? `Benachrichtigungen, ${ungelesen} ungelesen` : 'Benachrichtigungen'
	);
</script>

<header class="header">
	<div class="header-left">
		<span class="logo">🦊</span>
		<h1>Seefüchse</h1>
	</div>
	<div class="header-right">
		<a href="/benachrichtigungen" class="icon-btn glocke" aria-label={glockeLabel}>
			<Bell size={20} />
			{#if ungelesen > 0}
				<span class="badge" aria-hidden="true">{badgeText}</span>
			{/if}
		</a>
		<form method="POST" action="/logout" style="display:contents">
			<button type="submit" class="icon-btn" aria-label="Abmelden">
				<LogOut size={20} />
			</button>
		</form>
	</div>
</header>

<style>
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.logo {
		font-size: 24px;
	}

	.header h1 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
	}

	.header-right {
		display: flex;
		gap: 12px;
	}

	.icon-btn {
		background: none;
		border: none;
		color: var(--color-text);
		cursor: pointer;
		padding: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-md);
		transition: background-color 0.2s;
	}

	.icon-btn:hover {
		background-color: var(--color-surface-raised);
	}

	.glocke {
		position: relative;
		text-decoration: none;
	}

	.badge {
		position: absolute;
		top: 0;
		right: 0;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: var(--radius-full);
		background: var(--color-accent);
		color: var(--color-text);
		font-size: 10px;
		font-weight: 700;
		line-height: 16px;
		text-align: center;
		box-shadow: 0 0 0 2px var(--color-surface);
	}
</style>
