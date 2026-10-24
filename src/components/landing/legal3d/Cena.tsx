import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  PerformanceMonitor,
  RoundedBox,
  Sparkles,
  Text,
} from "@react-three/drei";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";

import { geometriaFolha, gerarArvore } from "./arvore3d";

const FONTE = "/fonts/IBMPlexMono-SemiBold.ttf";
const RAIO = 2.5;
const PASSO = (Math.PI * 2) / 5.2; // ângulo entre cartões na hélice
const QUEDA = 0.95; // quanto cada cartão fica abaixo do anterior

export type Progresso = { atual: number };

/** Material da árvore: metal dourado iridescente (a "espinha" do Active Theory, em ouro) que só mostra o que já nasceu. */
function useMaterialArvore(cresce: React.RefObject<{ value: number }>) {
  return useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#e9b463"),
      metalness: 0.82,
      roughness: 0.26,
      emissive: new THREE.Color("#3a2208"),
      emissiveIntensity: 0.35,
      iridescence: 1,
      iridescenceIOR: 1.7,
      iridescenceThicknessRange: [180, 620],
      clearcoat: 1,
      clearcoatRoughness: 0.18,
      envMapIntensity: 2.2,
    });
    m.onBeforeCompile = (sh) => {
      sh.uniforms["uCresce"] = cresce.current!;
      sh.vertexShader = sh.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute float aNasce;\nvarying float vNasce;",
        )
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvNasce = aNasce;");
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float uCresce;\nvarying float vNasce;",
        )
        .replace(
          "#include <dithering_fragment>",
          // a ponta que está nascendo brilha (seiva quente)
          "#include <dithering_fragment>\nfloat ponta = 1.0 - smoothstep(0.0, 0.025, uCresce - vNasce);\ngl_FragColor.rgb += vec3(1.0, 0.62, 0.25) * ponta * 1.6;",
        )
        .replace("void main() {", "void main() {\nif (vNasce > uCresce) discard;");
    };
    return m;
  }, [cresce]);
}

function Arvore({ progresso }: { progresso: Progresso }) {
  const { geometria, folhas } = useMemo(() => gerarArvore(), []);
  const cresce = useRef({ value: 0 });
  const material = useMaterialArvore(cresce);
  const folhaGeo = useMemo(() => geometriaFolha(), []);
  const folhasRef = useRef<THREE.InstancedMesh>(null);
  const grupo = useRef<THREE.Group>(null);
  const aux = useMemo(() => new THREE.Object3D(), []);
  const ultimo = useRef(-1);

  useFrame((estado, dt) => {
    const alvo = 0.1 + progresso.atual * 0.9;
    cresce.current.value += (alvo - cresce.current.value) * Math.min(1, dt * 4);
    if (grupo.current) grupo.current.rotation.y += dt * 0.06;
    const c = cresce.current.value;
    if (folhasRef.current && Math.abs(c - ultimo.current) > 0.002) {
      ultimo.current = c;
      folhas.forEach((f, i) => {
        const k = THREE.MathUtils.clamp((c - f.nasce) / 0.04, 0, 1);
        const s = f.escala * (k * k * (3 - 2 * k));
        aux.position.copy(f.pos);
        aux.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), f.dir);
        aux.rotateY(i * 1.7);
        aux.scale.setScalar(Math.max(s, 0.0001));
        aux.updateMatrix();
        folhasRef.current!.setMatrixAt(i, aux.matrix);
      });
      folhasRef.current.instanceMatrix.needsUpdate = true;
    }
    void estado;
  });

  return (
    <group ref={grupo} position={[0, 0.4, 0]}>
      <mesh geometry={geometria} material={material} />
      <instancedMesh ref={folhasRef} args={[folhaGeo, undefined, folhas.length]}>
        <meshPhysicalMaterial
          color="#a8c26a"
          metalness={0.35}
          roughness={0.3}
          iridescence={0.8}
          iridescenceIOR={1.5}
          sheen={1}
          sheenColor="#f6d27a"
          side={THREE.DoubleSide}
          envMapIntensity={1.2}
        />
      </instancedMesh>
    </group>
  );
}

