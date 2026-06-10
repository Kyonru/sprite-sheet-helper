import * as THREE from "three";
import type { TrianglesDrawModes } from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { SimplifyModifier } from "three/addons/modifiers/SimplifyModifier.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import type {
  ModelDowngradeAnalysis,
  ModelDowngradeRecipe,
  ModelDowngradeReport,
} from "@/types/model-downgrade";

type MaterialWithMaps = THREE.Material & {
  color?: THREE.Color;
  map?: THREE.Texture | null;
  normalMap?: THREE.Texture | null;
  roughnessMap?: THREE.Texture | null;
  metalnessMap?: THREE.Texture | null;
  aoMap?: THREE.Texture | null;
  emissiveMap?: THREE.Texture | null;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  flatShading?: boolean;
};

type DowngradeResult = {
  object: THREE.Object3D;
  clips: THREE.AnimationClip[];
  report: ModelDowngradeReport;
};

const TEXTURE_KEYS = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "emissiveMap",
] as const;

const EPSILON = 1e-6;

export function analyzeModel(
  object: THREE.Object3D,
  clips: THREE.AnimationClip[] = [],
): ModelDowngradeAnalysis {
  const materials = new Set<string>();
  const textures = new Map<string, { name: string; width: number; height: number }>();
  const bones = new Set<string>();
  let triangleCount = 0;
  let meshCount = 0;
  let staticMeshCount = 0;
  let skinnedMeshCount = 0;
  let morphTargetMeshCount = 0;
  let eligibleStaticMeshCount = 0;
  let topologySkippedMeshCount = 0;

  object.traverse((child) => {
    if ((child as THREE.Bone).isBone) {
      bones.add(child.uuid);
      return;
    }

    if (!isMesh(child)) return;
    meshCount += 1;
    const geometry = child.geometry;
    const isSkinned = isSkinnedMesh(child);
    const hasMorphs = hasMorphTargets(geometry);
    const triangles = getTriangleCount(geometry);
    triangleCount += triangles;

    if (isSkinned) skinnedMeshCount += 1;
    else staticMeshCount += 1;

    if (hasMorphs) morphTargetMeshCount += 1;
    if (!isSkinned && !hasMorphs) eligibleStaticMeshCount += 1;
    else topologySkippedMeshCount += 1;

    for (const material of toMaterialArray(child.material)) {
      materials.add(material.uuid);
      for (const texture of getMaterialTextures(material)) {
        const size = getTextureSize(texture);
        textures.set(texture.uuid, {
          name: texture.name || "Texture",
          width: size.width,
          height: size.height,
        });
      }
    }
  });

  const textureSizes = [...textures.values()];
  const maxTextureSize = textureSizes.reduce(
    (max, texture) => Math.max(max, texture.width, texture.height),
    0,
  );

  return {
    triangleCount,
    meshCount,
    staticMeshCount,
    skinnedMeshCount,
    morphTargetMeshCount,
    materialCount: materials.size,
    textureCount: textures.size,
    maxTextureSize,
    textureSizes,
    boneCount: bones.size,
    animationCount: clips.length,
    animationKeyframeCount: clips.reduce(
      (total, clip) =>
        total +
        clip.tracks.reduce((trackTotal, track) => trackTotal + track.times.length, 0),
      0,
    ),
    eligibleStaticMeshCount,
    topologySkippedMeshCount,
  };
}

export async function downgradeModel(
  object: THREE.Object3D,
  clips: THREE.AnimationClip[],
  recipe: ModelDowngradeRecipe,
): Promise<DowngradeResult> {
  const before = analyzeModel(object, clips);
  const clone = cloneSkeleton(object);
  const warnings: string[] = [];
  const operations: string[] = [];
  const staticTriangles = getStaticTopologyTriangleCount(clone);

  const meshTasks: Promise<void>[] = [];
  clone.traverse((child) => {
    if (!isMesh(child)) return;
    const currentTriangles = getTriangleCount(child.geometry);
    const targetTriangles =
      staticTriangles > recipe.triangleBudget && !isSkinnedMesh(child)
        ? Math.max(
            1,
            Math.floor((currentTriangles / staticTriangles) * recipe.triangleBudget),
          )
        : currentTriangles;

    child.geometry = downgradeGeometry(
      child,
      recipe,
      targetTriangles,
      warnings,
      operations,
    );
    meshTasks.push(downgradeMaterials(child, recipe, warnings, operations));
  });

  await Promise.all(meshTasks);
  const reducedClips = clips.map((clip) =>
    reduceAnimationClip(clip, recipe.animationFps, recipe.steppedAnimation),
  );
  const after = analyzeModel(clone, reducedClips);

  return {
    object: clone,
    clips: reducedClips,
    report: {
      before,
      after,
      warnings: unique(warnings),
      operations: unique(operations),
    },
  };
}

