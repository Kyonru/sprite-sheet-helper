import * as THREE from "three";
import type {
  MaterialAsset,
  MaterialAssignment,
  MaterialInventoryItem,
  MaterialMapKind,
  MaterialOriginalSnapshot,
  MaterialTextureAsset,
} from "@/types/materials";
import { readFileFromFS } from "@/utils/file-system/fs.web";

const ORIGINAL_MATERIALS_KEY = "__sshOriginalMaterials";
const MATERIAL_PATH_KEY = "__sshMaterialPath";

type MeshWithMaterial = THREE.Mesh & {
  material: THREE.Material | THREE.Material[];
};

type TextureCache = Map<string, Promise<THREE.Texture>>;

const textureCache: TextureCache = new Map();

export function buildMaterialInventory(
  object: THREE.Object3D,
  modelUuid?: string,
): MaterialInventoryItem[] {
  const inventory: MaterialInventoryItem[] = [];

  walkObject(object, "", (child, meshPath) => {
    if (!isMeshWithMaterial(child)) return;
    child.userData[MATERIAL_PATH_KEY] = meshPath;
    ensureOriginalMaterials(child);
    const originalMaterials = getOriginalMaterials(child);
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    materials.forEach((material, materialSlot) => {
      const original = originalMaterials[materialSlot] ?? material;
      inventory.push({
        id: createMaterialAssignmentId(modelUuid ?? "", meshPath, materialSlot),
        modelUuid,
        meshPath,
        meshName: child.name || meshPath.split("/").at(-1) || "Mesh",
        materialSlot,
        originalMaterialName: original.name || `Material ${materialSlot + 1}`,
        original: snapshotThreeMaterial(original),
      });
    });
  });

  return inventory;
}

export async function applyMaterialAssignments(
  object: THREE.Object3D,
  modelUuid: string,
  _inventory: MaterialInventoryItem[],
  materials: Record<string, MaterialAsset>,
  assignments: Record<string, MaterialAssignment>,
  textures: Record<string, MaterialTextureAsset>,
) {
  const pending: Promise<void>[] = [];
  walkObject(object, "", (child, meshPath) => {
    if (!isMeshWithMaterial(child)) return;
    pending.push(
      applyMeshAssignments(
        child,
        modelUuid,
        meshPath,
        materials,
        assignments,
        textures,
      ),
    );
  });
  await Promise.all(pending);
}

export async function createThreeMaterial(
  asset: MaterialAsset,
  textures: Record<string, MaterialTextureAsset>,
): Promise<THREE.Material> {
  const material = createBaseMaterial(asset);
  await applyTextureRefs(material, asset, textures);
  material.needsUpdate = true;
  return material;
}

export function clearMaterialTextureCache() {
  textureCache.forEach((promise) => {
    void promise.then((texture) => texture.dispose());
  });
  textureCache.clear();
}

export function createMaterialAssignmentId(
  modelUuid: string,
  meshPath: string,
  materialSlot: number,
) {
  return `${modelUuid}::${meshPath}::${materialSlot}`;
}

function createBaseMaterial(asset: MaterialAsset): THREE.Material {
  const common = {
    name: asset.name,
    color: new THREE.Color(asset.color),
    opacity: asset.opacity,
    transparent: asset.transparent || asset.opacity < 1,
    wireframe: asset.wireframe,
    side: toThreeSide(asset.side),
    depthWrite: asset.depthWrite,
  };

  if (asset.lightingMode === "unlit") {
    return new THREE.MeshBasicMaterial(common);
  }

  return new THREE.MeshStandardMaterial({
    ...common,
    roughness: asset.roughness,
    metalness: asset.metalness,
    emissive: new THREE.Color(asset.emissive),
    emissiveIntensity: asset.emissiveIntensity,
    flatShading: asset.flatShading || asset.lightingMode === "flat",
  });
}

