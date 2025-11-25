"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Billboard,
  Image,
  ScrollControls,
  useGLTF,
  useScroll,
} from "@react-three/drei";
import { easing } from "maath";

// 메인에서 바로 쓰는 sbm1 클라이언트 컴포넌트
export default function Sbm1Client() {
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [bgVisible, setBgVisible] = useState(false);
  const fadeRef = useRef<NodeJS.Timeout | null>(null);

  const handleSelectImage = (url: string | null) => {
    if (!url) return;
    setBgUrl(url);
    setBgVisible(true);
    if (fadeRef.current) clearTimeout(fadeRef.current);
    // 5초 후 서서히 사라지도록 플래그만 내리고, CSS transition으로 페이드 처리
    fadeRef.current = setTimeout(() => {
      setBgVisible(false);
    }, 5000);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000",
        overflow: "hidden",
      }}
    >
      {/* 선택된 이미지가 잠시 전체 배경이 되는 레이어 */}
      {bgUrl && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            backgroundImage: `url(${bgUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            opacity: bgVisible ? 1 : 0,
            transition: "opacity 2s ease",
            pointerEvents: "none",
          }}
        />
      )}

      {/* 메인 3D 씬 */}
      <Canvas
        dpr={[1, 1.5]}
        style={{
          width: "100vw",
          height: "100vh",
          background: "#000000",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Global lighting for cards + center tree (고정 값) */}
        <ambientLight intensity={1.0} />
        <directionalLight
          position={[-5.0, 24.5, 12.0]}
          intensity={3.2}
          color="#ffffff"
        />
        <directionalLight
          position={[-3.5, 21.5, -14.0]}
          intensity={4.2}
          color="#8fa1de"
        />

        <ScrollControls pages={4} infinite>
          <Scene position={[0, 1.5, 0]} onSelectImage={handleSelectImage} />
        </ScrollControls>
      </Canvas>
    </div>
  );
}

function Scene({
  children,
  onSelectImage,
  ...props
}: {
  children?: React.ReactNode;
  onSelectImage?: (url: string | null) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const scroll = useScroll();
  const [hovered, hover] = useState<number | null>(0);

  // 4초마다 자동으로 다음 이미지 선택
  useEffect(() => {
    if (onSelectImage) {
      onSelectImage(getImageUrl(0));
    }
    const id = setInterval(() => {
      hover((prev) => {
        const next = ((prev ?? 0) + 1) % IMAGE_COUNT;
        if (onSelectImage) {
          onSelectImage(getImageUrl(next));
        }
        return next;
      });
    }, 4000);
    return () => clearInterval(id);
  }, [onSelectImage]);

  useFrame((state, delta) => {
    // rotate ring by scroll offset + 느린 자전 모션
    if (ref.current) {
      const t = state.clock.getElapsedTime();
      ref.current.rotation.y = -scroll.offset * (Math.PI * 2) + t * 0.1;
    }
    // smooth camera movement with pointer
    const t = state.clock.getElapsedTime();
    const yOsc = Math.sin(t * 0.05) * 0.4; // 위아래로 아주 서서히 움직이는 모션
    easing.damp3(
      state.camera.position,
      [-state.pointer.x * 2, state.pointer.y * 2 + 4.5 + yOsc, 9],
      0.3,
      delta
    );
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={ref} {...(props as any)}>
      {/* 중앙 3D 나무 모델 */}
      <CenterTree hovered={hovered} />
      <Cards
        category="spring"
        from={0}
        len={Math.PI / 4}
        onPointerOver={hover}
        onPointerOut={hover}
        onSelectImage={onSelectImage}
      />
      <Cards
        category="summer"
        from={Math.PI / 4}
        len={Math.PI / 2}
        position={[0, 0.4, 0]}
        onPointerOver={hover}
        onPointerOut={hover}
        onSelectImage={onSelectImage}
      />
      <Cards
        category="autumn"
        from={Math.PI / 4 + Math.PI / 2}
        len={Math.PI / 2}
        onPointerOver={hover}
        onPointerOut={hover}
        onSelectImage={onSelectImage}
      />
      <Cards
        category="winter"
        from={Math.PI * 1.25}
        len={Math.PI * 2 - Math.PI * 1.25}
        position={[0, -0.4, 0]}
        onPointerOver={hover}
        onPointerOut={hover}
        onSelectImage={onSelectImage}
      />
      <ActiveCard hovered={hovered} />
    </group>
  );
}

function CenterTree({ hovered, ...props }: { hovered: number | null }) {
  // public/sbm1 아래 GLB 로드
  const { scene } = useGLTF(
    "/sbm1/a_tall_narrow_three__1110145554_texture.glb"
  );
  // 선택된 이미지(hovered)가 있을 때 살짝 투명하게
  useEffect(() => {
    if (!scene) return;
    scene.traverse((obj: any) => {
      if (obj && obj.isMesh && obj.material) {
        const mat = obj.material;
        mat.transparent = true;
        mat.opacity = hovered != null ? 0.7 : 1;
      }
    });
  }, [scene, hovered]);
  return (
    <primitive
      object={scene}
      // 살짝 카메라 쪽(+z)으로 빼서 배경 이미지/카드에 안 잘리도록
      position={[0, 0, 0.4]}
      scale={[2.8, 2.8, 2.8]}
      {...(props as any)}
    />
  );
}

// 사전 로드
useGLTF.preload("/sbm1/a_tall_narrow_three__1110145554_texture.glb");

// 이미지 풀: public/sbm1 안에 있는 시간대별 이미지를 모두 순회해서 사용
const sbm1Images = (() => {
  const result: string[] = [];
  const addGroup = (prefix: string, count: number) => {
    for (let i = 1; i <= count; i++) {
      result.push(`/sbm1/${prefix}${i}.png`);
    }
  };
  addGroup("새벽", 13);
  addGroup("아침", 18);
  addGroup("오후", 27);
  addGroup("밤", 16);
  addGroup("노을", 10);
  return result;
})();

const imagePool = sbm1Images;

function getImageUrl(i: number) {
  return imagePool[i % imagePool.length];
}

const IMAGE_COUNT = imagePool.length;

function Cards({
  from = 0,
  len = Math.PI * 2,
  radius = 6.3,
  onPointerOver,
  onPointerOut,
  onSelectImage,
  ...props
}: {
  from?: number;
  len?: number;
  radius?: number;
  onPointerOver: (index: number | null) => void;
  onPointerOut: (index: number | null) => void;
  onSelectImage?: (url: string | null) => void;
}) {
  const [hovered, hover] = useState<number | null>(null);
  const amount = Math.round(len * 22);

  return (
    <group {...(props as any)}>
      {Array.from({ length: amount - 3 }, (_, i) => {
        const angle = from + (i / amount) * len;
        return (
          <Card
            key={angle}
            onPointerOver={(e: any) => (
              e.stopPropagation(), hover(i), onPointerOver(i)
            )}
            onPointerOut={() => (hover(null), onPointerOut(null))}
            position={[Math.sin(angle) * radius, 0, Math.cos(angle) * radius]}
            rotation={[0, Math.PI / 2 + angle, 0]}
            active={hovered !== null}
            hovered={hovered === i}
            url={getImageUrl(i)}
            onSelectImage={onSelectImage}
          />
        );
      })}
    </group>
  );
}

function Card({
  url,
  active,
  hovered,
  onSelectImage,
  ...props
}: {
  url: string;
  active: boolean;
  hovered: boolean;
  onSelectImage?: (url: string | null) => void;
}) {
  const ref = useRef<any>(null);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const f = hovered ? 1.4 : active ? 1.25 : 1;
    easing.damp3(ref.current.position, [0, hovered ? 0.25 : 0, 0], 0.1, delta);
    easing.damp3(ref.current.scale, [1.9 * f, 1.1 * f, 1], 0.15, delta);
  });

  return (
    <group
      {...(props as any)}
      onClick={() => {
        if (onSelectImage) onSelectImage(url);
      }}
    >
      <Image
        ref={ref}
        transparent
        radius={0.075}
        url={url}
        scale={[1.9, 1.1, 1]}
        side={THREE.DoubleSide}
      />
    </group>
  );
}

function ActiveCard({
  hovered,
  ...props
}: {
  hovered: number | null;
}) {
  const ref = useRef<any>(null);

  useLayoutEffect(() => {
    if (ref.current && ref.current.material) {
      ref.current.material.zoom = 0.8;
    }
  }, [hovered]);

  useFrame((state, delta) => {
    if (!ref.current || !ref.current.material) return;
    easing.damp(ref.current.material, "zoom", 1, 0.5, delta);
    easing.damp(ref.current.material, "opacity", hovered !== null, 0.3, delta);
  });

  return (
    <Billboard {...(props as any)}>
      <Image
        ref={ref}
        transparent
        radius={0.3}
        position={[0, 1.3, 0]}
        scale={[5.4, 1.618 * 5.4, 0.2, 1]}
        url={hovered !== null ? getImageUrl(hovered) : getImageUrl(0)}
      />
    </Billboard>
  );
}



