import Capabilities from "@/components/Capabilities";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import { SquigglyHome } from "@/components/SquigglyHome";

export default function Home() {
  return (
    <main>
      <Header />
      <Hero />
      <SquigglyHome />
      <Capabilities />
    </main>
  );
}
