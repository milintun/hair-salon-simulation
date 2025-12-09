import * as THREE from 'three';

export class HairTrimmings {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];

        this.maxParticles = 10000; // Increased limit
        this.particleCount = 0;

        // For LineSegments, we need 2 vertices per particle
        const vertexCount = this.maxParticles * 2;

        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(vertexCount * 3);
        this.colors = new Float32Array(vertexCount * 3);

        // Simulation data (one per particle)
        this.velocities = new Float32Array(this.maxParticles * 3);
        this.orientations = new Float32Array(this.maxParticles * 3); // Direction vector
        this.lifetimes = new Float32Array(this.maxParticles);
        this.isOnGround = new Uint8Array(this.maxParticles); // Track ground state

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

        this.material = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            linewidth: 1 // Note: linewidth > 1 only works in some browsers/WebGL implementations
        });

        this.mesh = new THREE.LineSegments(this.geometry, this.material);
        this.mesh.frustumCulled = false;
        this.scene.add(this.mesh);
    }

    spawn(position, color) {
        let index = -1;

        if (this.particleCount < this.maxParticles) {
            index = this.particleCount;
            this.particleCount++;
        } else {
            // Overwrite oldest or random? Random is easier for now, but might look weird if ground hair disappears.
            // Let's try to find a dead one first, if not, random.
            // Actually, with 10000, we might hit limit.
            // Let's just overwrite random for now.
            index = Math.floor(Math.random() * this.maxParticles);
        }

        // Simulation Data
        const i3 = index * 3;

        // Random velocity with outward burst
        const headCenter = new THREE.Vector3(0, 1, 0);
        const direction = new THREE.Vector3().subVectors(position, headCenter).normalize();

        // Add some randomness to the direction
        direction.x += (Math.random() - 0.5) * 0.5;
        direction.z += (Math.random() - 0.5) * 0.5;
        direction.normalize();

        const outwardSpeed = 0.03 + Math.random() * 0.05;

        this.velocities[i3] = direction.x * outwardSpeed;
        this.velocities[i3 + 1] = 0.02 + Math.random() * 0.02; // Slight upward pop
        this.velocities[i3 + 2] = direction.z * outwardSpeed;

        // Random orientation (length of the hair snippet)
        const len = 0.02 + Math.random() * 0.03; // 2-5cm equivalent
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;

        this.orientations[i3] = Math.sin(phi) * Math.cos(theta) * len;
        this.orientations[i3 + 1] = Math.cos(phi) * len;
        this.orientations[i3 + 2] = Math.sin(phi) * Math.sin(theta) * len;

        this.lifetimes[index] = 1.0;
        this.isOnGround[index] = 0;

        // Set Initial Vertices
        // We store the "center" position in the simulation loop, but here we set the actual vertices
        // Let's store the center position in a separate array or just use the first vertex as reference?
        // To keep it simple, let's say positions[v1] is the "physics" position.

        const v1 = index * 2 * 3;
        const v2 = (index * 2 + 1) * 3;

        // V1
        this.positions[v1] = position.x;
        this.positions[v1 + 1] = position.y;
        this.positions[v1 + 2] = position.z;

        // V2 = V1 + Orientation
        this.positions[v2] = position.x + this.orientations[i3];
        this.positions[v2 + 1] = position.y + this.orientations[i3 + 1];
        this.positions[v2 + 2] = position.z + this.orientations[i3 + 2];

        // Colors (same for both vertices)
        this.colors[v1] = color.r;
        this.colors[v1 + 1] = color.g;
        this.colors[v1 + 2] = color.b;

        this.colors[v2] = color.r;
        this.colors[v2 + 1] = color.g;
        this.colors[v2 + 2] = color.b;

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
    }

    update(dt = 0.016) {
        const gravity = -9.8 * 0.1;

        let activeCount = 0;

        for (let i = 0; i < this.particleCount; i++) {
            // If dead and not on ground (shouldn't happen if we keep them), skip
            // We use lifetime for falling phase mostly now.

            if (this.isOnGround[i]) {
                activeCount++;
                continue; // Don't update physics for ground particles
            }

            const i3 = i * 3;
            const v1 = i * 2 * 3;
            const v2 = (i * 2 + 1) * 3;

            // Update velocity
            this.velocities[i3 + 1] += gravity * dt;

            // Update Position (V1 is the anchor)
            let x = this.positions[v1];
            let y = this.positions[v1 + 1];
            let z = this.positions[v1 + 2];

            x += this.velocities[i3];
            y += this.velocities[i3 + 1];
            z += this.velocities[i3 + 2];

            // Floor collision
            if (y < -1.5) {
                y = -1.5 + 0.001 + Math.random() * 0.005; // Slight offset to avoid z-fighting

                // Stop moving
                this.velocities[i3] = 0;
                this.velocities[i3 + 1] = 0;
                this.velocities[i3 + 2] = 0;

                this.isOnGround[i] = 1;

                // Flatten orientation
                // Project orientation to XZ plane to make it lie flat
                const ox = this.orientations[i3];
                const oz = this.orientations[i3 + 2];
                const len = Math.sqrt(ox * ox + oz * oz);
                if (len > 0.001) {
                    // Normalize and scale back to original length approx
                    // Or just keep X and Z components
                    this.orientations[i3 + 1] = 0;
                }
            }

            // Update V1
            this.positions[v1] = x;
            this.positions[v1 + 1] = y;
            this.positions[v1 + 2] = z;

            // Update V2 based on V1 + Orientation
            this.positions[v2] = x + this.orientations[i3];
            this.positions[v2 + 1] = y + this.orientations[i3 + 1];
            this.positions[v2 + 2] = z + this.orientations[i3 + 2];

            activeCount++;
        }

        if (activeCount > 0) {
            this.geometry.attributes.position.needsUpdate = true;
        }
    }
}