export function downgradeGeometry(
  mesh: THREE.Mesh,
  recipe: ModelDowngradeRecipe,
  targetTriangles: number,
  warnings: string[] = [],
  operations: string[] = [],
): THREE.BufferGeometry {
  const isSkinned = isSkinnedMesh(mesh);
  const hasMorphs = hasMorphTargets(mesh.geometry);
  const canChangeTopology = !isSkinned && !hasMorphs;
  let geometry = mesh.geometry.clone();

  if (!canChangeTopology) {
    if (isSkinned) {
      warnings.push(
        `Skipped topology reduction for skinned mesh "${mesh.name || "Mesh"}" to keep rigging intact.`,
      );
    }
    if (hasMorphs) {
      warnings.push(
        `Skipped topology reduction for morph-target mesh "${mesh.name || "Mesh"}" to preserve deformation data.`,
      );
    }
  }

  if (canChangeTopology) {
    geometry = toTrianglesGeometry(geometry);
    operations.push("Triangulated static mesh geometry.");

    if (recipe.mergeVertices) {
      geometry = BufferGeometryUtils.mergeVertices(geometry);
      operations.push("Merged duplicate static mesh vertices.");
    }

    if (recipe.removeTinyIslands) {
      geometry = removeTinyTriangles(geometry, Math.max(EPSILON, recipe.snapVertices * recipe.snapVertices * 0.01));
      operations.push("Removed tiny static mesh triangles.");
    }

    const currentTriangles = getTriangleCount(geometry);
    if (currentTriangles > targetTriangles) {
      geometry = simplifyGeometry(geometry, targetTriangles, warnings);
      operations.push("Decimated static mesh geometry.");
    }
  }

  if (recipe.snapVertices > 0) {
    quantizeGeometryPositions(geometry, recipe.snapVertices);
    operations.push("Quantized vertex positions.");
  }

  if (recipe.flatShading) {
    if (canChangeTopology && geometry.index) {
      geometry = geometry.toNonIndexed();
    }
    geometry.computeVertexNormals();
    operations.push("Recomputed flat-friendly normals.");
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export async function downgradeMaterials(
  mesh: THREE.Mesh,
  recipe: ModelDowngradeRecipe,
  warnings: string[] = [],
  operations: string[] = [],
) {
  const materials = await Promise.all(
    toMaterialArray(mesh.material).map((material) =>
      downgradeMaterial(material, recipe, warnings),
    ),
  );
  mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
  operations.push("Simplified material settings and texture filtering.");
}

export async function downgradeTextures(
  texture: THREE.Texture,
  recipe: ModelDowngradeRecipe,
  warnings: string[] = [],
) {
  const clone = await resizeAndQuantizeTexture(texture, recipe, warnings);
  applyTextureFiltering(clone, recipe.nearestFiltering);
  return clone;
}

export function reduceAnimationClip(
  clip: THREE.AnimationClip,
  fps: number,
  stepped: boolean,
): THREE.AnimationClip {
  if (!Number.isFinite(fps) || fps <= 0 || clip.tracks.length === 0) {
    return clip.clone();
  }

  const minStep = 1 / fps;
  const tracks = clip.tracks.map((track) =>
    reduceKeyframeTrack(track, minStep, stepped),
  );
  const reduced = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  reduced.optimize();
  return reduced;
}

export async function exportDowngradedGlb(
  object: THREE.Object3D,
  clips: THREE.AnimationClip[],
): Promise<ArrayBuffer> {
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(object, {
    binary: true,
    animations: clips,
    onlyVisible: false,
  });

  if (result instanceof ArrayBuffer) return result;
  if (result instanceof Blob) return result.arrayBuffer();
  return new TextEncoder().encode(JSON.stringify(result)).buffer;
}

function downgradeMaterial(
  material: THREE.Material,
  recipe: ModelDowngradeRecipe,
  warnings: string[],
): Promise<THREE.Material> {
  return recipe.simplifyMaterials
    ? createSimplifiedMaterial(material, recipe, warnings)
    : cloneMaterialWithDowngradedTextures(material, recipe, warnings);
}

async function createSimplifiedMaterial(
  material: THREE.Material,
  recipe: ModelDowngradeRecipe,
  warnings: string[],
) {
  const source = material as MaterialWithMaps;
  const map = source.map
    ? await downgradeTextures(source.map, recipe, warnings)
    : null;
  const output = new THREE.MeshStandardMaterial({
    name: material.name,
    color: source.color?.clone() ?? new THREE.Color("#ffffff"),
    map,
    transparent: material.transparent,
    opacity: material.opacity,
    side: material.side,
    depthWrite: material.depthWrite,
    roughness: Math.max(0.85, source.roughness ?? 1),
    metalness: 0,
    flatShading: recipe.flatShading,
  });
  output.needsUpdate = true;
  return output;
}

async function cloneMaterialWithDowngradedTextures(
  material: THREE.Material,
  recipe: ModelDowngradeRecipe,
  warnings: string[],
) {
  const output = material.clone() as MaterialWithMaps;
  for (const key of TEXTURE_KEYS) {
    const texture = output[key];
    if (texture) output[key] = await downgradeTextures(texture, recipe, warnings);
  }
  output.flatShading = recipe.flatShading;
  output.needsUpdate = true;
  return output;
}

function simplifyGeometry(
  geometry: THREE.BufferGeometry,
  targetTriangles: number,
  warnings: string[],
) {
  const position = geometry.getAttribute("position");
  if (!position) return geometry;
  const targetVertices = Math.max(3, targetTriangles * 3);
  const removeCount = Math.max(0, position.count - targetVertices);
  if (removeCount <= 0) return geometry;

  try {
    return new SimplifyModifier().modify(geometry, removeCount);
  } catch (error) {
    warnings.push(
      `Could not decimate mesh geometry: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return geometry;
  }
}

function toTrianglesGeometry(geometry: THREE.BufferGeometry) {
  const drawMode = (geometry as THREE.BufferGeometry & { drawMode?: number })
    .drawMode;
  if (drawMode && drawMode !== THREE.TrianglesDrawMode) {
    return BufferGeometryUtils.toTrianglesDrawMode(
      geometry,
      drawMode as TrianglesDrawModes,
    );
  }
  return geometry;
}

function removeTinyTriangles(
  geometry: THREE.BufferGeometry,
  minArea: number,
): THREE.BufferGeometry {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const position = source.getAttribute("position");
  if (!position || position.count < 3) return source;

  const keep: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    if (triangleArea(a, b, c) >= minArea) {
      keep.push(i, i + 1, i + 2);
    }
  }

  if (keep.length === position.count) return source;
  const output = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const itemSize = attribute.itemSize;
    const values: number[] = [];
    for (const vertexIndex of keep) {
      for (let item = 0; item < itemSize; item += 1) {
        values.push(attribute.getComponent(vertexIndex, item));
      }
    }
    output.setAttribute(
      name,
      new THREE.Float32BufferAttribute(values, itemSize, attribute.normalized),
    );
  }
  return output;
}

function quantizeGeometryPositions(
  geometry: THREE.BufferGeometry,
  step: number,
) {
  const position = geometry.getAttribute("position");
  if (!position) return;
  for (let i = 0; i < position.count; i += 1) {
    position.setXYZ(
      i,
      snap(position.getX(i), step),
      snap(position.getY(i), step),
      snap(position.getZ(i), step),
    );
  }
  position.needsUpdate = true;
}

function reduceKeyframeTrack(
  track: THREE.KeyframeTrack,
  minStep: number,
  stepped: boolean,
) {
  const valueSize = track.getValueSize();
  const keep: number[] = [];
  let lastTime = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < track.times.length; i += 1) {
    const time = track.times[i];
    if (
      i === 0 ||
      i === track.times.length - 1 ||
      time - lastTime >= minStep - EPSILON
    ) {
      keep.push(i);
      lastTime = time;
    }
  }

  const times = new Float32Array(keep.map((index) => track.times[index]));
  const values = new Float32Array(keep.length * valueSize);
  keep.forEach((sourceIndex, targetIndex) => {
    for (let offset = 0; offset < valueSize; offset += 1) {
      values[targetIndex * valueSize + offset] =
        track.values[sourceIndex * valueSize + offset];
    }
  });

  const next = createTrackLike(track, times, values);
  next.setInterpolation(
    stepped ? THREE.InterpolateDiscrete : track.getInterpolation(),
  );
  return next;
}

function createTrackLike(
  track: THREE.KeyframeTrack,
  times: Float32Array,
  values: Float32Array,
) {
  const timeValues = Array.from(times);
  const trackValues = Array.from(values);
  if (track instanceof THREE.QuaternionKeyframeTrack) {
    return new THREE.QuaternionKeyframeTrack(track.name, timeValues, trackValues);
  }
  if (track instanceof THREE.VectorKeyframeTrack) {
    return new THREE.VectorKeyframeTrack(track.name, timeValues, trackValues);
  }
  if (track instanceof THREE.ColorKeyframeTrack) {
    return new THREE.ColorKeyframeTrack(track.name, timeValues, trackValues);
  }
  if (track instanceof THREE.BooleanKeyframeTrack) {
    return new THREE.BooleanKeyframeTrack(track.name, timeValues, trackValues);
  }
  if (track instanceof THREE.StringKeyframeTrack) {
    return new THREE.StringKeyframeTrack(track.name, timeValues, trackValues);
  }
  return new THREE.NumberKeyframeTrack(track.name, timeValues, trackValues);
}

async function resizeAndQuantizeTexture(
  texture: THREE.Texture,
  recipe: ModelDowngradeRecipe,
  warnings: string[],
) {
  const fallback = texture.clone();
  const image = texture.image as CanvasImageSource | undefined;
  if (
    typeof document === "undefined" ||
    !image ||
    !("width" in image) ||
    Number(image.width) <= 0
  ) {
    return fallback;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = recipe.textureSize;
    canvas.height = recipe.textureSize;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return fallback;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, recipe.textureSize, recipe.textureSize);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    quantizeImageData(imageData, recipe.paletteColors, recipe.ditherTextures);
    ctx.putImageData(imageData, 0, 0);

    const resized = new THREE.CanvasTexture(canvas);
    resized.name = texture.name;
    resized.colorSpace = texture.colorSpace;
    resized.wrapS = texture.wrapS;
    resized.wrapT = texture.wrapT;
    resized.repeat.copy(texture.repeat);
    resized.offset.copy(texture.offset);
    resized.center.copy(texture.center);
    resized.rotation = texture.rotation;
    resized.flipY = texture.flipY;
    return resized;
  } catch (error) {
    warnings.push(
      `Could not resize texture "${texture.name || "Texture"}": ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return fallback;
  }
}

function applyTextureFiltering(texture: THREE.Texture, nearest: boolean) {
  texture.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  texture.minFilter = nearest
    ? THREE.NearestFilter
    : THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = !nearest;
  texture.needsUpdate = true;
}

function quantizeImageData(
  imageData: ImageData,
  paletteColors: number,
  dither: boolean,
) {
  const levels = Math.max(2, Math.min(256, Math.floor(paletteColors)));
  const step = 255 / (levels - 1);
  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      const i = (y * imageData.width + x) * 4;
      const threshold = dither ? (bayer4(x, y) - 0.5) * step : 0;
      imageData.data[i] = quantizeChannel(imageData.data[i], step, threshold);
      imageData.data[i + 1] = quantizeChannel(
        imageData.data[i + 1],
        step,
        threshold,
      );
      imageData.data[i + 2] = quantizeChannel(
        imageData.data[i + 2],
        step,
        threshold,
      );
    }
  }
}

function quantizeChannel(value: number, step: number, threshold: number) {
  return Math.max(0, Math.min(255, Math.round((value + threshold) / step) * step));
}

function bayer4(x: number, y: number) {
  const matrix = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  return matrix[y % 4][x % 4] / 16;
}

function getStaticTopologyTriangleCount(object: THREE.Object3D) {
  let total = 0;
  object.traverse((child) => {
    if (!isMesh(child)) return;
    if (isSkinnedMesh(child) || hasMorphTargets(child.geometry)) return;
    total += getTriangleCount(child.geometry);
  });
  return Math.max(1, total);
}

function getTriangleCount(geometry: THREE.BufferGeometry) {
  const index = geometry.getIndex();
  if (index) return Math.floor(index.count / 3);
  const position = geometry.getAttribute("position");
  return position ? Math.floor(position.count / 3) : 0;
}

function getMaterialTextures(material: THREE.Material) {
  const source = material as MaterialWithMaps;
  return TEXTURE_KEYS.flatMap((key) => (source[key] ? [source[key]!] : []));
}

function getTextureSize(texture: THREE.Texture) {
  const image = texture.image as
    | { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number }
    | undefined;
  return {
    width: Number(image?.naturalWidth ?? image?.width ?? 0),
    height: Number(image?.naturalHeight ?? image?.height ?? 0),
  };
}

function toMaterialArray(
  material: THREE.Material | THREE.Material[],
): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}

function isMesh(object: THREE.Object3D): object is THREE.Mesh {
  return Boolean((object as THREE.Mesh).isMesh && (object as THREE.Mesh).geometry);
}

function isSkinnedMesh(object: THREE.Object3D): object is THREE.SkinnedMesh {
  return Boolean((object as THREE.SkinnedMesh).isSkinnedMesh);
}

function hasMorphTargets(geometry: THREE.BufferGeometry) {
  return Object.values(geometry.morphAttributes).some(
    (attributes) => attributes.length > 0,
  );
}

function triangleArea(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
  return new THREE.Vector3()
    .subVectors(b, a)
    .cross(new THREE.Vector3().subVectors(c, a))
    .length() * 0.5;
}

function snap(value: number, step: number) {
  return Math.round(value / step) * step;
}

function unique(values: string[]) {
  return [...new Set(values)];
}
