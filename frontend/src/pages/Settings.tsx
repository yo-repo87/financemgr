import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

interface AiSettings {
  hasKey: boolean;
  maskedKey: string | null;
  modelPreference: string;
}

export default function Settings() {
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
    <div className="space-y-6 max-w-lg">
      <h1 className="text-lg font-semibold text-slate-900">Settings</h1>

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
    </div>
  );
}
