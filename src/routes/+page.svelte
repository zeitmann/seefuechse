<script>
	import Header from '$lib/components/Header.svelte';
	import Card from '$lib/components/Card.svelte';
	import MatchCard from '$lib/components/MatchCard.svelte';

	let { data } = $props();

	function getInitials(name) {
		return name
			.split(' ')
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('');
	}

	const freigabenMitBewerbungen = $derived(
		data.meineOffenenFreigaben.filter((f) => f.bewerbungen.length > 0)
	);
</script>

<div class="page-container">
	<Header />

	<main class="main-content">
		<!-- Begrüßung mit Avatar -->
		<section class="greeting-section">
			<div class="greeting-header">
				<div class="avatar" aria-label={data.mitgliedName}>
					{getInitials(data.mitgliedName)}
				</div>
				<div class="greeting-text">
					<h2>Servus, {data.mitgliedName}</h2>
					{#if data.isCardOwner && data.meineDauerkarte}
						<p class="card-info">
							📇 {data.meineDauerkarte.bezeichnung} • {data.meineDauerkarte.block}, {data.meineDauerkarte.reihe}
						</p>
					{/if}
				</div>
			</div>
		</section>

		<!-- Bewerbungen für deine Karte (nur für DK-Besitzer) -->
		{#if data.isCardOwner && freigabenMitBewerbungen.length > 0}
			<section class="applications-section">
				<Card>
					<div class="applications-card">
						<h3>Bewerbungen für deine Karte</h3>

						{#each freigabenMitBewerbungen as freigabe}
							<div class="application-item">
								<div class="application-info">
									<p class="opponent">{freigabe.spiel.gegner} • {new Date(freigabe.spiel.datum).toLocaleDateString('de-DE')}</p>
									<div class="applicant-avatars">
										{#each freigabe.bewerbungen.slice(0, 3) as bewerbung}
											<div class="mini-avatar" title={bewerbung.mitglied.name}>
												{getInitials(bewerbung.mitglied.name)}
											</div>
										{/each}
										{#if freigabe.bewerbungen.length > 3}
											<div class="mini-avatar extra">+{freigabe.bewerbungen.length - 3}</div>
										{/if}
									</div>
								</div>
								<div class="application-badge">{freigabe.bewerbungen.length} Bewerbung{freigabe.bewerbungen.length !== 1 ? 'en' : ''}</div>
								<button class="decide-btn">Entscheiden →</button>
							</div>
						{/each}
					</div>
				</Card>
			</section>
		{/if}

		<!-- Nächste Spiele -->
		<section class="matches-section">
			<div class="section-header">
				<h3>Nächste Spiele</h3>
				<a href="/spielplan" class="link-playbook">Spielplan &gt;</a>
			</div>

			<div class="matches-list">
				{#each data.naechsteSpiele as spiel}
					<MatchCard
						datum={spiel.datum}
						heimAuswaerts={spiel.heimAuswaerts}
						wettbewerb={spiel.wettbewerb}
						gegner={spiel.gegner}
						statusBadge={spiel.freeCount > 0 ? `${spiel.freeCount} frei` : undefined}
					/>
				{/each}
			</div>
		</section>

		<!-- Aktuell freie Karten -->
		{#if data.alleFreienKarten.length > 0}
			<section class="free-cards-section">
				<h3>Aktuell freie Karten</h3>
				<div class="free-cards-list">
					{#each data.alleFreienKarten as item}
						<Card>
							<div class="free-card-content">
								<div class="card-owner-info">
									<p class="owner-name">{item.besitzerName}</p>
									<p class="card-match">vs {item.spielGegner} • {new Date(item.spielDatum).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })}</p>
								</div>
								<div class="card-status">
									{#if item.applicationCount > 0}
										<span class="status-badge warning">Bewerbung{item.applicationCount !== 1 ? 'en' : ''} offen</span>
									{:else}
										<span class="status-badge success">Frei</span>
									{/if}
								</div>
							</div>
						</Card>
					{/each}
				</div>
			</section>
		{/if}
	</main>
</div>

<style>
	.page-container {
		min-height: 100vh;
		background: var(--color-bg);
		color: var(--color-text);
	}

	/* MAIN */
	.main-content {
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: 20px 16px 100px;
		max-width: var(--container-max);
		margin: 0 auto;
	}

	/* GREETING */
	.greeting-section {
		padding-bottom: 12px;
		border-bottom: 1px solid var(--color-border);
	}

	.greeting-header {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.avatar {
		width: 56px;
		height: 56px;
		border-radius: var(--radius-full);
		background: linear-gradient(135deg, #e8453c, #f5a623);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 20px;
		font-weight: 600;
		color: #fff;
		flex-shrink: 0;
	}

	.greeting-text h2 {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
	}

	.card-info {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
	}

	/* APPLICATIONS */
	.applications-section {
		margin-top: 12px;
	}

	.applications-card h3 {
		margin: 0 0 16px;
		font-size: 16px;
		font-weight: 600;
	}

	.application-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--color-border);
	}

	.application-item:first-of-type {
		padding-top: 0;
		border-top: none;
	}

	.application-info {
		flex: 1;
	}

	.opponent {
		margin: 0;
		font-size: 14px;
		font-weight: 500;
	}

	.applicant-avatars {
		display: flex;
		gap: 6px;
		margin-top: 8px;
		align-items: center;
	}

	.mini-avatar {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-full);
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.mini-avatar.extra {
		background: transparent;
	}

	.application-badge {
		font-size: 12px;
		font-weight: 600;
		color: var(--badge-status-bg);
		white-space: nowrap;
		text-align: center;
	}

	.decide-btn {
		background: none;
		border: none;
		color: var(--color-text);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		padding: 6px 0;
		white-space: nowrap;
		transition: color 0.2s;
	}

	.decide-btn:hover {
		color: var(--color-accent);
	}

	/* MATCHES */
	.matches-section {
		margin-top: 12px;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.section-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}

	.link-playbook {
		color: var(--color-accent);
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
		transition: opacity 0.2s;
	}

	.link-playbook:hover {
		opacity: 0.8;
	}

	.matches-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	/* FREE CARDS */
	.free-cards-section {
		margin-top: 12px;
	}

	.free-cards-section h3 {
		margin: 0 0 12px;
		font-size: 16px;
		font-weight: 600;
	}

	.free-cards-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.free-card-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}

	.card-owner-info {
		flex: 1;
	}

	.owner-name {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	.card-match {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
	}

	.card-status {
		text-align: right;
	}

	.status-badge {
		display: inline-block;
		padding: 4px 10px;
		border-radius: 6px;
		font-size: 11px;
		font-weight: 600;
		white-space: nowrap;
	}

	.status-badge.warning {
		background-color: var(--badge-wettbewerb-bg);
		color: var(--badge-wettbewerb-text);
	}

	.status-badge.success {
		background-color: var(--badge-status-bg);
		color: var(--badge-status-text);
	}

	/* RESPONSIVE */
	@media (max-width: 375px) {
		.main-content {
			padding: 16px 12px 100px;
			gap: 16px;
		}

		.greeting-header {
			gap: 10px;
		}

		.avatar {
			width: 48px;
			height: 48px;
			font-size: 18px;
		}

		.greeting-text h2 {
			font-size: 18px;
		}
	}
</style>
