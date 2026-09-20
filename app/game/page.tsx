import PortalShell from "@/components/game/portal3d/PortalShell";

export default function GamePage() {
  return (
    <main>
      <p className="sr-only">
        Portal Hoppers in 3D. Help Zip, Ember, and Moxie rescue fifteen friends from Captain Clank across ten magical worlds.
        Meet Cubo, earn powers, jump moving platforms, bash portal orbs, and enjoy the original Portal Hoppers soundtrack.
        Keyboard, controller, and touchscreen controls. Choose Super Hopper for harder challenges.
      </p>
      <PortalShell />
    </main>
  );
}
