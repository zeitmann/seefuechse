<script lang="ts">
	import '../app.css';
	import NavBar from '$lib/components/NavBar.svelte';
	import { page } from '$app/state';

	let { children, data } = $props();

	const AUTH_ROUTES = ['/login', '/registrieren', '/warten'];
	const showNav = $derived(
		data.mitgliedStatus === 'aktiv' && !AUTH_ROUTES.includes(page.url.pathname)
	);
</script>

<div class="container">
	{@render children()}
	{#if showNav}
		<NavBar />
	{/if}
</div>
