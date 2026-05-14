"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export function UserShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="mx-auto w-full max-w-4xl px-4 py-10 md:px-6">
        <SidebarTrigger className="mb-4 md:hidden" />
        {children}
      </main>
    </SidebarProvider>
  );
}
