import { invalidateAll } from '$app/navigation';
import type { SubmitFunction } from '@sveltejs/kit';

/**
 * Gemeinsame SubmitFunction für use:enhance: wendet das Ergebnis wie üblich an
 * und lädt bei einem Fehler (fail) zusätzlich die Seitendaten neu, damit z. B.
 * ein nicht mehr gültiger Vergeben-Button verschwindet.
 */
export const mitNeuladenBeiFehler: SubmitFunction = () => {
	return async ({ result, update }) => {
		await update();
		if (result.type === 'failure') await invalidateAll();
	};
};
