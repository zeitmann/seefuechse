<script lang="ts">
	import Card from '$lib/components/Card.svelte';
</script>

<main class="warten-page">
	<div class="warten-header">
		<h1 class="warten-title">Seefüchse</h1>
	</div>

	<Card>
		<div class="warten-inhalt">
			<div class="warten-icon" aria-hidden="true">⏳</div>
			<h2 class="warten-heading">Freischaltung ausstehend</h2>
			<p class="warten-text">
				Deine Registrierung ist eingegangen. Ein Vorstandsmitglied prüft deinen Antrag und
				schaltet dich frei – das dauert in der Regel wenige Stunden.
			</p>
			<p class="warten-text">
				Sobald dein Konto aktiviert ist, kannst du dich ganz normal anmelden.
			</p>

			<form method="POST" action="/logout">
				<button type="submit" class="btn-logout">Abmelden</button>
			</form>
		</div>
	</Card>
</main>

<style>
	.warten-page {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 24px;
		padding: 24px 0 40px;
	}

	.warten-header {
		text-align: center;
	}

	.warten-title {
		margin: 0;
		font-size: 28px;
		font-weight: 800;
		color: var(--color-accent);
	}

	.warten-inhalt {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		text-align: center;
	}

	.warten-icon {
		font-size: 40px;
	}

	.warten-heading {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
	}

	.warten-text {
		margin: 0;
		font-size: 14px;
		color: var(--color-text-muted);
		line-height: 1.6;
		max-width: 320px;
	}

	.btn-logout {
		margin-top: 8px;
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text-muted);
		font-size: 14px;
		font-weight: 600;
		padding: 10px 24px;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}

	.btn-logout:hover {
		border-color: var(--color-text-muted);
		color: var(--color-text);
	}
</style>
