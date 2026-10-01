import type { Metadata } from "next";
import VoxelShell from "@/components/game/voxel/VoxelShell";

export const metadata: Metadata = {
  title: "Portal Hoppers: Blocky Worlds (preview) | Tolley.io",
  description: "Preview build of the rebuilt Portal Hoppers: a blocky 3D rescue adventure with keys, levers, Cubo lifts and mouse aiming.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://www.tolley.io/game" },
};

export default function GameNextPage() {
  return (
    <main>
      <p className="sr-only">
        Portal Hoppers: Blocky Worlds is a preview of the rebuilt game. Move with WASD, jump with Space, bash with X or the left mouse button, pull levers with E, and ask Cubo for a
        lift with Shift. Find three keys, free your friend, and open the vault portal.
      </p>
      <VoxelShell />
    </main>
  );
}
