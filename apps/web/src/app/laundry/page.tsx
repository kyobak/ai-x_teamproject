"use client";
import { Header } from "@/components/Header";
import { MachineCard } from "@/components/MachineCard";
import { PwaSetup } from "@/components/PwaSetup";
import { useRealtime } from "@/lib/realtime";

/** 세탁실 (슬라이스 B). 기기 목록 + 내 티켓. 실물 우선 원칙을 화면에 명시합니다. */
export default function LaundryPage() {
  const { list, myTickets, refreshTickets, deviceId } = useRealtime();
  // 세탁기를 먼저, 건조기를 뒤에. 같은 종류 안에서는 이름순.
  const machines = list.filter((r) => r.kind === "laundry")
    .sort((a, b) => (a.machine_type === b.machine_type ? a.name.localeCompare(b.name, "ko") : a.machine_type === "washer" ? -1 : 1));
  const zone = machines[0]?.zone ?? "세탁실";
  return (
    <>
      <Header title="세탁실" back="/" />
      <main className="space-y-3 p-4">
        <PwaSetup />
        <p className="text-xs text-slate-500">{zone} · 앱은 안내 도구이며 실제로 먼저 온 사람이 우선입니다. 기기가 비면 1순위에게 알려드립니다.</p>
        {machines.map((m) => (
          <MachineCard key={m.id} r={m} deviceId={deviceId} onChanged={refreshTickets}
            ticket={myTickets.find((t) => t.resource_id === m.id)} />
        ))}
        {machines.length === 0 && <p className="text-sm text-slate-500">기기 정보를 불러오는 중…</p>}
        <details className="rounded-xl bg-white p-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium">상태는 어떻게 판정하나요?</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>세탁기 외벽 진동 센서가 진동 세기만 보냅니다. 카메라·QR 없음.</li>
            <li>진동이 30초 이상 이어지면 사용 중, 기본 코스 50분을 더해 예상 종료를 표시합니다.</li>
            <li>불림·배수 구간의 짧은 정지는 무시하고, 무진동이 5분 이상 이어져야 종료로 봅니다.</li>
            <li>예상 시각이 지나도 진동이 있으면 계속 사용 중으로 둡니다(센서 우선).</li>
          </ul>
        </details>
      </main>
    </>
  );
}
