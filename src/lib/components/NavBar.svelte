<script lang="ts">
	import { page } from '$app/state';
	import { Home, Calendar, Ticket, Inbox, Shield } from '@lucide/svelte';

	let {
		hasDauerkarte = false,
		kannVerwalten = false
	}: { hasDauerkarte?: boolean; kannVerwalten?: boolean } = $props();

	// Navigation items – "Anfragen" immer sichtbar, "Dauerkarte" zusätzlich bei Besitz,
	// "Verwaltung" nur mit Verwaltungsrolle
	const navItems = $derived([
		{ label: 'Start', path: '/', icon: Home },
		{ label: 'Spielplan', path: '/spielplan', icon: Calendar },
		{ label: 'Anfragen', path: '/anfragen', icon: Inbox },
		...(hasDauerkarte ? [{ label: 'Dauerkarte', path: '/karte', icon: Ticket }] : []),
		...(kannVerwalten ? [{ label: 'Verwaltung', path: '/verwaltung', icon: Shield }] : [])
	]);

	// Check if a path is active
	function isActive(path: string): boolean {
		return page.url.pathname === path;
	}
</script>

<nav class="navbar">
	<div class="navbar-content" class:compact={navItems.length >= 5}>
		{#each navItems as item}
			<a href={item.path} class="nav-item" class:active={isActive(item.path)}>
				<svelte:component this={item.icon} size={24} />
				<span class="nav-label">{item.label}</span>
			</a>
		{/each}
	</div>
</nav>

<style>
	.navbar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--color-surface);
		border-top: 1px solid var(--color-border);
		z-index: 10;
		padding-bottom: env(safe-area-inset-bottom);
	}

	.navbar-content {
		max-width: var(--container-max);
		margin: 0 auto;
		padding: 0 16px;
		height: 70px;
		display: flex;
		justify-content: space-around;
		align-items: center;
	}

	.nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		color: var(--color-text-muted);
		text-decoration: none;
		transition: color 0.2s;
		flex: 1;
	}

	.nav-item:hover {
		color: var(--color-text);
	}

	.nav-item.active {
		color: var(--color-accent);
	}

	.nav-label {
		font-size: 11px;
		font-weight: 600;
		white-space: nowrap;
	}

	@media (max-width: 375px) {
		.navbar-content {
			padding: 0 12px;
		}

		.nav-item {
			gap: 2px;
		}

		.nav-label {
			font-size: 10px;
		}

		/* Bis zu 5 Tabs gleichzeitig – Labels etwas schmaler, damit sie
		   auf einem 375px-Viewport nicht kollidieren */
		.navbar-content.compact {
			padding: 0 8px;
		}

		.navbar-content.compact .nav-label {
			font-size: 9px;
			letter-spacing: -0.2px;
		}
	}
</style>
