<script>
	import { Bell, LogOut, Menu } from '@lucide/svelte';
	import Card from '$lib/components/Card.svelte';
	import MatchCard from '$lib/components/MatchCard.svelte';

	// ============================================================================
	// MOCK-DATEN (später durch echte DB-Queries ersetzen)
	// ============================================================================

	// Aktuell angemeldete Person (später aus Auth)
	const currentUser = {
		id: '550e8400-e29b-41d4-a716-446655440000',
		name: 'Holger',
		email: 'holger@seefuechse.de'
	};

	// Dauerkarte des aktuellen Benutzers (nur falls er DK-Besitzer ist)
	const currentUserDauerkarte = {
		id: '660e8400-e29b-41d4-a716-446655440000',
		besitzerId: currentUser.id,
		bezeichnung: 'DK 1',
		block: 'Block 5',
		reihe: 'Reihe 12',
		platz: '001'
	};

	// Spiele
	const allSpiele = [
		{
			id: '770e8400-e29b-41d4-a716-446655440000',
			datum: '2025-02-28',
			gegner: 'Borussia Dortmund',
			wettbewerb: 'Bundesliga',
			heimAuswaerts: 'heim',
			openligadbId: 'abc123'
		},
		{
			id: '880e8400-e29b-41d4-a716-446655440001',
			datum: '2025-03-04',
			gegner: 'FC St. Pauli',
			wettbewerb: 'DFB-Pokal',
			heimAuswaerts: 'heim',
			openligadbId: 'def456'
		},
		{
			id: '990e8400-e29b-41d4-a716-446655440002',
			datum: '2025-03-07',
			gegner: 'FC Augsburg',
			wettbewerb: 'Bundesliga',
			heimAuswaerts: 'auswaerts',
			openligadbId: 'ghi789'
		}
	];

	// Freigaben (offene und vergebene)
	const allFreigaben = [
		{
			id: '111e8400-e29b-41d4-a716-446655440000',
			dauerkarteId: currentUserDauerkarte.id,
			spielId: allSpiele[0].id, // Borussia Dortmund
			status: 'offen',
			vergebenAn: null
		},
		{
			id: '222e8400-e29b-41d4-a716-446655440001',
			dauerkarteId: '661e8400-e29b-41d4-a716-446655440001', // Andere DK
			spielId: allSpiele[1].id, // FC St. Pauli
			status: 'offen',
			vergebenAn: null
		},
		{
			id: '333e8400-e29b-41d4-a716-446655440002',
			dauerkarteId: '662e8400-e29b-41d4-a716-446655440002', // Andere DK
			spielId: allSpiele[2].id, // FC Augsburg
			status: 'offen',
			vergebenAn: null
		}
	];

	// Mitglieder (für Bewerbungen und Freigaben)
	const allMitglieder = [
		{ id: currentUser.id, name: 'Holger', email: 'holger@seefuechse.de' },
		{ id: '661e8400-e29b-41d4-a716-446655440001', name: 'Tim', email: 'tim@seefuechse.de' },
		{ id: '662e8400-e29b-41d4-a716-446655440002', name: 'Sandra', email: 'sandra@seefuechse.de' },
		{ id: '663e8400-e29b-41d4-a716-446655440003', name: 'Klaus', email: 'klaus@seefuechse.de' }
	];

	// Bewerbungen (nur für Spiele, bei denen der aktuelle Benutzer DK-Besitzer ist)
	const allBewerbungen = [
		{
			id: '444e8400-e29b-41d4-a716-446655440000',
			freigabeId: allFreigaben[0].id, // Auf Holgers Borussia-Dortmund-Karte
			mitgliedId: allMitglieder[1].id, // Tim
			status: 'angefragt',
			erstelltAm: '2025-02-20T10:30:00Z'
		},
		{
			id: '555e8400-e29b-41d4-a716-446655440001',
			freigabeId: allFreigaben[0].id,
			mitgliedId: allMitglieder[2].id, // Sandra
			status: 'angefragt',
			erstelltAm: '2025-02-20T11:15:00Z'
		},
		{
			id: '666e8400-e29b-41d4-a716-446655440002',
			freigabeId: allFreigaben[0].id,
			mitgliedId: allMitglieder[3].id, // Klaus
			status: 'angefragt',
			erstelltAm: '2025-02-20T12:45:00Z'
		}
	];

	// Alle Dauerkarten
	const allDauerkarten = [
		currentUserDauerkarte,
		{ id: '661e8400-e29b-41d4-a716-446655440001', besitzerId: allMitglieder[1].id, bezeichnung: 'DK 2', block: 'Block 3', reihe: 'Reihe 8', platz: '005' },
		{ id: '662e8400-e29b-41d4-a716-446655440002', besitzerId: allMitglieder[2].id, bezeichnung: 'DK 3', block: 'Block 7', reihe: 'Reihe 15', platz: '020' }
	];

	// ============================================================================
	// COMPUTED VALUES
	// ============================================================================

	// Freigaben des aktuellen Benutzers
	function getMyFreigaben() {
		return allFreigaben.filter((f) => {
			const dk = allDauerkarten.find((d) => d.id === f.dauerkarteId);
			return dk && dk.besitzerId === currentUser.id;
		});
	}

	// Offene Bewerbungen für meine Freigaben
	function getMyOpenApplications() {
		const myFreigabenIds = getMyFreigaben()
			.filter((f) => f.status === 'offen')
			.map((f) => f.id);

		return allBewerbungen.filter((b) => myFreigabenIds.includes(b.freigabeId));
	}

	// Gruppierte Bewerbungen nach Freigabe-ID
	function getApplicationsByFreigabe(freigabeId) {
		return allBewerbungen.filter((b) => b.freigabeId === freigabeId);
	}

	// Nächste 3 Spiele
	function getUpcomingMatches() {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		return allSpiele
			.filter((s) => new Date(s.datum) >= today)
			.sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime())
			.slice(0, 3);
	}

	// Für jedes Spiel: wie viele freie Karten gibt es?
	function getFreeCardsCountForMatch(spielId) {
		return allFreigaben.filter((f) => f.spielId === spielId && f.status === 'offen').length;
	}

	// Alle aktuell freigegebenen Karten mit deren Besitzern
	function getAllFreeCards() {
		return allFreigaben
			.filter((f) => f.status === 'offen')
			.map((f) => {
				const dk = allDauerkarten.find((d) => d.id === f.dauerkarteId);
				const spiel = allSpiele.find((s) => s.id === f.spielId);
				const besitzer = allMitglieder.find((m) => m.id === dk.besitzerId);
				const applicationCount = getApplicationsByFreigabe(f.id).length;

				return {
					freigabe: f,
					dauerkarte: dk,
					spiel: spiel,
					besitzer: besitzer,
					applicationCount: applicationCount
				};
			});
	}

	// Avatar: Initialen aus Namen
	function getInitials(name) {
		return name
			.split(' ')
			.map((part) => part[0].toUpperCase())
			.join('');
	}

	// ============================================================================
	// UHRZEIT-FORMATIERUNG
	// ============================================================================

	function getUhrzeit(spielId) {
		// Mock: Rückgabe verschiedener Uhrzeiten
		if (spielId === allSpiele[0].id) return '15:30';
		if (spielId === allSpiele[1].id) return '20:45';
		if (spielId === allSpiele[2].id) return '15:30';
		return '15:30';
	}

	// ============================================================================
	// REACTIVE
	// ============================================================================

	const myOpenApplications = getMyOpenApplications();
	const upcomingMatches = getUpcomingMatches();
	const allFreeCards = getAllFreeCards();
	const isCardOwner = getMyFreigaben().length > 0;
