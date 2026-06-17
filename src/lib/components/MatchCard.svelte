<script>
	import Card from './Card.svelte';
	import { ChevronRight, Clock } from '@lucide/svelte';

	let {
		datum,
		heimAuswaerts,
		wettbewerb,
		gegner,
		uhrzeit = undefined,
		statusBadge
	} = $props();

	// Datum parsen (erwartet: ISO-String oder Date-Objekt)
	function formatDate(dateStr) {
		const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
		const day = date.getDate().toString().padStart(2, '0');
		const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
		const month = monthNames[date.getMonth()];
		return { day, month };
	}

	const dateFormatted = $derived(formatDate(datum));
	const day = $derived(dateFormatted.day);
	const month = $derived(dateFormatted.month);
	const heimAuswaertsText = $derived(heimAuswaerts === 'heim' ? 'HEIM' : 'AUSWÄRTS');
</script>

<Card>
	<div class="match-card">
		<div class="date-section">
			<div class="date-day">{day}</div>
			<div class="date-month">{month}</div>
		</div>

		<div class="content-section">
			<div class="badges-row">
				<span class="badge badge-heim">{heimAuswaertsText}</span>
				<span class="badge badge-wettbewerb">{wettbewerb.toUpperCase()}</span>
			</div>
			<h3 class="gegner">{gegner}</h3>
			{#if uhrzeit}
				<div class="time-row">
					<Clock size={16} />
					<span>{uhrzeit} Uhr</span>
				</div>
			{/if}
		</div>

		<div class="status-section">
			{#if statusBadge}
				<span class="badge badge-status">{statusBadge}</span>
			{/if}
			<ChevronRight size={20} />
		</div>
	</div>
</Card>

<style>
	.match-card {
		display: flex;
		gap: 16px;
		align-items: center;
	}

	.date-section {
		flex-shrink: 0;
		text-align: center;
		font-family: var(--font-mono);
	}

	.date-day {
		font-size: 32px;
		font-weight: 600;
		line-height: 1;
		color: var(--color-text);
	}

	.date-month {
		font-size: 12px;
		color: var(--color-text-muted);
		margin-top: 4px;
	}

	.content-section {
		flex: 1;
	}

	.badges-row {
		display: flex;
		gap: 8px;
		margin-bottom: 8px;
	}

	.badge {
		display: inline-block;
		padding: 4px 8px;
		border-radius: 6px;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.5px;
	}

	.badge-heim {
		background-color: var(--badge-heim-bg);
		color: var(--badge-heim-text);
		border: 1px solid var(--badge-heim-bg);
	}

	.badge-wettbewerb {
		background-color: var(--badge-wettbewerb-bg);
		color: var(--badge-wettbewerb-text);
		border: 1px solid var(--badge-wettbewerb-bg);
	}

	.gegner {
		font-size: 16px;
		font-weight: 600;
		margin: 0;
		color: var(--color-text);
		margin-bottom: 8px;
	}

	.time-row {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		color: var(--color-text-muted);
	}

	.status-section {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		color: var(--color-text-muted);
	}

	.badge-status {
		background-color: var(--badge-status-bg);
		color: var(--badge-status-text);
		border: 1px solid var(--badge-status-bg);
	}
</style>
