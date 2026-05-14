import { BrainCircuit, Database, ShieldCheck, ToggleLeft } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MemoryDataTable } from "./data-table";
import { memoryData } from "./data";

const totalMemories = memoryData.length;
const activeMemories = memoryData.filter(
  (memory) => memory.status === "active"
).length;
const disabledMemories = totalMemories - activeMemories;
const projectMemories = memoryData.filter(
  (memory) => memory.scope !== "Global"
).length;

const stats = [
  {
    label: "Total memories",
    value: totalMemories,
    description: "Captured across chats",
    icon: Database,
  },
  {
    label: "Active",
    value: activeMemories,
    description: "Available for recall",
    icon: BrainCircuit,
  },
  {
    label: "Project scoped",
    value: projectMemories,
    description: "Attached to workspaces",
    icon: ShieldCheck,
  },
  {
    label: "Disabled",
    value: disabledMemories,
    description: "Kept but not reused",
    icon: ToggleLeft,
  },
];

export default function Page() {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold">Memory</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Manage what Langclaw remembers, where each memory applies, and whether
          it can be reused in future conversations.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card key={stat.label} size="sm">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>{stat.label}</CardTitle>
                  <CardDescription>{stat.description}</CardDescription>
                </div>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <MemoryDataTable data={memoryData} />
    </div>
  );
}
