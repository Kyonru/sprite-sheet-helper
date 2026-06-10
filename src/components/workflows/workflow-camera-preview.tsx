import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  CameraControls,
  GizmoHelper,
  GizmoViewport,
  Grid,
  TransformControls,
} from "@react-three/drei";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useEntitiesStore } from "@/store/next/entities";
import { useTransformsStore } from "@/store/next/transforms";
import { useLightsStore } from "@/store/next/lights";
import { useModelsStore } from "@/store/next/models";
import { useModelDowngradesStore } from "@/store/next/model-downgrades";
import { getRuntimeModel } from "@/utils/model-downgrade-runtime";
import { normalizeWorkflowDegrees } from "@/utils/workflow-camera";
import {
  buildPlaybackClip,
  getAnimationClipFps,
} from "@/utils/animation-clips";
import type { ResolvedWorkflowCamera } from "@/utils/workflow-camera";
import type {
  AmbientLightComponent,
  DirectionalLightComponent,
  LightComponent,
  PointLightComponent,
  SpotLightComponent,
  Transform,
} from "@/types/ecs";

type WorkflowCameraPreviewProps = {
  camera: ResolvedWorkflowCamera;
  selectedDirection: string;
  selectedAnimation?: {
    modelUuid?: string;
    animationName?: string;
  };
  onCameraChange: (camera: {
    distance: number;
    phi: number;
    theta: number;
  }) => void;
  onTargetChange: (target: [number, number, number]) => void;
};

function transformProps(transform?: Transform) {
  return {
    position: transform?.position ?? ([0, 0, 0] as [number, number, number]),
    rotation: transform?.rotation ?? ([0, 0, 0] as [number, number, number]),
    scale: transform?.scale ?? ([1, 1, 1] as [number, number, number]),
  };
}

function PreviewModel({
  uuid,
  selectedAnimation,
}: {
  uuid: string;
  selectedAnimation?: {
    modelUuid?: string;
    animationName?: string;
  };
}) {
  const clips = useModelsStore((state) => state.clips);
  const durations = useModelsStore((state) => state.durations);
  const speeds = useModelsStore((state) => state.speeds);
  const loops = useModelsStore((state) => state.loops);
  const transform = useTransformsStore((state) => state.transforms[uuid]);
  const modelClips = useModelsStore((state) => state.clips[uuid]);
  const modelDurations = durations[uuid] ?? {};
  const modelSpeeds = speeds[uuid] ?? {};
  const modelLoops = loops[uuid] ?? {};
  const activeVariant = useModelDowngradesStore(
    (state) => state.entries[uuid]?.activeVariant ?? "original",
  );
  const downgradeRevision = useModelDowngradesStore(
    (state) => state.entries[uuid]?.revision ?? 0,
  );
  const clipsRevision = useModelsStore(
    (state) => state.clips[uuid]?.length ?? 0,
  );
  const runtimeRefreshKey = `${activeVariant}:${downgradeRevision}:${clipsRevision}`;
  const object = useMemo(() => {
    if (runtimeRefreshKey.length === 0) return null;
    const runtime = getRuntimeModel(uuid, activeVariant);
    if (!runtime?.object) return null;
    const cloned = cloneSkeleton(runtime.object);
    cloned.traverse((child) => {
      child.frustumCulled = false;
    });
    return cloned;
  }, [activeVariant, runtimeRefreshKey, uuid]);
  const previewAnimation =
    selectedAnimation?.modelUuid && selectedAnimation.modelUuid === uuid
      ? selectedAnimation
      : undefined;
  const modelRef = useRef<THREE.AnimationMixer | null>(null);

  useFrame((_, delta) => {
    modelRef.current?.update(delta);
  });

  useEffect(() => {
    if (!object) {
      if (modelRef.current) {
        modelRef.current.stopAllAction();
      }
      modelRef.current = null;
      return;
    }

    modelRef.current = new THREE.AnimationMixer(object);

    return () => {
      modelRef.current?.stopAllAction();
      modelRef.current = null;
    };
  }, [object]);

  useEffect(() => {
    const mixer = modelRef.current;
    if (!mixer) return;
    mixer.stopAllAction();
    mixer.setTime(0);

    if (
      !previewAnimation?.animationName ||
      previewAnimation.animationName === "none"
    ) {
      return;
    }

    const animationName = previewAnimation.animationName;
    const clipRef = modelClips?.find(
      (entry) => entry.clip.name === animationName,
    );
    if (!clipRef) return;

    const [trimStart, trimEnd] = modelDurations[animationName] ?? [
      0,
      clipRef.clip.duration,
    ];
    const fps = getAnimationClipFps(clipRef.clip);
    const { clip, generated } = buildPlaybackClip(
      clipRef.clip,
      trimStart,
      trimEnd,
      fps,
    );
    const action = mixer.clipAction(clip);
    const speed = modelSpeeds[animationName] ?? 1;
    const loop = modelLoops[animationName] ?? THREE.LoopOnce;

    action.setDuration((1 / speed) * clip.duration);
    action.setLoop(loop, Infinity);
    action.play();

    return () => {
      action.stop();
      if (generated) {
        mixer.uncacheAction(clip);
        mixer.uncacheClip(clip);
      }
    };
  }, [
    clips,
    modelClips,
    modelDurations,
    modelLoops,
    modelSpeeds,
    previewAnimation?.animationName,
  ]);

  if (!object) return null;

  return (
    <group {...transformProps(transform)}>
      <primitive object={object} dispose={null} />
    </group>
  );
}