function Cartoes({ titulos, progresso }: { titulos: string[]; progresso: Progresso }) {
  const grupo = useRef<THREE.Group>(null);
  const cartoes = useRef<(THREE.Group | null)[]>([]);
  const a = useRef(0);
  const n = titulos.length;
  useFrame((_, dt) => {
    const alvo = progresso.atual * (n - 1);
    a.current += (alvo - a.current) * Math.min(1, dt * 5);
    if (!grupo.current) return;
    grupo.current.rotation.y = -a.current * PASSO;
    grupo.current.position.y = a.current * QUEDA;
    cartoes.current.forEach((c, i) => {
      if (!c) return;
      const d = Math.abs(i - a.current);
      const s = 1 - Math.min(0.25, d * 0.12);
      c.scale.setScalar(s);
      // os cartões longe da frente somem aos poucos (só a seção da frente e as vizinhas ficam nítidas)
      const op = THREE.MathUtils.clamp(1.6 - d * 0.55, 0, 1);
      c.visible = op > 0.02;
      c.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (!m) return;
        m.transparent = true;
        m.opacity = op;
      });
    });
  });
  return (
    <group ref={grupo}>
      {titulos.map((t, i) => {
        const ang = i * PASSO;
        return (
          <group
            key={t}
            ref={(el) => {
              cartoes.current[i] = el;
            }}
            position={[Math.sin(ang) * RAIO, -i * QUEDA + 0.3, Math.cos(ang) * RAIO]}
            rotation={[0, ang, 0]}
          >
            {/* placa de vidro de verdade (refração e espessura), como as do Active Theory */}
            <RoundedBox args={[2.5, 1.45, 0.07]} radius={0.09} smoothness={5}>
              <meshPhysicalMaterial
                transmission={1}
                thickness={0.35}
                roughness={0.08}
                ior={1.5}
                color="#f4fbf6"
                attenuationColor="#9fd4b4"
                attenuationDistance={6}
                emissive="#173f2c"
                emissiveIntensity={0.18}
                iridescence={0.6}
                iridescenceIOR={1.3}
                specularIntensity={1}
                clearcoat={1}
                clearcoatRoughness={0.1}
                envMapIntensity={1.3}
              />
            </RoundedBox>
            <Text
              font={FONTE}
              fontSize={0.085}
              letterSpacing={0.18}
              color="#f2d39b"
              anchorX="left"
              anchorY="top"
              position={[-1.08, 0.56, 0.05]}
            >
              {`${String(i + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}  ->`}
            </Text>
            <Text
              font={FONTE}
              fontSize={0.2}
              maxWidth={2.1}
              lineHeight={1.12}
              letterSpacing={0.02}
              color="#fff7e8"
              anchorX="left"
              anchorY="bottom"
              position={[-1.08, -0.5, 0.05]}
            >
              {t.toUpperCase()}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

function Camera() {
  useFrame((estado, dt) => {
    const { camera, size, pointer } = estado;
    const cam = camera as THREE.PerspectiveCamera;
    // desloca a imagem para a direita (o painel de leitura em HTML ocupa a esquerda), sem mudar a perspectiva
    if (cam.view?.offsetX !== -size.width * 0.19)
      cam.setViewOffset(size.width, size.height, -size.width * 0.19, 0, size.width, size.height);
    // parallax suave com o mouse
    const alvoX = pointer.x * 0.6;
    const alvoY = 0.3 + pointer.y * 0.35;
    cam.position.x += (alvoX - cam.position.x) * Math.min(1, dt * 2.5);
    cam.position.y += (alvoY - cam.position.y) * Math.min(1, dt * 2.5);
    cam.lookAt(0, 0.35, 0);
  });
  return null;
}

/** A cena inteira. `progresso.atual` (0..1) vem da rolagem da página, sem re-render do React. */
export default function Cena({ titulos, progresso }: { titulos: string[]; progresso: Progresso }) {
  const dpr = useRef<[number, number]>([1, 1.6]);
  return (
    <Canvas
      dpr={dpr.current}
      camera={{ position: [0, 0.3, 13.6], fov: 38 }}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <color attach="background" args={["#06120c"]} />
      <fog attach="fog" args={["#06120c", 12, 24]} />
      <PerformanceMonitor onDecline={() => (dpr.current = [1, 1])} />
      {/* luz de estúdio feita na hora (sem baixar HDRI): chave quente, contraluz fria e preenchimento verde */}
      <Environment resolution={256} frames={1}>
        <Lightformer
          intensity={3.2}
          color="#ffd9a0"
          position={[4, 3, 3]}
          scale={[4, 6, 1]}
          form="rect"
        />
        <Lightformer
          intensity={2.4}
          color="#9fd8ff"
          position={[-5, 2, -3]}
          scale={[3, 8, 1]}
          form="rect"
        />
        <Lightformer
          intensity={1.6}
          color="#7fe0a8"
          position={[0, -4, 4]}
          scale={[8, 2, 1]}
          form="rect"
        />
        <Lightformer
          intensity={4}
          color="#ffffff"
          position={[0, 6, 0]}
          scale={[2, 2, 1]}
          form="ring"
        />
      </Environment>
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 5, 4]} intensity={2.2} color="#ffe2b0" />
      <directionalLight position={[-4, 2, -3]} intensity={1.4} color="#8fd4ff" />
      <pointLight position={[0, 1.5, 3.5]} intensity={8} distance={9} color="#ffcf8a" />
      <mesh position={[0, 0.6, -6]}>
        <planeGeometry args={[34, 22]} />
        <shaderMaterial
          depthWrite={false}
          fog={false}
          vertexShader={`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
          fragmentShader={`varying vec2 vUv; void main(){ vec2 d = (vUv - vec2(0.5, 0.55)) * vec2(1.4, 1.0); float r = length(d); vec3 c = mix(vec3(0.075, 0.17, 0.115), vec3(0.018, 0.05, 0.034), smoothstep(0.0, 0.6, r)); c += vec3(0.22, 0.13, 0.04) * exp(-r * r * 26.0) * 0.45; gl_FragColor = vec4(c, 1.0); }`}
        />
      </mesh>
      <Arvore progresso={progresso} />
      <Cartoes titulos={titulos} progresso={progresso} />
      <Sparkles
        count={140}
        scale={[9, 9, 7]}
        size={2.2}
        speed={0.25}
        opacity={0.55}
        color="#ffd38a"
      />
      <Camera />
      <EffectComposer multisampling={4}>
        <Bloom intensity={0.75} luminanceThreshold={0.62} luminanceSmoothing={0.25} mipmapBlur />
        <ChromaticAberration offset={new THREE.Vector2(0.0006, 0.0006)} />
        <Noise opacity={0.045} />
        <Vignette offset={0.25} darkness={0.75} />
      </EffectComposer>
    </Canvas>
  );
}
