"use client";
/* Simulation state and Three objects are mutable external systems, not React state. */
/* eslint-disable react-hooks/immutability */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Html, useGLTF, useAnimations } from "@react-three/drei";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { FRIEND_BY_ID } from "../worlds/friends";
import type { HeroKind, FriendId } from "../engine/types";
import { PortalGame } from "./model";
import { PortalInput } from "./input";
import { platformAt, type Platform } from "./worlds";
type V3 = [number, number, number];
type Props = {
  game: PortalGame;
  input: PortalInput;
  title: boolean;
  hero: HeroKind;
  quality: "high" | "low";
  onReady: (world: number) => void;
  onFailure: () => void;
  onPause: () => void;
};
const modelPath = (name: string) => `/game/models/${name}.glb`;
function Model({
  name,
  position = [0, 0, 0],
  scale = 1,
  rotation = [0, 0, 0],
}: {
  name: string;
  position?: V3;
  scale?: number | V3;
  rotation?: V3;
}) {
  const gltf = useGLTF(modelPath(name));
  const object = useMemo(() => {
    const root = clone(gltf.scene);
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return root;
  }, [gltf.scene]);
  return (
    <primitive
      object={object}
      position={position}
      scale={scale}
      rotation={rotation}
    />
  );
}
function Character({
  hero,
  game,
  title = false,
  position = [0, 0, 0],
  scale = 1,
}: {
  hero: HeroKind;
  game?: PortalGame;
  title?: boolean;
  position?: V3;
  scale?: number;
}) {
  const gltf = useGLTF(modelPath(hero));
  const root = useMemo(() => {
    const s = clone(gltf.scene);
    s.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.frustumCulled = false;
      }
    });
    return s;
  }, [gltf.scene]);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(gltf.animations, root);
  const current = useRef("");
  useFrame((state) => {
    const name =
      title || !game
        ? "Idle"
        : game.attack > 0
          ? "Bash"
          : !game.grounded
            ? "Jump"
            : Math.hypot(game.velocity.x, game.velocity.z) > 0.3
              ? "Run"
              : "Idle";
    if (name !== current.current) {
      actions[current.current]?.fadeOut(0.13);
      actions[name]?.reset().fadeIn(0.13).play();
      current.current = name;
    }
    if (group.current && game && !title) {
      group.current.position.set(
        game.position.x,
        game.position.y,
        game.position.z,
      );
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        group.current.rotation.y +
          Math.atan2(
            Math.sin(game.yaw - group.current.rotation.y),
            Math.cos(game.yaw - group.current.rotation.y),
          ),
        0.23,
      );
      group.current.visible =
        game.invulnerable <= 0 || Math.sin(state.clock.elapsedTime * 24) > -0.5;
      const small = game.active === "shrink" && game.powerTime > 0;
      group.current.scale.setScalar(small ? 0.48 : 1);
    }
  });
  return (
    <group ref={group} position={position} scale={scale}>
      <primitive object={root} />
    </group>
  );
}
function Ball({
  at,
  size,
  color,
  glow = 0,
}: {
  at: V3;
  size: V3;
  color: string;
  glow?: number;
}) {
  return (
    <mesh position={at} scale={size} castShadow>
      <sphereGeometry args={[1, 20, 14]} />
      <meshStandardMaterial
        color={color}
        roughness={0.45}
        emissive={color}
        emissiveIntensity={glow}
      />
    </mesh>
  );
}
function Star({
  at,
  color = "#ffdd62",
  size = 0.35,
}: {
  at: V3;
  color?: string;
  size?: number;
}) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 + Math.PI / 2,
        r = i % 2 ? 0.46 : 1;
      const x = Math.cos(a) * r,
        y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.09,
      bevelThickness: 0.08,
    });
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh position={at} scale={size} geometry={geometry} castShadow>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.25}
        metalness={0.28}
        roughness={0.27}
      />
    </mesh>
  );
}
function islandGeometry(w: number, d: number, depth: number) {
  const x = w / 2,
    z = d / 2,
    r = Math.min(w, d) * 0.29;
  const shape = new THREE.Shape();
  shape.moveTo(-x + r, -z);
  shape.lineTo(x - r, -z);
  shape.quadraticCurveTo(x, -z, x, -z + r);
  shape.lineTo(x, z - r);
  shape.quadraticCurveTo(x, z, x - r, z);
  shape.lineTo(-x + r, z);
  shape.quadraticCurveTo(-x, z, -x, z - r);
  shape.lineTo(-x, -z + r);
  shape.quadraticCurveTo(-x, -z, -x + r, -z);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.1,
    bevelThickness: 0.1,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}
