"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";

/** 모바일 하단 탭. 엄지로 닿는 위치. 활성 탭만 브랜드 파랑(가이드: 파랑은 드물게). */
const TABS = [
  { href: "/", key: "nav.home", icon: "⌂" },
  { href: "/laundry", key: "nav.laundry", icon: "◎" },
  { href: "/shuttle", key: "nav.shuttle", icon: "▷" },
  { href: "/admin", key: "nav.admin", icon: "⚙" },
];

export function BottomNav() {
  const path = usePathname();
  const t = useT();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-canvas/95 backdrop-blur safe-bottom">
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? path === "/" : path.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link href={tab.href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-display ${active ? "text-primary" : "text-muted"}`}>
                <span className="text-lg leading-none" aria-hidden>{tab.icon}</span>
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
