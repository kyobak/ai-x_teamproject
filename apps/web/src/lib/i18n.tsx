"use client";
/**
 * 아주 작은 한/영 전환 (Could: 영어 UI).
 * 라이브러리 없이 사전 객체 하나와 훅 하나로 끝냅니다. 유학생 시연용이므로 화면에 보이는 고정 문구만 번역하고,
 * 서버가 만든 문장(note, state_label)은 한국어 그대로 둡니다.
 * 언어는 localStorage 에 저장되고 useSyncExternalStore 로 읽어 서버 렌더링(항상 ko)과 어긋나지 않게 합니다.
 */
import { useSyncExternalStore } from "react";

export type Lang = "ko" | "en";
const KEY = "erica-wait-lang";
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const get = (): Lang => { try { return (localStorage.getItem(KEY) as Lang) || "ko"; } catch { return "ko"; } };

export function setLang(l: Lang) { try { localStorage.setItem(KEY, l); } catch { /* ignore */ } listeners.forEach((f) => f()); }
export function useLang(): Lang { return useSyncExternalStore(subscribe, get, () => "ko"); }

const DICT: Record<string, { ko: string; en: string }> = {
  "nav.home": { ko: "홈", en: "Home" }, "nav.laundry": { ko: "세탁·건조", en: "Laundry" }, "nav.space": { ko: "오픈스페이스", en: "Spaces" }, "nav.shuttle": { ko: "셔틀", en: "Shuttle" }, "nav.cafeteria": { ko: "학식", en: "Food" }, "nav.admin": { ko: "관리", en: "Admin" }, "nav.me": { ko: "내 정보", en: "My page" },
  "hub.laundry": { ko: "세탁 · 건조", en: "Laundry & Dryers" }, "hub.laundry.sub": { ko: "인재관 · 창의관 · 행복관", en: "3 dorm laundry rooms" },
  "hub.space": { ko: "오픈스페이스 혼잡도", en: "Open space occupancy" }, "hub.space.sub": { ko: "융합교육관 · 체육관 · 경상관 · 솔성관 · 과기대", en: "5 buildings" },
  "hub.shuttle": { ko: "셔틀 대기줄", en: "Shuttle queues" }, "hub.shuttle.sub": { ko: "셔틀콕 · 창의인재원 · 한대앞역 · 예술인APT", en: "4 stops" },
  "hub.cafeteria": { ko: "학식 정보 · 대기줄", en: "Cafeterias & lines" }, "hub.cafeteria.sub": { ko: "구내식당 4곳 · 푸드코트 2곳", en: "4 canteens · 2 food courts" },
  "login": { ko: "로그인", en: "Log in" }, "register": { ko: "회원가입", en: "Sign up" }, "logout": { ko: "로그아웃", en: "Log out" },
  "home.title": { ko: "ERICA 캠퍼스 대기 현황", en: "ERICA Campus Wait Times" },
  "home.hero.kicker": { ko: "지금 가장 빠른 학식", en: "Fastest cafeteria right now" },
  "home.hero.wait": { ko: "지금 서면", en: "If you line up now" },
  "home.sec.cafeteria": { ko: "학식 · 지금 가면 얼마나 기다릴까", en: "Cafeterias · how long is the line" },
  "home.sec.laundry": { ko: "세탁실", en: "Laundry room" }, "home.sec.shuttle": { ko: "셔틀", en: "Shuttle" },
  "home.sec.space": { ko: "오픈스페이스", en: "Open space" }, "home.sec.parking": { ko: "주차장", en: "Parking" },
  "mock": { ko: "목업", en: "mock" }, "live": { ko: "실시간", en: "live" }, "offline": { ko: "오프라인", en: "offline" },
  "level.relaxed": { ko: "여유", en: "Light" }, "level.normal": { ko: "보통", en: "Moderate" }, "level.crowded": { ko: "혼잡", en: "Busy" }, "level.unknown": { ko: "알 수 없음", en: "Unknown" },
  "queue.people": { ko: "줄", en: "in line" }, "people.unit": { ko: "명", en: "" },
  "laundry.available": { ko: "사용 가능", en: "Available" }, "laundry.in_use": { ko: "사용 중", en: "In use" }, "laundry.unknown": { ko: "상태 불명", en: "Unknown" },
  "laundry.join": { ko: "줄 서기", en: "Join queue" }, "laundry.leave": { ko: "취소", en: "Leave" }, "laundry.start": { ko: "내 차례! 사용 시작", en: "My turn! Start" }, "laundry.giveup": { ko: "포기", en: "Give up" },
  "laundry.waiting": { ko: "대기", en: "waiting" }, "laundry.soon": { ko: "곧 종료", en: "Ending soon" }, "laundry.minleft": { ko: "분 남음", en: " min left" },
  "report.q": { ko: "지금 현장은 어떤가요? (제보)", en: "How does it look on site? (report)" },
  "notif.ask": { ko: "🔔 내 차례 알림을 받으려면 알림을 허용하세요", en: "🔔 Allow notifications to get your turn alert" },
  "notif.denied": { ko: "(브라우저 설정에서 차단됨 · 화면 배너로 대체)", en: "(blocked in browser settings · in-app banner instead)" },
  "cafe.how": { ko: "어떻게 계산했나", en: "How we calculated" }, "cafe.count": { ko: "줄 인원(명)", en: "people in line" }, "cafe.thr": { ko: "분당 처리(명)", en: "served per min" }, "cafe.wait": { ko: "예상 대기(분)", en: "est. wait (min)" },
  "cafe.menu": { ko: "오늘 메뉴", en: "Today's menu" }, "cafe.vendors": { ko: "입점 매장", en: "Vendors" }, "cafe.trend": { ko: "최근 줄 인원 추이", en: "Recent line trend" },
  "shuttle.people": { ko: "줄 인원", en: "in line" }, "shuttle.cap": { ko: "버스 정원", en: "bus capacity" }, "shuttle.board": { ko: "탑승 가능", en: "you board" }, "shuttle.next": { ko: "다음 차", en: "next bus" }, "shuttle.later": { ko: "대 뒤", en: " bus(es) later" }, "shuttle.dep": { ko: "다음 출발", en: "Next departures" },
  "admin.title": { ko: "관리 (수동 입력)", en: "Admin (manual input)" },
};

export function useT() {
  const lang = useLang();
  return (key: string) => DICT[key]?.[lang] ?? key;
}
