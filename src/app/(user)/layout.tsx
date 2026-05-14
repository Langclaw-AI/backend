"use client";

import { UserShell } from "@/components/user-shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <UserShell>{children}</UserShell>;
}