async function applyTextureRefs(
  material: THREE.Material,
  asset: MaterialAsset,
  textures: Record<string, MaterialTextureAsset>,
) {
  const entries = Object.entries(asset.textureRefs) as [
    MaterialMapKind,
    string | undefined,
  ][];

  for (const [kind, textureId] of entries) {
    if (!textureId) continue;
    const textureAsset = textures[textureId];
    if (!textureAsset) continue;
    const texture = await loadTexture(textureAsset, asset.nearestFiltering, kind);
    assignTexture(material, kind, texture);
  }
}

function assignTexture(
  material: THREE.Material,
  kind: MaterialMapKind,
  texture: THREE.Texture,
) {
  const target = material as THREE.MeshStandardMaterial & THREE.MeshBasicMaterial;
  switch (kind) {
    case "albedo":
      target.map = texture;
      break;
    case "normal":
      if ("normalMap" in target) target.normalMap = texture;
      break;
    case "roughness":
      if ("roughnessMap" in target) target.roughnessMap = texture;
      break;
    case "metalness":
      if ("metalnessMap" in target) target.metalnessMap = texture;
      break;
    case "ao":
      if ("aoMap" in target) target.aoMap = texture;
      break;
    case "emissive":
      if ("emissiveMap" in target) target.emissiveMap = texture;
      break;
  }
}

function loadTexture(
  textureAsset: MaterialTextureAsset,
  nearest: boolean,
  kind: MaterialMapKind,
): Promise<THREE.Texture> {
  const cacheKey = `${textureAsset.uuid}:${kind}:${nearest ? "nearest" : "linear"}`;
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const promise = readFileFromFS(textureAsset.filePath, "materials")
    .then((file) => {
      const url = URL.createObjectURL(file);
      return new Promise<THREE.Texture>((resolve, reject) => {
        new THREE.TextureLoader().load(
          url,
          (texture) => {
            URL.revokeObjectURL(url);
            texture.colorSpace = kind === "albedo" || kind === "emissive"
              ? THREE.SRGBColorSpace
              : THREE.NoColorSpace;
            texture.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
            texture.minFilter = nearest
              ? THREE.NearestFilter
              : THREE.LinearMipmapLinearFilter;
            texture.generateMipmaps = !nearest;
            texture.needsUpdate = true;
            resolve(texture);
          },
          undefined,
          (error) => {
            URL.revokeObjectURL(url);
            reject(error);
          },
        );
      });
    });
  textureCache.set(cacheKey, promise);
  return promise;
}

async function applyMeshAssignments(
  mesh: MeshWithMaterial,
  modelUuid: string,
  meshPath: string,
  materials: Record<string, MaterialAsset>,
  assignments: Record<string, MaterialAssignment>,
  textures: Record<string, MaterialTextureAsset>,
) {
  mesh.userData[MATERIAL_PATH_KEY] = meshPath;
  ensureOriginalMaterials(mesh);
  const originalMaterials = getOriginalMaterials(mesh);
  const slots = Array.isArray(mesh.material)
    ? mesh.material.length
    : originalMaterials.length;
  const nextMaterials: THREE.Material[] = [];

  for (let materialSlot = 0; materialSlot < slots; materialSlot++) {
    const assignment =
      assignments[createMaterialAssignmentId(modelUuid, meshPath, materialSlot)];
    const asset = assignment ? materials[assignment.materialId] : undefined;
    nextMaterials[materialSlot] = asset
      ? await createThreeMaterial(asset, textures)
      : originalMaterials[materialSlot]?.clone() ??
        new THREE.MeshStandardMaterial();
  }

  mesh.material = Array.isArray(mesh.material) ? nextMaterials : nextMaterials[0];
}

function walkObject(
  object: THREE.Object3D,
  parentPath: string,
  visit: (child: THREE.Object3D, path: string) => void,
) {
  object.children.forEach((child, index) => {
    const segment = `${sanitizePathPart(child.name || child.type || "Object")}[${index}]`;
    const path = parentPath ? `${parentPath}/${segment}` : segment;
    visit(child, path);
    walkObject(child, path, visit);
  });
}

function sanitizePathPart(value: string) {
  return value.replace(/[/:]/g, "_");
}

