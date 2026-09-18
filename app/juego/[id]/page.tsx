import GameDetail from "@/components/GameDetail";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GameDetail id={id} />;
}
