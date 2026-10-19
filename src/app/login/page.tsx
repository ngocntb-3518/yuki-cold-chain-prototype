"use client";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { signIn } from "./actions";

function LoginForm() {
  const next = useSearchParams().get("next") ?? "/";
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <h1 className="text-xl font-bold text-slate-900">ユキコールドロジスティクス</h1>
        <p className="text-sm text-slate-500">食品コールドチェーン業務支援システム（プロトタイプ）</p>
      </div>
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm">
        メールアドレス
        <input name="email" type="email" required autoComplete="username" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" />
      </label>
      <label className="block text-sm">
        パスワード
        <input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="w-full rounded bg-sky-700 py-2 font-semibold text-white disabled:opacity-50">
        {pending ? "ログイン中…" : "ログイン"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
