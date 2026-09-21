import type { Metadata } from "next";
import Home from "@/components/Home";

export const metadata: Metadata = {
  title: "Arcade Vault · El arcade clásico está de vuelta",
  description: "Juega clásicos arcade gratis en tu navegador. Sin descargas, con ranking global.",
};

export default function Page() {
  return <Home />;
}
