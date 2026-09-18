import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RealtimeProvider } from "@/lib/realtime";
import { BottomNav } from "@/components/BottomNav";
import { CalledBanner } from "@/components/CalledBanner";

/**
 * 전체 레이아웃. 모바일 우선(최대 폭 lg), 데스크톱에선 가운데 정렬된 폰 화면처럼 보입니다.
 * 배경은 순백 캔버스(디자인 가이드), 데스크톱 바깥 여백만 옅은 회색.
 */
export const metadata: Metadata = {
  title: "ERICA 대기 통합",
  description: "학식·세탁실·셔틀 대기 현황과 예상 대기시간",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ERICA 대기" },
};
export const viewport: Viewport = { themeColor: "#0052ff", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-surface-soft text-ink antialiased">
        <RealtimeProvider>
          <div className="mx-auto min-h-dvh max-w-lg bg-canvas pb-20">
            <CalledBanner />
            {children}
          </div>
          <BottomNav />
        </RealtimeProvider>
      </body>
    </html>
  );
}
