"use client";
/**
 * 실시간 상태 공급자.
 *
 * 앱 전체에서 SSE 연결을 딱 하나만 열고(EventSource), 서버가 보내는 resource_updated 를 받아
 * 자원 목록을 갱신합니다. 페이지마다 따로 연결하면 서버 부담과 중복 알림이 생기므로 layout 에서 한 번만 감쌉니다.
 *
 * - 첫 로드: GET /api/resources 로 전체를 받음
 * - 이후: 이벤트가 올 때마다 해당 자원만 교체
 * - queue_called 이벤트가 "내 기기" 것이면 브라우저 알림 + 상단 배너 (REQ-LAU-04)
 * - 연결이 끊기면 EventSource 가 자동 재연결하고, 그 사이엔 20초마다 폴링으로 보완
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { api, apiBase, type MyTicket, type Resource } from "./api";
import { getDeviceId } from "./device";
import { setAuth, useAuth } from "./auth";

interface Ctx {
  resources: Record<string, Resource>;
  list: Resource[];
  connected: boolean;
  loading: boolean;
  error: string | null;
  myTickets: MyTicket[];
  refreshTickets: () => Promise<void>;
  deviceId: string;
}

const RealtimeContext = createContext<Ctx | null>(null);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [resources, setResources] = useState<Record<string, Resource>>({});
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myTickets, setMyTickets] = useState<MyTicket[]>([]);
  // 기기 ID 는 localStorage 에서 오므로 서버 렌더링 때는 비어 있고(""), 브라우저에서 채워집니다.
  // useSyncExternalStore 를 쓰면 이 차이를 React 가 안전하게 처리합니다(hydration 불일치 없음).
  const deviceId = useSyncExternalStore(() => () => {}, getDeviceId, () => "");

  const loadAll = useCallback(async () => {
    try {
      const list = await api.resources();
      setResources(Object.fromEntries(list.map((r) => [r.id, r])));
      setError(null);
    } catch {
      setError(`서버에 연결할 수 없습니다 (${apiBase()}). 백엔드가 켜져 있는지 확인하세요.`);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshTickets = useCallback(async () => {
    if (!deviceId) return;
    try { setMyTickets(await api.myTickets(deviceId)); } catch { /* 서버 다운 시 무시 */ }
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId) return;   // 브라우저에서 기기 ID 가 준비된 뒤에만 연결
    // 아래 두 호출은 await 뒤에서만 setState 하므로 동기 setState 가 아닙니다. 린터가 이를 구분하지 못해 규칙을 끕니다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    refreshTickets();

    const es = new EventSource(`${apiBase()}/api/stream`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener("resource_updated", (e) => {
      const r: Resource = JSON.parse((e as MessageEvent).data);
      setResources((prev) => ({ ...prev, [r.id]: r }));
    });
    es.addEventListener("resource_removed", (e) => {
      const { id } = JSON.parse((e as MessageEvent).data) as { id: string };
      setResources((prev) => { const next = { ...prev }; delete next[id]; return next; });
    });
    const onQueueEvent = (e: Event) => {
      const d = JSON.parse((e as MessageEvent).data) as { resource_id: string; device_id: string; timeout_min?: number };
      if (d.device_id !== deviceId) return;
      refreshTickets();
      if (e.type === "queue_called") notify("세탁기가 비었습니다!", `${d.timeout_min ?? 5}분 안에 사용을 시작하지 않으면 다음 순번으로 넘어갑니다.`);
      if (e.type === "queue_expired") notify("순번이 만료되었습니다", "5분 안에 사용 시작이 확인되지 않아 다음 대기자를 호출했습니다.");
    };
    es.addEventListener("queue_called", onQueueEvent);
    es.addEventListener("queue_expired", onQueueEvent);
    es.addEventListener("queue_done", onQueueEvent);

    // SSE 가 끊겨 있는 동안의 안전망: 20초마다 전체를 다시 받음
    const poll = setInterval(() => { if (es.readyState !== EventSource.OPEN) loadAll(); }, 20000);
    return () => { es.close(); clearInterval(poll); };
  }, [deviceId, loadAll, refreshTickets]);

  // 저장된 로그인이 서버에서도 유효한지 앱을 열 때 한 번 확인합니다.
  // (무료 서버는 재배포 때 DB 가 초기화되어 계정이 사라지므로, 헤더에 옛 닉네임이 남아 있지 않게 정리)
  const authToken = useAuth()?.token;
  useEffect(() => {
    if (!authToken) return;
    api.me(authToken).catch((e: Error) => { if (/로그인|세션|401/.test(e.message)) setAuth(null); });
  }, [authToken]);

  const list = useMemo(() => Object.values(resources), [resources]);
  const value: Ctx = { resources, list, connected, loading, error, myTickets, refreshTickets, deviceId };
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): Ctx {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime 은 RealtimeProvider 안에서만 사용");
  return ctx;
}

/** 브라우저 알림. 권한이 없으면 조용히 건너뜁니다(화면 상단 배너가 대체). iOS 는 홈 화면에 추가해야 동작. */
function notify(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    navigator.serviceWorker?.ready.then((reg) => reg.showNotification(title, { body, icon: "/icons/icon-192.png" }))
      .catch(() => new Notification(title, { body }));
  } catch { /* 일부 브라우저는 new Notification 을 막음 */ }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "default") return Notification.requestPermission();
  return Notification.permission;
}
