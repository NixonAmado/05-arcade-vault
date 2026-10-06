import Welcome from "@/components/Welcome";

export default async function BienvenidaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <Welcome next={next} />;
}
