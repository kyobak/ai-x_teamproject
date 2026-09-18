"use client";
/**
 * 로그인 상태 (닉네임 + 토큰). localStorage 에 두고 useSyncExternalStore 로 읽습니다.
 * 학번·실명은 서버가 받지 않으므로 여기에도 없습니다. 토큰이 있으면 /api/auth/me 를 Bearer 로 호출합니다.
 */
import { useMemo, useSyncExternalStore } from "react";
import type { AuthUser } from "./api";

const KEY = "erica-wait-auth";
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
let cache: string | null = null;
const read = () => { try { const v = localStorage.getItem(KEY); if (v !== cache) cache = v; return cache; } catch { return null; } };

export function setAuth(u: AuthUser | null) {
  try { if (u) localStorage.setItem(KEY, JSON.stringify(u)); else localStorage.removeItem(KEY); } catch { /* ignore */ }
  listeners.forEach((f) => f());
}
// 파싱 결과를 raw 문자열 기준으로 useMemo 로 고정합니다. 매 렌더마다 새 객체를 만들면 이 값을 의존성으로 쓰는
// useEffect 가 렌더마다 다시 실행되어 "내 정보" 폼이 입력 직후 서버 값으로 되돌아가는 버그가 납니다(실제로 겪음).
export function useAuth(): AuthUser | null {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => { try { return raw ? (JSON.parse(raw) as AuthUser) : null; } catch { return null; } }, [raw]);
}

/** 브라우저에서 localStorage 를 읽을 준비가 됐는지. 서버 렌더·하이드레이션 첫 렌더에서는 false.
 *  로그인 여부로 페이지를 튕길 때는 이 값이 true 일 때만 판단해야 합니다 (안 그러면 새로고침마다 /login 으로 감). */
export function useAuthReady(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
