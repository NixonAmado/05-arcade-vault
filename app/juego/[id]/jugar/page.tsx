import GamePlayer from "@/components/GamePlayer";

export default async function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GamePlayer id={id} />;
}
