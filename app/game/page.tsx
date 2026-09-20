import AdventureShell from "@/components/game/adventure/AdventureShell";

export default function GamePage() {
  return (
    <main>
      <p className="sr-only">
        Portal Hoppers: Whisperwood is an original 3D woodland adventure. Explore with Ember, Zip, or Moxie and your companion Cubo.
        Awaken three beacons, solve five temple rooms, and free the Heartwood Guardian. Use a keyboard and mouse or a controller.
        The original two-player platformer and touchscreen controls remain available in Portal Hoppers Classic.
      </p>
      <AdventureShell />
    </main>
  );
}
