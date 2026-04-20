"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ChatWindow from "@/components/ChatWindow";
import { LogOut, BarChart3, Headphones } from "lucide-react";

export default function ChatPage() {
  const { token, role, name, logout, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !token) router.push("/");
  }, [ready, token, router]);

  if (!ready) return null;

  return (
    <div className="flex h-screen bg-surface">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col py-6 px-4 shrink-0">
        <div className="flex items-center gap-2 mb-8">
          <Headphones className="w-6 h-6 text-brand-400" />
          <span className="font-bold text-white text-lg">AI Support</span>
        </div>
        <nav className="flex-1 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-brand-500/10 text-brand-400 font-medium text-sm">
            <Headphones className="w-4 h-4" /> Chat
          </div>
          {(role === "agent" || role === "admin") && (
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-card text-sm transition"
            >
              <BarChart3 className="w-4 h-4" /> Dashboard
            </button>
          )}
        </nav>
        <div className="border-t border-border pt-4 space-y-3">
          <div className="px-3">
            <p className="text-white text-sm font-medium truncate">{name}</p>
            <p className="text-slate-500 text-xs capitalize">{role}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 text-sm transition"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Chat area */}
      <main className="flex-1 flex flex-col min-h-0">
        <ChatWindow />
      </main>
    </div>
  );
}
