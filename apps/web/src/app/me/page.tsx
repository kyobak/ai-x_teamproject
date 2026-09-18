"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { api, type Prefs } from "@/lib/api";
import { setAuth, useAuth } from "@/lib/auth";
import { setLang, useT } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";

/**
 * 내 정보: 닉네임, 기숙사 동, 자주 가는 식당, 기본 정류장, 알림 설정, 언어 + 내 대기열/체크인 현황.
 * 저장은 서버(users.prefs). 학번·실명 없음.
 */
/** 셀렉트 박스. 렌더 함수 밖에 두어야 입력 중 포커스가 안 튑니다. */
function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <label className="block text-sm"><span className="text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-hairline bg-canvas px-3 py-2.5">
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select></label>
  );
}

const DORMS = [{ v: "none", l: "기숙사 아님" }, { v: "injae", l: "인재관" }, { v: "changui", l: "창의관" }, { v: "haengbok", l: "행복관" }];

export default function MePage() {
  const user = useAuth();
  const router = useRouter();
  const t = useT();
  const { list, myTickets } = useRealtime();
  const [prefs, setPrefs] = useState<Prefs>({ dorm: "none", notify_queue: true, notify_shuttle: false, lang: "ko" });
  const [msg, setMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const token = user?.token;
  useEffect(() => {
    if (!token) { router.replace("/login"); return; }
    // 토큰이 바뀔 때(로그인/로그아웃)만 서버 값을 불러옵니다. 폼 입력 중에는 다시 불러오지 않음.
    api.me(token).then((u) => { setPrefs({ dorm: "none", notify_queue: true, notify_shuttle: false, lang: "ko", ...u.prefs }); setReady(true); })
      .catch(() => { setAuth(null); router.replace("/login"); });
  }, [token, router]);

  if (!user) return null;
  const save = async () => {
    try { const u = await api.savePrefs(user.token, prefs); setAuth({ ...user, prefs: u.prefs }); if (prefs.lang) setLang(prefs.lang as "ko" | "en"); setMsg("저장됨"); }
    catch (e) { setMsg((e as Error).message); }
  };
  const logout = async () => { try { await api.logout(user.token); } finally { setAuth(null); router.replace("/"); } };
  const cafes = list.filter((r) => r.kind === "cafeteria"), stops = list.filter((r) => r.kind === "shuttle");
  return (
    <>
      <Header title={t("nav.me")} back="/" />
      <main className="space-y-4 p-4">
        <section className="card flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-display text-xl text-white">{user.nickname.slice(0, 1)}</span>
          <div className="flex-1"><p className="font-display text-lg text-ink">{user.nickname}</p><p className="text-xs text-muted">익명 계정 · 학번/실명 없음</p></div>
          <button onClick={logout} className="pill bg-surface-strong px-3 py-1.5 text-xs font-semibold text-ink">{t("logout")}</button>
        </section>

        {ready && (
          <section className="card space-y-3 p-5">
            <h2 className="font-display text-base text-ink">내 설정</h2>
            <Sel label="기숙사" value={prefs.dorm ?? "none"} onChange={(v) => setPrefs({ ...prefs, dorm: v })} options={DORMS} />
            <Sel label="자주 가는 식당" value={prefs.favorite_cafeteria ?? ""} onChange={(v) => setPrefs({ ...prefs, favorite_cafeteria: v || null })} options={[{ v: "", l: "선택 안 함" }, ...cafes.map((c) => ({ v: c.id, l: c.name }))]} />
            <Sel label="기본 셔틀 정류장" value={prefs.default_stop ?? ""} onChange={(v) => setPrefs({ ...prefs, default_stop: v || null })} options={[{ v: "", l: "선택 안 함" }, ...stops.map((c) => ({ v: c.id, l: c.name }))]} />
            <Sel label="언어" value={prefs.lang ?? "ko"} onChange={(v) => setPrefs({ ...prefs, lang: v })} options={[{ v: "ko", l: "한국어" }, { v: "en", l: "English" }]} />
            <label className="flex items-center justify-between text-sm"><span>세탁기 내 차례 알림</span><input type="checkbox" checked={!!prefs.notify_queue} onChange={(e) => setPrefs({ ...prefs, notify_queue: e.target.checked })} className="h-5 w-5 accent-primary" /></label>
            <label className="flex items-center justify-between text-sm"><span>기본 정류장 셔틀 출발 알림</span><input type="checkbox" checked={!!prefs.notify_shuttle} onChange={(e) => setPrefs({ ...prefs, notify_shuttle: e.target.checked })} className="h-5 w-5 accent-primary" /></label>
            <button onClick={save} className="pill h-11 w-full bg-primary font-semibold text-white">저장</button>
            {msg && <p className="text-xs text-body">{msg}</p>}
          </section>
        )}

        <section className="card p-5">
          <h2 className="font-display text-base text-ink">내 현황</h2>
          {myTickets.length === 0 ? <p className="mt-1 text-sm text-muted">대기 중인 세탁기가 없습니다.</p> : (
            <ul className="mt-1 divide-y divide-hairline-soft">
              {myTickets.map((tk) => <li key={tk.id} className="flex justify-between py-2 text-sm"><span>{tk.name}</span><span className={tk.status === "called" ? "text-primary font-semibold" : "text-body"}>{tk.status === "called" ? "내 차례!" : `${tk.position}번 · 앞에 ${tk.people_ahead}명`}</span></li>)}
            </ul>
          )}
          {prefs.dorm && prefs.dorm !== "none" && <Link href={`/laundry/${prefs.dorm}`} className="mt-3 block text-sm text-primary">내 기숙사 세탁실 바로가기 ›</Link>}
          {prefs.default_stop && <Link href={`/shuttle/${prefs.default_stop}`} className="mt-1 block text-sm text-primary">기본 정류장 바로가기 ›</Link>}
        </section>

        <section className="card p-5 text-sm">
          <Link href="/admin" className="text-primary">관리자 화면 ›</Link>
        </section>
      </main>
    </>
  );
}
