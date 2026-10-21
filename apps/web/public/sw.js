// Minimal service worker: no offline caching, ready for web push.
// Push payload (JSON): { title, body, url? }. Clicking opens `url` or /actions.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Penny";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "You have new action items.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/actions" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/actions", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client && "navigate" in client) {
          return client.navigate(url).then((c) => (c || client).focus());
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
