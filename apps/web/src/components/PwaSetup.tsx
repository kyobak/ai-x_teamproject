"use client";
import { useEffect, useSyncExternalStore } from "react";
import { requestNotificationPermission } from "@/lib/realtime";

/**
 * PWA 준비: 서비스워커 등록 + 알림 권한 버튼.
 * 서비스워커(public/sw.js)는 오프라인 캐시보다 "홈 화면에 추가" 와 알림 표시를 위해 필요합니다.
 *
 * Notification.permission 은 브라우저 전역 값이라 React 상태가 아닙니다. useSyncExternalStore 로 "외부 값" 으로 읽고,
 * 권한을 요청한 뒤에는 emit() 으로 다시 읽게 합니다. (서버 렌더링 시엔 "default" 로 취급)
 */
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const getSnapshot = () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);
const emit = () => listeners.forEach((l) => l());

export function PwaSetup() {
  const perm = useSyncExternalStore(subscribe, getSnapshot, () => "default");
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  if (perm === "granted" || perm === "unsupported") return null;
  return (
    <button onClick={async () => { await requestNotificationPermission(); emit(); }}
      className="w-full rounded-xl border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-800">
      🔔 내 차례 알림을 받으려면 알림을 허용하세요 {perm === "denied" ? "(브라우저 설정에서 차단됨 · 화면 배너로 대체)" : ""}
    </button>
  );
}
