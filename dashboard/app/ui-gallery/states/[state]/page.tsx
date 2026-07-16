import { VisualStateFixture } from "@/components/ui/VisualStateFixture";

export default async function VisualFixturePage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  return <VisualStateFixture state={state} />;
}
