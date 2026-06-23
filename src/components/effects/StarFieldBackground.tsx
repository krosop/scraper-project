import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const STAR_COUNT = 12000;
const COLORS = [
  new THREE.Color("#ffffff"),
  new THREE.Color("#e0e0e0"),
  new THREE.Color("#a0a0a0"),
];

const starVert = `
  uniform float time;
  varying float vAlpha;
  varying vec3 vColor;

  vec3 rgbToHsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  vec3 hsvToRgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    vec3 pos = position;
    float flicker = sin(time * 0.5 + position.x * 100.0) * 0.3 + 0.7;
    float dist = length(position);
    float alpha = smoothstep(80.0, 10.0, dist) * flicker;
    vAlpha = alpha;
    vec3 hsl = rgbToHsv(instanceColor.xyz);
    hsl.x += sin(time * 0.1 + position.z) * 0.02;
    hsl.x = clamp(hsl.x, 0.0, 1.0);
    vColor = hsvToRgb(hsl);
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
    gl_PointSize = (8.0 * flicker) * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const starFrag = `
  uniform float time;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    float strength = 1.0 - smoothstep(0.0, 0.5, dist);
    float flicker = sin(time * 2.0 + gl_FragCoord.x * 0.1) * 0.1 + 0.9;
    float finalAlpha = strength * vAlpha * flicker;
    gl_FragColor = vec4(vColor, finalAlpha);
  }
`;

function StarField() {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(STAR_COUNT * 3);
    const col = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i++) {
      const r = Math.random() * 80 + 10;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      const c = COLORS[Math.floor(Math.random() * COLORS.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }

    return { positions: pos, colors: col };
  }, []);

  useMemo(() => {
    if (!meshRef.current) return;
    meshRef.current.geometry.setAttribute(
      "position",
      new THREE.InstancedBufferAttribute(positions, 3)
    );
    for (let i = 0; i < STAR_COUNT; i++) {
      dummy.position.set(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2]
      );
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [positions, dummy]);

  useFrame(({ clock, camera }) => {
    camera.position.z -= 0.3;
    if (camera.position.z < -60) camera.position.z = 200;
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.getElapsedTime();
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, STAR_COUNT]}
      frustumCulled={false}
    >
      <bufferGeometry>
        <instancedBufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={starVert}
        fragmentShader={starFrag}
        transparent={true}
        depthWrite={false}
        uniforms={{ time: { value: 0 } }}
      />
    </instancedMesh>
  );
}

export function StarFieldBackground() {
  return (
    <div
      className="absolute inset-0"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 200], fov: 60 }}
        gl={{ alpha: true, antialias: false }}
        style={{ background: "transparent" }}
        onCreated={({ gl }) => {
          gl.setClearColor("#000000", 0);
        }}
      >
        <StarField />
      </Canvas>
    </div>
  );
}
