export type MemoryStatus = "active" | "disabled";

export type MemoryCategory =
  | "Preference"
  | "Project"
  | "Workflow"
  | "Personal"
  | "API";

export type MemoryItem = {
  id: string;
  memory: string;
  category: MemoryCategory;
  scope: string;
  status: MemoryStatus;
  source: string;
  lastUsed: string;
  updatedAt: string;
  confidence: number;
};
