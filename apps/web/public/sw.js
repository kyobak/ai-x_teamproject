/*
 * 서비스워커.
 * 목적: (1) "홈 화면에 추가" 가 가능한 PWA 조건 충족, (2) 알림 표시, (3) Web Push 수신.
 * 오프라인 캐시는 일부러 넣지 않았습니다 — 대기 현황은 오래된 값을 보여주면 오히려 해롭기 때문입니다.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// 서버(server/app/push.py)가 보낸 푸시. payload = {title, body, url}
self.addEventListener("push", (e) => {
  let data = { title: "ERICA 대기", body: "", url: "/laundry" };
  try { data = { ...data, ...e.data.json() }; } catch { /* 본문 없는 푸시 */ }
  e.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/icons/icon-192.png", data: { url: data.url } }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/laundry";
  e.waitUntil(self.clients.openWindow(url));
});
