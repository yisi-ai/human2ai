import sharp, { type OverlayOptions } from "sharp";
import { Color, Group, LineBasicMaterial, LineSegments, Matrix3, Matrix4, Mesh, MeshLambertMaterial, Vector3, Vector4 } from "three";
import { createOutputCamera, createSpatialScene, disposeSpatialScene } from "../domain/spatial/scene.ts";
import { fingerPart } from "../domain/spatial/hands.ts";
import { jointWorldTransforms } from "../domain/spatial/kinematics.ts";
import { applySpatialContactShading, getSpatialLighting, spatialShadowSampler } from "../domain/spatial/lighting.ts";
import type { SpatialCamera, SpatialDraft, SpatialRenderPass } from "../domain/spatial/types.ts";
import { SPATIAL_BOX_FACES, SPATIAL_BOX_GAP, SPATIAL_BOX_LABEL_HEIGHT, type SpatialBoxFace, type SpatialBoxView, type SpatialCameraBox } from "../domain/spatial/types.ts";
import { cameraBoxView } from "../domain/spatial/camera-box.ts";
import { cameraBoxSheetLayout } from "../domain/spatial/camera-box-sheet.ts";
import en from "../../locales/en/common.json" with { type: "json" };
import { spatialEntityRenderKey } from "../domain/spatial/render-inputs.ts";

/** Worker-owned geometry/contact cache, shared across cameras and box faces. */
export class SpatialRenderContext {
  private scenes = new Map<string, { scene: Group; colored: boolean; shadows?: ReturnType<typeof spatialShadowSampler> }>();

  get(draft: SpatialDraft, pass: SpatialRenderPass) {
    const key = JSON.stringify([draft.characters.map(spatialEntityRenderKey), draft.objects.map(spatialEntityRenderKey), pass !== "depth", Boolean(draft.lightingEnabled)]);
    let prepared = this.scenes.get(key);
    if (!prepared) {
      prepared = { scene: createSpatialScene(draft, { handCreases: pass !== "depth" }), colored: false };
      this.scenes.set(key, prepared);
      if (this.scenes.size > 2) {
        const oldest = this.scenes.keys().next().value!;
        disposeSpatialScene(this.scenes.get(oldest)!.scene); this.scenes.delete(oldest);
      }
    }
    if (pass === "color" && !prepared.colored) {
      applySpatialContactShading(prepared.scene, draft);
      if (draft.lightingEnabled) prepared.shadows = spatialShadowSampler(prepared.scene);
      prepared.colored = true;
    }
    return prepared;
  }

  dispose(): void {
    this.scenes.forEach(value => disposeSpatialScene(value.scene)); this.scenes.clear();
  }
}

