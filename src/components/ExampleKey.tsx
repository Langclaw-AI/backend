"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "./ui/button";
import { CheckIcon, CopyIcon } from "lucide-react";

const examples = {
  curl: `curl https://api.langclaw.ai/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $LANGCLAW_API_KEY" \\
  -d '{
    "model": "langclaw-chat",
    "messages": [
      {
        "role": "user",
        "content": "Explain what Langclaw can do in one sentence."
      }
    ]
  }'`,
  python: `import os
import requests

response = requests.post(
    "https://api.langclaw.ai/v1/chat/completions",
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {os.environ['LANGCLAW_API_KEY']}",
    },
    json={
        "model": "langclaw-chat",
        "messages": [
            {
                "role": "user",
                "content": "Explain what Langclaw can do in one sentence.",
            }
        ],
    },
)

print(response.json())`,
  nodejs: `const response = await fetch("https://api.langclaw.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${process.env.LANGCLAW_API_KEY}\`,
  },
  body: JSON.stringify({
    model: "langclaw-chat",
    messages: [
      {
        role: "user",
        content: "Explain what Langclaw can do in one sentence.",
      },
    ],
  }),
});

const data = await response.json();
console.log(data);`,
};

type ExampleValue = keyof typeof examples;

function CodeExample({
  language,
  value,
}: {
  language: string;
  value: ExampleValue;
}) {
  const [copied, setCopied] = useState(false);
  const code = examples[value];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="overflow-hidden rounded-md border bg-muted/40">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
        <span className="text-xs font-medium uppercase text-muted-foreground">
          {language}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleCopy}
          aria-label={`Copy ${language} example`}
        >
          {copied ? (
            <CheckIcon className="size-3" />
          ) : (
            <CopyIcon className="size-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function ExampleKey() {
  return (
    <div className="space-y-5">
      <h1 className="font-bold text-2xl">API Examples</h1>
      <Tabs defaultValue="curl">
        <TabsList>
          <TabsTrigger value="curl">curl</TabsTrigger>
          <TabsTrigger value="python">python</TabsTrigger>
          <TabsTrigger value="nodejs">nodejs</TabsTrigger>
        </TabsList>
        <TabsContent value="curl">
          <CodeExample language="curl" value="curl" />
        </TabsContent>
        <TabsContent value="python">
          <CodeExample language="python" value="python" />
        </TabsContent>
        <TabsContent value="nodejs">
          <CodeExample language="node.js" value="nodejs" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
