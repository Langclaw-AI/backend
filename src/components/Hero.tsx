import React from "react";
import { DiaTextReveal } from "./ui/dia-text-reveal";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { SendHorizontal } from "lucide-react";
import { Textarea } from "./ui/textarea";

export default function Hero() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center space-y-10 px-4 text-foreground">
      <h1 className="max-w-full text-center text-3xl font-semibold tracking-tight md:text-7xl">
        Learn to{" "}
        <DiaTextReveal
          repeat
          repeatDelay={1.2}
          text={["build faster", "ship smarter", "scale easier"]}
        />
      </h1>
      <section className="relative flex w-full max-w-2xl">
        <Textarea placeholder="what do you to know?" />
        <Button className="absolute inset-y-0 right-0 ">
          <SendHorizontal />
        </Button>
      </section>
      <section className="mt-10 text-center text-lg md:text-xl">
        <p>Autonomous AI Research Engine for Verifiable Trend Intelligence</p>
      </section>
    </div>
  );
}
