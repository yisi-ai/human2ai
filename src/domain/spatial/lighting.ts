import { Box3, BufferAttribute, DirectionalLight, DoubleSide, Group, Matrix3, Matrix4, Mesh, MeshLambertMaterial, Ray, Vector3 } from "three";
import type { SpatialDraft } from "./types.ts";

// Linear diffuse contributions. Three's Lambert lights use intensity / PI.
export const SPATIAL_LIGHTING = { ambient: .3, key: .85, direction: [-.65,.6,1.3], shadowSize: 2048, shadowRadius: 2, shadowStrength: .65 } as const;
export const getSpatialLighting = (draft: SpatialDraft) => draft.lightingEnabled
  ? SPATIAL_LIGHTING : { ...SPATIAL_LIGHTING, ambient: 1, key: 0, shadowStrength: 0 };
export const spatialSurfaces = (scene: Group): Mesh[] => {
  const meshes: Mesh[] = [];
  scene.traverse(object => { if (object instanceof Mesh && !object.userData.rig) meshes.push(object); });
  return meshes;
};

/** Fit all authored surfaces, excluding the editor grid and articulation helpers. */
export function fitSpatialLight(light: DirectionalLight, scene: Group): void {
  const bounds = new Box3();
  for (const mesh of spatialSurfaces(scene)) bounds.union(new Box3().setFromObject(mesh));
  const center = bounds.isEmpty() ? new Vector3() : bounds.getCenter(new Vector3());
  const extent = Math.max(.1,bounds.getSize(new Vector3()).length());
  light.position.copy(center).addScaledVector(new Vector3(...SPATIAL_LIGHTING.direction).normalize(),extent);
  light.target.position.copy(center); light.target.updateMatrixWorld(); light.updateMatrixWorld();
  const camera = light.shadow.camera;
  camera.position.copy(light.position); camera.lookAt(center); camera.updateMatrixWorld();
  const viewBounds = bounds.isEmpty() ? new Box3(new Vector3(-.5,-.5,-.5),new Vector3(.5,.5,.5)) : bounds.clone().applyMatrix4(camera.matrixWorldInverse);
  const pad = extent * .02;
  camera.left = viewBounds.min.x-pad; camera.right = viewBounds.max.x+pad;
  camera.bottom = viewBounds.min.y-pad; camera.top = viewBounds.max.y+pad;
  camera.near = Math.max(.001,-viewBounds.max.z-pad); camera.far = Math.max(camera.near+.1,-viewBounds.min.z+pad);
  camera.updateProjectionMatrix();
  const texel = Math.max(camera.right-camera.left,camera.top-camera.bottom)/SPATIAL_LIGHTING.shadowSize;
  light.castShadow = true; light.shadow.mapSize.setScalar(SPATIAL_LIGHTING.shadowSize);
  light.shadow.radius = SPATIAL_LIGHTING.shadowRadius;
  light.shadow.intensity = SPATIAL_LIGHTING.shadowStrength;
  light.shadow.normalBias = texel*2; light.shadow.bias = -texel*2/(camera.far-camera.near);
  light.shadow.needsUpdate = true;
}

type SurfaceTriangle = { a: Vector3; b: Vector3; c: Vector3; bounds: Box3; center: Vector3 };
type OcclusionNode = { bounds: Box3; triangles?: SurfaceTriangle[]; left?: OcclusionNode; right?: OcclusionNode };
function occlusionTree(triangles: SurfaceTriangle[]): OcclusionNode {
  const bounds = new Box3(); for (const triangle of triangles) bounds.union(triangle.bounds);
  if (triangles.length <= 12) return { bounds,triangles };
  const size = bounds.getSize(new Vector3()), axis = size.x > size.y && size.x > size.z ? "x" : size.y > size.z ? "y" : "z";
  triangles.sort((a,b)=>a.center[axis]-b.center[axis]);
  const middle = Math.floor(triangles.length/2);
  return { bounds,left:occlusionTree(triangles.slice(0,middle)),right:occlusionTree(triangles.slice(middle)) };
}