function isMeshWithMaterial(object: THREE.Object3D): object is MeshWithMaterial {
  return Boolean((object as THREE.Mesh).isMesh && (object as THREE.Mesh).material);
}

function ensureOriginalMaterials(mesh: MeshWithMaterial) {
  if (mesh.userData[ORIGINAL_MATERIALS_KEY]) return;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mesh.userData[ORIGINAL_MATERIALS_KEY] = materials.map((material) =>
    material.clone(),
  );
}

function getOriginalMaterials(mesh: MeshWithMaterial): THREE.Material[] {
  ensureOriginalMaterials(mesh);
  return mesh.userData[ORIGINAL_MATERIALS_KEY] as THREE.Material[];
}

function snapshotThreeMaterial(
  material: THREE.Material,
): MaterialOriginalSnapshot {
  const standard = material as THREE.MeshStandardMaterial;
  const basic = material as THREE.MeshBasicMaterial;
  return {
    name: material.name || "Imported Material",
    color: colorToHex(standard.color ?? basic.color),
    opacity: material.opacity,
    transparent: material.transparent,
    roughness: standard.roughness,
    metalness: standard.metalness,
    emissive: standard.emissive ? colorToHex(standard.emissive) : "#000000",
    emissiveIntensity: standard.emissiveIntensity,
    wireframe: Boolean((material as THREE.MeshBasicMaterial).wireframe),
    side: fromThreeSide(material.side),
    depthWrite: material.depthWrite,
    flatShading: Boolean(standard.flatShading),
    hasTextures: {
      albedo: Boolean(standard.map ?? basic.map),
      normal: Boolean(standard.normalMap),
      roughness: Boolean(standard.roughnessMap),
      metalness: Boolean(standard.metalnessMap),
      ao: Boolean(standard.aoMap),
      emissive: Boolean(standard.emissiveMap),
    },
  };
}

type ThreeColorLike = {
  getHexString?: () => string;
  r?: number;
  g?: number;
  b?: number;
  x?: number;
  y?: number;
  z?: number;
};

function colorToHex(color?: THREE.Color | string | number | ThreeColorLike) {
  if (color === undefined) return "#ffffff";
  if (typeof color === "string") {
    const normalized = normalizeHexColor(color);
    if (normalized) return normalized;
  }

  if (typeof color === "number") {
    return `#${Math.round(color).toString(16).padStart(6, "0")}`;
  }

  if (typeof color === "object" && color && "getHexString" in color && color.getHexString) {
    try {
      return `#${color.getHexString()}`;
    } catch {
      // intentional fallback
    }
  }

  if (typeof color === "object" && color !== null) {
    const asColor = color as ThreeColorLike;
    const red = asColor.r ?? asColor.x;
    const green = asColor.g ?? asColor.y;
    const blue = asColor.b ?? asColor.z;
    if (
      red !== undefined &&
      green !== undefined &&
      blue !== undefined &&
      Number.isFinite(red) &&
      Number.isFinite(green) &&
      Number.isFinite(blue)
    ) {
      const fallback = new THREE.Color(red, green, blue);
      return `#${fallback.getHexString()}`;
    }

    try {
      return `#${new THREE.Color(color as unknown as string).getHexString()}`;
    } catch {
      // intentional fallback
    }
  }

  return "#ffffff";
}

function normalizeHexColor(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return "#ffffff";

  if (trimmed.startsWith("#") && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    if (trimmed.length === 4) {
      const [, r, g, b] = trimmed;
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return trimmed;
  }

  if (/^0x[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.slice(2)}`;
  }

  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed}`;
  }

  return undefined;
}

function toThreeSide(side: "front" | "back" | "double") {
  if (side === "back") return THREE.BackSide;
  if (side === "double") return THREE.DoubleSide;
  return THREE.FrontSide;
}

function fromThreeSide(side: THREE.Side) {
  if (side === THREE.BackSide) return "back";
  if (side === THREE.DoubleSide) return "double";
  return "front";
}
