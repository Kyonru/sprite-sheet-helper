import * as THREE from "three";

export const fitObjectToCamera = (
  object: THREE.Object3D,
  camera: THREE.Camera,
  fill = 2, // 0 to 1, percentage of camera view to fill
): number => {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim === 0) return 1;

  let targetSize: number;

  if (camera instanceof THREE.PerspectiveCamera) {
    const distance = camera.position.length();
    const fovRad = (camera.fov * Math.PI) / 180;
    targetSize = Math.tan(fovRad / 2) * distance * fill;
  } else if (camera instanceof THREE.OrthographicCamera) {
    const viewHeight = camera.top - camera.bottom;
    targetSize = viewHeight * fill;
  } else {
    targetSize = 2 * fill;
  }

  return targetSize / maxDim;
};
