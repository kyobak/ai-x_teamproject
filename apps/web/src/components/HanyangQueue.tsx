"use client";
/* eslint-disable @next/next/no-img-element -- 마스코트는 360px 이하 webp 라 next/image 최적화가 필요 없고, absolute 애니메이션에 img 가 단순함 */
/**
 * 하냥이 대기줄: 정류장 앞에 학교 마스코트(하냥이)가 줄을 서는 애니메이션.
 *
 * - 하냥이 1마리 = 5명. 줄이 길어질수록 하냥이가 뒤에 한 마리씩 톡 튀어나오며 늘어납니다 (최대 9마리 + "+N명").
 * - 버스가 출발 시각에 도착하면: 버스가 왼쪽에서 들어와 정류장에 서고 → 앞쪽 하냥이들이 버스로 쏙 들어가고 → 버스가 떠납니다.
 *   남은 하냥이들은 앞으로 한 칸씩 스르륵 당겨집니다.
 * - 버스 도착은 (1) 다음 출발 시각이 지나 목록이 바뀌었을 때 (2) 줄이 한 번에 크게 줄었을 때 자동으로, (3) "버스 도착 시연" 버튼으로 언제든.
 *
 * 구현 요점: 하냥이마다 고유 id 를 주고 absolute 위치(right) 를 순번으로 계산합니다. 앞사람이 빠지면 순번이 줄어
 * CSS transition 으로 자연스럽게 앞으로 이동합니다. 캐릭터 그림은 id 로 정해져 줄이 움직여도 같은 하냥이가 그대로 걸어갑니다.
 */
import { useEffect, useRef, useState } from "react";

const MASCOTS = [2, 10, 11, 13, 14, 1, 4, 15].map((n) => `/mascot/hanyang-${String(n).padStart(2, "0")}.webp`);
const PER_MASCOT = 5;       // 하냥이 1마리 = 5명
const MAX_SHOW = 9;         // 화면에 세우는 최대 마리 수
const SPACING = 30;         // 하냥이 간격(px)
const STOP_W = 70;          // 정류장 표지판 영역 폭(px)

type Phase = "idle" | "arrive" | "board" | "leave";

