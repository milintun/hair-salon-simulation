import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as dat from 'dat.gui';
import { HairMesh } from './HairMesh.js';
import { InteractionManager } from './InteractionManager.js';
import { HairTrimmings } from './HairTrimmings.js';
import { ToolFactory } from './ToolFactory.js';
import { HairMaterial } from './HairMaterial.js';
import WebGL from 'three/examples/jsm/capabilities/WebGL.js';
import { TeapotGeometry } from 'three/examples/jsm/geometries/TeapotGeometry.js';

// Error Handler for debugging
window.addEventListener('error', (e) => {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.top = '0';
    div.style.left = '0';
    div.style.background = 'red';
    div.style.color = 'white';
    div.style.padding = '20px';
    div.style.zIndex = '9999';
    div.innerText = 'Error: ' + e.message + ' at ' + e.filename + ':' + e.lineno;
    document.body.appendChild(div);
});



// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.5, 3);

// HUD Setup
const hudScene = new THREE.Scene();
const hudCamera = new THREE.OrthographicCamera(
    window.innerWidth / -2, window.innerWidth / 2,
    window.innerHeight / 2, window.innerHeight / -2,
    1, 1000
);
hudCamera.position.z = 10;

// HUD Lighting
const hudAmbient = new THREE.AmbientLight(0xffffff, 1);
hudScene.add(hudAmbient);

const hudDirectional = new THREE.DirectionalLight(0xffffff, 1.5);
hudDirectional.position.set(0, 0, 10);
hudScene.add(hudDirectional);

// WebGL Support Check
if (!WebGL.isWebGL2Available()) {
    console.warn('WebGL 2 is not available. Attempting to run with WebGL 1...');
    const warning = WebGL.getWebGL2ErrorMessage();
    warning.style.display = 'none';
}

let renderer;
try {
    renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'low-power',
        precision: 'mediump',
        alpha: false,
        depth: true,
        stencil: false,
        failIfMajorPerformanceCaveat: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);
} catch (e) {
    console.error("Renderer creation failed:", e);
    const div = document.createElement('div');
    div.style.color = 'white';
    div.style.background = 'red';
    div.style.padding = '20px';
    div.innerHTML = '<h1>WebGL Error</h1><p>Could not create WebGL context.</p><pre>' + e.message + '</pre>';
    document.body.appendChild(div);
    throw e;
}

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

// Create a Head (Base)
const headGeometry = new TeapotGeometry(0.5);
const headMaterial = new THREE.MeshStandardMaterial({ color: 0xf4c2a0 }); // Skin tone
const head = new THREE.Mesh(headGeometry, headMaterial);
head.position.y = 1;
scene.add(head);

// Create a Scalp (Subset of Head)
// For simplicity, we'll just use a slightly larger sphere or a hemisphere as the scalp for now.
// In a real app, this would be a specific mesh part.
const scalpGeometry = new THREE.SphereGeometry(0.505, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.4); // Top part of sphere
const scalpMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, visible: false }); // Invisible scalp
const scalp = new THREE.Mesh(scalpGeometry, scalpMaterial);
head.add(scalp); // Attach to head

// Initialize Hair Mesh
const hairMesh = new HairMesh(scalp, { length: 0.5 });

// Create Hair Material
const hairMaterial = new HairMaterial({ length: 0.5 });
hairMaterial.uniforms.hairMap.value = hairMesh.hairMap;
hairMaterial.uniforms.lengthMap.value = hairMesh.lengthMap;
hairMaterial.uniforms.colorMap.value = hairMesh.colorMap;
hairMaterial.uniforms.curlMap.value = hairMesh.curlMap;
hairMaterial.uniforms.prismCount.value = hairMesh.prismCount;

// Tuning
hairMaterial.uniforms.gravity.value = 0.8; // Stronger gravity
hairMaterial.uniforms.frizzAmount.value = 0.2; // Some frizz
hairMesh.params.curlFrequency = 5.0; // Looser curls
hairMesh.params.curlAmplitude = 0.02; // Gentle wave
hairMesh.resetProperties(); // Apply to maps

// Create Mesh for Strands
const strandsMesh = new THREE.Mesh(hairMesh.strandGeometry, hairMaterial);
// Use LINES mode
const linesMesh = new THREE.LineSegments(hairMesh.strandGeometry, hairMaterial);
head.add(linesMesh);

// Hair Trimmings
const hairTrimmings = new HairTrimmings(scene);

// --- Tools Setup ---
const tools = [];
const toolMeshes = [];

const spacing = 160;
const totalTools = 6; // 6 tools (not counting reset button)
const totalWidth = totalTools * spacing;
const startX = -totalWidth / 2 + spacing / 2; // Center the tools
const yPos = -window.innerHeight / 2 + 80;

