import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RealtimeProvider } from "@/lib/realtime";
import { BottomNav } from "@/components/BottomNav";
import { CalledBanner } from "@/components/CalledBanner";

/**
 * 전체 레이아웃. 모바일 우선(최대 폭 lg)이며 데스크톱에선 가운데 정렬된 폰 화면처럼 보입니다.
 * RealtimeProvider 를 여기서 한 번만 감싸 모든 페이지가 같은 SSE 연결을 공유합니다.
 */
export const metadata: Metadata = {
  title: "ERICA 대기 통합",
  description: "학식·세탁실·셔틀 대기 현황과 예상 대기시간",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ERICA 대기" },
};
export const viewport: Viewport = { themeColor: "#0E4A84", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-slate-100 text-slate-900 antialiased">
        <RealtimeProvider>
          <div className="mx-auto min-h-dvh max-w-lg bg-slate-50 pb-20 shadow-xl">
            <CalledBanner />
            {children}
          </div>
          <BottomNav />
        </RealtimeProvider>
      </body>
    </html>
  );
}
