// Kein serverseitiger Auth-Guard nötig: Die Passwort-Änderung läuft vollständig
// clientseitig über die kurzlebige Recovery-Session, die der Supabase-Browser-Client
// aus dem URL-Fragment (#access_token=…&type=recovery) aufbaut. Dieses Fragment
// erreicht den Server ohnehin nie. Die Route ist zusätzlich in hooks.server.ts als
// PUBLIC_ROUTE eingetragen, damit sie auch ohne reguläre Session erreichbar ist.
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return {};
};
