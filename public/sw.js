self.addEventListener("push", (event) => {
  let data = { title: "Nodegent", body: "You have upcoming deadlines.", url: "/dashboard" };
  try {
    data = event.data.json();
  } catch {
    // malformed payload — use defaults
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes("/dashboard") && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          const rawUrl = event.notification.data?.url;
          const safeUrl = (typeof rawUrl === "string" && rawUrl.startsWith("/"))
            ? rawUrl
            : "/dashboard";
          return clients.openWindow(safeUrl);
        }
      })
  );
});
