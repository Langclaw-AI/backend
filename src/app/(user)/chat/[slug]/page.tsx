import SignalGraphChat from "@/components/SignalGraphChat";

export default async function page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <SignalGraphChat sessionId={slug} />;
}
