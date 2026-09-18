/*
 * 최소 서비스워커.
 * 목적: (1) "홈 화면에 추가" 가 가능한 PWA 조건 충족, (2) reg.showNotification 으로 알림 표시.
 * 오프라인 캐시는 일부러 넣지 않았습니다 — 대기 현황은 오래된 값을 보여주면 오히려 해롭기 때문입니다.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow("/laundry"));
});