/** Short hemisphere rays darken nearby contacts, on the same posed skin in both renderers. */
export function applySpatialContactShading(scene: Group, draft: SpatialDraft, cached?: Float32Array[]): Float32Array[] {
  const meshes = spatialSurfaces(scene), triangles: SurfaceTriangle[] = [];
  const apply = (mesh: Mesh, colors: Float32Array) => {
    if (mesh.geometry.getAttribute("color")?.array !== colors) mesh.geometry.setAttribute("color",new BufferAttribute(colors,3));
    const material = mesh.material as MeshLambertMaterial;
    material.vertexColors = true; material.shadowSide = DoubleSide;
    mesh.castShadow = true; mesh.receiveShadow = true;
  };
  if (cached) { meshes.forEach((mesh,i)=>apply(mesh,cached[i])); return cached; }
  for (const mesh of meshes) {
    const positions = mesh.geometry.getAttribute("position"), indices = mesh.geometry.index;
    for (let i=0;i<(indices?.count??positions.count);i+=3) {
      const [a,b,c] = [0,1,2].map(j=>new Vector3().fromBufferAttribute(positions,indices?indices.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
      triangles.push({ a,b,c,bounds:new Box3().setFromPoints([a,b,c]),center:a.clone().add(b).add(c).multiplyScalar(1/3) });
    }
  }
  if (!triangles.length) return [];
  const result: Float32Array[] = [];
  const tree = occlusionTree(triangles), ray = new Ray(), hit = new Vector3();
  const blocked = (node: OcclusionNode, radius: number): boolean => {
    if (node.bounds.distanceToPoint(ray.origin)>radius || !ray.intersectsBox(node.bounds)) return false;
    if (node.triangles) return node.triangles.some(t=>ray.intersectTriangle(t.a,t.b,t.c,false,hit)!==null && hit.distanceToSquared(ray.origin)<radius*radius);
    return blocked(node.left!,radius)||blocked(node.right!,radius);
  };
  const point = new Vector3(), normal = new Vector3(), tangent = new Vector3(), bitangent = new Vector3();
  const samples = Array.from({length:8},(_,i)=>{const z=Math.sqrt(1-(i+.5)/8),r=Math.sqrt(1-z*z),angle=i*2.399963229728653;return [r*Math.cos(angle),r*Math.sin(angle),z];});
  for (const mesh of meshes) {
    const positions = mesh.geometry.getAttribute("position"), normals = mesh.geometry.getAttribute("normal");
    const normalMatrix = new Matrix3().getNormalMatrix(mesh.matrixWorld);
    const actor = draft.characters.find(c=>c.id===mesh.userData.characterId);
    const radius = (actor?.height ?? Math.max(...(draft.objects.find(o=>o.id===mesh.userData.objectId)?.size ?? [1]))) * .025;
    const colors = new Float32Array(positions.count*3);
    for (let i=0;i<positions.count;i++) {
      point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
      normal.fromBufferAttribute(normals,i).applyNormalMatrix(normalMatrix);
      tangent.set(Math.abs(normal.y)<.9?0:1,Math.abs(normal.y)<.9?1:0,0).cross(normal).normalize();
      bitangent.crossVectors(normal,tangent);
      ray.origin.copy(point).addScaledVector(normal,radius*.025);
      let occluded=0;
      for (const [x,y,z] of samples) {
        ray.direction.copy(normal).multiplyScalar(z).addScaledVector(tangent,x).addScaledVector(bitangent,y);
        if (blocked(tree,radius)) occluded++;
      }
      colors.fill(1-.5*occluded/samples.length,i*3,i*3+3);
    }
    apply(mesh,colors); result.push(colors);
  }
  return result;
}

/** CPU equivalent of the editor's fitted directional shadow map. */
export function spatialShadowSampler(scene: Group) {
  const light = new DirectionalLight(); fitSpatialLight(light,scene);
  const camera = light.shadow.camera, size = SPATIAL_LIGHTING.shadowSize;
  const matrix = new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const depths = new Float32Array(size*size).fill(Infinity);
  for (const mesh of spatialSurfaces(scene)) {
    const geometry = mesh.geometry, positions = geometry.getAttribute("position"), indices = geometry.index;
    const transform = matrix.clone().multiply(mesh.matrixWorld);
    for (let i=0;i<(indices?.count??positions.count);i+=3) {
      const p = [0,1,2].map(j=>new Vector3().fromBufferAttribute(positions,indices?indices.getX(i+j):i+j).applyMatrix4(transform));
      for (const v of p) { v.x=(v.x+1)*size/2; v.y=(v.y+1)*size/2; }
      const [a,b,c] = p, area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
      if (Math.abs(area)<1e-9) continue;
      const x0=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),x1=Math.min(size-1,Math.ceil(Math.max(a.x,b.x,c.x)));
      const y0=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),y1=Math.min(size-1,Math.ceil(Math.max(a.y,b.y,c.y)));
      for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++) {
        const u=((b.x-x-.5)*(c.y-y-.5)-(b.y-y-.5)*(c.x-x-.5))/area;
        const v=((c.x-x-.5)*(a.y-y-.5)-(c.y-y-.5)*(a.x-x-.5))/area,w=1-u-v;
        if (u<0||v<0||w<0) continue;
        const index=y*size+x; depths[index]=Math.min(depths[index],u*a.z+v*b.z+w*c.z);
      }
    }
  }
  const projected = new Vector3(), viewNormal = new Vector3();
  const normalMatrix = new Matrix3().getNormalMatrix(camera.matrixWorldInverse);
  const bias = -2*light.shadow.bias;
  return {
    slope(normal: Vector3): [number,number] {
      viewNormal.copy(normal).applyNormalMatrix(normalMatrix);
      const z = Math.abs(viewNormal.z)<.001 ? (viewNormal.z<0?-.001:.001) : viewNormal.z;
      const scale = 2/((camera.far-camera.near)*size*z);
      return [viewNormal.x*(camera.right-camera.left)*scale,viewNormal.y*(camera.top-camera.bottom)*scale];
    },
    sample(point: Vector3, slopeX: number, slopeY: number): number {
      projected.copy(point).applyMatrix4(matrix);
      const x=(projected.x+1)*size/2-.5,y=(projected.y+1)*size/2-.5;
      const radius = SPATIAL_LIGHTING.shadowRadius*.75;
      let visible=0;
      for (const [dx,dy] of [[0,0],[-radius,0],[radius,0],[0,-radius],[0,radius]]) {
        const sx=Math.round(x+dx),sy=Math.round(y+dy);
        // Compare at each tap's receiver-plane depth, avoiding stripes on sloped skin.
        const receiver = projected.z+slopeX*(sx-x)+slopeY*(sy-y);
        visible += sx<0||sy<0||sx>=size||sy>=size||receiver<=depths[sy*size+sx]+bias ? 1 : 0;
      }
      return visible/5;
    }
  };
}
