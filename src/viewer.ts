import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** A single Three.js scene that loads one .glb model at a time, framing the camera to it. */
export function createViewer(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x16181c);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
  camera.position.set(2, 1.6, 3);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  const hemi = new THREE.HemisphereLight(0xffffff, 0x33363c, 1.1);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(-3, 2, -2);
  scene.add(fill);

  const grid = new THREE.GridHelper(10, 20, 0x33363c, 0x24262b);
  scene.add(grid);

  const loader = new GLTFLoader();
  let current: THREE.Object3D | null = null;
  // Bumped on every load()/loadScene() call so a slower, superseded load can tell it's
  // stale once its await resolves and bail out instead of clobbering a newer one.
  let loadToken = 0;

  function disposeObject(object: THREE.Object3D) {
    object.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (material) {
        const materials = Array.isArray(material) ? material : [material];
        for (const mat of materials) {
          for (const key of Object.keys(mat) as (keyof THREE.Material)[]) {
            const value = mat[key];
            if (value && typeof value === 'object' && 'isTexture' in value) {
              (value as THREE.Texture).dispose();
            }
          }
          mat.dispose();
        }
      }
    });
  }

  function disposeCurrent() {
    if (!current) return;
    scene.remove(current);
    disposeObject(current);
    current = null;
  }

  /** Loads a model by URL, replacing whatever is currently shown, and frames the camera to it. */
  async function load(url: string): Promise<void> {
    const token = ++loadToken;
    const gltf = await loader.loadAsync(url);
    if (token !== loadToken) return; // superseded by a newer load/loadScene call
    disposeCurrent();
    current = gltf.scene;
    scene.add(current);
    frameToObject(current);
  }

  /**
   * Loads every given model into one shared scene, laid out in a grid on the ground so
   * they can be compared side by side, and frames the camera to the whole group.
   */
  async function loadScene(models: { url: string }[]): Promise<void> {
    const token = ++loadToken;
    const gltfs = await Promise.all(models.map((m) => loader.loadAsync(m.url)));
    if (token !== loadToken) return; // superseded

    disposeCurrent();
    const group = new THREE.Group();

    const placed = gltfs.map((gltf) => {
      const object = gltf.scene;
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      // Sit each model on y=0 and centre it on its own footprint, so grid placement
      // below only has to worry about spacing, not each model's own off-centre origin.
      object.position.x -= (box.min.x + box.max.x) / 2;
      object.position.y -= box.min.y;
      object.position.z -= (box.min.z + box.max.z) / 2;
      group.add(object);
      return { object, footprint: Math.max(size.x, size.z) };
    });

    const cols = Math.ceil(Math.sqrt(placed.length));
    const spacing = Math.max(...placed.map((p) => p.footprint), 0.001) * 1.6;
    placed.forEach(({ object }, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      object.position.x += (col - (cols - 1) / 2) * spacing;
      object.position.z += (row - (cols - 1) / 2) * spacing;
    });

    current = group;
    scene.add(group);
    frameToObject(group);
  }

  function frameToObject(object: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.length() / 2, 0.001);

    // Sit the model on the grid rather than straddling it.
    object.position.y -= box.min.y;
    center.y -= box.min.y;

    const distance = radius / Math.sin((camera.fov * Math.PI) / 360);
    camera.near = distance / 100;
    camera.far = distance * 100;
    camera.updateProjectionMatrix();

    const direction = new THREE.Vector3(1, 0.6, 1).normalize();
    camera.position.copy(center.clone().addScaledVector(direction, distance * 1.2));
    controls.target.copy(center);
    controls.update();
  }

  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  }

  function tick() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  resize();
  tick();

  return { load, loadScene };
}
