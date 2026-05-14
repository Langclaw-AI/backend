import Balance from "@/components/Balance";
import DetailUsage from "@/components/DetailUsage";
import { MonthlyUsage } from "@/components/MonthlyUsage";
import React from "react";

export default function page() {
  return (
    <div className="space-y-10">
      <Balance />
      <MonthlyUsage />
      <DetailUsage />
    </div>
  );
}
