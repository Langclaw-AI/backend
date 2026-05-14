import React from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShineBorder } from "./ui/shine-border";
import { ExternalLink } from "lucide-react";
export default function FlowKey() {
  return (
    <div className="space-y-5">
      <h1 className="font-bold text-2xl">Quickstart</h1>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>01</CardTitle>
            <CardDescription>Create API Key</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Generate and securely save your API key</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>02</CardTitle>
            <CardDescription>View examples</CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              Explore usage examples, available in cURL, Python, and Node.js
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>03</CardTitle>
            <CardDescription>Make a request</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Integrate with Langclaw AI services</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <ShineBorder shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]} />
          <CardHeader>
            <CardTitle>04</CardTitle>
            <CardDescription>Langclaw API Doc</CardDescription>
            <CardAction>
              <ExternalLink />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p>View the full API Reference and Guides</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
