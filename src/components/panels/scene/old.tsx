import { useEffect, useRef } from "react";
import { useExportOptionsStore } from "@/store/export";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

// import { useEntitiesStore } from "@/store/next/entities";
import { useCamerasStore } from "@/store/next/cameras";
import { useFrameValues } from "@/hooks/use-frame-values";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ------------------------------------------------------------------
// Scissor helper — maps a DOM element's rect onto the shared canvas
// ------------------------------------------------------------------
function setScissorForElement(
  renderer: THREE.WebGLRenderer,
  canvas: HTMLCanvasElement,
  elem: HTMLElement,
) {
  const canvasRect = canvas.getBoundingClientRect();
  const elemRect = elem.getBoundingClientRect();

  const left = Math.max(0, elemRect.left - canvasRect.left);
  const right = Math.min(elemRect.right, canvasRect.right) - canvasRect.left;
  const top = Math.max(0, elemRect.top - canvasRect.top);
  const bottom = Math.min(elemRect.bottom, canvasRect.bottom) - canvasRect.top;

  const width = right - left;
  const height = bottom - top;
  const yUp = canvasRect.height - bottom; // WebGL origin is bottom-left

  renderer.setScissor(left, yUp, width, height);
  renderer.setViewport(left, yUp, width, height);

  return width / height;
}

// ------------------------------------------------------------------
// Scene builder — shared between both viewports
// ------------------------------------------------------------------
function buildScene() {
  const scene = new THREE.Scene();

  // Hotpink box (matches SharedScene in original)
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial({ color: "hotpink" }),
  );
  scene.add(box);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const point = new THREE.PointLight(0xffffff, 2);
  point.position.set(5, 10, 5);
  scene.add(point);

  // Grid
  const grid = new THREE.GridHelper(20, 20, "#a09f9f", "#868686");
  scene.add(grid);

  // Contact shadow plane (simple approximation)
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.ShadowMaterial({ opacity: 0.4 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.5;
  shadow.receiveShadow = true;
  scene.add(shadow);

  return scene;
}

// ------------------------------------------------------------------
// Main component
// ------------------------------------------------------------------
function AssetCreation() {
  const exportedImages = useExportOptionsStore((state) => state.images);
  const cameraGlobalSettings = useCamerasStore((state) => state.globalSettings);
  const { previewHeight, previewWidth } = useFrameValues();
  // const entities = useEntitiesStore((state) => state.entities);

  const sceneRef = useRef<THREE.Scene>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view1Ref = useRef<HTMLDivElement>(null);
  const view2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (exportedImages.length === 0) return;
      e.preventDefault();
      e.returnValue = true;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [exportedImages]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const view1 = view1Ref.current!;
    const view2 = view2Ref.current!;

    // --- Renderer ---

    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    renderer.setScissorTest(true);
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    // --- Shared scene ---
    const scene = buildScene();
    sceneRef.current = scene;

    // --- Camera 1: Perspective (main editor view) ---
    const camera1 = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera1.position.set(0, 0, 5);
    const controls1 = new OrbitControls(camera1, view1);
    controls1.enabled = cameraGlobalSettings.orbitControls;
    controls1.update();

    // CameraHelper — visible only in view2
    const camHelper = new THREE.CameraHelper(camera1);
    scene.add(camHelper);

    // --- Camera 2: Perspective (sprite preview) ---
    const spritePos: [number, number, number] = [5, 5, 5];
    const camera2 = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera2.position.set(...spritePos);
    camera2.lookAt(0, 0, 0);
    const controls2 = new OrbitControls(camera2, view2);
    controls2.enabled = cameraGlobalSettings.orbitControls;
    controls2.update();

    // --- Resize ---
    function resize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        renderer.setSize(w, h, false);
      }
    }

    // --- Render loop ---
    let animId: number;
    function render() {
      animId = requestAnimationFrame(render);
      resize();

      // View 1 — main editor
      camHelper.visible = false;
      scene.background = new THREE.Color("#1a1a1a");
      const aspect1 = setScissorForElement(renderer, canvas, view1);
      camera1.aspect = aspect1;
      camera1.updateProjectionMatrix();
      renderer.render(scene, camera1);

      // View 2 — sprite preview
      camHelper.visible = true;
      scene.background = new THREE.Color("#111111");
      const aspect2 = setScissorForElement(renderer, canvas, view2);
      camera2.aspect = aspect2;
      camera2.updateProjectionMatrix();
      renderer.render(scene, camera2);
    }

    render();

    return () => {
      cancelAnimationFrame(animId);
      controls1.dispose();
      controls2.dispose();
      renderer.dispose();
    };
  }, [cameraGlobalSettings.orbitControls]);

  // useEffect(() => {
  //   const scene = sceneRef.current;
  //   if (!scene) return;

  //   // Remove old entity meshes
  //   const toRemove = scene.children.filter((c) => c.userData.isEntity);
  //   toRemove.forEach((c) => scene.remove(c));

  //   // Add current entities
  //   Object.values(entities).forEach((entity) => {
  //     const mesh = buildEntityMesh(entity); // your entity → Three.js object logic
  //     mesh.userData.isEntity = true;
  //     scene.add(mesh);
  //   });
  // }, [entities]);

  return (
    <>
      <ResizablePanel defaultSize="75%">
        {/*
          The wrapper is `position: relative` so the canvas can sit
          behind the view divs with `position: absolute`.
        */}
        <ResizablePanelGroup
          orientation="vertical"
          style={{ position: "relative" }}
        >
          {/* View 1 — main editor, takes up 60% */}
          <ResizablePanel defaultSize="60%">
            <div
              ref={view1Ref}
              style={{ width: "100%", height: "100%", pointerEvents: "auto" }}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* View 2 — sprite preview, takes up 40% */}
          <ResizablePanel
            defaultSize="40%"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
            className="overflow-hidden overflow-y-scroll justify-center items-center w-full flex"
          >
            <div
              className="overflow-hidden"
              style={{ height: previewHeight, width: previewWidth }}
            >
              <div
                ref={view2Ref}
                style={{ width: "100%", height: "100%", pointerEvents: "auto" }}
              />
            </div>
          </ResizablePanel>

          {/* Single shared canvas — sits behind everything */}
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          />
        </ResizablePanelGroup>
      </ResizablePanel>
    </>
  );
}

export default AssetCreation;
