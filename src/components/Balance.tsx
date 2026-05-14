import React from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Balance() {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-3">User Usage</h1>
      <section className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Balance</CardTitle>
            <CardDescription>
              User balance in <b>0G Token</b>
            </CardDescription>
            <CardAction>
              <Button>+ Top Up</Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">1000</p>
          </CardContent>
          {/* <CardFooter>
          <p>Card Footer</p>
        </CardFooter> */}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage this month</CardTitle>
            <CardDescription>
              User usage this month balance in <b>0G Token</b>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">109233</p>
          </CardContent>
          {/* <CardFooter>
          <p>Card Footer</p>
        </CardFooter> */}
        </Card>
      </section>
    </div>
  );
}
