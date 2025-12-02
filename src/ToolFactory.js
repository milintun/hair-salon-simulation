import * as THREE from 'three';

export class ToolFactory {
    static createScissors() {
        const group = new THREE.Group();
        group.userData.type = 'scissors';
        group.userData.tipOffset = new THREE.Vector3(0, 0.3, 0);

        // Hit Box (Invisible)
        const hitGeo = new THREE.BoxGeometry(0.3, 0.5, 0.1);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitBox = new THREE.Mesh(hitGeo, hitMat);
        group.add(hitBox);

        // Handle
        const handleGeo = new THREE.TorusGeometry(0.05, 0.01, 8, 16);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.4 }); // Bright Red

        const handle1 = new THREE.Mesh(handleGeo, handleMat);
        handle1.position.set(-0.05, -0.1, 0);

        const handle2 = new THREE.Mesh(handleGeo, handleMat);
        handle2.position.set(0.05, -0.1, 0);

        // Blades
        const bladeGeo = new THREE.BoxGeometry(0.02, 0.4, 0.005);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.9, roughness: 0.1 });

        const blade1 = new THREE.Mesh(bladeGeo, bladeMat);
        blade1.position.set(-0.02, 0.15, 0);
        blade1.rotation.z = -0.1;

        const blade2 = new THREE.Mesh(bladeGeo, bladeMat);
        blade2.position.set(0.02, 0.15, 0);
        blade2.rotation.z = 0.1;

        group.add(handle1, handle2, blade1, blade2);

        return group;
    }

    static createLabelTexture(text) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; // Higher res
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Background - High contrast
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 256, 128);

        // Border
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(0, 0, 256, 128);

        // Text
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 60px Arial'; // Bigger font
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 64);

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    }

    static createDryer() {
        const group = new THREE.Group();
        group.userData.type = 'dryer';
        group.userData.tipOffset = new THREE.Vector3(0.25, 0.15, 0); // Adjusted for side view

        // Hit Box
        const hitGeo = new THREE.BoxGeometry(0.6, 0.6, 0.4);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitBox = new THREE.Mesh(hitGeo, hitMat);
        group.add(hitBox);

        // Materials
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3333cc, roughness: 0.2, metalness: 0.1 });
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
        const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });

        // Handle (Vertical-ish)
        const handleGeo = new THREE.CylinderGeometry(0.035, 0.03, 0.25, 16);
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.set(0, -0.1, 0);
        handle.rotation.z = -0.2; // Slight angle backwards
        group.add(handle);

        // Main Body (Horizontal - Along X)
        const bodyGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.25, 16);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.z = -Math.PI / 2; // Rotate to point Right
        body.position.set(0.1, 0.05, 0);
        group.add(body);

        // Back Cap
        const capGeo = new THREE.SphereGeometry(0.07, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
        const cap = new THREE.Mesh(capGeo, bodyMat);
        cap.rotation.z = Math.PI / 2; // Cap on left
        cap.position.set(-0.025, 0.05, 0);
        group.add(cap);

        // Nozzle (Right side)
        const nozzleGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.1, 16);
        const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
        nozzle.rotation.z = -Math.PI / 2;
        nozzle.position.set(0.275, 0.05, 0);
        group.add(nozzle);

        return group;
    }

    static createCurler() {
        const group = new THREE.Group();
        group.userData.type = 'curler';
        group.userData.tipOffset = new THREE.Vector3(0, 0.2, 0);

        // Hit Box
        const hitGeo = new THREE.BoxGeometry(0.2, 0.5, 0.2);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitBox = new THREE.Mesh(hitGeo, hitMat);
        group.add(hitBox);

        // Handle
        const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 16);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.set(0, -0.1, 0);

        // Rod
        const rodGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.3, 16);
        const rodMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.6, roughness: 0.3 }); // Gold
        const rod = new THREE.Mesh(rodGeo, rodMat);
        rod.position.set(0, 0.15, 0);

        group.add(handle, rod);
        return group;
    }

    static createStraightener() {
        const group = new THREE.Group();
        group.userData.type = 'straightener';
        group.userData.tipOffset = new THREE.Vector3(0, 0.2, 0);

        // Hit Box
        const hitGeo = new THREE.BoxGeometry(0.2, 0.5, 0.1);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitBox = new THREE.Mesh(hitGeo, hitMat);
        group.add(hitBox);

        // Handle
        const handleGeo = new THREE.BoxGeometry(0.06, 0.15, 0.02);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.set(0, -0.1, 0);

        // Plates
        const plateGeo = new THREE.BoxGeometry(0.02, 0.3, 0.005);
        const plateMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5 });

        const plate1 = new THREE.Mesh(plateGeo, plateMat);
        plate1.position.set(-0.015, 0.15, 0);

        const plate2 = new THREE.Mesh(plateGeo, plateMat);
        plate2.position.set(0.015, 0.15, 0);

        group.add(handle, plate1, plate2);
        return group;
    }

    static createBottle(type, color) {
        const group = new THREE.Group();
        group.userData.type = type;
        group.userData.tipOffset = new THREE.Vector3(0, 0.25, 0);
        if (type === 'dye') group.userData.color = color;

        // Hit Box
        const hitGeo = new THREE.BoxGeometry(0.5, 0.6, 0.5); // Much bigger grab zone
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitBox = new THREE.Mesh(hitGeo, hitMat);
        group.add(hitBox);

        // Bottle Body
        const bottleGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.2, 16);
        const bottleMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3, metalness: 0.0 });
        const bottle = new THREE.Mesh(bottleGeo, bottleMat);
        bottle.position.set(0, 0.05, 0);

        // Label
        const labelText = type === 'growth' ? 'GROW' : 'DYE';
        const labelTex = this.createLabelTexture(labelText);
        // Billboard style label above the bottle
        const labelGeo = new THREE.PlaneGeometry(0.15, 0.08);
        const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, opacity: 1.0, side: THREE.DoubleSide });
        const label = new THREE.Mesh(labelGeo, labelMat);
        label.position.set(0, 0.25, 0); // Floating above the bottle
        group.add(label);

        // Neck
        const neckGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.05, 16);
        const neckMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const neck = new THREE.Mesh(neckGeo, neckMat);
        neck.position.set(0, 0.175, 0);

        // Nozzle
        const nozzleGeo = new THREE.BoxGeometry(0.01, 0.01, 0.05);
        const nozzle = new THREE.Mesh(nozzleGeo, neckMat);
        nozzle.position.set(0, 0.21, 0.02);

        group.add(bottle, neck, nozzle);
        return group;
    }
}