function PreviewLight({
  uuid,
  light,
}: {
  uuid: string;
  light: LightComponent;
}) {
  const transform = useTransformsStore((state) => state.transforms[uuid]);
  const props = transformProps(transform);

  if (light.type === "ambient") {
    const ambient = light as AmbientLightComponent;
    return <ambientLight color={ambient.color} intensity={ambient.intensity} />;
  }

  if (light.type === "directional") {
    const directional = light as DirectionalLightComponent;
    return (
      <directionalLight
        color={directional.color}
        intensity={directional.intensity}
        position={props.position}
      />
    );
  }

  if (light.type === "point") {
    const point = light as PointLightComponent;
    return (
      <pointLight
        color={point.color}
        decay={point.decay}
        distance={point.distance}
        intensity={point.intensity}
        power={point.power}
        position={props.position}
      />
    );
  }

  if (light.type === "spot") {
    const spot = light as SpotLightComponent;
    return (
      <spotLight
        angle={spot.angle}
        color={spot.color}
        decay={spot.decay}
        distance={spot.distance}
        intensity={spot.intensity}
        penumbra={spot.penumbra}
        power={spot.power}
        position={props.position}
      />
    );
  }

  return null;
}

function PreviewSceneObjects({
  selectedAnimation,
}: {
  selectedAnimation?: WorkflowCameraPreviewProps["selectedAnimation"];
}) {
  const entities = useEntitiesStore((state) => state.entities);
  const lights = useLightsStore((state) => state.lights);
  const isVisible = (entity: unknown) =>
    (entity as { visible?: boolean }).visible !== false;
  const modelEntities = Object.values(entities).filter(
    (entity) => entity.type === "model" && isVisible(entity),
  );
  const lightEntities = Object.values(entities).filter(
    (entity) => entity.type === "light" && isVisible(entity),
  );

  return (
    <>
      {modelEntities.map((entity) => (
        <PreviewModel
          key={entity.uuid}
          uuid={entity.uuid}
          selectedAnimation={selectedAnimation}
        />
      ))}
      {lightEntities.map((entity) => {
        const light = lights[entity.uuid];
        return light ? (
          <PreviewLight key={entity.uuid} uuid={entity.uuid} light={light} />
        ) : null;
      })}
      {lightEntities.length === 0 && (
        <>
          <ambientLight intensity={0.55} />
          <directionalLight intensity={1.2} position={[3, 5, 4]} />
        </>
      )}
    </>
  );
}

