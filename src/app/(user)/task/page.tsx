import { CalendarClock, CircleCheck, Clock3 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const tasks = [
  {
    title: "Weekly signal scan",
    description: "Track X, GitHub, Docs, and HackQuest signals every Monday.",
    status: "Ready",
    icon: CalendarClock,
  },
  {
    title: "Evidence refresh",
    description: "Prepare updated source cards before a verified brief is shared.",
    status: "Queued",
    icon: Clock3,
  },
  {
    title: "Verifier pass",
    description: "Check unsupported claims before storage and chain proof steps.",
    status: "Active",
    icon: CircleCheck,
  },
];

export default function Page() {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold">Automation Task</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Manage recurring Langclaw jobs for discovery, evidence packaging,
          and verification.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {tasks.map((task) => {
          const Icon = task.icon;

          return (
            <Card key={task.title}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{task.title}</CardTitle>
                    <CardDescription>{task.status}</CardDescription>
                  </div>
                  <Icon className="size-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {task.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
