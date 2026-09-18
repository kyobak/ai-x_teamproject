"use client";
import { useEffect, useSyncExternalStore } from "react";
import { requestNotificationPermission, useRealtime } from "@/lib/realtime";
import { subscribePush } from "@/lib/pushClient";
import { useT } from "@/lib/i18n";

/**
 * PWA 준비: 서비스워커 등록 + 알림 권한 버튼 + (허용되면) Web Push 구독.
 * Notification.permission 은 브라우저 전역 값이라 useSyncExternalStore 로 "외부 값" 으로 읽습니다.
 */
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const getSnapshot = () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);
const emit = () => listeners.forEach((l) => l());

export function PwaSetup() {
  const t = useT();
  const { deviceId } = useRealtime();
  const perm = useSyncExternalStore(subscribe, getSnapshot, () => "default");
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  // 이미 허용된 기기는 조용히 푸시 구독을 갱신 (구독은 여러 번 해도 같은 endpoint 라 안전)
  useEffect(() => { if (perm === "granted" && deviceId) subscribePush(deviceId); }, [perm, deviceId]);
  if (perm === "granted" || perm === "unsupported") return null;
  return (
    <button onClick={async () => { await requestNotificationPermission(); emit(); if (Notification.permission === "granted") subscribePush(deviceId); }}
      className="pill w-full border border-dashed border-primary/40 bg-surface-soft px-4 py-2.5 text-xs text-primary">
      {t("notif.ask")} {perm === "denied" ? t("notif.denied") : ""}
    </button>
  );
}
