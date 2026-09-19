"use client";
import Link from "next/link";
import type { Resource } from "@/lib/api";
import { waitText } from "@/lib/format";
import { useD, useL, useLang, useT } from "@/lib/i18n";
import { LevelBadge } from "./LevelBadge";
import { SourceNote } from "./SourceNote";

/** 목록 화면의 자원 카드. 종류별로 핵심 숫자 하나만 크게. 클릭하면 상세로. */
export function resourceHref(r: Resource): string {
  switch (r.kind) {
    case "cafeteria": return `/cafeteria/${r.id}`;
    case "shuttle": return `/shuttle/${r.id}`;
    case "laundry": return `/laundry/${r.building ?? ""}`;
    case "space": return `/space/${r.id}`;
    default: return "/admin";
  }
}

export function ResourceCard({ r }: { r: Resource }) {
  const t = useT();
  const L = useL();
  const D = useD();
  const lang = useLang();
  let big = "—";
  let sub = "";
  if (r.kind === "cafeteria") {
    big = r.est_wait_min != null ? waitText(r.est_wait_min, lang) : t(`level.${r.level ?? "unknown"}`);
    sub = r.people_count != null ? `${t("queue.people")} ${r.people_count}${t("people.unit")}` : "";
  } else if (r.kind === "shuttle") {
    big = r.next_in_min == null ? L("운행 종료", "No more buses") : r.next_in_min === 0 ? L("지금 출발", "Leaving now") : L(`${r.next_in_min}분 후`, `in ${r.next_in_min} min`);
    sub = (r.people_count != null ? `${t("queue.people")} ${r.people_count}${t("people.unit")} · ` : "") + (r.board_time ? L(`지금 서면 ${r.board_time} 차`, `Line up now → ${r.board_time} bus`) : "");
  } else if (r.kind === "laundry") {
    big = r.state === "available" ? t("laundry.available")
      : r.state === "in_use" ? (r.remaining_min == null ? t("laundry.in_use") : r.remaining_min === 0 ? t("laundry.soon") : `${r.remaining_min}${t("laundry.minleft")}`)
      : t("laundry.unknown");
    sub = r.queue_length ? `${t("laundry.waiting")} ${r.queue_length}${t("people.unit")}` : "";
  } else {
    big = r.occupancy_count != null ? `${r.occupancy_count}${r.capacity ? ` / ${r.capacity}` : ""}` : t(`level.${r.level ?? "unknown"}`);
    sub = r.capacity && r.occupancy_count != null ? L(`잔여 ${Math.max(0, r.capacity - r.occupancy_count)}`, `${Math.max(0, r.capacity - r.occupancy_count)} seats left`) : "";
  }
  return (
    <Link href={resourceHref(r)} className="card block p-5 transition active:bg-surface-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">{D(r.zone)}</p>
          <h3 className="truncate font-display text-base text-ink">{D(r.name)}</h3>
          {r.kind === "space" && r.capacity ? <p className="text-[11px] text-muted-soft">{L(`수용 약 ${r.capacity}명`, `Capacity ~${r.capacity}`)}{r.space_note ? ` · ${D(r.space_note)}` : ""}</p> : null}
        </div>
        {r.kind !== "laundry" && <LevelBadge level={r.level} size="sm" />}
        {r.kind === "laundry" && (
          <span className={`pill px-2.5 py-0.5 text-[11px] font-semibold bg-surface-strong ${r.state === "in_use" ? "text-in-use" : "text-body"}`}>
            {r.machine_type === "dryer" ? L("건조기", "Dryer") : L("세탁기", "Washer")}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-3xl tabular-nums text-ink">{big}</p>
      {sub && <p className="mt-0.5 text-sm text-body">{sub}</p>}
      <div className="mt-1.5"><SourceNote source={r.source} note={r.note} seenAt={r.vision_seen_at} /></div>
    </Link>
  );
}