function PreviewCameraControls({
  camera,
  onCameraChange,
}: Pick<WorkflowCameraPreviewProps, "camera" | "onCameraChange">) {
  const controlsRef = useRef<CameraControls>(null);
  const { camera: threeCamera } = useThree();

  useEffect(() => {
    threeCamera.position.set(...camera.position);
    controlsRef.current?.setLookAt(...camera.position, ...camera.target, false);
  }, [camera.position, camera.target, threeCamera]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={0.1}
      onEnd={() => {
        const controls = controlsRef.current;
        if (!controls) return;
        const target = controls.getTarget(new THREE.Vector3());
        const controlledCamera = controls.camera;
        const offset = controlledCamera.position.clone().sub(target);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        onCameraChange({
          distance: Number(spherical.radius.toFixed(3)),
          phi: Number(THREE.MathUtils.radToDeg(spherical.phi).toFixed(2)),
          theta: normalizeWorkflowDegrees(
            Number(THREE.MathUtils.radToDeg(spherical.theta).toFixed(2)),
          ),
        });
      }}
    />
  );
}

function TargetHandle({
  target,
  onTargetChange,
}: Pick<WorkflowCameraPreviewProps, "onTargetChange"> & {
  target: [number, number, number];
}) {
  const targetObject = useMemo(() => new THREE.Object3D(), []);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (draggingRef.current) return;
    targetObject.position.set(...target);
  }, [target, targetObject]);

  useFrame(() => {
    if (!draggingRef.current) return;
    onTargetChange([
      Number(targetObject.position.x.toFixed(3)),
      Number(targetObject.position.y.toFixed(3)),
      Number(targetObject.position.z.toFixed(3)),
    ]);
  });

  return (
    <>
      <primitive object={targetObject} visible={false} />
      <TransformControls
        object={targetObject}
        mode="translate"
        size={0.65}
        onMouseDown={() => {
          draggingRef.current = true;
        }}
        onMouseUp={() => {
          draggingRef.current = false;
          onTargetChange([
            Number(targetObject.position.x.toFixed(3)),
            Number(targetObject.position.y.toFixed(3)),
            Number(targetObject.position.z.toFixed(3)),
          ]);
        }}
      />
      <mesh position={target}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#22c55e" depthTest={false} />
      </mesh>
    </>
  );
}

export function WorkflowCameraPreview({
  camera,
  selectedDirection,
  selectedAnimation,
  onCameraChange,
  onTargetChange,
}: WorkflowCameraPreviewProps) {
  return (
    <div
      className="relative h-[360px] overflow-hidden rounded-md border bg-muted/20"
      data-testid="workflow-camera-preview"
    >
      <Canvas
        camera={{
          position: camera.position,
          fov: 45,
          near: 0.01,
          far: 1000,
        }}
        gl={{ antialias: false, alpha: true }}
      >
        <color attach="background" args={["#18181b"]} />
        <PreviewCameraControls
          camera={camera}
          onCameraChange={onCameraChange}
        />
        <PreviewSceneObjects selectedAnimation={selectedAnimation} />
        <TargetHandle target={camera.target} onTargetChange={onTargetChange} />
        <Grid
          args={[10, 10]}
          cellColor="#3f3f46"
          sectionColor="#71717a"
          infiniteGrid
          fadeDistance={18}
          fadeStrength={2}
        />
        <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
          <GizmoViewport labelColor="white" />
        </GizmoHelper>
      </Canvas>
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border bg-background/85 px-2 py-1 text-xs">
        Previewing {selectedDirection}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border bg-background/85 px-2 py-1 text-[11px] text-muted-foreground">
        Orbit to adjust camera · drag target to reframe
      </div>
    </div>
  );
}