function Island({ platform, game }: { platform: Platform; game?: PortalGame }) {
  const group = useRef<THREE.Group>(null);
  const w = platform.w,
    d = platform.d;
  const theme = game?.world.theme;
  const geometry = useMemo(() => islandGeometry(w, d, 1.5), [w, d]);
  const edge = useMemo(() => islandGeometry(w + 0.08, d + 0.08, 0.24), [w, d]);
  useEffect(
    () => () => {
      geometry.dispose();
      edge.dispose();
    },
    [geometry, edge],
  );
  useFrame(() => {
    if (group.current && game) {
      const at = platformAt(platform, game.speedTime);
      group.current.position.set(at.x, at.y, at.z);
    }
  });
  return (
    <group ref={group} position={[platform.x, platform.y, platform.z]}>
      <mesh
        position={[0, -0.18, 0]}
        geometry={geometry}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={theme?.earth ?? "#9270ba"}
          roughness={0.8}
        />
      </mesh>
      <mesh position={[0, -0.02, 0]} geometry={edge} castShadow receiveShadow>
        <meshStandardMaterial color={theme?.top ?? "#79e8ce"} roughness={0.7} />
      </mesh>
      <mesh position={[0, -2, 0]} scale={[w * 0.45, 1.8, d * 0.44]}>
        <sphereGeometry args={[1, 20, 10]} />
        <meshStandardMaterial
          color={theme?.earth ?? "#9270ba"}
          roughness={0.85}
        />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh
          key={`path-${i}`}
          position={[Math.sin(i * 1.8) * 0.4, 0.1, (i - 2) * d * 0.14]}
          rotation={[-Math.PI / 2, 0, i * 0.7]}
          scale={[0.6 + (i % 2) * 0.2, 0.34, 1]}
          receiveShadow
        >
          <circleGeometry args={[1, 16]} />
          <meshStandardMaterial
            color={
              game?.world.id === 8
                ? "#fff1ca"
                : game?.world.id === 1
                  ? "#b0e8dd"
                  : "#dfedb9"
            }
            roughness={0.8}
          />
        </mesh>
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <group
          key={`tuft-${i}`}
          position={[
            (i % 2 ? -1 : 1) * (w / 2 - 1.0),
            game?.world.id === 8 ? 0.17 : 0.1,
            (i / 9 - 0.5) * d * 0.67,
          ]}
        >
          {game?.world.id === 1 ? (
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.13, 0.17, 16]} />
              <meshStandardMaterial color="#90b9bc" metalness={0.4} />
            </mesh>
          ) : (
            <group rotation={[0, i * 2.4, 0]}>
              {[-1, 0, 1].map((j) => (
                <mesh
                  key={j}
                  position={[j * 0.08, 0.17, 0]}
                  rotation={[0, 0, j * 0.3]}
                  scale={[1, 1 + (i % 3) * 0.25, 1]}
                >
                  <coneGeometry args={[0.07, 0.4, 5]} />
                  <meshStandardMaterial
                    color={
                      game?.world.id === 8
                        ? "#fff1ae"
                        : game?.world.id === 9
                          ? "#93ede5"
                          : "#39b995"
                    }
                  />
                </mesh>
              ))}
            </group>
          )}
        </group>
      ))}
      {platform.spring && (
        <group position={[0, 0.08, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.1, 0.22, 12, 32]} />
            <meshStandardMaterial color="#ff6dae" roughness={0.4} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.94, 32]} />
            <meshStandardMaterial color="#fff09e" />
          </mesh>
          <Star at={[0, 0.1, 0]} size={0.4} />
        </group>
      )}
      {platform.moving && (
        <group position={[0, -0.6, d / 2 + 0.03]}>
          <Star at={[0, 0, 0]} size={0.25} color="#b4ffff" />
        </group>
      )}
    </group>
  );
}
function Portal({
  at,
  open = true,
  size = 1,
}: {
  at: V3;
  open?: boolean;
  size?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, opened: { value: 1 } },
        side: THREE.DoubleSide,
        transparent: true,
        vertexShader:
          "varying vec2 uvv;void main(){uvv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader:
          "varying vec2 uvv;uniform float time;uniform float opened;void main(){vec2 p=uvv-.5;float r=length(p)*2.;float a=atan(p.y,p.x);float wave=sin(r*23.-a*4.-time*2.)*.5+.5;vec3 c=mix(vec3(.19,.12,.51),vec3(.25,.94,.94),wave);c=mix(c,vec3(.9,.51,1.),pow(r,3.));c*=.4+opened*.7;gl_FragColor=vec4(c,(1.-smoothstep(.92,1.,r))*.93);}",
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    material.uniforms.time.value = clock.elapsedTime;
    material.uniforms.opened.value = open ? 1 : 0;
    if (group.current)
      group.current.rotation.z = Math.sin(clock.elapsedTime * 0.4) * 0.035;
  });
  return (
    <group position={at} scale={size}>
      <group ref={group}>
        <mesh castShadow>
          <torusGeometry args={[2, 0.22, 16, 64]} />
          <meshStandardMaterial
            color="#e4b8ff"
            metalness={0.3}
            roughness={0.25}
            emissive="#9c66d1"
            emissiveIntensity={0.2}
          />
        </mesh>
        <mesh position={[0, 0, 0.04]} material={material}>
          <circleGeometry args={[1.96, 64]} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => (
          <Star
            key={i}
            at={[
              Math.sin((i * Math.PI) / 4) * 2.03,
              Math.cos((i * Math.PI) / 4) * 2.03,
              0.18,
            ]}
            size={0.17}
            color={open ? "#ffed8b" : "#beadd8"}
          />
        ))}
        <mesh>
          <torusGeometry args={[2.28, 0.03, 8, 64]} />
          <meshBasicMaterial color="#b1ffff" transparent opacity={0.6} />
        </mesh>
      </group>
      <Ball at={[-1.8, -2, 0]} size={[0.6, 0.25, 0.65]} color="#c0a2ec" />
      <Ball at={[1.8, -2, 0]} size={[0.6, 0.25, 0.65]} color="#c0a2ec" />
    </group>
  );
}
function Flower({
  at,
  color = "#ffc36a",
  scale = 1,
}: {
  at: V3;
  color?: string;
  scale?: number;
}) {
  return (
    <group position={at} scale={scale}>
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 0.55, 6]} />
        <meshStandardMaterial color="#35b795" />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <Ball
          key={i}
          at={[
            Math.sin(i * 1.256) * 0.14,
            0.58 + Math.cos(i * 1.256) * 0.14,
            0,
          ]}
          size={[0.12, 0.13, 0.065]}
          color={color}
        />
      ))}
      <Ball at={[0, 0.58, -0.055]} size={[0.09, 0.09, 0.07]} color="#fff3b0" />
    </group>
  );
}
function SkyGradient({ sky, fog }: { sky: string; fog: string }) {
  const skyMesh = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    if (skyMesh.current) skyMesh.current.position.copy(camera.position);
  });
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          sky: { value: new THREE.Color(sky) },
          horizon: { value: new THREE.Color(fog) },
        },
        vertexShader:
          "varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader:
          "varying vec3 v;uniform vec3 sky;uniform vec3 horizon;void main(){float t=smoothstep(-.2,.65,normalize(v).y);gl_FragColor=vec4(mix(horizon,sky,t),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
      }),
    [sky, fog],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh ref={skyMesh} renderOrder={-1} material={material}>
      <sphereGeometry args={[120, 24, 16]} />
    </mesh>
  );
}
function Background({ game, title }: { game: PortalGame; title: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    if (light.current && !title) {
      const p = game.position;
      light.current.position.set(p.x + 16, p.y + 28, p.z + 12);
      light.current.target.position.set(p.x, p.y, p.z);
      light.current.target.updateMatrixWorld();
    }
  });
  const theme = game.world.theme;
  const stars = useMemo(() => {
    const a = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      a[i * 3] = Math.sin(i * 12.3) * 90;
      a[i * 3 + 1] = 9 + ((i * 7.3) % 45);
      a[i * 3 + 2] = -110 + Math.cos(i * 8.7) * 80;
    }
    return a;
  }, []);
  return (
    <>
      <color attach="background" args={[theme.sky]} />
      <SkyGradient sky={theme.sky} fog={theme.fog} />
      <fog attach="fog" args={[theme.fog, 35, 115]} />
      <hemisphereLight
        args={["#ffe8fd", "#6263ae", game.world.id === 9 ? 0.8 : 2.4]}
      />
      <ambientLight intensity={0.5} />
      <directionalLight
        ref={light}
        position={[16, 28, 12]}
        color="#fff0cf"
        intensity={3.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-bias={-0.001}
      />
      <directionalLight
        position={[-16, 12, -8]}
        color="#c6ceff"
        intensity={1.8}
      />
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#fff3c6"
          size={0.17}
          transparent
          opacity={0.8}
          sizeAttenuation
        />
      </points>
      {Array.from({ length: title ? 7 : 12 }, (_, i) => (
        <Model
          key={i}
          name="cloud"
          position={[
            (i % 2 ? -1 : 1) * (20 + (i % 4) * 7),
            5 + (i % 3) * 7,
            12 - i * 11,
          ]}
          scale={2 + (i % 3) * 0.7}
        />
      ))}
      {!title &&
        Array.from({ length: 9 }, (_, i) => (
          <group
            key={i}
            position={[
              (i % 2 ? 1 : -1) * (25 + (i % 3) * 8),
              -4 + (i % 3) * 3,
              4 - i * 12,
            ]}
            scale={1.5 + (i % 3) * 0.5}
          >
            <Ball at={[0, -2, 0]} size={[5, 3, 4]} color={theme.earth} />
            <Ball at={[0, 0, 0]} size={[5, 0.55, 4]} color={theme.top} />
            <Model name={theme.prop} position={[0, 0.2, 0]} scale={1.4} />
          </group>
        ))}
      {game.world.id === 2 && (
        <Ball at={[-19, 23, -60]} size={[5, 5, 5]} color="#fff1b3" glow={0.4} />
      )}
      {game.world.id === 9 &&
        !title &&
        Array.from({ length: 7 }, (_, i) => (
          <group
            key={`inverted-${i}`}
            position={[(i % 2 ? 1 : -1) * 12, 11, 5 - i * 14]}
            rotation={[0, 0, Math.PI]}
          >
            <Model name="tree" scale={1.2} />
            <Model name="crystal" position={[2, 0, 0]} scale={1.4} />
          </group>
        ))}
      {game.world.id === 4 && !title && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.7, -36]}>
          <planeGeometry args={[36, 107, 1, 1]} />
          <meshStandardMaterial
            color="#36c8e7"
            transparent
            opacity={0.7}
            metalness={0.4}
            roughness={0.19}
          />
        </mesh>
      )}
    </>
  );
}
function TitleWorld({ hero }: { hero: HeroKind }) {
  const { camera } = useThree();
  const cubo = useRef<THREE.Group>(null);
  useFrame(({ clock, size }) => {
    const phone = size.width < 700;
    camera.position.set(phone ? 8 : 10, phone ? 7 : 7.5, phone ? 16 : 19);
    camera.lookAt(phone ? 3 : -1.7, phone ? -2.4 : 2.2, 0);
    if (cubo.current)
      cubo.current.position.y = 1.5 + Math.sin(clock.elapsedTime * 2) * 0.2;
  });
  return (
    <>
      <Island
        platform={{ id: "title", x: 3, y: 0, z: 0, w: 15, d: 11, phase: 0 }}
      />
      <Portal at={[2.2, 3.2, -3]} size={1.45} />
      <Character hero={hero} title position={[3.6, 0, 2.3]} scale={1.55} />
      <group ref={cubo} position={[6.2, 1.5, 2]} rotation={[0, -0.3, 0]}>
        <Model name="cubo" scale={1.05} />
      </group>
      <Model name="tree" position={[8, 0, -1.6]} scale={1.1} />
      <Model name="mushroom" position={[-2, 0, 1.7]} scale={1.4} />
      <Model name="candy" position={[7, 0, -3.7]} scale={0.9} />
      <Model name="crystal" position={[6.4, 0, 3.1]} scale={0.65} />
      <Model
        name="gear"
        position={[-1, 0.4, -1]}
        rotation={[Math.PI / 2, 0.3, 0]}
        scale={1.2}
      />
      {Array.from({ length: 16 }, (_, i) => (
        <Flower
          key={i}
          at={[-3 + ((i * 1.37) % 13), 0.05, 3.9 + Math.sin(i * 2) * 0.8]}
          color={i % 2 ? "#fff18d" : "#ff8fd4"}
          scale={0.7 + (i % 3) * 0.2}
        />
      ))}
      <Star at={[1.1, 4, 1.2]} size={0.5} />
      <Star at={[6.8, 4, -0.3]} size={0.35} />
      <Billboard position={[3, -2.6, 3]}>
        <Html center transform distanceFactor={12}>
          <span className="ph-world-stamp">
            10 worlds. 15 friends. One big adventure.
          </span>
        </Html>
      </Billboard>
    </>
  );
}
function Friend({ id }: { id: FriendId }) {
  const f = FRIEND_BY_ID[id];
  const bird = ["zippy", "magnus", "frosty"].includes(id);
  const wings = ["flutter", "lumen", "skye"].includes(id);
  const ears = ["bolt", "bam", "pixel", "dash", "tock"].includes(id);
  return (
    <group>
      <Ball at={[0, 0.55, 0]} size={[0.36, 0.43, 0.28]} color={f.color} />
      <Ball at={[0, 0.95, 0.03]} size={[0.38, 0.32, 0.3]} color={f.color} />
      <Ball at={[0, 0.51, 0.24]} size={[0.25, 0.28, 0.07]} color="#fff4d6" />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Ball
            at={[s * 0.14, 1.0, 0.3]}
            size={[0.1, 0.12, 0.06]}
            color="#ffffff"
          />
          <Ball
            at={[s * 0.14, 1.0, 0.35]}
            size={[0.045, 0.07, 0.03]}
            color="#31204c"
          />
          <Ball
            at={[s * 0.19, 0.16, 0.1]}
            size={[0.16, 0.12, 0.23]}
            color={bird ? "#ffc462" : f.color}
          />
          {ears && (
            <Ball
              at={[s * 0.24, 1.26, 0]}
              size={[0.11, id === "bolt" || id === "bam" ? 0.35 : 0.16, 0.1]}
              color={f.color}
            />
          )}
          {(bird || wings) && (
            <group rotation={[0, 0, s * 0.32]}>
              <Ball
                at={[s * 0.44, 0.72, 0]}
                size={[wings ? 0.42 : 0.2, 0.23, 0.09]}
                color={wings ? "#ffd2f1" : f.color}
              />
            </group>
          )}
          {id === "bubbles" && (
            <Ball
              at={[s * 0.4, 0.65, 0]}
              size={[0.13, 0.2, 0.08]}
              color="#ffae62"
            />
          )}
        </group>
      ))}
      {bird ? (
        <mesh position={[0, 0.91, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.09, 0.25, 12]} />
          <meshStandardMaterial color="#ffbb54" />
        </mesh>
      ) : (
        <Ball at={[0, 0.88, 0.34]} size={[0.06, 0.04, 0.035]} color="#51305b" />
      )}
      {id === "shelly" && (
        <Ball at={[0, 0.55, -0.2]} size={[0.42, 0.43, 0.26]} color="#2a967f" />
      )}
      {id === "gecko" && (
        <Ball at={[0.32, 0.35, -0.12]} size={[0.5, 0.1, 0.1]} color={f.color} />
      )}
    </group>
  );
}
function Cages({ game }: { game: PortalGame }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    game.world.cages.forEach((c, i) => {
      const g = groups.current[i];
      if (g) g.visible = !game.saveData.rescued.includes(c.friend);
    });
  });
  return (
    <>
      {game.world.cages.map((c, i) => (
        <group
          key={c.friend}
          ref={(o) => {
            groups.current[i] = o;
          }}
          position={[c.x, c.y, c.z]}
        >
          <group scale={1.1}>
            <Friend id={c.friend} />
          </group>
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[1, 1.1, 0.18, 32]} />
            <meshStandardMaterial
              color="#a899da"
              metalness={0.4}
              roughness={0.3}
            />
          </mesh>
          {Array.from({ length: 10 }, (_, j) => (
            <mesh
              key={j}
              position={[
                Math.sin(j * 0.628) * 0.94,
                1.05,
                Math.cos(j * 0.628) * 0.94,
              ]}
            >
              <cylinderGeometry args={[0.035, 0.035, 1.9, 8]} />
              <meshStandardMaterial
                color="#e5d3ff"
                metalness={0.7}
                roughness={0.25}
              />
            </mesh>
          ))}
          <mesh position={[0, 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.95, 0.06, 8, 32]} />
            <meshStandardMaterial color="#ffda71" metalness={0.5} />
          </mesh>
          <Ball at={[0, 2.08, 0]} size={[0.98, 0.25, 0.98]} color="#b193e8" />
          <Billboard position={[0, 2.9, 0]}>
            <Html center distanceFactor={17}>
              <div className="ph-label">
                {FRIEND_BY_ID[c.friend].name}
                <small>3 bashes to freedom!</small>
              </div>
            </Html>
          </Billboard>
        </group>
      ))}
    </>
  );
}
function Collectibles({ game }: { game: PortalGame }) {
  const coins = useRef<(THREE.Group | null)[]>([]);
  const stars = useRef<(THREE.Group | null)[]>([]);
  const orb = useRef<THREE.Group>(null);
  useFrame(() => {
    coins.current.forEach((m, i) => {
      if (!m) return;
      const c = game.world.coins[i];
      m.visible = !game.collected.has(c.id);
      m.rotation.y = game.time * 2;
      m.position.y = c.y + Math.sin(game.time * 3 + i) * 0.13;
    });
    stars.current.forEach((m, i) => {
      if (!m) return;
      m.visible = !game.saveData.stars.includes(game.world.stars[i].id);
      m.rotation.y = game.time;
      m.position.y = game.world.stars[i].y + Math.sin(game.time * 2) * 0.2;
    });
    if (orb.current) {
      orb.current.rotation.y = game.time;
      orb.current.position.y =
        game.world.orb.y + Math.sin(game.time * 2) * 0.15;
    }
  });
  return (
    <>
      {game.world.coins.map((c, i) => (
        <group
          ref={(g) => {
            coins.current[i] = g;
          }}
          key={c.id}
          position={[c.x, c.y, c.z]}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.25, 0.25, 0.09, 20]} />
            <meshStandardMaterial
              color="#ffd656"
              metalness={0.65}
              roughness={0.25}
              emissive="#ffb329"
              emissiveIntensity={0.15}
            />
          </mesh>
          <Star at={[0, 0, 0.065]} size={0.125} color="#fff4af" />
        </group>
      ))}
      {game.world.stars.map((s, i) => (
        <group
          key={s.id}
          position={[s.x, s.y, s.z]}
          ref={(g) => {
            stars.current[i] = g;
          }}
        >
          <Star at={[0, 0, 0]} size={0.55} />
        </group>
      ))}
      <group
        position={[game.world.orb.x, game.world.orb.y, game.world.orb.z]}
        ref={orb}
      >
        <Ball
          at={[0, 0, 0]}
          size={[0.64, 0.64, 0.64]}
          color={game.orbHits === 3 ? "#91ffe6" : "#ffcb71"}
          glow={0.6}
        />
        <mesh rotation={[0.7, 0, 0.3]}>
          <torusGeometry args={[0.92, 0.055, 10, 40]} />
          <meshStandardMaterial
            color="#fff9bd"
            emissive="#fff9bd"
            emissiveIntensity={1}
          />
        </mesh>
        <Star at={[0, 0, 0.65]} size={0.26} />
      </group>
      <Billboard
        position={[game.world.orb.x, game.world.orb.y + 1.7, game.world.orb.z]}
      >
        <Html center distanceFactor={17}>
          <div className="ph-label">
            PORTAL ORB<small>Bash × 3</small>
          </div>
        </Html>
      </Billboard>
    </>
  );
}
function Enemies({ game }: { game: PortalGame }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    game.world.enemies.forEach((e, i) => {
      const g = groups.current[i];
      if (!g) return;
      g.visible = e.hp > 0;
      g.position.set(e.x, e.y + 0.5 + Math.sin(game.time * 5 + i) * 0.05, e.z);
      g.rotation.y = Math.atan2(game.position.x - e.x, game.position.z - e.z);
      g.scale.y = e.phase === "warn" ? 1 + Math.sin(game.time * 25) * 0.08 : 1;
      const warn = g.getObjectByName("warning");
      if (warn) warn.visible = e.phase === "warn";
    });
  });
  return (
    <>
      {game.world.enemies.map((e, i) => (
        <group
          key={e.id}
          ref={(g) => {
            groups.current[i] = g;
          }}
        >
          <Ball
            at={[0, 0, 0]}
            size={[0.62, 0.5, 0.52]}
            color={game.world.id === 8 ? "#f488bc" : "#ad8adf"}
          />
          <Ball at={[0, 0.05, 0.4]} size={[0.46, 0.3, 0.1]} color="#e5d3ff" />
          {[-1, 1].map((s) => (
            <group key={s}>
              <Ball
                at={[s * 0.19, 0.12, 0.49]}
                size={[0.12, 0.14, 0.05]}
                color="#fff7d8"
              />
              <Ball
                at={[s * 0.19, 0.12, 0.535]}
                size={[0.048, 0.075, 0.02]}
                color="#372355"
              />
              <Ball
                at={[s * 0.39, -0.4, 0]}
                size={[0.22, 0.12, 0.33]}
                color="#7c69b5"
              />
            </group>
          ))}
          <Model
            name="gear"
            scale={0.2}
            position={[0, 0.55, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <mesh
            name="warning"
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.45, 0]}
          >
            <ringGeometry args={[0.8, 1.15, 32]} />
            <meshBasicMaterial color="#ffd24f" transparent opacity={0.7} />
          </mesh>
        </group>
      ))}
    </>
  );
}
function Boss({ game }: { game: PortalGame }) {
  const group = useRef<THREE.Group>(null);
  const wave = useRef<THREE.Mesh>(null);
  const center = game.world.platforms[12];
  useFrame(() => {
    if (group.current) {
      group.current.visible = game.bossHP > 0;
      group.current.position.y = center.y + Math.sin(game.time * 2) * 0.08;
      group.current.rotation.y = Math.atan2(
        game.position.x - center.x,
        game.position.z - center.z,
      );
      group.current.rotation.z =
        game.bossPhase === "rest" ? Math.sin(game.time * 4) * 0.08 : 0;
    }
    if (wave.current) {
      wave.current.visible = game.bossPhase === "wave" && game.bossHP > 0;
      wave.current.scale.setScalar(Math.max(0.01, game.waveRadius));
    }
  });
  if (!game.world.boss) return null;
  const clank = game.world.boss === "clank",
    sultan = game.world.boss === "sultan";
  return (
    <>
      <group
        ref={group}
        position={[center.x, center.y, center.z + 1]}
        scale={1.4}
      >
        <Ball
          at={[0, 1, 0]}
          size={[0.85, 0.9, 0.65]}
          color={sultan ? "#f384b8" : clank ? "#62bbc2" : "#9776d0"}
        />
        <Ball
          at={[0, 2, 0]}
          size={[0.8, 0.66, 0.65]}
          color={sultan ? "#ffc17f" : clank ? "#dfcba7" : "#b7a2e8"}
        />
        {[-1, 1].map((s) => (
          <group key={s}>
            <Ball
              at={[s * 0.3, 2.12, 0.56]}
              size={[0.21, 0.23, 0.1]}
              color="#fff7db"
            />
            <Ball
              at={[s * 0.3, 2.12, 0.64]}
              size={[0.085, 0.12, 0.035]}
              color="#3b275e"
            />
            <Ball
              at={[s * 0.88, 1.1, 0]}
              size={[0.25, 0.52, 0.29]}
              color={clank ? "#8b6da7" : "#f09bbe"}
            />
            <Ball
              at={[s * 0.45, 0.22, 0.1]}
              size={[0.39, 0.25, 0.48]}
              color="#61517f"
            />
          </group>
        ))}
        <mesh position={[0, 2.78, 0]}>
          <cylinderGeometry args={[0.8, 0.65, 0.38, 32]} />
          <meshStandardMaterial
            color={sultan ? "#ffdf76" : "#8371b4"}
            metalness={0.2}
          />
        </mesh>
        {[-1, 0, 1].map((s) => (
          <Star key={s} at={[s * 0.55, 3.06, 0.1]} size={0.21} />
        ))}
        {clank && (
          <Model
            name="gear"
            position={[0, 1.2, 0.66]}
            scale={0.4}
            rotation={[Math.PI / 2, 0, 0]}
          />
        )}
        <Billboard position={[0, 3.9, 0]}>
          <Html center distanceFactor={18}>
            <div className="ph-label">
              {clank
                ? "CAPTAIN CLANK"
                : sultan
                  ? "SUGAR SULTAN"
                  : "THE WHISTLER"}
            </div>
          </Html>
        </Billboard>
      </group>
      <mesh
        ref={wave}
        position={[center.x, center.y + 0.18, center.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.92, 1, 64]} />
        <meshBasicMaterial
          color="#fff283"
          side={THREE.DoubleSide}
          transparent
          opacity={0.9}
        />
      </mesh>
    </>
  );
}
function World({ game }: { game: PortalGame }) {
  const world = game.world;
  const hazards = useRef<(THREE.Group | null)[]>([]);
  const pillar = useRef<THREE.Group>(null);
  useFrame(() => {
    hazards.current.forEach((g, i) => {
      if (!g) return;
      const live = Math.sin(game.speedTime * 2 + world.hazards[i].phase) > 0.25;
      g.scale.y = live ? 1 : 0.12;
    });
    if (pillar.current) {
      pillar.current.visible = !!game.pillar;
      if (game.pillar)
        pillar.current.position.set(
          game.pillar.x,
          game.pillar.y,
          game.pillar.z,
        );
    }
  });
  return (
    <>
      {world.platforms.map((p) => (
        <Island key={p.id} platform={p} game={game} />
      ))}
      {world.platforms
        .filter((_, i) => i % 2 === 0)
        .map((p, i) => (
          <group key={p.id}>
            <Model
              name={world.theme.prop}
              position={[p.x + p.w / 2 + 1.6, p.y - 1, p.z - 1]}
              scale={
                world.theme.prop === "gear"
                  ? 1.8
                  : world.theme.prop === "crystal"
                    ? 1.7
                    : 1.1
              }
              rotation={
                world.theme.prop === "gear"
                  ? [Math.PI / 2, 0, i * 0.3]
                  : [0, i, 0]
              }
            />
            {world.id !== 3 && (
              <Model
                name={
                  world.id === 8 ? "candy" : world.id === 4 ? "coral" : "tree"
                }
                position={[p.x - p.w / 2 - 2, p.y - 1.2, p.z - 2]}
                scale={world.id === 4 ? 1.4 : 0.75}
              />
            )}
            {[0, 1, 2].map((j) => (
              <Flower
                key={j}
                at={[p.x - 1.3 + j * 0.8, p.y + 0.02, p.z + p.d / 2 - 0.5]}
                color={world.theme.accent}
                scale={0.7}
              />
            ))}
          </group>
        ))}
      {world.id === 1 &&
        [0, 2, 4].map((i) => (
          <group
            key={i}
            position={[-11, world.platforms[i].y - 1, 8 - i * 7.2]}
          >
            <mesh position={[0, 2, 0]} castShadow>
              <cylinderGeometry args={[2, 2.3, 4, 32]} />
              <meshStandardMaterial color="#77c8ce" />
            </mesh>
            <mesh position={[0, 4.2, 0]} castShadow>
              <coneGeometry args={[2.6, 1.4, 32]} />
              <meshStandardMaterial color="#b594ea" />
            </mesh>
            <Model
              name="gear"
              position={[0, 2.4, 2.05]}
              scale={0.65}
              rotation={[Math.PI / 2, 0, 0]}
            />
            <Ball at={[0.4, 5.1, 0.2]} size={[0.2, 0.2, 0.2]} color="#ffe18f" />
          </group>
        ))}
      {world.pipes.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]}>
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.85, 0.85, 0.9, 32]} />
            <meshStandardMaterial color="#5acfac" metalness={0.3} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.95, 0]}>
            <torusGeometry args={[0.78, 0.17, 12, 32]} />
            <meshStandardMaterial color="#83ffe0" />
          </mesh>
          <Billboard position={[0, 2.5, 0]}>
            <Html center distanceFactor={17}>
              <div className="ph-label">
                PIPE EXPRESS<small>E to hop inside</small>
              </div>
            </Html>
          </Billboard>
        </group>
      ))}
      <Portal
        at={[world.portal.x, world.portal.y + 2.2, world.portal.z]}
        open={game.portalOpen}
      />
      <Billboard
        position={[world.portal.x, world.portal.y + 5.1, world.portal.z]}
      >
        <Html center distanceFactor={17}>
          <div className="ph-label">
            {game.portalOpen ? "HOP TO THE NEXT WORLD" : "WAKE THE PORTAL"}
            <small>
              {game.portalOpen
                ? "E to travel"
                : "Rescue friends + bash the orb"}
            </small>
          </div>
        </Html>
      </Billboard>
      <group
        position={[world.checkpoint.x, world.checkpoint.y, world.checkpoint.z]}
      >
        <mesh position={[2.2, 1.2, -1]}>
          <cylinderGeometry args={[0.035, 0.035, 2.4, 8]} />
          <meshStandardMaterial color="#fff2c2" />
        </mesh>
        <Star
          at={[2.2, 2.45, -1]}
          size={0.36}
          color={game.saveData.checkpoint ? "#7bffe2" : "#ffe08b"}
        />
      </group>
      {world.hazards.map((h, i) => (
        <group
          key={i}
          ref={(g) => {
            hazards.current[i] = g;
          }}
          position={[h.x, h.y, h.z]}
        >
          <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.7, 0.16, 12, 32]} />
            <meshStandardMaterial color="#ff9296" />
          </mesh>
          <Ball
            at={[0, 0.55, 0]}
            size={[0.45, 0.6, 0.45]}
            color="#ffe29b"
            glow={0.6}
          />
        </group>
      ))}
      <group ref={pillar}>
        <mesh position={[0, 1, 0]}>
          <cylinderGeometry args={[0.45, 0.65, 2, 24]} />
          <meshStandardMaterial color="#85e9ff" transparent opacity={0.6} />
        </mesh>
      </group>
      <Cages game={game} />
      <Collectibles game={game} />
      <Enemies game={game} />
      <Boss game={game} />
    </>
  );
}
function Effects({ game }: { game: PortalGame }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useRef<THREE.InstancedMesh>(null);
  useFrame(() => {
    const mesh = particles.current;
    if (!mesh) return;
    let count = 0;
    for (const e of game.effects) {
      for (let j = 0; j < 12; j++) {
        const a = j * 2.4;
        dummy.position.set(
          e.x + Math.sin(a) * e.age * 2,
          e.y + 1 + Math.sin(e.age * Math.PI) * 1.8 + (j % 3) * 0.13,
          e.z + Math.cos(a) * e.age * 2,
        );
        dummy.scale.setScalar((1 - e.age / 1.3) * 0.1);
        dummy.rotation.set(a, e.age * 4, a);
        dummy.updateMatrix();
        mesh.setMatrixAt(count, dummy.matrix);
        mesh.setColorAt(
          count,
          new THREE.Color(
            e.kind === "hurt" ? "#ff96b0" : j % 2 ? "#fff4b3" : "#a7fff0",
          ),
        );
        count++;
        if (count >= 240) break;
      }
      if (count >= 240) break;
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    meshes.current.forEach((m, i) => {
      if (!m) return;
      m.position.y = 0.8 + Math.sin(game.time * 2 + i) * 0.4;
    });
  });
  return (
    <instancedMesh
      ref={particles}
      args={[undefined, undefined, 240]}
      frustumCulled={false}
    >
      <octahedronGeometry args={[1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
function PlayWorld({
  game,
  input,
  onPause,
}: {
  game: PortalGame;
  input: PortalInput;
  onPause: () => void;
}) {
  const { camera } = useThree();
  const cubo = useRef<THREE.Group>(null);
  const glow = useRef<THREE.PointLight>(null);
  const bubble = useRef<THREE.Mesh>(null);
  const position = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const initialized = useRef(false);
  useFrame((_, delta) => {
    if (!game.paused) {
      let remaining = Math.min(delta, 0.1);
      const controls = input.poll(game, remaining, onPause);
      while (remaining > 0) {
        const dt = Math.min(remaining, 1 / 60);
        game.tick(dt, controls);
        controls.jump = false;
        controls.bash = false;
        controls.power = false;
        controls.interact = false;
        controls.cycle = false;
        controls.boost = false;
        remaining -= dt;
      }
    }
    const p = game.position;
    const distance = 10.5;
    position.set(
      p.x + Math.sin(game.cameraYaw) * distance * Math.cos(game.cameraPitch),
      p.y + 2 + Math.sin(game.cameraPitch) * distance,
      p.z + Math.cos(game.cameraYaw) * distance * Math.cos(game.cameraPitch),
    );
    if (!initialized.current) {
      camera.position.copy(position);
      initialized.current = true;
    } else
      camera.position.lerp(position, 1 - Math.exp(-Math.min(delta, 0.1) * 8));
    target.set(p.x, p.y + 1, p.z - 1.1);
    camera.lookAt(target);
    if (cubo.current) {
      cubo.current.visible = game.hasCubo;
      cubo.current.position.set(
        game.cubo.x,
        game.cubo.y + Math.sin(game.time * 3) * 0.13,
        game.cubo.z,
      );
      cubo.current.rotation.y = game.yaw;
    }
    if (glow.current) {
      glow.current.position.set(p.x, p.y + 2, p.z);
      glow.current.intensity = game.has("glow")
        ? 9
        : game.world.id === 9
          ? 4
          : 0;
    }
    if (bubble.current) {
      bubble.current.visible = game.powerTime > 0 && game.active === "bubble";
      bubble.current.position.set(p.x, p.y + 1, p.z);
    }
  });
  return (
    <>
      <World game={game} />
      <Character hero={game.saveData.hero} game={game} />
      <pointLight ref={glow} color="#fff0a8" distance={12} decay={1.4} />
      <group ref={cubo}>
        <Model name="cubo" scale={0.65} />
      </group>
      <mesh ref={bubble}>
        <sphereGeometry args={[1.5, 24, 16]} />
        <meshStandardMaterial
          color="#9de7ff"
          transparent
          opacity={0.25}
          metalness={0.2}
          roughness={0.1}
        />
      </mesh>
      <Effects game={game} />
    </>
  );
}
function ContextGuard({ onFailure }: { onFailure: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onFailure();
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl, onFailure]);
  return null;
}
function AssetsReady() {
  useGLTF(modelPath("frog"));
  useGLTF(modelPath("fox"));
  useGLTF(modelPath("cat"));
  useGLTF(modelPath("cubo"));
  useGLTF(modelPath("tree"));
  useGLTF(modelPath("mushroom"));
  useGLTF(modelPath("candy"));
  useGLTF(modelPath("coral"));
  useGLTF(modelPath("crystal"));
  useGLTF(modelPath("gear"));
  useGLTF(modelPath("cloud"));
  return null;
}
function Ready({
  onReady,
  world,
}: {
  onReady: (world: number) => void;
  world: number;
}) {
  const observed = useRef({ world: 0, frames: 0 });
  useFrame(() => {
    if (observed.current.world !== world)
      observed.current = { world, frames: 0 };
    if (observed.current.frames < 3) {
      observed.current.frames++;
      if (observed.current.frames === 3) onReady(world);
    }
  });
  return null;
}
for (const asset of [
  "frog",
  "fox",
  "cat",
  "cubo",
  "tree",
  "mushroom",
  "candy",
  "coral",
  "crystal",
  "gear",
  "cloud",
])
  useGLTF.preload(modelPath(asset));
export default function Scene(props: Props) {
  return (
    <Canvas
      shadows={props.quality === "high"}
      dpr={[1, props.quality === "high" ? 1.5 : 1]}
      camera={{ position: [10, 7, 19], fov: 48, near: 0.1, far: 180 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <ContextGuard onFailure={props.onFailure} />
      <Suspense fallback={null}>
        <AssetsReady />
        <Background game={props.game} title={props.title} />
        {props.title ? (
          <TitleWorld hero={props.hero} />
        ) : (
          <PlayWorld
            key={props.game.worldVersion}
            game={props.game}
            input={props.input}
            onPause={props.onPause}
          />
        )}
        <Ready onReady={props.onReady} world={props.game.world.id} />
      </Suspense>
    </Canvas>
  );
}
