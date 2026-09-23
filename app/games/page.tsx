import GamesTable from "@/components/GamesTable";

export default function GamesPage() {
  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>MIS PARTIDAS</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          HISTORIAL DE PARTIDAS DE ASTEROIDS
        </p>
      </div>

      <GamesTable />
    </div>
  );
}
