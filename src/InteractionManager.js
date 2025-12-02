
import * as THREE from 'three';

export class InteractionManager {
    constructor(camera, scene, hairMesh, hairMaterial, hairTrimmings, toolMeshes, controls, hudScene, hudCamera) {
        this.camera = camera;
        this.scene = scene;
        this.hairMesh = hairMesh;
        this.hairMaterial = hairMaterial;
        this.hairTrimmings = hairTrimmings;
        this.toolMeshes = toolMeshes || [];
        this.controls = controls;
        this.hudScene = hudScene;
        this.hudCamera = hudCamera;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.isMouseDown = false;

        this.activeTool = 'none'; // 'scissors', 'growth', 'curler', 'straightener', 'dye', 'dryer'
        this.brushRadius = 0.1;
        this.activeColor = new THREE.Color(0xff0000);

        // Tool Dragging
        this.draggedTool = null;

        // Tool Parameters
        this.cutSpeed = 0.05;
        this.growthSpeed = 0.05;
        this.curlSpeed = 0.5;
        this.windStrength = 2.0;

        this.initEvents();
    }

    initEvents() {
        window.addEventListener('mousedown', (e) => {
            if (e.target.closest('.dg')) return;

            this.isMouseDown = true;
            this.updateMouse(e);

            // Check for tool pickup
            if (this.checkToolPickup()) {
                if (this.controls) this.controls.enabled = false;
                return;
            }

            // If dragging tool, apply tool
            if (this.draggedTool) {
                this.applyToolFrom3D();
            } else {
                if (this.activeTool !== 'none') {
                    if (this.controls) this.controls.enabled = false; // Disable cam for painting too
                    this.applyTool();
                }
            }
        });

        window.addEventListener('mousemove', (e) => {
            this.updateMouse(e);

            if (this.draggedTool) {
                this.updateToolPosition(e);

                // Continuous application for dragged tool
                if (this.isMouseDown) {
                    this.applyToolFrom3D();
                }
            } else if (this.isMouseDown && this.activeTool !== 'none') {
                this.applyTool();
            }
        });

        window.addEventListener('mouseup', () => {
            this.isMouseDown = false;
            if (this.controls) this.controls.enabled = true;

            // Drop tool if we were dragging
            if (this.draggedTool) {
                this.draggedTool.position.copy(this.draggedTool.userData.originalPos);
                this.draggedTool = null;
                this.activeTool = 'none';
            }

            // Reset continuous effects like wind
            if (this.hairMaterial && this.hairMaterial.uniforms.windStrength) {
                this.hairMaterial.uniforms.windStrength.value = 0.0;
            }
        });
    }

    updateMouse(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    checkToolPickup() {
        // Raycast against HUD
        if (this.hudCamera && this.hudScene) {
            this.raycaster.setFromCamera(this.mouse, this.hudCamera);
            const intersects = this.raycaster.intersectObjects(this.toolMeshes, true);

            if (intersects.length > 0) {
                let obj = intersects[0].object;
                while (obj.parent && obj.parent.type !== 'Scene') {
                    obj = obj.parent;
                }

                if (obj.userData.type) {
                    // Handle Buttons
                    if (obj.userData.type === 'button') {
                        if (obj.userData.onClick) obj.userData.onClick();
                        return true; // Consumed click
                    }

                    this.draggedTool = obj;
                    this.activeTool = obj.userData.type;
                    // Don't override activeColor for dye tool - use GUI color instead
                    if (obj.userData.color && obj.userData.type !== 'dye') {
                        this.activeColor = new THREE.Color(obj.userData.color);
                    }

                    // Store original pos if not stored
                    if (!obj.userData.originalPos) {
                        obj.userData.originalPos = obj.position.clone();
                    }
                    return true;
                }
            }
        }
        return false;
    }

    updateToolPosition(event) {
        // Move tool in HUD coordinates (pixels relative to center)
        // Mouse is -1 to 1.
        // HUD Camera is -W/2 to W/2.

        const x = this.mouse.x * (window.innerWidth / 2);
        const y = this.mouse.y * (window.innerHeight / 2);

        if (this.draggedTool) {
            this.draggedTool.position.set(x, y, 0);
        }
    }

    applyToolFrom3D() {
        if (!this.draggedTool) return;

        this.raycaster.setFromCamera(this.mouse, this.camera); // Use Main Camera

        // Raycast against scalp
        const intersects = this.raycaster.intersectObject(this.hairMesh.scalpMesh);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const hitPoint = hit.point;
            const hitNormal = hit.face.normal.clone().transformDirection(this.hairMesh.scalpMesh.matrixWorld);

            if (this.activeTool === 'dryer') {
                this.applyDryer(hitPoint, hitNormal);
            } else {
                this.applyToRegion(hitPoint);
            }
        }
    }

