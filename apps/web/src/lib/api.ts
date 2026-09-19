/**
 * 서버 API 호출 모음.
 *
 * API_BASE 를 고정하지 않고 "지금 페이지를 연 호스트의 8000 포트" 로 계산하는 이유:
 * 휴대폰에서 http://192.168.0.10:3000 으로 열면 API 도 http://192.168.0.10:8000 이어야 하기 때문입니다.
 * 배포 시엔 NEXT_PUBLIC_API_BASE 로 고정합니다.
 */
export function apiBase(): string {
  if (process.env.NEXT_PUBLIC_API_BASE) return process.env.NEXT_PUBLIC_API_BASE;
  if (typeof window !== "undefined") return `${window.location.protocol}//${window.location.hostname}:8000`;
  return "http://localhost:8000";
}

/** 서버 build_resource_status() 가 돌려주는 모양. kind 에 따라 일부 필드만 채워집니다. */
export type Level = "relaxed" | "normal" | "crowded" | "unknown";
export interface Resource {
  id: string;
  kind: "cafeteria" | "shuttle" | "laundry" | "space" | "parking";
  zone: string;
  name: string;
  capacity: number | null;
  primary_source: string;
  updated_at: string;
  // cafeteria / shuttle
  people_count?: number | null;
  throughput_per_min?: number | null;
  est_wait_min?: number | null;
  level?: Level;
  level_ko?: string;
  source?: string;
  note?: string;
  report_count?: number;
  vision_seen_at?: string | null;
  confidence?: number | null;
  menu?: { name: string; price: number; meal?: string; items?: string[] }[];
  vendors?: { name: string; category?: string; hours?: string }[];
  hours?: string | null;
  next_departures?: string[];
  buses_to_wait?: number | null;
  // shuttle (시간표 기반)
  direction?: string;
  upcoming?: { time: string; in_min: number }[];
  next_in_min?: number | null;
  board_time?: string | null;
  board_in_min?: number | null;
  board_note?: string;
  travel_min?: number | null;
  // laundry
  building?: string;
  machine_type?: "washer" | "dryer";
  state?: "available" | "in_use" | "unknown";
  state_label?: string;
  remaining_min?: number | null;
  overdue?: boolean;
  expected_end_at?: string | null;
  last_sample_at?: string | null;
  queue_length?: number;
  avg_cycle_min?: number | null;
  // space / parking
  occupancy_count?: number | null;
  space_note?: string | null;
}

export interface AuthUser { token: string; nickname: string; prefs: Prefs; created_at?: string }
export interface Prefs { dorm?: string | null; favorite_cafeteria?: string | null; default_stop?: string | null; notify_queue?: boolean; notify_shuttle?: boolean; lang?: string }

export interface MyTicket {
  id: number;
  resource_id: string;
  name: string;
  position: number;
  status: "waiting" | "called";
  people_ahead: number;
  called_at: string | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail: unknown = res.statusText;
    try { detail = (await res.json()).detail; } catch { /* 본문 없음 */ }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json();
}

const post = (path: string, body: unknown) =>
  fetch(`${apiBase()}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  resources: () => fetch(`${apiBase()}/api/resources`).then((r) => json<Resource[]>(r)),
  resource: (id: string) => fetch(`${apiBase()}/api/resources/${id}`).then((r) => json<Resource>(r)),
  history: (id: string) => fetch(`${apiBase()}/api/resources/${id}/history?limit=60`).then((r) => json<Record<string, number | string | null>[]>(r)),
  myTickets: (deviceId: string) => fetch(`${apiBase()}/api/queue/me?device_id=${encodeURIComponent(deviceId)}`).then((r) => json<MyTicket[]>(r)),
  // 줄 서기는 로그인 필요: Authorization 헤더로 토큰을 보내고, 서버가 검사합니다.
  joinQueue: (id: string, deviceId: string, token: string) =>
    fetch(`${apiBase()}/api/queue/${id}/join`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ device_id: deviceId }) }).then((r) => json<{ position: number }>(r)),
  leaveQueue: (id: string, deviceId: string) => post(`/api/queue/${id}/leave`, { device_id: deviceId }).then((r) => json<unknown>(r)),
  startUsing: (id: string, deviceId: string) => post(`/api/queue/${id}/start`, { device_id: deviceId }).then((r) => json<unknown>(r)),
  report: (id: string, level: number, deviceId: string) => post(`/api/reports`, { resource_id: id, level, device_id: deviceId }).then((r) => json<unknown>(r)),
  adminStatus: (body: { resource_id: string; state?: string; occupancy_level?: string; occupancy_count?: number }, pin: string) =>
    fetch(`${apiBase()}/api/admin/status`, { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Pin": pin }, body: JSON.stringify(body) }).then((r) => json<unknown>(r)),
  adminLogin: (pin: string) =>
    fetch(`${apiBase()}/api/admin/login`, { method: "POST", headers: { "X-Admin-Pin": pin } }).then((r) => json<unknown>(r)),
  adminCreateResource: (body: Record<string, unknown>, pin: string) =>
    fetch(`${apiBase()}/api/admin/resources`, { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Pin": pin }, body: JSON.stringify(body) }).then((r) => json<unknown>(r)),
  adminDeleteResource: (id: string, pin: string) =>
    fetch(`${apiBase()}/api/admin/resources/${id}`, { method: "DELETE", headers: { "X-Admin-Pin": pin } }).then((r) => json<unknown>(r)),
  pushTest: (deviceId: string) => post(`/api/push/test`, { device_id: deviceId }).then((r) => json<unknown>(r)),
  register: (nickname: string, password: string) => post(`/api/auth/register`, { nickname, password }).then((r) => json<AuthUser>(r)),
  login: (nickname: string, password: string) => post(`/api/auth/login`, { nickname, password }).then((r) => json<AuthUser>(r)),
  me: (token: string) => fetch(`${apiBase()}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => json<AuthUser>(r)),
  savePrefs: (token: string, prefs: Prefs) =>
    fetch(`${apiBase()}/api/auth/me/prefs`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(prefs) }).then((r) => json<AuthUser>(r)),
  logout: (token: string) => fetch(`${apiBase()}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).then((r) => json<unknown>(r)),
};