// Helper to setup tool for HUD
function setupHudTool(tool, index) {
    tool.scale.set(300, 300, 300);
    tool.rotation.set(0, 0, 0);

    if (tool.userData.type === 'scissors') tool.rotation.z = Math.PI / 4;
    if (tool.userData.type === 'dryer') tool.rotation.z = Math.PI / 4;
    if (tool.userData.type === 'curler') tool.rotation.z = Math.PI / 4;
    if (tool.userData.type === 'straightener') tool.rotation.z = Math.PI / 4;

    tool.position.set(startX + index * spacing, yPos, 0);

    // Store original pos for reset
    tool.userData.originalPos = tool.position.clone();

    hudScene.add(tool);
    tools.push(tool);
    toolMeshes.push(tool);
}

const scissors = ToolFactory.createScissors();
setupHudTool(scissors, 0);

const dryer = ToolFactory.createDryer();
setupHudTool(dryer, 1);

const curler = ToolFactory.createCurler();
setupHudTool(curler, 2);

const straightener = ToolFactory.createStraightener();
setupHudTool(straightener, 3);

const growthBottle = ToolFactory.createBottle('growth', 0x00ff00);
setupHudTool(growthBottle, 4);

const dyeBottle = ToolFactory.createBottle('dye', 0xff0000);
setupHudTool(dyeBottle, 5);

// Reset Button
const canvas = document.createElement('canvas');
canvas.width = 128;
canvas.height = 64;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#555555';
ctx.fillRect(0, 0, 128, 64);
ctx.fillStyle = '#ffffff';
ctx.font = '24px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('Reset', 64, 32);

const resetTex = new THREE.CanvasTexture(canvas);
const resetGeo = new THREE.PlaneGeometry(100, 50);
const resetMat = new THREE.MeshBasicMaterial({ map: resetTex });
const resetButton = new THREE.Mesh(resetGeo, resetMat);
resetButton.position.set(startX + 6 * spacing + 50, yPos, 0);
resetButton.userData.type = 'button';
resetButton.userData.onClick = () => {
    hairMesh.resetProperties();
    hairMaterial.uniforms.windStrength.value = 0.0;
};
hudScene.add(resetButton);
tools.push(resetButton);
toolMeshes.push(resetButton);


// Interaction Manager
const interactionManager = new InteractionManager(camera, scene, hairMesh, hairMaterial, hairTrimmings, toolMeshes, controls, hudScene, hudCamera);

// GUI
const gui = new dat.GUI();
const params = {
    hairDensity: 10000,
    hairLength: 0.5,
    hairColor: '#4a3b2a',
};

gui.add(params, 'hairLength', 0.1, 2.0).onChange(v => {
    hairMesh.update({ length: v });
    hairMaterial.uniforms.uMaxLength.value = v;
});

const stylingFolder = gui.addFolder('Styling');
stylingFolder.addColor(params, 'hairColor').name('Color').onChange(v => {
    hairMesh.update({ color: new THREE.Color(v) });
});
stylingFolder.add(hairMaterial.uniforms.frizzAmount, 'value', 0.0, 0.5).name('Frizz');
params.curlFrequency = 10.0; // Default
params.curlAmplitude = 0.05; // Default
params.partingStrength = 0.0; // Default

stylingFolder.add(params, 'curlFrequency', 0.0, 20.0).name('Curl Freq').onChange(v => {
    hairMesh.params.curlFrequency = v; // Update the hairMesh params
    hairMesh.resetProperties(); // Re-apply global params to maps
});
stylingFolder.add(params, 'curlAmplitude', 0.0, 0.2).name('Curl Amp').onChange(v => {
    hairMesh.params.curlAmplitude = v; // Update the hairMesh params
    hairMesh.resetProperties();
});
stylingFolder.add(params, 'partingStrength', 0.0, 1.0).name('Parting').onChange(v => {
    hairMesh.update({ partingStrength: v });
});
stylingFolder.add(hairMaterial.uniforms.gravity, 'value', 0.0, 2.0).name('Gravity');
stylingFolder.open();

const toolsFolder = gui.addFolder('Tools');
const toolParams = {
    tool: 'none',
    brushRadius: 0.1,
    dyeColor: '#ff0000'
};

toolsFolder.add(toolParams, 'tool', ['none', 'scissors', 'growth', 'curler', 'straightener', 'dye', 'dryer']).onChange(v => {
    interactionManager.setTool(v);
});

toolsFolder.add(toolParams, 'brushRadius', 0.01, 0.5).onChange(v => {
    interactionManager.brushRadius = v;
});

toolsFolder.addColor(toolParams, 'dyeColor').onChange(v => {
    interactionManager.activeColor = new THREE.Color(v);
});

toolsFolder.open();

// Resize Handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    hudCamera.left = window.innerWidth / -2;
    hudCamera.right = window.innerWidth / 2;
    hudCamera.top = window.innerHeight / 2;
    hudCamera.bottom = window.innerHeight / -2;
    hudCamera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    hairTrimmings.update();

    renderer.autoClear = true;
    renderer.render(scene, camera);

    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(hudScene, hudCamera);
}

animate();
