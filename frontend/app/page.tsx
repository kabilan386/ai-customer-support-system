"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Bot, Headphones, BarChart3 } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "customer" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch(
        mode === "login" ? "/auth/login" : "/auth/register",
        { method: "POST", body: JSON.stringify(form) }
      );
      login(data.access_token, data.role, data.name, data.user_id);
      if (data.role === "customer") router.push("/chat");
      else router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 p-12">
        <div className="flex items-center gap-3">
          <Headphones className="w-8 h-8 text-white" />
          <span className="text-white font-bold text-xl">AI Support Hub</span>
        </div>
        <div className="space-y-8">
          <h1 className="text-5xl font-extrabold text-white leading-tight">
            Smarter Support,<br />Powered by AI
          </h1>
          <div className="space-y-4">
            {[
              { icon: Bot, label: "LLM Chatbot", desc: "GPT-4o with domain-tuned prompts" },
              { icon: Headphones, label: "Voice Bot", desc: "Hands-free via Web Speech API" },
              { icon: BarChart3, label: "Live Analytics", desc: "KPIs, sentiment trends & more" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold">{label}</p>
                  <p className="text-brand-100 text-sm">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-brand-100 text-sm">MCA Internship Project · SRM University</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white">{mode === "login" ? "Welcome back" : "Create account"}</h2>
            <p className="text-slate-400 mt-1">{mode === "login" ? "Sign in to continue" : "Join the support platform"}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <>
                <input
                  className="w-full bg-card border border-border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  placeholder="Full name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
                <select
                  className="w-full bg-card border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  <option value="customer">Customer</option>
                  <option value="agent">Support Agent</option>
                  <option value="admin">Admin</option>
                </select>
              </>
            )}
            <input
              type="email"
              className="w-full bg-card border border-border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              placeholder="Email address"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
            <input
              type="password"
              className="w-full bg-card border border-border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              placeholder="Password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <p className="text-slate-400 text-sm text-center mt-6">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              className="text-brand-500 hover:text-brand-400 font-medium"
              onClick={() => setMode(m => m === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Register" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
