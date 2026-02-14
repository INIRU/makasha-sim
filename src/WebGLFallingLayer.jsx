import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { gsap } from "gsap";
import * as THREE from "three";

const MAX_PARTICLES = 80;
const MAX_DEVICE_PIXEL_RATIO = 1.5;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function createParticle(scene, sharedGeometry, initialTexture) {
  const material = new THREE.MeshBasicMaterial({
    map: initialTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0,
  });

  const mesh = new THREE.Mesh(sharedGeometry, material);
  mesh.visible = false;
  scene.add(mesh);

  return {
    mesh,
    material,
    busy: false,
  };
}

function releaseParticle(particle, context) {
  if (!particle.busy) return;

  gsap.killTweensOf(particle.mesh.position);
  gsap.killTweensOf(particle.mesh.rotation);
  gsap.killTweensOf(particle.material);

  particle.busy = false;
  particle.mesh.visible = false;
  particle.material.opacity = 0;
  context.activeCount = Math.max(0, context.activeCount - 1);
}

const WebGLFallingLayer = forwardRef(function WebGLFallingLayer({ texturePaths }, ref) {
  const mountRef = useRef(null);
  const contextRef = useRef({
    renderer: null,
    scene: null,
    camera: null,
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
    rafId: 0,
    textures: [],
    sharedGeometry: null,
    particles: [],
    activeCount: 0,
  });

  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode) return undefined;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DEVICE_PIXEL_RATIO));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.className = "webgl-fall-canvas";
    mountNode.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      -window.innerWidth / 2,
      window.innerWidth / 2,
      window.innerHeight / 2,
      -window.innerHeight / 2,
      1,
      2000,
    );
    camera.position.z = 50;

    const loader = new THREE.TextureLoader();
    const textures = texturePaths.map((path) => {
      const texture = loader.load(encodeURI(path));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      return texture;
    });

    const sharedGeometry = new THREE.PlaneGeometry(1, 1);
    const particles = Array.from({ length: MAX_PARTICLES }, () =>
      createParticle(scene, sharedGeometry, textures[0]),
    );

    contextRef.current = {
      renderer,
      scene,
      camera,
      width: window.innerWidth,
      height: window.innerHeight,
      rafId: 0,
      textures,
      sharedGeometry,
      particles,
      activeCount: 0,
    };

    const onResize = () => {
      contextRef.current.width = window.innerWidth;
      contextRef.current.height = window.innerHeight;

      camera.left = -window.innerWidth / 2;
      camera.right = window.innerWidth / 2;
      camera.top = window.innerHeight / 2;
      camera.bottom = -window.innerHeight / 2;
      camera.updateProjectionMatrix();

      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DEVICE_PIXEL_RATIO));
    };

    const renderLoop = () => {
      renderer.render(scene, camera);
      contextRef.current.rafId = window.requestAnimationFrame(renderLoop);
    };

    window.addEventListener("resize", onResize);
    renderLoop();

    return () => {
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(contextRef.current.rafId);

      particles.forEach((particle) => {
        releaseParticle(particle, contextRef.current);
        particle.material.dispose();
        scene.remove(particle.mesh);
      });

      sharedGeometry.dispose();
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();

      if (renderer.domElement.parentNode === mountNode) {
        mountNode.removeChild(renderer.domElement);
      }
    };
  }, [texturePaths]);

  useImperativeHandle(
    ref,
    () => ({
      spawnBurst({ amount = 4, originRatioX = 0.5, scatter = 0.38 } = {}) {
        const context = contextRef.current;
        const { textures, particles, width, height } = context;
        if (!textures.length || !particles.length) return;

        const freeParticles = particles.filter((particle) => !particle.busy);
        if (!freeParticles.length) return;

        const clampedRatio = Math.max(0, Math.min(1, originRatioX));
        const baseX = (clampedRatio - 0.5) * width;
        const scatterPx = Math.max(180, width * scatter);
        const horizontalLimit = width / 2 - 30;

        const requestedCount = Math.max(1, amount);
        const loadCappedCount = context.activeCount > 36 ? 2 : context.activeCount > 20 ? 3 : requestedCount;
        const spawnCount = Math.min(requestedCount, loadCappedCount, freeParticles.length);

        for (let index = 0; index < spawnCount; index += 1) {
          const particle = freeParticles[index];
          const texture = textures[Math.floor(Math.random() * textures.length)];
          const size = randomBetween(62, 108);
          const duration = randomBetween(1.4, 2.4);

          const startX = THREE.MathUtils.clamp(
            baseX + randomBetween(-scatterPx, scatterPx),
            -horizontalLimit,
            horizontalLimit,
          );
          const endX = THREE.MathUtils.clamp(
            startX + randomBetween(-scatterPx * 0.35, scatterPx * 0.35),
            -horizontalLimit,
            horizontalLimit,
          );

          particle.busy = true;
          context.activeCount += 1;

          gsap.killTweensOf(particle.mesh.position);
          gsap.killTweensOf(particle.mesh.rotation);
          gsap.killTweensOf(particle.material);

          particle.material.map = texture;
          particle.material.opacity = 1;
          particle.material.needsUpdate = true;

          particle.mesh.visible = true;
          particle.mesh.scale.set(size, size, 1);
          particle.mesh.position.set(startX, height / 2 + size + randomBetween(0, 120), 0);
          particle.mesh.rotation.z = randomBetween(-0.45, 0.45);

          gsap.to(particle.mesh.position, {
            x: endX,
            y: -height / 2 - size,
            duration,
            delay: randomBetween(0, 0.14),
            ease: "none",
            onComplete: () => releaseParticle(particle, context),
          });

          gsap.to(particle.mesh.rotation, {
            z: particle.mesh.rotation.z + randomBetween(2.8, 5.5),
            duration,
            ease: "none",
          });

          gsap.to(particle.material, {
            opacity: 0,
            duration: 0.35,
            delay: Math.max(0, duration - 0.35),
            ease: "power1.out",
          });
        }
      },
    }),
    [],
  );

  return <div className="webgl-falling-layer" ref={mountRef} />;
});

export default WebGLFallingLayer;
