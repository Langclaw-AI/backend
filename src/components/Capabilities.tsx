import {
  Blocks,
  Bot,
  CalendarSync,
  FileCog,
  MessagesSquare,
  Rss,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "./ui/card";
import { PointerHighlight } from "./ui/pointer-highlight";
import { ShineBorder } from "./ui/shine-border";

export default function Capabilities() {
  return (
    <Card className="m-5 p-20 relative overflow-hidden">
      <ShineBorder shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]} />
      <CardHeader className="space-y-3">
        {/* <h1 className="text-3xl font-bold">
          Six Core Capabilities to Build Your AI Agent
        </h1> */}
        <div className="text-3xl font-bold tracking-tight md:text-5xl">
          Six Core Capabilities to Build Your
          <PointerHighlight>
            <span>AI Agent</span>
          </PointerHighlight>
        </div>
        <h2 className="text-xl">
          Chat / Models / Multi-Agent / Channels Skills / Scheduled Tasks
        </h2>
      </CardHeader>
      <CardContent className="grid gap-5">
        <section className="grid grid-cols-3 gap-5">
          <article className="border-r space-y-3">
            <MessagesSquare size={40} />
            <h3 className="text-xl font-bold text-primary">
              Smart Interaction
            </h3>
            <h4 className="font-semibold">Conversational Chat Interface</h4>
            <p>
              Immersive chat experience with Markdown rendering, code
              highlighting, and conversation history.
            </p>
          </article>

          <article className="border-r space-y-3">
            <Bot size={40} />
            <h3 className="text-xl font-bold text-primary">Agent Management</h3>
            <h4 className="font-semibold">Multi-Agent Smart Routing</h4>
            <p>
              Create and manage multiple AI assistants, each with its own
              configuration.
            </p>
          </article>

          <article className="space-y-3">
            <Rss size={40} />
            <h3 className="text-xl font-bold text-primary">
              Channel Management
            </h3>
            <h4 className="font-semibold">Multi-Platform Account Binding</h4>
            <p>
              Immersive chat experience with Markdown rendering, code
              highlighting, and conversation history.
            </p>
          </article>
        </section>

        <section className="grid grid-cols-3 gap-5">
          <article className="border-r space-y-3">
            <CalendarSync size={40} />
            <h3 className="text-xl font-bold text-primary">Automation</h3>
            <h4 className="font-semibold">Scheduled Task Scheduler</h4>
            <p>
              Visual cron configuration for setting trigger conditions and
              intervals. Let AI execute tasks automatically around the clock.
            </p>
          </article>

          <article className="border-r space-y-3">
            <Blocks size={40} />
            <h3 className="text-xl font-bold text-primary">Skill Extension</h3>
            <h4 className="font-semibold">Built-in Skill Marketplace</h4>
            <p>
              Graphical skill panel with no package manager needed. Browse,
              install, and manage skills with document processing and search
              capabilities pre-installed.
            </p>
          </article>

          <article className="space-y-3">
            <FileCog size={40} />
            <h3 className="text-xl font-bold text-primary">System Settings</h3>
            <h4 className="font-semibold">One-Stop Configuration Center</h4>
            <p>
              Centralized management of themes, notifications, proxies, and
              more. Adaptive light/dark themes with launch-at-login support.
            </p>
          </article>
        </section>
      </CardContent>
    </Card>
  );
}
