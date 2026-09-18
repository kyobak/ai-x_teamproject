"use client";
/**
 * 로그인 상태 (닉네임 + 토큰). localStorage 에 두고 useSyncExternalStore 로 읽습니다.
 * 학번·실명은 서버가 받지 않으므로 여기에도 없습니다. 토큰이 있으면 /api/auth/me 를 Bearer 로 호출합니다.
 */
import { useSyncExternalStore } from "react";
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
export function useAuth(): AuthUser | null {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  try { return raw ? (JSON.parse(raw) as AuthUser) : null; } catch { return null; }
}
