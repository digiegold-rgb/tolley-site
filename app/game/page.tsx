import { GameShell } from "@/components/game/GameShell";

export default function GamePage() {
  return (
    <main>
      <p className="sr-only">
        Portal Hoppers is a free co-op pixel platformer. Pick Zip the frog, Ember the fox or Moxie the cat, team up with Cubo the cube, hop through
        ten worlds, free fifteen caged friends and unlock their powers. Move with the arrow keys, jump with Space (hold it for an Ultra Jump), bash
        with X and use powers with C. A second player can drive Cubo with WASD and Shift. Touch controls appear on phones and tablets.
      </p>
      <GameShell />
    </main>
  );
}
