"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

/**
 * 로그인/회원가입. 닉네임 + 비밀번호만. 학번·실명·이메일은 받지 않습니다 (REQ-SYS-01).
 * 계정은 "내 정보(기숙사 동, 자주 가는 식당, 알림 설정)" 를 기기 간에 유지하는 용도입니다. 대기열 자체는 로그인 없이 됩니다.
 */
export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [nick, setNick] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const u = mode === "login" ? await api.login(nick, pw) : await api.register(nick, pw);
      setAuth(u); router.push("/me");
    } catch (err) { setMsg((err as Error).message); } finally { setBusy(false); }
  };
  return (
    <>
      <Header title={mode === "login" ? t("login") : t("register")} back="/" />
      <main className="p-4">
        <form onSubmit={submit} className="card space-y-4 p-6">
          <p className="text-xs text-body">닉네임과 비밀번호만 사용합니다. 학번·이름은 저장하지 않습니다.</p>
          <label className="block text-sm"><span className="text-muted">닉네임</span>
            <input value={nick} onChange={(e) => setNick(e.target.value)} minLength={2} maxLength={20} required className="mt-1 w-full rounded-xl border border-hairline px-3 py-3" placeholder="예: 뾰롱이" /></label>
          <label className="block text-sm"><span className="text-muted">비밀번호</span>
            <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" minLength={4} required className="mt-1 w-full rounded-xl border border-hairline px-3 py-3" placeholder="4자 이상" /></label>
          <button disabled={busy} className="pill h-12 w-full bg-primary font-semibold text-white active:bg-primary-active disabled:bg-primary-disabled">{mode === "login" ? t("login") : t("register")}</button>
          {msg && <p className="text-xs text-down">{msg}</p>}
          <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="w-full text-center text-sm text-primary">
            {mode === "login" ? "처음이신가요? 회원가입" : "이미 계정이 있나요? 로그인"}
          </button>
        </form>
      </main>
    </>
  );
}
