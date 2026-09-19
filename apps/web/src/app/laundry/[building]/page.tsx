"use client";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { MachineCard } from "@/components/MachineCard";
import type { MyTicket, Resource } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useL } from "@/lib/i18n";

/** 세탁기/건조기 묶음. 렌더 함수 안에서 컴포넌트를 만들면 매 렌더마다 새 컴포넌트가 되어 상태가 초기화되므로 밖에 둡니다. */
function MachineSection({ title, items, tickets, deviceId, onChanged }: { title: string; items: Resource[]; tickets: MyTicket[]; deviceId: string; onChanged: () => void }) {
  const L = useL();
  return (
    <section>
      <h2 className="mb-2 font-display text-base text-ink">{title} <span className="text-sm text-muted">{L("빈 기기", "Free")} {items.filter((r) => r.state === "available").length}/{items.length}</span></h2>
      <div className="space-y-3">
        {items.map((m) => <MachineCard key={m.id} r={m} deviceId={deviceId} onChanged={onChanged} ticket={tickets.find((tk) => tk.resource_id === m.id)} />)}
      </div>
    </section>
  );
}

/** 세탁·건조 2단계: 한 관의 세탁기·건조기 목록 + 가상 대기열 (슬라이스 B). */
const NAMES: Record<string, { ko: string; en: string }> = { injae: { ko: "인재관", en: "Injae Hall" }, changui: { ko: "창의관", en: "Changui Hall" }, haengbok: { ko: "행복관", en: "Haengbok Hall" } };

export default function BuildingPage() {
  const { building } = useParams<{ building: string }>();
  const { list, myTickets, refreshTickets, deviceId } = useRealtime();
  const L = useL();
  const ms = list.filter((r) => r.kind === "laundry" && r.building === building).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const washers = ms.filter((r) => r.machine_type === "washer"), dryers = ms.filter((r) => r.machine_type === "dryer");
  return (
    <>
      <Header title={L(`${NAMES[building]?.ko ?? building} 세탁실`, `${NAMES[building]?.en ?? building} laundry`)} back="/laundry" />
      <main className="space-y-6 p-4">
        {ms.length === 0 && <p className="text-sm text-muted">{L("기기 정보를 불러오는 중…", "Loading machines…")}</p>}
        <MachineSection title={L("세탁기", "Washers")} items={washers} tickets={myTickets} deviceId={deviceId} onChanged={refreshTickets} />
        <MachineSection title={L("건조기", "Dryers")} items={dryers} tickets={myTickets} deviceId={deviceId} onChanged={refreshTickets} />
        <details className="rounded-[24px] bg-surface-soft p-4 text-xs text-body">
          <summary className="cursor-pointer font-semibold text-ink">{L("상태는 어떻게 판정하나요?", "How is the status decided?")}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>{L("기기 외벽 진동 센서가 진동 세기만 보냅니다. 카메라·QR 없음.", "A vibration sensor on the machine sends only vibration strength. No camera or QR.")}</li>
            <li>{L("진동이 30초 이상 이어지면 사용 중, 기본 코스(세탁 50분·건조 45분)를 더해 예상 종료를 표시합니다.", "30+ seconds of vibration means in use; the estimated end adds a standard cycle (wash 50 min, dry 45 min).")}</li>
            <li>{L("불림·배수 구간의 짧은 정지는 무시하고, 무진동이 5분 이상 이어져야 종료로 봅니다.", "Short pauses for soaking or draining are ignored; 5+ minutes without vibration means finished.")}</li>
            <li>{L("센서가 아직 안 붙은 기기는 시연용 시뮬레이션으로 표시됩니다.", "Machines without a sensor yet show demo simulation data.")}</li>
          </ul>
        </details>
      </main>
    </>
  );
}
