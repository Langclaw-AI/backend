"use client";

import {
  Eye,
  FileText,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  defaultAppSettings,
  readAppSettings,
  resetAppSettings,
  updateAppSettings,
  type AppSettings,
} from "@/lib/app-settings";

type ThemeMode = "light" | "dark";

const displaySettings = [
  {
    key: "showSourceCards",
    title: "Source cards",
    description: "Show citation cards under research answers.",
    icon: FileText,
  },
  {
    key: "showAgentTrace",
    title: "Agent trace",
    description: "Show live steps and final OpenClaw trace.",
    icon: Sparkles,
  },
  {
    key: "showProofPanel",
    title: "0G proof panel",
    description: "Show compute, storage, chain, and brief hash details.",
    icon: ShieldCheck,
  },
  {
    key: "compactAnswers",
    title: "Compact answers",
    description: "Keep assistant answers shorter in the chat view.",
    icon: Eye,
  },
] satisfies Array<{
  key: keyof AppSettings;
  title: string;
  description: string;
  icon: typeof Eye;
}>;

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function SettingRow({
  checked,
  description,
  icon: Icon,
  onToggle,
  title,
}: {
  checked: boolean;
  description: string;
  icon: typeof Eye;
  onToggle: () => void;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/70 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-medium">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button
        aria-pressed={checked}
        onClick={onToggle}
        size="sm"
        type="button"
        variant={checked ? "default" : "outline"}
      >
        {checked ? "On" : "Off"}
      </Button>
    </div>
  );
}

export default function Page() {
  const [settings, setSettings] = useState<AppSettings>(() =>
    readAppSettings()
  );
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function patchSettings(patch: Partial<AppSettings>) {
    updateAppSettings(patch);
    setSettings(readAppSettings());
  }

  function resetAll() {
    resetAppSettings();
    setSettings(defaultAppSettings);
    setTheme("light");
  }

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Control how Langclaw displays chat output, research evidence, and app
          theme in this session.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Theme applies immediately.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setTheme("light")}
              type="button"
              variant={theme === "light" ? "default" : "outline"}
            >
              <Sun />
              Light
            </Button>
            <Button
              onClick={() => setTheme("dark")}
              type="button"
              variant={theme === "dark" ? "default" : "outline"}
            >
              <Moon />
              Dark
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        {displaySettings.map((item) => (
          <SettingRow
            checked={Boolean(settings[item.key])}
            description={item.description}
            icon={item.icon}
            key={item.key}
            onToggle={() =>
              patchSettings({
                [item.key]: !settings[item.key],
              })
            }
            title={item.title}
          />
        ))}
      </section>

      <div className="flex justify-end">
        <Button onClick={resetAll} type="button" variant="outline">
          <RotateCcw />
          Reset settings
        </Button>
      </div>
    </div>
  );
}
