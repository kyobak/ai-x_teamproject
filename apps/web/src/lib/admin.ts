/** 관리자 PIN 을 localStorage 에 두고 /api/admin/* 호출 때 헤더로 보냅니다. 프로토타입용 단순 인증. */
const KEY = "erica-wait-admin-pin";
export const getPin = () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };
export const setPin = (pin: string) => { try { localStorage.setItem(KEY, pin); } catch { /* ignore */ } };
export const clearPin = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };
