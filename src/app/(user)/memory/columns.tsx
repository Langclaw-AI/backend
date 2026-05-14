"use client";

import * as React from "react";
import type { Column, ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown,
  Ban,
  Copy,
  MoreHorizontal,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { MemoryCategory, MemoryItem, MemoryStatus } from "./types";

type MemoryColumnActions = {
  onDelete: (id: string) => void;
  onStatusToggle: (id: string) => void;
};

const categoryStyles: Record<MemoryCategory, string> = {
  Preference: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
  Project:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  Workflow:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Personal:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300",
  API: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

const statusStyles: Record<MemoryStatus, string> = {
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  disabled:
    "border-muted bg-muted text-muted-foreground dark:border-muted-foreground/20",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00`));
}

function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

function DataTableCheckbox({
  checked,
  indeterminate,
  onCheckedChange,
  className,
  ...props
}: Omit<
  React.ComponentProps<"input">,
  "checked" | "onChange" | "type"
> & {
  checked: boolean;
  indeterminate?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange(event.target.checked)}
      className={cn(
        "size-4 rounded border border-input accent-primary",
        className
      )}
      {...props}
    />
  );
}

function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-2 h-8 px-2", className)}
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {title}
      <ArrowUpDown
        className={cn(
          "size-4",
          column.getIsSorted() && "text-primary"
        )}
      />
    </Button>
  );
}

export function getMemoryColumns({
  onDelete,
  onStatusToggle,
}: MemoryColumnActions): ColumnDef<MemoryItem>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <DataTableCheckbox
          aria-label="Select all"
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(value)}
        />
      ),
      cell: ({ row }) => (
        <DataTableCheckbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(value)}
        />
      ),
      enableHiding: false,
      enableSorting: false,
    },
    {
      accessorKey: "memory",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Memory" />
      ),
      cell: ({ row }) => (
        <div className="max-w-[340px] whitespace-normal font-medium leading-relaxed">
          {row.getValue("memory")}
        </div>
      ),
    },
    {
      accessorKey: "category",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Category" />
      ),
      cell: ({ row }) => {
        const category = row.getValue("category") as MemoryCategory;

        return <Pill className={categoryStyles[category]}>{category}</Pill>;
      },
      filterFn: (row, id, value) => !value || row.getValue(id) === value,
    },
    {
      accessorKey: "scope",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Scope" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.getValue("scope")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as MemoryStatus;

        return (
          <Pill className={statusStyles[status]}>
            {status === "active" ? "Active" : "Disabled"}
          </Pill>
        );
      },
      filterFn: (row, id, value) => !value || row.getValue(id) === value,
    },
    {
      accessorKey: "source",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Source" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.getValue("source")}
        </span>
      ),
    },
    {
      accessorKey: "lastUsed",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last Used" />
      ),
      cell: ({ row }) => formatDate(row.getValue("lastUsed")),
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Updated" />
      ),
      cell: ({ row }) => formatDate(row.getValue("updatedAt")),
    },
    {
      accessorKey: "confidence",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Confidence"
          className="justify-end"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right font-medium">
          {row.getValue("confidence")}%
        </div>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const memory = row.original;
        const statusLabel =
          memory.status === "active" ? "Disable memory" : "Enable memory";

        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={() => void navigator.clipboard.writeText(memory.id)}
                >
                  <Copy />
                  Copy memory ID
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onStatusToggle(memory.id)}>
                  {memory.status === "active" ? <Ban /> : <RotateCcw />}
                  {statusLabel}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => onDelete(memory.id)}
                >
                  <Trash2 />
                  Delete memory
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