    applyTool() {
        if (this.activeTool === 'none') return;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Raycast against scalp
        // scalpMesh is accessible via hairMesh.scalpMesh
        const intersects = this.raycaster.intersectObject(this.hairMesh.scalpMesh);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const hitPoint = hit.point;
            const hitNormal = hit.face.normal.clone().transformDirection(this.hairMesh.scalpMesh.matrixWorld);

            // Apply to region
            if (this.activeTool === 'dryer') {
                this.applyDryer(hitPoint, hitNormal);
            } else {
                this.applyToRegion(hitPoint);
            }
        }
    }

    applyDryer(hitPoint, hitNormal) {
        // Set wind source slightly above the surface
        const source = hitPoint.clone().add(hitNormal.multiplyScalar(0.2));

        if (this.hairMaterial) {
            this.hairMaterial.uniforms.windSource.value.copy(source);
            this.hairMaterial.uniforms.windStrength.value = this.windStrength;
        }
    }

    applyToRegion(centerPoint) {
        // Iterate over all prisms (faces)
        // This is brute force but likely fast enough for < 5000 faces

        const posAttr = this.hairMesh.scalpMesh.geometry.attributes.position;
        const indexAttr = this.hairMesh.scalpMesh.geometry.index;

        // We need world positions of faces to check distance
        // Or transform centerPoint to local space.
        // Let's transform centerPoint to local space of scalp
        const localPoint = centerPoint.clone();
        this.hairMesh.scalpMesh.worldToLocal(localPoint);

        const prismCount = this.hairMesh.prismCount;
        const indices = indexAttr.array;

        // Cache face centers if performance is bad, but for now calculate on fly
        const pA = new THREE.Vector3();
        const pB = new THREE.Vector3();
        const pC = new THREE.Vector3();
        const faceCenter = new THREE.Vector3();

        let modified = false;

        for (let i = 0; i < prismCount; i++) {
            // Get face vertices
            const a = indices[i * 3];
            const b = indices[i * 3 + 1];
            const c = indices[i * 3 + 2];

            pA.fromBufferAttribute(posAttr, a);
            pB.fromBufferAttribute(posAttr, b);
            pC.fromBufferAttribute(posAttr, c);

            // Calculate center
            faceCenter.copy(pA).add(pB).add(pC).multiplyScalar(1 / 3);

            // Check distance
            if (faceCenter.distanceTo(localPoint) < this.brushRadius) {
                this.applyEffect(i);
                modified = true;
            }
        }

        if (modified) {
            this.hairMesh.lengthMap.needsUpdate = true;
            this.hairMesh.colorMap.needsUpdate = true;
            this.hairMesh.curlMap.needsUpdate = true;
        }
    }

    applyEffect(index) {
        // Get current values
        // lengthData, colorData, curlData are Float32Arrays in HairMesh

        const i4 = index * 4;

        switch (this.activeTool) {
            case 'scissors':
                // Reduce length
                let len = this.hairMesh.lengthData[i4];
                if (len > 0.01) {
                    // Spawn trimming before cutting
                    if (this.hairTrimmings && Math.random() < 0.3) { // Don't spawn for every single strand every frame
                        this.spawnTrimming(index, len);
                    }

                    len = Math.max(0.01, len - this.cutSpeed);
                    this.hairMesh.lengthData[i4] = len;
                }
                break;

            case 'growth':
                // Increase length
                let len2 = this.hairMesh.lengthData[i4];
                len2 = Math.min(2.0, len2 + this.growthSpeed);
                this.hairMesh.lengthData[i4] = len2;
                break;

            case 'dye':
                this.hairMesh.colorData[i4] = this.activeColor.r;
                this.hairMesh.colorData[i4 + 1] = this.activeColor.g;
                this.hairMesh.colorData[i4 + 2] = this.activeColor.b;
                break;

            case 'curler':
                // Increase curl freq/amp
                // curlData: R=Freq, G=Amp
                this.hairMesh.curlData[i4] = Math.min(20.0, this.hairMesh.curlData[i4] + this.curlSpeed); // Freq
                this.hairMesh.curlData[i4 + 1] = Math.min(0.2, this.hairMesh.curlData[i4 + 1] + 0.005); // Amp
                break;

            case 'straightener':
                // Decrease curl
                this.hairMesh.curlData[i4] = Math.max(0.0, this.hairMesh.curlData[i4] - this.curlSpeed);
                this.hairMesh.curlData[i4 + 1] = Math.max(0.0, this.hairMesh.curlData[i4 + 1] - 0.005);
                break;
        }
    }

    spawnTrimming(index, currentLen) {
        const scalpGeo = this.hairMesh.scalpMesh.geometry;
        const indices = scalpGeo.index.array;
        const posAttr = scalpGeo.attributes.position;
        const normAttr = scalpGeo.attributes.normal;

        const a = indices[index * 3];
        const b = indices[index * 3 + 1];
        const c = indices[index * 3 + 2];

        // Get positions and normals
        const pA = new THREE.Vector3().fromBufferAttribute(posAttr, a);
        const pB = new THREE.Vector3().fromBufferAttribute(posAttr, b);
        const pC = new THREE.Vector3().fromBufferAttribute(posAttr, c);

        const nA = new THREE.Vector3().fromBufferAttribute(normAttr, a);
        const nB = new THREE.Vector3().fromBufferAttribute(normAttr, b);
        const nC = new THREE.Vector3().fromBufferAttribute(normAttr, c);

        // Average center and normal
        const center = pA.add(pB).add(pC).multiplyScalar(1 / 3);
        const normal = nA.add(nB).add(nC).multiplyScalar(1 / 3).normalize();

        // Transform to world space
        center.applyMatrix4(this.hairMesh.scalpMesh.matrixWorld);
        normal.transformDirection(this.hairMesh.scalpMesh.matrixWorld);

        // Calculate tip
        const tipPos = center.clone().add(normal.multiplyScalar(currentLen));

        // Color
        const r = this.hairMesh.colorData[index * 4];
        const g = this.hairMesh.colorData[index * 4 + 1];
        const colorB = this.hairMesh.colorData[index * 4 + 2];
        const color = new THREE.Color(r, g, colorB);

        this.hairTrimmings.spawn(tipPos, color);
    }

    setTool(toolName, params = {}) {
        this.activeTool = toolName;
        if (params.color) this.activeColor = params.color;
    }
}
