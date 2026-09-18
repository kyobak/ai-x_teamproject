"use client";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { MachineCard } from "@/components/MachineCard";
import type { MyTicket, Resource } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

/** 세탁기/건조기 묶음. 렌더 함수 안에서 컴포넌트를 만들면 매 렌더마다 새 컴포넌트가 되어 상태가 초기화되므로 밖에 둡니다. */
function MachineSection({ title, items, tickets, deviceId, onChanged }: { title: string; items: Resource[]; tickets: MyTicket[]; deviceId: string; onChanged: () => void }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-base text-ink">{title} <span className="text-sm text-muted">빈 기기 {items.filter((r) => r.state === "available").length}/{items.length}</span></h2>
      <div className="space-y-3">
        {items.map((m) => <MachineCard key={m.id} r={m} deviceId={deviceId} onChanged={onChanged} ticket={tickets.find((tk) => tk.resource_id === m.id)} />)}
      </div>
    </section>
  );
}

/** 세탁·건조 2단계: 한 관의 세탁기·건조기 목록 + 가상 대기열 (슬라이스 B). */
const NAMES: Record<string, string> = { injae: "인재관", changui: "창의관", haengbok: "행복관" };

export default function BuildingPage() {
  const { building } = useParams<{ building: string }>();
  const { list, myTickets, refreshTickets, deviceId } = useRealtime();
  const ms = list.filter((r) => r.kind === "laundry" && r.building === building).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const washers = ms.filter((r) => r.machine_type === "washer"), dryers = ms.filter((r) => r.machine_type === "dryer");
  return (
    <>
      <Header title={`${NAMES[building] ?? building} 세탁실`} back="/laundry" />
      <main className="space-y-6 p-4">
        {ms.length === 0 && <p className="text-sm text-muted">기기 정보를 불러오는 중…</p>}
        <MachineSection title="세탁기" items={washers} tickets={myTickets} deviceId={deviceId} onChanged={refreshTickets} />
        <MachineSection title="건조기" items={dryers} tickets={myTickets} deviceId={deviceId} onChanged={refreshTickets} />
        <details className="rounded-[24px] bg-surface-soft p-4 text-xs text-body">
          <summary className="cursor-pointer font-semibold text-ink">상태는 어떻게 판정하나요?</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>기기 외벽 진동 센서가 진동 세기만 보냅니다. 카메라·QR 없음.</li>
            <li>진동이 30초 이상 이어지면 사용 중, 기본 코스(세탁 50분·건조 45분)를 더해 예상 종료를 표시합니다.</li>
            <li>불림·배수 구간의 짧은 정지는 무시하고, 무진동이 5분 이상 이어져야 종료로 봅니다.</li>
            <li>센서가 아직 안 붙은 기기는 시연용 시뮬레이션으로 표시됩니다.</li>
          </ul>
        </details>
      </main>
    </>
  );
}
