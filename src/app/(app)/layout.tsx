// Shell for every signed-in page: navigation + user + sign-out. The middleware has already rejected anonymous visitors.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

const NAV = [
  ["/", "ホーム"], ["/inbound", "入荷検品"], ["/inventory", "在庫・隔離"], ["/allocation", "引当・出荷"], ["/history", "納品履歴"],
  ["/alarms", "温度警報"], ["/routes", "配車・拘束時間"], ["/trace", "トレース"], ["/masters", "マスタ"],
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined) ?? "";
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <span className="font-bold text-sky-800">Yuki コールドチェーン</span>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="rounded px-2 py-1 hover:bg-slate-100">{label}</Link>
            ))}
          </nav>
          <form action={signOut} className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            <span>{email}</span>
            <button className="btn-secondary">ログアウト</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">{children}</main>
    </div>
  );
}
