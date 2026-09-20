// Convert the CC0 Quaternius source into a synchronous, shared rendering asset.
// Usage: node scripts/prepare-spatial-model.mjs /path/to/Superhero_{Male,Female}_FullBody.gltf
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Matrix4, Quaternion, Vector3 } from "three";
const source = process.argv[2];
if (!source) throw new Error("Pass the official Superhero Male or Female FullBody glTF path");
const name = path.basename(source, ".gltf");
if (!["Superhero_Male_FullBody", "Superhero_Female_FullBody"].includes(name)) throw new Error("Unsupported source body");
const female = name === "Superhero_Female_FullBody";
const gltf = JSON.parse(await readFile(source, "utf8"));
const buffers = await Promise.all(gltf.buffers.map(b => readFile(path.resolve(path.dirname(source), b.uri))));
const accessor = id => {
  const a = gltf.accessors[id], b = gltf.bufferViews[a.bufferView], data = buffers[b.buffer];
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
  const [size, read] = { 5121: [1, "readUInt8"], 5123: [2, "readUInt16LE"], 5125: [4, "readUInt32LE"], 5126: [4, "readFloatLE"] }[a.componentType];
  return Array.from({ length: a.count }, (_, i) => Array.from({ length: width }, (__, j) => data[read]((b.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (b.byteStride ?? width * size) + j * size)));
};
const parent = new Map(); gltf.nodes.forEach((n,i) => n.children?.forEach(c=>parent.set(c,i)));
const matrices = new Map();
const world = id => {
  if (matrices.has(id)) return matrices.get(id);
  const n = gltf.nodes[id], local = n.matrix ? new Matrix4().fromArray(n.matrix) : new Matrix4().compose(new Vector3(...n.translation ?? [0,0,0]), new Quaternion(...n.rotation ?? [0,0,0,1]), new Vector3(...n.scale ?? [1,1,1]));
  const m = parent.has(id) ? world(parent.get(id)).clone().multiply(local) : local; matrices.set(id,m); return m;
};
const at = name => new Vector3().setFromMatrixPosition(world(gltf.nodes.findIndex(n=>n.name===name))).toArray();
const points = { pelvis: at("pelvis"), spine: at("spine_02"), chest: [0, at("upperarm_l")[1], at("upperarm_l")[2]], neck: at("Head") };
let top = -Infinity, bottom = Infinity;
for (const mesh of gltf.meshes) for (const p of mesh.primitives) for (const v of accessor(p.attributes.POSITION)) { top = Math.max(top,v[1]); bottom = Math.min(bottom,v[1]); }
points.head = [0, top, points.neck[2]];
for (const [side,suffix] of [["left","l"],["right","r"]]) {
  for (const [id,name] of [["shoulder","upperarm"],["elbow","lowerarm"],["wrist","hand"],["hand","middle_04_leaf"],["hip","thigh"],["knee","calf"],["ankle","foot"],["foot","ball_leaf"]]) points[`${side}-${id}`] = at(`${name}_${suffix}`);
  // The palm ends inside the palm. Finger roots retain the source landmarks.
  points[`${side}-hand`] = new Vector3(...points[`${side}-wrist`]).lerp(new Vector3(...points[`${side}-hand`]), .35).toArray();
  for (const finger of ["thumb", "index", "middle", "ring", "little"]) for (let i = 0; i < 4; i++) {
    points[`${side}-${finger}-${i}`] = at(`${finger === "little" ? "pinky" : finger}_0${i+1}${i === 3 ? "_leaf" : ""}_${suffix}`);
  }
}
const parts = [{ id: "pelvis", start: points.pelvis, end: points.spine }];
for (const [id,start] of [["spine","pelvis"],["chest","spine"],["neck","chest"],["head","neck"]]) parts.push({ id, start: points[start], end: points[id] });
for (const side of ["left","right"]) for (const [id,start] of [["shoulder","chest"],["elbow",`${side}-shoulder`],["wrist",`${side}-elbow`],["hand",`${side}-wrist`],["hip","pelvis"],["knee",`${side}-hip`],["ankle",`${side}-knee`],["foot",`${side}-ankle`]]) parts.push({ id:`${side}-${id}`, start:points[start],end:points[`${side}-${id}`] });
for (const side of ["left", "right"]) for (const finger of ["thumb", "index", "middle", "ring", "little"]) for (let i = 0; i < 4; i++) {
  parts.push({ id: `${side}-${finger}-${i}`, start: points[i ? `${side}-${finger}-${i-1}` : `${side}-hand`], end: points[`${side}-${finger}-${i}`] });
}
const partFor = name => {
  if (name === "Head") return "head";
  if (name === "neck_01") return "neck";
  if (name === "spine_01") return "spine";
  if (name.startsWith("spine_")) return "chest";
  const side = name.endsWith("_l") ? "left" : name.endsWith("_r") ? "right" : null;
  if (!side) return "pelvis";
  const prefix = name.split("_")[0];
  if (["thumb", "index", "middle", "ring", "pinky"].includes(prefix)) return `${side}-${prefix === "pinky" ? "little" : prefix}-${Math.min(3, Number(name.split("_")[1]))}`;
  return `${side}-${({ clavicle:"shoulder", upperarm:"elbow", lowerarm:"wrist", thigh:"knee", calf:"ankle", foot:"foot", ball:"foot" })[prefix] ?? "hand"}`;
};
const partIndex = name => parts.findIndex(p=>p.id===name);
const skinParts = gltf.skins[0].joints.map(id=>partIndex(partFor(gltf.nodes[id].name)));
const positions=[], influences=[], weights=[], modules=[];
for (const mesh of gltf.meshes) for (const p of mesh.primitives) {
  const start = positions.length/3, vertices = accessor(p.attributes.POSITION), joints = accessor(p.attributes.JOINTS_0), sourceWeights = accessor(p.attributes.WEIGHTS_0);
  for (let i=0;i<vertices.length;i++) {
    positions.push(...vertices[i]);
    const merged = new Map(); joints[i].forEach((j,k)=>merged.set(skinParts[j],(merged.get(skinParts[j])??0)+sourceWeights[i][k]));
    const sorted = [...merged].sort((a,b)=>b[1]-a[1]); while(sorted.length<4)sorted.push([0,0]);
    const total = sorted.reduce((sum,v)=>sum+v[1],0);
    influences.push(...sorted.map(v=>v[0])); weights.push(...sorted.map(v=>v[1]/total));
  }
  const groups = new Map();
  const indices = accessor(p.indices).flat();
  for(let i=0;i<indices.length;i+=3) {
    const triangle=indices.slice(i,i+3).map(v=>v+start), scores=new Map();
    for(const v of triangle) for(let k=0;k<4;k++) { const part=influences[v*4+k];scores.set(part,(scores.get(part)??0)+weights[v*4+k]); }
    const part=[...scores].sort((a,b)=>b[1]-a[1])[0][0];
    if(!groups.has(part))groups.set(part,[]);groups.get(part).push(...triangle);
  }
  for(const [part,indices] of groups) modules.push({ part, material:p.material===0?"brows":p.material===1?"eyes":"body", indices });
}
const round = v=>Math.round(v*1e6)/1e6;
const result={ source:`Quaternius Universal Base Characters — ${name}`, height:top-bottom, parts, positions:positions.map(round), influences, weights:weights.map(round), modules };
await mkdir("src/domain/spatial/assets",{recursive:true});
await writeFile(`src/domain/spatial/assets/quaternius-superhero${female ? "-female" : ""}.json`,JSON.stringify(result));
await writeFile(`src/domain/spatial/assets/quaternius${female ? "-female" : ""}-rig.json`,JSON.stringify({height:top-bottom,bottom,parts},null,2)+"\n");
console.log({ vertices:positions.length/3,triangles:modules.reduce((s,m)=>s+m.indices.length/3,0),modules:modules.length,height:result.height,points });
