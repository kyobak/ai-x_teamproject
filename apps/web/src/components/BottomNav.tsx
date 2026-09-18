"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";

/** 하단 탭 = 4개 분야 + 홈. 분야를 고른 뒤 목록 → 상세로 내려가는 구조의 첫 단계. 활성 탭만 브랜드 파랑. */
const TABS = [
  { href: "/", key: "nav.home", icon: "⌂" },
  { href: "/laundry", key: "nav.laundry", icon: "◎" },
  { href: "/space", key: "nav.space", icon: "▦" },
  { href: "/shuttle", key: "nav.shuttle", icon: "▷" },
  { href: "/cafeteria", key: "nav.cafeteria", icon: "◒" },
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
              <Link href={tab.href} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-display ${active ? "text-primary" : "text-muted"}`}>
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
