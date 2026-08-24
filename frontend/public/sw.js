// Push-only service worker - deliberately no install/activate/fetch caching
// behavior. A finance app must never serve a stale cached API response, so
// this worker exists solely to receive push events while the tab is closed.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "FinanceMgr", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "FinanceMgr";
  const options = {
    body: data.body || "",
    icon: "/financemgr/icons/icon-192.png",
    badge: "/financemgr/icons/icon-192.png",
    data: { url: data.url || "/financemgr/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/financemgr/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
