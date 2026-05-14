import Link from "next/link";
import React from "react";
import { Button } from "./ui/button";

export default function Header() {
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-5 sm:px-8 lg:px-20">
      <nav className="flex min-w-0 items-center gap-3 sm:gap-5">
        <p className="shrink-0 text-xl font-bold">
          <Link href={"/"}>Langclaw</Link>
        </p>
        <p className="hidden sm:block">
          <Link href={"/"}>Documentation</Link>
        </p>
      </nav>
      <Button className="shrink-0 whitespace-nowrap px-3 text-xs sm:px-4 sm:text-sm" asChild>
        <Link href={"/chat"}>TRY LANGCLAW</Link>
      </Button>
    </header>
  );
}
