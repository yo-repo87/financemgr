import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import PasskeyManager from "../components/PasskeyManager";
import TwoFactorManager from "../components/TwoFactorManager";
import SecurityQuestionsManager from "../components/SecurityQuestionsManager";
import { subscribeToPush, isPushSupported } from "../lib/push";

interface AiSettings {
  hasKey: boolean;
  maskedKey: string | null;
  modelPreference: string;
}

function AiAdvisorSettings() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  const { data: settings } = useQuery<AiSettings>({
    queryKey: ["ai-settings"],
    queryFn: () => api.get("/api/ai/settings").then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: () => api.put("/api/ai/settings", { openaiApiKey: apiKey }),
    onSuccess: () => {
      setApiKey("");
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (apiKey.trim().length >= 20) saveMutation.mutate();
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-slate-700">OpenAI API key</h2>
        <p className="text-xs text-slate-400 mt-1">
          Used only for your Advisor conversations. Stored encrypted (AES-256-GCM) and never shown in full again.
        </p>
      </div>

      {settings?.hasKey && (
        <p className="text-sm text-slate-600">
          Current key: <span className="font-mono">{settings.maskedKey}</span>
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="password"
          placeholder="sk-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm font-mono"
        />
        <button
          type="submit"
          disabled={saveMutation.isPending || apiKey.trim().length < 20}
          className="bg-slate-900 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saveMutation.isPending ? "Saving..." : "Save key"}
        </button>
        {saved && <span className="ml-3 text-sm text-emerald-600">Saved.</span>}
      </form>
    </div>
  );
}

interface NotificationSettings {
  pushEnabled: boolean;
  subscriptionCount: number;
}

function NotificationSettingsPanel() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);

  const { data: settings } = useQuery<NotificationSettings>({
    queryKey: ["notification-settings"],
    queryFn: () => api.get("/api/notifications/settings").then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (pushEnabled: boolean) => api.put("/api/notifications/settings", { pushEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-settings"] }),
  });

  async function enableOnThisDevice() {
    setError(null);
    setEnabling(true);
    try {
      await subscribeToPush();
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
    } catch (err: any) {
      setError(err?.message || "Could not enable notifications");
    } finally {
      setEnabling(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-slate-700">Push notifications</h2>
        <p className="text-xs text-slate-400 mt-1">
          Payment reminders and other important alerts, sent even when the app isn't open.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-700">Notifications enabled</span>
        <button
          role="switch"
          aria-checked={settings?.pushEnabled ?? false}
          onClick={() => toggleMutation.mutate(!(settings?.pushEnabled ?? true))}
          disabled={!settings || toggleMutation.isPending}
          className={`w-11 h-6 rounded-full transition-colors relative disabled:opacity-50 ${
            settings?.pushEnabled ? "bg-slate-900" : "bg-slate-200"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              settings?.pushEnabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {settings && settings.subscriptionCount === 0 && isPushSupported() && (
        <div className="pt-2 border-t">
          <p className="text-xs text-slate-400 mb-2">This device isn't subscribed yet.</p>
          <button
            onClick={enableOnThisDevice}
            disabled={enabling}
            className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
          >
            {enabling ? "Requesting permission..." : "Enable on this device"}
          </button>
        </div>
      )}
      {settings && !isPushSupported() && (
        <p className="text-xs text-slate-400">Push notifications aren't supported in this browser.</p>
      )}
    </div>
  );
}

const tabs = [
  { id: "advisor", label: "AI Advisor" },
  { id: "security", label: "Security" },
  { id: "notifications", label: "Notifications" },
] as const;

export default function Settings() {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("advisor");

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-lg font-semibold text-slate-900">Settings</h1>

      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "advisor" && <AiAdvisorSettings />}
      {tab === "security" && (
        <div className="space-y-6">
          <PasskeyManager />
          <TwoFactorManager />
          <SecurityQuestionsManager />
        </div>
      )}
      {tab === "notifications" && <NotificationSettingsPanel />}
    </div>
  );
}
