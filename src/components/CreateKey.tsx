import React from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "./ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "./ui/card";

export default function CreateKey() {
  return (
    <div className="space-y-5">
      <h1 className="font-bold text-2xl">API Keys</h1>
      <section className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between md:gap-10">
        <p className="text-sm">
          Create an API key to access BAI services in your applications. Please
          store it securely. Do not share your API key with others, or expose it
          in the browser or other client-side code. You may generate up to 3 API
          keys.
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="whitespace-nowrap">Create API Key</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Do not share your API key with others, or expose it in the
                browser or other client-side code.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Please enter the API key name" />
              <Button>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </section>
      <Card>
        <Table>
          <TableCaption>A list of your recent API key.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Name</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Key</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">test</TableCell>
              <TableCell>5/14/2026, 11:14:48 AM</TableCell>
              <TableCell>Never Used</TableCell>
              <TableCell>sk-wi8cg*******912j</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
