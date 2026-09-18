"use client";
import Link from "next/link";
import type { Resource } from "@/lib/api";
import { waitText } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { LevelBadge } from "./LevelBadge";
import { SourceNote } from "./SourceNote";

/** 대시보드의 자원 카드(24px 라운드, 헤어라인, 그림자 없음). 종류별로 핵심 숫자 하나만 크게 보여줍니다. */
export function ResourceCard({ r }: { r: Resource }) {
  const t = useT();
  const href =
    r.kind === "cafeteria" ? `/cafeteria/${r.id}` :
    r.kind === "shuttle" ? "/shuttle" :
    r.kind === "laundry" ? "/laundry" :
    r.kind === "space" ? `/checkin/${r.id}` : "/admin";

  let big = "—";
  let sub = "";
  if (r.kind === "cafeteria" || r.kind === "shuttle") {
    big = r.est_wait_min != null ? waitText(r.est_wait_min) : t(`level.${r.level ?? "unknown"}`);
    sub = r.people_count != null ? `${t("queue.people")} ${r.people_count}${t("people.unit")}` : "";
    if (r.kind === "shuttle" && r.buses_to_wait != null) sub += ` · ${r.buses_to_wait === 0 ? t("shuttle.next") : `${r.buses_to_wait}${t("shuttle.later")}`}`;
  } else if (r.kind === "laundry") {
    big = r.state === "available" ? t("laundry.available")
      : r.state === "in_use" ? (r.remaining_min == null ? t("laundry.in_use") : r.remaining_min === 0 ? t("laundry.soon") : `${r.remaining_min}${t("laundry.minleft")}`)
      : t("laundry.unknown");
    sub = r.queue_length ? `${t("laundry.waiting")} ${r.queue_length}${t("people.unit")}` : "";
  } else {
    big = r.occupancy_count != null ? `${r.occupancy_count}${r.capacity ? ` / ${r.capacity}` : ""}` : t(`level.${r.level ?? "unknown"}`);
  }

  const showLevel = r.kind !== "laundry";
  return (
    <Link href={href} className="card block p-5 transition active:bg-surface-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">{r.zone}</p>
          <h3 className="truncate font-display text-base text-ink">{r.name}</h3>
        </div>
        {showLevel && <LevelBadge level={r.level} size="sm" />}
        {r.kind === "laundry" && (
          <span className={`pill px-2.5 py-0.5 text-[11px] font-semibold ${r.state === "in_use" ? "bg-surface-strong text-in-use" : "bg-surface-strong text-body"}`}>
            {r.machine_type === "dryer" ? "건조기" : "세탁기"}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-3xl tabular-nums text-ink">{big}</p>
      {sub && <p className="mt-0.5 text-sm text-body">{sub}</p>}
      {(r.kind === "cafeteria" || r.kind === "shuttle" || r.kind === "space") && <div className="mt-1.5"><SourceNote source={r.source} note={r.note} seenAt={r.vision_seen_at} /></div>}
    </Link>
  );
}
