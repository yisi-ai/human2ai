import { CylinderGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

/** Deterministic, program-built example; no downloaded models or textures. */
export async function createBrickModelFixture(): Promise<ArrayBuffer> {
  const model = new Group();
  const materials = ["#efe5cf", "#337f83", "#b96747", "#708769", "#d4b684", "#e6b64c"].map(
    (color) => new MeshStandardMaterial({ color, roughness: 0.28, metalness: 0 }),
  );
  const stud = new CylinderGeometry(0.12, 0.12, 0.065, 20);
  function brick(x: number, y: number, z: number, width: number, depth: number, color: number, height = 0.32, studs = true): void {
    const body = new Mesh(new RoundedBoxGeometry(width * 0.4 - 0.015, height - 0.012, depth * 0.4 - 0.015, 2, 0.018), materials[color]);
    body.position.set(x, y + height / 2, z);
    model.add(body);
    if (studs) for (let i = 0; i < width; i++) for (let j = 0; j < depth; j++) {
      const top = new Mesh(stud, materials[color]);
      top.position.set(x + (i - (width - 1) / 2) * 0.4, y + height + 0.025, z + (j - (depth - 1) / 2) * 0.4);
      model.add(top);
    }
  }
  brick(0, 0, 0, 13, 10, 3, 0.16);
  brick(-0.4, 0.16, -0.2, 8, 6, 4, 0.16, false);
  for (let row = 0; row < 5; row++) {
    const y = 0.32 + row * 0.32;
    // Staggered rear and side walls, with a doorway and an inset front window.
    for (let side = 0; side < 2; side++) brick(-1.2 + side * 1.6, y, -1.2, 4, 1, 0);
    for (const x of [-1.8, 1]) for (const z of [-0.4, 0.4]) brick(x, y, z, 1, 2, 0);
    brick(-1.8, y, 0.8, 1, 1, 0);
    brick(-0.6, y, 0.8, 1, 1, 0);
    brick(1, y, 0.8, 1, 1, 0);
    if (row === 0 || row === 4) brick(0.2, y, 0.8, 3, 1, 0);
    if (row === 4) brick(-1.2, y, 0.8, 2, 1, 0);
  }
  brick(-1.2, 0.32, 0.72, 2, 1, 1, 1.25, false);
  brick(0.2, 0.65, 0.74, 3, 1, 1, 0.92, false);
  brick(0.2, 1.05, 0.96, 3, 1, 0, 0.08, false);
  brick(0.2, 0.65, 0.97, 0.2, 0.2, 0, 0.92, false);
  for (let level = 0; level < 4; level++) brick(-0.4, 1.92 + level * 0.16, -0.2, 9, 8 - level * 2, 2, 0.16);
  brick(-1.2, 0.16, 1.4, 3, 2, 4, 0.16, false);
  brick(1.8, 0.16, -0.8, 1, 1, 2, 0.96);
  brick(1.8, 1.12, -0.8, 3, 3, 3);
  brick(1.8, 1.44, -0.8, 2, 2, 3);
  brick(1.8, 1.76, -0.8, 1, 1, 3);
  brick(1.6, 0.16, 1.2, 2, 1, 2);
  brick(1.6, 0.48, 1.2, 2, 1, 5, 0.16);
  try {
    return await new GLTFExporter().parseAsync(model, { binary: true }) as ArrayBuffer;
  } finally {
    model.traverse((object) => { if (object instanceof Mesh) object.geometry.dispose(); });
    materials.forEach((material) => material.dispose());
  }
}