export function HanyangQueue({ people, capacity, nextDeparture, stopName, demoKey }: {
  people: number | null | undefined; capacity: number | null | undefined; nextDeparture?: string; stopName: string; demoKey?: number;
}) {
  const target = Math.min(MAX_SHOW, Math.ceil((people ?? 0) / PER_MASCOT));
  const [ids, setIds] = useState<number[]>([]);
  const [boarding, setBoarding] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const nextId = useRef(0);
  const prevDep = useRef(nextDeparture);
  const prevPeople = useRef(people ?? 0);
  const busy = useRef(false);

  // 현재 줄(ids)을 ref 로도 들고 있어, 타이머 안에서 최신 줄을 읽습니다 (setState 안에서 또 setState 하지 않기 위해).
  const idsRef = useRef<number[]>([]);
  useEffect(() => { idsRef.current = ids; }, [ids]);

  // 버스 도착 → 탑승 → 출발 순서의 애니메이션. 끝나면 줄 길이를 새 값(after 마리)에 맞춥니다.
  const playBus = (after: number) => {
    if (busy.current) return;
    busy.current = true;
    setPhase("arrive");
    const k = Math.max(1, Math.min(idsRef.current.length, Math.ceil((capacity ?? 45) / PER_MASCOT)));
    const riders = idsRef.current.slice(0, k);            // 앞에서부터 정원만큼 탑승
    setTimeout(() => { setBoarding(riders); setPhase("board"); }, 1100);
    setTimeout(() => {
      setIds(fit(idsRef.current.filter((id) => !riders.includes(id)), after));
      setBoarding([]);
      setPhase("leave");
    }, 2300);
    setTimeout(() => { setPhase("idle"); busy.current = false; }, 3300);
  };

  // 목표 마리 수에 맞게 뒤에서 더하거나 뺍니다 (앞사람은 그대로).
  const fit = (cur: number[], n: number) => {
    const next = cur.slice(0, n);
    while (next.length < n) next.push(nextId.current++);
    return next;
  };

  useEffect(() => {
    const departed = prevDep.current !== undefined && nextDeparture !== prevDep.current;
    const bigDrop = (prevPeople.current - (people ?? 0)) >= PER_MASCOT * 3;
    prevDep.current = nextDeparture;
    prevPeople.current = people ?? 0;
    if ((departed || bigDrop) && ids.length > 0) { playBus(target); return; }
    if (!busy.current) setIds((cur) => fit(cur, target));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, nextDeparture, people]);

  // 발표용: 버튼으로 언제든 버스 도착 장면을 재생 (demoKey 가 바뀔 때마다)
  useEffect(() => {
    if (demoKey) playBus(Math.max(0, ids.length - Math.ceil((capacity ?? 45) / PER_MASCOT)) + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoKey]);

  const extra = Math.max(0, (people ?? 0) - MAX_SHOW * PER_MASCOT);
  return (
    <div className="relative h-36 w-full overflow-hidden rounded-[20px] bg-gradient-to-b from-[#eaf1ff] to-[#f7f9fc]">
      {/* 도로 */}
      <div className="absolute inset-x-0 bottom-0 h-7 bg-[#d9dee6]">
        <div className="absolute inset-x-0 top-1/2 h-0 border-t-2 border-dashed border-white/90" />
      </div>
      {/* 인도 */}
      <div className="absolute inset-x-0 bottom-7 h-2 bg-[#c3cad4]" />

      {/* 정류장 표지판 */}
      <div className="absolute bottom-9 right-3 flex flex-col items-center" style={{ width: STOP_W - 12 }}>
        <svg viewBox="0 0 48 92" className="h-[86px] w-12" aria-hidden>
          <rect x="22" y="30" width="4" height="62" rx="2" fill="#0a3a6b" />
          <circle cx="24" cy="20" r="18" fill="#0052ff" stroke="#0a3a6b" strokeWidth="3" />
          <rect x="14" y="11" width="20" height="15" rx="3" fill="#fff" />
          <rect x="16" y="13" width="7" height="5" rx="1" fill="#0052ff" />
          <rect x="25" y="13" width="7" height="5" rx="1" fill="#0052ff" />
          <circle cx="18" cy="27" r="2" fill="#fff" /><circle cx="30" cy="27" r="2" fill="#fff" />
        </svg>
        <span className="-mt-1 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[9px] font-semibold text-white">{stopName}</span>
      </div>

      {/* 하냥이 줄 (앞사람 = 정류장 쪽) */}
      {ids.map((id, i) => {
        const isBoarding = boarding.includes(id);
        return (
          <img key={id} src={MASCOTS[id % MASCOTS.length]} alt="" aria-hidden
            className={`hanyang ${isBoarding ? "hanyang-board" : "hanyang-join"}`}
            style={{ right: STOP_W + i * SPACING, animationDelay: isBoarding ? `${i * 90}ms` : undefined, ["--bob-delay" as string]: `${(id % 5) * 0.23}s` }} />
        );
      })}
      {ids.length === 0 && (
        <div className="absolute bottom-9 right-24 flex items-end gap-2">
          <img src="/mascot/hanyang-06.webp" alt="" aria-hidden className="h-16 w-auto" />
          <span className="mb-4 rounded-full bg-white px-2 py-1 text-[11px] text-body shadow-sm">줄이 없어요!</span>
        </div>
      )}
      {extra > 0 && (
        <span className="absolute bottom-10 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white" style={{ right: STOP_W + MAX_SHOW * SPACING + 26 }}>+{extra}명</span>
      )}

      {/* 버스 */}
      <div className={`shuttle-bus bus-${phase}`} aria-hidden>
        <svg viewBox="0 0 150 60" className="h-full w-full">
          <rect x="2" y="4" width="146" height="44" rx="10" fill="#0052ff" stroke="#0a3a6b" strokeWidth="3" />
          <rect x="10" y="11" width="24" height="16" rx="3" fill="#dbe8ff" /><rect x="40" y="11" width="24" height="16" rx="3" fill="#dbe8ff" />
          <rect x="70" y="11" width="24" height="16" rx="3" fill="#dbe8ff" /><rect x="100" y="11" width="20" height="30" rx="3" fill="#dbe8ff" />
          <rect x="126" y="11" width="16" height="12" rx="3" fill="#dbe8ff" />
          <text x="48" y="42" fontSize="10" fontWeight="700" fill="#fff" textAnchor="middle">HANYANG</text>
          <circle cx="32" cy="50" r="8" fill="#0a0b0d" /><circle cx="118" cy="50" r="8" fill="#0a0b0d" />
          <circle cx="32" cy="50" r="3" fill="#a8acb3" /><circle cx="118" cy="50" r="3" fill="#a8acb3" />
        </svg>
      </div>
    </div>
  );
}
