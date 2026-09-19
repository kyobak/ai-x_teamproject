"use client";
/* eslint-disable @next/next/no-img-element -- 작은 마스코트 webp 한 장 */
import { useL } from "@/lib/i18n";

/** 모든 페이지 맨 아래의 제작자 표기. 하트를 든 하냥이 + "made by 굳건". */
export function Footer() {
  const L = useL();
  return (
    <footer className="px-4 pb-4 pt-8 text-center text-[11px] text-muted">
      <img src="/mascot/hanyang-13.webp" alt="" aria-hidden className="mx-auto mb-1 h-12 w-auto" />
      <span className="pill inline-block bg-surface-strong px-3 py-1 font-display text-primary">{L("made by 굳건", "made by Team Gutgeon")}</span>
      <p className="mt-1.5">{L("한양대 ERICA · AI+X 공학융합프로젝트 2026 · 팀 굳건", "Hanyang Univ. ERICA · AI+X Convergence Project 2026 · Team Gutgeon")}</p>
      {/* Android 앱 설치 파일. apps/mobile 에서 빌드해 public/ 에 둔 것 (npm run apk 후 복사) */}
      <a href="/erica-wait.apk" download className="mt-2 inline-block text-primary">{L("Android 앱 다운로드 (APK)", "Download the Android app (APK)")}</a>
    </footer>
  );
}
