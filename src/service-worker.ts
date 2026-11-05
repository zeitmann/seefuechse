/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

declare let self: ServiceWorkerGlobalScope;

// Bewusst KEIN fetch-Handler und KEIN Caching: Die App braucht immer frische
// Server-Daten, Offline-Betrieb ist nicht gewünscht.

self.addEventListener('install', () => {
	// Neue Version sofort aktivieren, ohne auf das Schließen alter Tabs zu warten
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	// Bereits offene Seiten sofort unter Kontrolle nehmen
	event.waitUntil(self.clients.claim());
});

// TODO Web Push (nächster Schritt): Push-Nachricht anzeigen und beim Antippen
// die passende Seite öffnen bzw. fokussieren.
//
// self.addEventListener('push', (event) => {
// 	const daten = event.data?.json() ?? {};
// 	event.waitUntil(
// 		self.registration.showNotification(daten.titel ?? 'Seefüchse', {
// 			body: daten.text,
// 			icon: '/icons/icon-192.png',
// 			data: { url: daten.url ?? '/' }
// 		})
// 	);
// });
//
// self.addEventListener('notificationclick', (event) => {
// 	event.notification.close();
// 	const url = event.notification.data?.url ?? '/';
// 	event.waitUntil(self.clients.openWindow(url));
// });