// A bounded, depth-buffered rasterizer keeps camera references and Agent PNG
// exports available in the Node service without requiring a browser or GPU.
export async function renderSpatialPng(draft: SpatialDraft, source: SpatialCamera, pass: SpatialRenderPass = "color", outputCamera?: ReturnType<typeof createOutputCamera>, context?: SpatialRenderContext): Promise<Buffer> {
  const camera = outputCamera ?? createOutputCamera(source);
  if (pass === "skeleton") return renderSkeletonPng(draft, source, camera);
  const prepared = context?.get(draft, pass);
  const scene = prepared?.scene ?? createSpatialScene(draft, { handCreases: pass !== "depth" });
  const transform = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const width = source.width, height = source.height;
  const lighting = getSpatialLighting(draft);
  const pixels = Buffer.alloc(width * height * 4);
  const depths = new Float64Array(width * height).fill(Infinity);
  const owners = pass !== "depth" ? new Uint32Array(width * height) : null;
  const slopeX = pass !== "depth" ? new Float64Array(width * height) : null;
  const slopeY = pass !== "depth" ? new Float64Array(width * height) : null;
  const directShare = pass === "color" && lighting.shadowStrength ? new Float32Array(width*height) : null;
  const geometricCharacters = new Set(pass === "color" ? draft.characters.filter(actor=>actor.appearance === "geometric").map(actor=>actor.id) : []);
  const outlinedOwners = new Set<number>();
  const ownerIds = new Map<string, number>();
  const ownerId = (data: Record<string, string>) => {
    const finger = fingerPart(data.modelPart ?? "");
    const geometric = geometricCharacters.has(data.characterId);
    // Adjacent phalanges belong to one digit: module seams are not creases.
    const part = finger ? (data.boneId ?? data.jointId).replace(/-[0-3]$/, "") : data.modelPart?.endsWith("-hand") ? data.boneId ?? data.jointId : "body";
    const key = JSON.stringify(data.objectId ? ["object", data.objectId] : geometric
      ? ["character", data.characterId, data.boneId ? "bone" : "joint", data.boneId ?? data.jointId]
      : ["character", data.characterId, part]);
    if (!ownerIds.has(key)) ownerIds.set(key, ownerIds.size + 1);
    const owner = ownerIds.get(key)!;
    if (geometric) outlinedOwners.add(owner);
    return owner;
  };
  if (pass !== "color") {
    pixels.fill(pass === "structure" ? 255 : 0);
    for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
  } else if (source.background) {
    const hex = source.background.slice(1);
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    for (let i = 0; i < pixels.length; i += 4) { pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255; }
  }
  const light = new Vector3(...lighting.direction).normalize();
  try {
    if (pass === "color" && !prepared) applySpatialContactShading(scene,draft);
    const shadows = directShare ? prepared?.shadows ?? spatialShadowSampler(scene) : null;
    scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const geometry = object.geometry, positions = geometry.getAttribute("position"), indices = geometry.index;
      const count = indices?.count ?? positions.count;
      const material = object.material as MeshLambertMaterial;
      const owner = owners ? ownerId(object.userData) : 0;
      const normals = geometry.getAttribute("normal"), contacts = geometry.getAttribute("color");
      const normalMatrix = new Matrix3().getNormalMatrix(object.matrixWorld);
      for (let index = 0; index < count; index += 3) {
        const vertices = [0,1,2].map(offset => {
          const i = indices ? indices.getX(index+offset) : index+offset;
          const p = new Vector3().fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);
          return { world:p,clip:new Vector4(p.x,p.y,p.z,1).applyMatrix4(transform),normal:new Vector3().fromBufferAttribute(normals,i).applyNormalMatrix(normalMatrix),ao:contacts?.getX(i)??1 };
        });
        const shadowSlope = shadows?.slope(vertices[1].world.clone().sub(vertices[0].world).cross(vertices[2].world.clone().sub(vertices[0].world)).normalize());
        const polygon = clipTriangle(vertices);
        for (let i = 1; i + 1 < polygon.length; i++) rasterize([polygon[0], polygon[i], polygon[i + 1]], material.color, owner, shadowSlope);
      }
    });
    if (directShare) {
      const inverse = transform.clone().invert(), point = new Vector3(), color = new Color();
      for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
        const i=y*width+x; if (!Number.isFinite(depths[i]) || !directShare[i]) continue;
        point.set((x+.5)*2/width-1,1-(y+.5)*2/height,depths[i]).applyMatrix4(inverse);
        const shade=1-directShare[i]*lighting.shadowStrength*(1-shadows!.sample(point,slopeX![i],slopeY![i]));
        if (shade>=1) continue;
        color.setRGB(pixels[i*4]/255,pixels[i*4+1]/255,pixels[i*4+2]/255).convertSRGBToLinear().multiplyScalar(shade).convertLinearToSRGB();
        pixels[i*4]=Math.round(color.r*255); pixels[i*4+1]=Math.round(color.g*255); pixels[i*4+2]=Math.round(color.b*255);
      }
    }
    // Both crease visibility and depth export use linear camera-space depth.
    let near = Infinity, far = -Infinity;
    for (let i = 0; i < depths.length; i++) {
      if (!Number.isFinite(depths[i])) continue;
      depths[i] = viewDepth(depths[i]);
      near = Math.min(near, depths[i]); far = Math.max(far, depths[i]);
    }
    if (pass === "depth") {
      // Box faces share a fixed metric range, even if one face sees very little geometry.
      if (outputCamera) { near = camera.near; far = camera.far; }
      for (let i = 0; i < depths.length; i++) if (Number.isFinite(depths[i])) {
        const gray = far > near ? 1 + Math.round(254 * (far - depths[i]) / (far - near)) : 255;
        pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = gray;
      }
    } else {
      if (pass === "structure" || outlinedOwners.size) drawBoundaries();
      scene.traverse(object => {
        if (!(object instanceof LineSegments) || object.userData.reference !== "finger-crease") return;
        const positions = object.geometry.getAttribute("position"), owner = ownerId(object.userData);
        const color = (object.material as LineBasicMaterial).color.clone().convertLinearToSRGB();
        for (let i = 0; i < positions.count; i += 2) {
          const points = [i, i + 1].map(index => {
            const p = new Vector3().fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
            return new Vector4(p.x, p.y, p.z, 1).applyMatrix4(transform);
          });
          const clipped = clipSegment(points[0], points[1]);
          if (clipped) drawCrease(clipped, owner, color);
        }
      });
    }
  } finally { if (!prepared) disposeSpatialScene(scene); }
  return sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();

  function rasterize(triangle: RenderVertex[], color: Color, owner: number, shadowSlope?: [number,number]) {
    const p = triangle.map(({clip:v}) => ({ x: (v.x / v.w + 1) * width / 2, y: (1 - v.y / v.w) * height / 2, z: v.z / v.w }));
    const edge = (a: typeof p[number], b: typeof p[number], x: number, y: number) => (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);
    const area = edge(p[0], p[1], p[2].x, p[2].y);
    if (Math.abs(area) < 1e-9) return;
    const zx = ((p[2].y - p[1].y) * p[0].z + (p[0].y - p[2].y) * p[1].z + (p[1].y - p[0].y) * p[2].z) / area;
    const zy = ((p[1].x - p[2].x) * p[0].z + (p[2].x - p[0].x) * p[1].z + (p[0].x - p[1].x) * p[2].z) / area;
    const x0 = Math.max(0, Math.floor(Math.min(...p.map(v => v.x)))), x1 = Math.min(width - 1, Math.ceil(Math.max(...p.map(v => v.x))));
    const y0 = Math.max(0, Math.floor(Math.min(...p.map(v => v.y)))), y1 = Math.min(height - 1, Math.ceil(Math.max(...p.map(v => v.y))));
    const normal = new Vector3(), shaded = new Color();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const a = edge(p[1], p[2], x + 0.5, y + 0.5) / area;
      const b = edge(p[2], p[0], x + 0.5, y + 0.5) / area;
      const c = 1 - a - b;
      if (a < -1e-7 || b < -1e-7 || c < -1e-7) continue;
      const depth = a * p[0].z + b * p[1].z + c * p[2].z;
      const pixel = y * width + x;
      if (depth >= depths[pixel]) continue;
      depths[pixel] = depth;
      if (owners) owners[pixel] = owner;
      if (slopeX && slopeY) { slopeX[pixel] = shadowSlope?.[0] ?? zx; slopeY[pixel] = shadowSlope?.[1] ?? zy; }
      if (pass === "color") {
        const u=a/triangle[0].clip.w,v=b/triangle[1].clip.w,w=c/triangle[2].clip.w,sum=u+v+w;
        normal.copy(triangle[0].normal).multiplyScalar(u).addScaledVector(triangle[1].normal,v).addScaledVector(triangle[2].normal,w).normalize();
        const ao=(triangle[0].ao*u+triangle[1].ao*v+triangle[2].ao*w)/sum;
        const key=lighting.key*Math.max(0,normal.dot(light)),intensity=lighting.ambient+key;
        if (directShare) directShare[pixel]=key/intensity;
        shaded.copy(color).multiplyScalar(intensity*ao).convertLinearToSRGB();
        pixels[pixel * 4] = Math.min(255,Math.round(shaded.r * 255)); pixels[pixel * 4 + 1] = Math.min(255,Math.round(shaded.g * 255)); pixels[pixel * 4 + 2] = Math.min(255,Math.round(shaded.b * 255)); pixels[pixel * 4 + 3] = 255;
      }
    }
  }

  function viewDepth(z: number) {
    return source.projection === "orthographic" ? camera.near + (z + 1) * (camera.far - camera.near) / 2
      : 2 * camera.near * camera.far / (camera.far + camera.near - z * (camera.far - camera.near));
  }
  function pixelSize(depth: number) {
    return source.projection === "orthographic" ? source.span / height : 2 * depth * Math.tan(source.fov * Math.PI / 360) / height;
  }
  function projectedDepth(depth: number) {
    return source.projection === "orthographic" ? 2 * (depth - camera.near) / (camera.far - camera.near) - 1
      : (camera.far + camera.near - 2 * camera.near * camera.far / depth) / (camera.far - camera.near);
  }
  function ink(pixel: number, gray: number) {
    pixels[pixel * 4] = pixels[pixel * 4 + 1] = pixels[pixel * 4 + 2] = Math.min(pixels[pixel * 4], gray);
  }
  function drawBoundaries() {
    const step = pass === "color" ? Math.max(1,Math.min(3,Math.round(Math.min(width,height)/700))) : 1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!owners![i] || (pass === "color" && !outlinedOwners.has(owners![i]))) continue;
      for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const nx = x + dx, ny = y + dy;
        // The image border is a crop, not a model contour.
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const n = ny * width + nx;
        if (pass === "color") {
          // Only the nearer visible part owns the stroke. Primitive identity
          // preserves close joint/bone boundaries without outlining triangles.
          if (owners![n] !== owners![i] && depths[i] <= depths[n]) {
            for (let channel=0;channel<3;channel++) pixels[i*4+channel] = Math.round(pixels[i*4+channel]*.48);
            break;
          }
          continue;
        }
        // Compare against this triangle's continuation, so steep but continuous
        // surfaces and skin-module boundaries do not turn into false outlines.
        const continued = viewDepth(projectedDepth(depths[i]) + slopeX![i] * dx + slopeY![i] * dy);
        const jump = depths[n] - depths[i];
        if (!owners![n] || jump > Math.max(pixelSize(depths[i]) * 4, Math.abs(continued - depths[i]) * 4)) {
          ink(i, 35); break;
        }
      }
    }
  }
  function drawCrease(segment: [Vector4, Vector4], owner: number, color: Color) {
    const rgb = [color.r, color.g, color.b].map(value => value * 255);
    const [a, b] = segment.map(v => ({ x: (v.x / v.w + 1) * width / 2, y: (1 - v.y / v.w) * height / 2, z: v.z / v.w }));
    const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
    if (length2 < 1e-10) return;
    const radius = Math.max(.65, Math.min(width, height) / 1100);
    const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - radius)), x1 = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x) + radius));
    const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - radius)), y1 = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y) + radius));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * width + x;
      if (owners![i] !== owner) continue;
      const t = Math.max(0, Math.min(1, ((x + .5 - a.x) * dx + (y + .5 - a.y) * dy) / length2));
      const distance = Math.hypot(x + .5 - a.x - t * dx, y + .5 - a.y - t * dy);
      if (distance > radius) continue;
      const depth = viewDepth(a.z + t * (b.z - a.z));
      if (depth > depths[i] + pixelSize(depth) * .75) continue;
      const coverage = Math.min(1, (radius - distance) * 2);
      if (pass === "structure") ink(i, Math.round(255 - 185 * coverage));
      else for (let channel = 0; channel < 3; channel++) {
        const index = i * 4 + channel, crease = rgb[channel];
        pixels[index] = Math.round(pixels[index] + (Math.min(pixels[index], crease) - pixels[index]) * coverage);
      }
    }
  }
}

