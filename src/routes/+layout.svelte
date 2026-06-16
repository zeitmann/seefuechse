<script>
	import '../app.css';
	import NavBar from '$lib/components/NavBar.svelte';

	let { children } = $props();
</script>

<div class="container">
	{@render children()}
	<NavBar />
</div>
