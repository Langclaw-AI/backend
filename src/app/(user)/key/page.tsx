import CreateKey from "@/components/CreateKey";
import ExampleKey from "@/components/ExampleKey";
import FlowKey from "@/components/FlowKey";

export default function page() {
  return (
    <div className="space-y-10">
      <FlowKey />
      <CreateKey />
      <ExampleKey />
    </div>
  );
}
