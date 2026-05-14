"use client";
import React from "react";
import { SquigglyText } from "@/components/ui/squiggly-text";

export function SquigglyHome() {
  return (
    <div className="flex min-h-[36rem] w-full items-center justify-center overflow-hidden px-4">
      <h1 className="max-w-5xl text-balance text-center text-4xl leading-tight font-bold text-neutral-900 sm:text-5xl md:text-7xl lg:text-8xl dark:text-neutral-100">
        Independent{" "}
        <SquigglyText stepDuration={70} scale={[6, 9]} className="text-primary">
          Research Identity
        </SquigglyText>{" "}
        <br />
        for <SquigglyText scale={5}> AI Agents</SquigglyText>
      </h1>
    </div>
  );
}
