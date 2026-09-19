/* eslint-disable @next/next/no-img-element -- 작은 마스코트 webp 한 장 */
/** 모든 페이지 맨 아래의 제작자 표기. 하트를 든 하냥이 + "made by 굳건". */
export function Footer() {
  return (
    <footer className="px-4 pb-4 pt-8 text-center text-[11px] text-muted">
      <img src="/mascot/hanyang-13.webp" alt="" aria-hidden className="mx-auto mb-1 h-12 w-auto" />
      <span className="pill inline-block bg-surface-strong px-3 py-1 font-display text-primary">made by 굳건</span>
      <p className="mt-1.5">한양대 ERICA · AI+X 공학융합프로젝트 2026 · 팀 굳건</p>
    </footer>
  );
}
