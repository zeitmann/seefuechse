<script lang="ts">
	import { Bell, LogOut, Menu } from '@lucide/svelte';
</script>

<header class="header">
	<div class="header-left">
		<span class="logo">🦊</span>
		<h1>Seefüchse</h1>
	</div>
	<div class="header-right">
		<button class="icon-btn" aria-label="Benachrichtigungen">
			<Bell size={20} />
		</button>
		<button class="icon-btn" aria-label="Menü">
			<Menu size={20} />
		</button>
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
</style>
