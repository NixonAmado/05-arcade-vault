import type { Metadata } from "next";
import About from "@/components/About";

export const metadata: Metadata = {
  title: "Acerca de — Arcade Vault",
  description:
    "Conoce la misión de Arcade Vault y escríbenos: sugerencias, propuestas de juegos o simplemente un saludo.",
};

export default function Page() {
  return <About />;
}
