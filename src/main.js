import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as dat from 'dat.gui';
import { HairMesh } from './HairMesh.js';

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.5, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

// --- Scalp & Hair Setup ---

// 1. Create a Head (Base)
const headGeometry = new THREE.SphereGeometry(0.5, 32, 32);
const headMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
const head = new THREE.Mesh(headGeometry, headMaterial);
head.position.y = 1;
scene.add(head);

// 2. Create a Scalp (Subset of Head)
// For simplicity, we'll just use a slightly larger sphere or a hemisphere as the scalp for now.
// In a real app, this would be a specific mesh part.
const scalpGeometry = new THREE.SphereGeometry(0.505, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.4); // Top part of sphere
const scalpMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, visible: false }); // Invisible scalp
const scalp = new THREE.Mesh(scalpGeometry, scalpMaterial);
head.add(scalp); // Attach to head

// 3. Initialize Hair Mesh
const hairMesh = new HairMesh(scalp, { length: 0.5 });

// Create Hair Material
import { HairMaterial } from './HairMaterial.js';
const hairMaterial = new HairMaterial({ length: 0.5 });
hairMaterial.uniforms.hairMap.value = hairMesh.hairMap;
hairMaterial.uniforms.prismCount.value = hairMesh.prismCount;

// Create Mesh for Strands
const strandsMesh = new THREE.Mesh(hairMesh.strandGeometry, hairMaterial);
// Use LINES mode
// strandsMesh.drawMode = THREE.Triangles; // Default
// We created indices for lines, so we should use LineSegments or just Mesh with wireframe? 
// No, we need gl.LINES. Three.js Mesh uses Triangles by default.
// We should use THREE.LineSegments or THREE.Line.
// But our geometry has indices for segments.
const linesMesh = new THREE.LineSegments(hairMesh.strandGeometry, hairMaterial);
head.add(linesMesh);

// head.add(hairMesh.prismMesh); // Hide debug mesh

// GUI
const gui = new dat.GUI();
const params = {
    hairDensity: 10000,
    hairLength: 0.5,
    hairColor: '#4a3b2a',
};

gui.add(params, 'hairLength', 0.1, 2.0).onChange(v => {
    hairMesh.update({ length: v });
    hairMaterial.uniforms.hairLength.value = v;
});

const stylingFolder = gui.addFolder('Styling');
stylingFolder.addColor(params, 'hairColor').name('Color').onChange(v => {
    hairMaterial.uniforms.color.value.set(v);
});
stylingFolder.add(hairMaterial.uniforms.frizzAmount, 'value', 0.0, 0.5).name('Frizz');
stylingFolder.add(hairMaterial.uniforms.curlFrequency, 'value', 0.0, 20.0).name('Curl Freq');
stylingFolder.add(hairMaterial.uniforms.curlAmplitude, 'value', 0.0, 0.2).name('Curl Amp');
stylingFolder.add(hairMaterial.uniforms.gravity, 'value', 0.0, 2.0).name('Gravity');
stylingFolder.open();

// Resize Handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();
