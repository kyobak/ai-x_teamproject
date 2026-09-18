"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** 모바일 하단 탭. 엄지로 닿는 위치에 두는 것이 휴대폰 UX 의 기본입니다. */
const TABS = [
  { href: "/", label: "홈", icon: "⌂" },
  { href: "/laundry", label: "세탁실", icon: "◎" },
  { href: "/shuttle", label: "셔틀", icon: "▷" },
  { href: "/admin", label: "관리", icon: "⚙" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur safe-bottom">
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link href={t.href} className={`flex flex-col items-center gap-0.5 py-2 text-xs ${active ? "text-blue-700 font-semibold" : "text-slate-500"}`}>
                <span className="text-lg leading-none" aria-hidden>{t.icon}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