</script>

<div class="page-container">
	<!-- Header -->
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

	<!-- Hauptinhalt -->
	<main class="main-content">
		<!-- Begrüßung mit Avatar -->
		<section class="greeting-section">
			<div class="greeting-header">
				<div class="avatar" aria-label={currentUser.name}>
					{getInitials(currentUser.name)}
				</div>
				<div class="greeting-text">
					<h2>Servus, {currentUser.name}</h2>
					{#if isCardOwner}
						<p class="card-info">
							📇 {currentUserDauerkarte.bezeichnung} • {currentUserDauerkarte.block}, {currentUserDauerkarte.reihe}
						</p>
					{/if}
				</div>
			</div>
		</section>

		<!-- Bewerbungen für deine Karte (nur für DK-Besitzer) -->
		{#if isCardOwner && myOpenApplications.length > 0}
			<section class="applications-section">
				<Card>
					<div class="applications-card">
						<h3>Bewerbungen für deine Karte</h3>

						{#each getMyFreigaben().filter((f) => f.status === 'offen') as freigabe}
							{@const spiel = allSpiele.find((s) => s.id === freigabe.spielId)}
							{@const apps = getApplicationsByFreigabe(freigabe.id)}
							{#if apps.length > 0}
								<div class="application-item">
									<div class="application-info">
										<p class="opponent">{spiel.gegner} • {new Date(spiel.datum).toLocaleDateString('de-DE')}</p>
										<div class="applicant-avatars">
											{#each apps.slice(0, 3) as app}
												{@const applicant = allMitglieder.find((m) => m.id === app.mitgliedId)}
												<div class="mini-avatar" title={applicant.name}>
													{getInitials(applicant.name)}
												</div>
											{/each}
											{#if apps.length > 3}
												<div class="mini-avatar extra">+{apps.length - 3}</div>
											{/if}
										</div>
									</div>
									<div class="application-badge">{apps.length} Bewerbung{apps.length !== 1 ? 'en' : ''}</div>
									<button class="decide-btn">Entscheiden →</button>
								</div>
							{/if}
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
				{#each upcomingMatches as spiel}
					{@const freeCount = getFreeCardsCountForMatch(spiel.id)}
					<MatchCard
						datum={spiel.datum}
						heimAuswaerts={spiel.heimAuswaerts}
						wettbewerb={spiel.wettbewerb}
						gegner={spiel.gegner}
						uhrzeit={getUhrzeit(spiel.id)}
						statusBadge={freeCount > 0 ? `${freeCount} frei` : undefined}
					/>
				{/each}
			</div>
		</section>

		<!-- Aktuell freie Karten -->
		{#if allFreeCards.length > 0}
			<section class="free-cards-section">
				<h3>Aktuell freie Karten</h3>
				<div class="free-cards-list">
					{#each allFreeCards as item}
						<Card>
							<div class="free-card-content">
								<div class="card-owner-info">
									<p class="owner-name">{item.besitzer.name}</p>
									<p class="card-match">vs {item.spiel.gegner} • {new Date(item.spiel.datum).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })}</p>
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

	/* HEADER */
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
