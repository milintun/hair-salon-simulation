import * as THREE from 'three';

export class HairTrimmings {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];

        // Geometry for a single hair trimming (short line)
        // Uses simple BufferGeometry for points or lines
        // Uses dynamic BufferGeometry with GL_LINES for best look

        this.maxParticles = 1000;
        this.particleCount = 0;

        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.maxParticles * 3); // Start pos
        this.velocities = new Float32Array(this.maxParticles * 3);
        this.colors = new Float32Array(this.maxParticles * 3);
        this.lifetimes = new Float32Array(this.maxParticles);

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

        this.material = new THREE.PointsMaterial({
            size: 0.05,
            vertexColors: true,
            transparent: true,
            opacity: 0.8
        });

        this.mesh = new THREE.Points(this.geometry, this.material);
        this.mesh.frustumCulled = false;
        this.scene.add(this.mesh);
    }

    spawn(position, color) {
        // Find a slot
        // Simple ring buffer or linear search for dead particle
        let index = -1;

        // If not full, use next slot
        if (this.particleCount < this.maxParticles) {
            index = this.particleCount;
            this.particleCount++;
        } else {
            index = Math.floor(Math.random() * this.maxParticles);
        }

        const i3 = index * 3;
        this.positions[i3] = position.x;
        this.positions[i3 + 1] = position.y;
        this.positions[i3 + 2] = position.z;

        this.velocities[i3] = (Math.random() - 0.5) * 0.01;
        this.velocities[i3 + 1] = 0.0; // Start with 0 vertical velocity
        this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.01;

        this.colors[i3] = color.r;
        this.colors[i3 + 1] = color.g;
        this.colors[i3 + 2] = color.b;

        this.lifetimes[index] = 1.0; // Alive

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
    }

    update(dt = 0.016) {
        const gravity = -9.8 * 0.1; // Scaled gravity

        let activeCount = 0;

        for (let i = 0; i < this.particleCount; i++) {
            if (this.lifetimes[i] <= 0) continue;

            const i3 = i * 3;

            // Update velocity
            this.velocities[i3 + 1] += gravity * dt;

            // Update position
            this.positions[i3] += this.velocities[i3];
            this.positions[i3 + 1] += this.velocities[i3 + 1];
            this.positions[i3 + 2] += this.velocities[i3 + 2];

            // Floor collision
            if (this.positions[i3 + 1] < 0) {
                this.positions[i3 + 1] = 0;
                this.velocities[i3] *= 0.5; // Friction
                this.velocities[i3 + 2] *= 0.5;
                this.lifetimes[i] -= dt * 2.0; // Fade out faster on floor
            } else {
                // Slowly fade out even in air
                this.lifetimes[i] -= dt * 0.1;
            }

            // If lifetime expired, move particle far away (effectively hide it)
            if (this.lifetimes[i] <= 0) {
                this.positions[i3] = 0;
                this.positions[i3 + 1] = -1000; // Move way below floor
                this.positions[i3 + 2] = 0;
            } else {
                activeCount++;
            }
        }

        if (activeCount > 0 || this.particleCount > 0) {
            this.geometry.attributes.position.needsUpdate = true;
        }
    }
}
