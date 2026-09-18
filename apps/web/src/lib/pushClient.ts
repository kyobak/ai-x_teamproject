/**
 * 브라우저 쪽 Web Push 구독.
 * 흐름: 알림 권한 → 서비스워커 준비 → 서버 공개키(VAPID) → PushManager.subscribe → 구독 정보를 서버에 저장.
 * 실패해도 앱은 동작해야 하므로(HTTP 로 열면 iOS/Chrome 이 막음) 예외는 삼키고 false 를 돌려줍니다.
 */
import { apiBase } from "./api";

function b64ToUint8(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function subscribePush(deviceId: string): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    if (Notification.permission !== "granted") return false;
    const reg = await navigator.serviceWorker.ready;
    const { public_key } = await fetch(`${apiBase()}/api/push/public-key`).then((r) => r.json());
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(public_key) as BufferSource });
    await fetch(`${apiBase()}/api/push/subscribe`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId, subscription: sub.toJSON() }),
    });
    return true;
  } catch {
    return false;
  }
}