async function renderSkeletonPng(draft: SpatialDraft, source: SpatialCamera, camera: ReturnType<typeof createOutputCamera>): Promise<Buffer> {
  const { width, height } = source, scale = Math.min(width,height)/1200;
  const transform = new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const project = (point: Vector3) => new Vector4(point.x,point.y,point.z,1).applyMatrix4(transform);
  const inside = (point: Vector4) => point.w > 0 && clipPlanes.every(distance=>distance(point)>=0);
  const screen = (point: Vector4) => ({ x:(point.x/point.w+1)*width/2, y:(1-point.y/point.w)*height/2, z:point.z/point.w });
  const parts: { depth: number; svg: string }[] = [];
  for (const actor of draft.characters) {
    const world = jointWorldTransforms(actor);
    for (const bone of actor.bones) {
      const start = world[bone.startJointId].position, end = world[bone.endJointId].position;
      const a = project(start), b = project(end), clipped = clipSegment(a.clone(),b.clone());
      if (!clipped) continue;
      const p = screen(clipped[0]), q = screen(clipped[1]);
      const finger = fingerPart(bone.modelPart);
      const color = bone.modelPart.startsWith("left") ? "#427ea9" : bone.modelPart.startsWith("right") ? "#b97337" : "#688296";
      if (bone.modelPart === "head" && inside(a) && inside(b)) {
        const center = start.clone().add(end).multiplyScalar(.5), c = screen(project(center));
        const across = center.clone().add(new Vector3(1,0,0).applyQuaternion(camera.quaternion).multiplyScalar(start.distanceTo(end)*.35));
        const edge = screen(project(across)), radius = Math.hypot(edge.x-c.x,edge.y-c.y);
        const length = Math.hypot(q.x-p.x,q.y-p.y), angle = Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI+90;
        parts.push({ depth:c.z, svg:`<ellipse cx="${c.x}" cy="${c.y}" rx="${radius}" ry="${Math.max(radius,length/2)}" transform="rotate(${angle} ${c.x} ${c.y})" fill="#e6eef3" stroke="${color}" stroke-width="${Math.max(1,6*scale)}"/>` });
      } else {
        const line = `<path d="M ${p.x} ${p.y} L ${q.x} ${q.y}" fill="none" stroke="${color}" stroke-width="${Math.max(1,(finger?5:13)*scale)}" stroke-linecap="round"/>`;
        // Clipped line endpoints are not anatomical joints: mark only real joints inside the view volume.
        const joint = inside(b) ? `<circle cx="${q.x}" cy="${q.y}" r="${Math.max(1.5,(finger?4:9)*scale)}" fill="white" stroke="${color}" stroke-width="${Math.max(1,(finger?2:4)*scale)}"/>` : "";
        parts.push({ depth:(p.z+q.z)/2, svg:line+joint });
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fafafa"/>${parts.sort((a,b)=>b.depth-a.depth).map(part=>part.svg).join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function renderSpatialCameraBoxPng(draft: SpatialDraft, box: SpatialCameraBox, view: SpatialBoxView | readonly SpatialBoxFace[] = "sheet", pass: SpatialRenderPass = "color", context?: SpatialRenderContext): Promise<Buffer> {
  const renderFace = (face: typeof SPATIAL_BOX_FACES[number]) => {
    const { source, camera } = cameraBoxView(box, face);
    return renderSpatialPng(draft, source, pass, camera, context);
  };
  if (typeof view === "string" && view !== "sheet") return renderFace(view);
  const size = box.resolution, labelHeight = SPATIAL_BOX_LABEL_HEIGHT, gap = SPATIAL_BOX_GAP;
  const { width, height, columns, rows, tiles } = cameraBoxSheetLayout(size, typeof view === "string" ? SPATIAL_BOX_FACES : view);
  // Separate cropped limbs at tile boundaries so they cannot visually join adjacent views.
  const verticalDividers = Array.from({ length: columns - 1 }, (_, index) => `<rect x="${(index + 1) * size + index * gap}" width="${gap}" height="${height}"/>`).join("");
  const horizontalDividers = Array.from({ length: rows - 1 }, (_, index) => `<rect y="${(index + 1) * (size + labelHeight) + index * gap}" width="${width}" height="${gap}"/>`).join("");
  const dividers = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><g fill="#dce1e7">${verticalDividers}${horizontalDividers}</g></svg>`);
  const composites: OverlayOptions[] = [{ input: dividers, left: 0, top: 0 }];
  // Sequential rendering bounds peak memory; all selected views read the same immutable revision.
  for (const { face, left, top } of tiles) {
    const key = `cameraBox${face[0].toUpperCase()}${face.slice(1)}` as keyof typeof en.spatial;
    const label = Buffer.from(`<svg width="${size}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><text x="${size/2}" y="19" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#283545">${en.spatial[key]}</text></svg>`);
    composites.push({ input: label, left, top }, { input: await renderFace(face), left, top: top + labelHeight });
  }
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(composites).png().toBuffer();
}

const clipPlanes = [(v: Vector4) => v.w + v.x, (v: Vector4) => v.w - v.x, (v: Vector4) => v.w + v.y, (v: Vector4) => v.w - v.y, (v: Vector4) => v.w + v.z, (v: Vector4) => v.w - v.z];

function clipSegment(a: Vector4, b: Vector4): [Vector4, Vector4] | null {
  for (const distance of clipPlanes) {
    const da = distance(a), db = distance(b);
    if (da < 0 && db < 0) return null;
    if (da < 0) a = a.clone().lerp(b, da / (da - db));
    else if (db < 0) b = b.clone().lerp(a, db / (db - da));
  }
  return [a, b];
}

type RenderVertex = { clip: Vector4; normal: Vector3; ao: number };
function clipTriangle(input: RenderVertex[]): RenderVertex[] {
  let vertices = input;
  for (const distance of clipPlanes) {
    const output: RenderVertex[] = [];
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i], b = vertices[(i + 1) % vertices.length];
      const da = distance(a.clip), db = distance(b.clip);
      if (da >= 0) output.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t=da/(da-db);
        output.push({clip:a.clip.clone().lerp(b.clip,t),normal:a.normal.clone().lerp(b.normal,t),ao:a.ao+(b.ao-a.ao)*t});
      }
    }
    vertices = output;
    if (!vertices.length) break;
  }
  return vertices;
}
