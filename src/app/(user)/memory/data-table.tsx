"use client";

import * as React from "react";
import {
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMemoryColumns } from "./columns";
import type { MemoryCategory, MemoryItem, MemoryStatus } from "./types";

const categoryOptions: MemoryCategory[] = [
  "Preference",
  "Project",
  "Workflow",
  "Personal",
  "API",
];

const statusOptions: { label: string; value: MemoryStatus }[] = [
  { label: "Active", value: "active" },
  { label: "Disabled", value: "disabled" },
];

const columnLabels: Record<string, string> = {
  memory: "Memory",
  category: "Category",
  scope: "Scope",
  status: "Status",
  source: "Source",
  lastUsed: "Last Used",
  updatedAt: "Updated",
  confidence: "Confidence",
};

export function MemoryDataTable({ data }: { data: MemoryItem[] }) {
  const [rows, setRows] = React.useState<MemoryItem[]>(data);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      confidence: false,
      source: false,
    });
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");

  const columns = React.useMemo(
    () =>
      getMemoryColumns({
        onDelete: (id) => {
          setRows((currentRows) =>
            currentRows.filter((memory) => memory.id !== id)
          );
          setRowSelection({});
        },
        onStatusToggle: (id) => {
          setRows((currentRows) =>
            currentRows.map((memory) =>
              memory.id === id
                ? {
                    ...memory,
                    status:
                      memory.status === "active" ? "disabled" : "active",
                    updatedAt: new Date().toISOString().slice(0, 10),
                  }
                : memory
            )
          );
        },
      }),
    []
  );

  // TanStack Table intentionally exposes mutable table APIs for interactive grids.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 5,
      },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const statusFilter =
    (table.getColumn("status")?.getFilterValue() as string | undefined) ??
    "all";
  const categoryFilter =
    (table.getColumn("category")?.getFilterValue() as string | undefined) ??
    "all";

  function deleteSelectedRows() {
    const selectedIds = new Set(selectedRows.map((row) => row.original.id));

    setRows((currentRows) =>
      currentRows.filter((memory) => !selectedIds.has(memory.id))
    );
    setRowSelection({});
  }

  function disableSelectedRows() {
    const selectedIds = new Set(selectedRows.map((row) => row.original.id));
    const today = new Date().toISOString().slice(0, 10);

    setRows((currentRows) =>
      currentRows.map((memory) =>
        selectedIds.has(memory.id)
          ? { ...memory, status: "disabled", updatedAt: today }
          : memory
      )
    );
    setRowSelection({});
  }

  return (
    <Card size="sm" className="gap-0">
      <CardHeader className="border-b pb-4">
        <CardTitle>Saved Memories</CardTitle>
        <CardDescription>
          Review, filter, and manage memories Langclaw can reuse across chats.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col gap-3 border-b px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative w-full md:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search memories..."
                value={globalFilter}
                onChange={(event) => setGlobalFilter(event.target.value)}
                className="pl-8"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 md:ml-auto">
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  table
                    .getColumn("status")
                    ?.setFilterValue(value === "all" ? undefined : value)
                }
              >
                <SelectTrigger className="w-[138px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={categoryFilter}
                onValueChange={(value) =>
                  table
                    .getColumn("category")
                    ?.setFilterValue(value === "all" ? undefined : value)
                }
              >
                <SelectTrigger className="w-[152px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Columns3 />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-40">
                  {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(Boolean(value))
                        }
                      >
                        {columnLabels[column.id] ?? column.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {selectedCount > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={disableSelectedRows}>
                <Ban />
                Disable selected
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSelectedRows}
              >
                <Trash2 />
                Delete selected
              </Button>
            </div>
          )}
        </div>

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No memories found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-3 border-t px-4 py-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            {selectedCount} of {filteredCount} row(s) selected.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="w-[118px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 20].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-sm text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount() || 1}
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronsLeft />
                <span className="sr-only">First page</span>
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft />
                <span className="sr-only">Previous page</span>
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight />
                <span className="sr-only">Next page</span>
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <ChevronsRight />
                <span className="sr-only">Last page</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
