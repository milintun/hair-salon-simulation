import * as THREE from 'three';

export class HairMesh {
    constructor(scalpMesh, params = {}) {
        this.scalpMesh = scalpMesh;
        this.params = {
            length: params.length || 0.5,
            ...params
        };

        this.prismGeometry = null;
        this.prismMesh = null;

        this.generatePrisms();
    }

    generatePrisms() {
        // 1. Get Scalp Geometry Data
        const scalpGeo = this.scalpMesh.geometry;
        if (!scalpGeo.isBufferGeometry) {
            console.error("HairMesh: Scalp must use BufferGeometry");
            return;
        }

        const posAttribute = scalpGeo.attributes.position;
        const normalAttribute = scalpGeo.attributes.normal;
        const indexAttribute = scalpGeo.index;

        if (!indexAttribute) {
            console.error("HairMesh: Scalp geometry must be indexed");
            return;
        }

        const indices = indexAttribute.array;
        const faceCount = indices.length / 3;

        // Store prism data for texture
        // We need 6 vertices per face.
        // Texture size: 6 x faceCount
        this.prismCount = faceCount;
        this.prismData = new Float32Array(faceCount * 6 * 4); // RGBA float texture

        // Create Data Texture
        this.hairMap = new THREE.DataTexture(
            this.prismData,
            6,
            faceCount,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.hairMap.minFilter = THREE.NearestFilter;
        this.hairMap.magFilter = THREE.NearestFilter;
        this.hairMap.needsUpdate = true;

        // Update prism data (initial)
        this.updatePrismData();

        // 2. Generate Strands
        this.generateStrands();

        // Debug Mesh (Optional)
        // ... (kept simple or removed for performance)
    }

    updatePrismData() {
        const scalpGeo = this.scalpMesh.geometry;
        const posAttribute = scalpGeo.attributes.position;
        const normalAttribute = scalpGeo.attributes.normal;
        const indexAttribute = scalpGeo.index;
        const indices = indexAttribute.array;

        // We assume the scalp mesh might animate, so we update this every frame or when needed.
        // For now, just static or simple update.

        // Helper to set pixel
        const setPixel = (prismIdx, vIdx, x, y, z) => {
            const index = (prismIdx * 6 + vIdx) * 4;
            this.prismData[index] = x;
            this.prismData[index + 1] = y;
            this.prismData[index + 2] = z;
            this.prismData[index + 3] = 1.0; // Alpha unused
        };

        for (let i = 0; i < this.prismCount; i++) {
            const a = indices[i * 3];
            const b = indices[i * 3 + 1];
            const c = indices[i * 3 + 2];

            const pA = new THREE.Vector3().fromBufferAttribute(posAttribute, a);
            const pB = new THREE.Vector3().fromBufferAttribute(posAttribute, b);
            const pC = new THREE.Vector3().fromBufferAttribute(posAttribute, c);

            const nA = new THREE.Vector3().fromBufferAttribute(normalAttribute, a);
            const nB = new THREE.Vector3().fromBufferAttribute(normalAttribute, b);
            const nC = new THREE.Vector3().fromBufferAttribute(normalAttribute, c);

            // Extrude
            const len = this.params.length;
            const pA_top = pA.clone().add(nA.clone().multiplyScalar(len));
            const pB_top = pB.clone().add(nB.clone().multiplyScalar(len));
            const pC_top = pC.clone().add(nC.clone().multiplyScalar(len));

            // Set texture data
            // Bottom: 0, 1, 2
            setPixel(i, 0, pA.x, pA.y, pA.z);
            setPixel(i, 1, pB.x, pB.y, pB.z);
            setPixel(i, 2, pC.x, pC.y, pC.z);

            // Top: 3, 4, 5
            setPixel(i, 3, pA_top.x, pA_top.y, pA_top.z);
            setPixel(i, 4, pB_top.x, pB_top.y, pB_top.z);
            setPixel(i, 5, pC_top.x, pC_top.y, pC_top.z);
        }

        this.hairMap.needsUpdate = true;
    }

    generateStrands() {
        const strandsPerFace = 16; // Configurable
        const segmentsPerStrand = 30; // Increased to 30 for even smoother curls
        const totalStrands = this.prismCount * strandsPerFace;
        const vertexCount = totalStrands * (segmentsPerStrand + 1); // Line strip

        const positions = new Float32Array(vertexCount * 3); // Dummy positions
        const barycentrics = new Float32Array(vertexCount * 3);
        const prismIndices = new Float32Array(vertexCount);
        const ts = new Float32Array(vertexCount); // t value 0..1
        const indices = [];

        let vIdx = 0;

        for (let i = 0; i < this.prismCount; i++) {
            for (let s = 0; s < strandsPerFace; s++) {
                // Random barycentric coords for this strand
                let u = Math.random();
                let v = Math.random();
                if (u + v > 1) {
                    u = 1 - u;
                    v = 1 - v;
                }
                const w = 1 - u - v;

                const startVIdx = vIdx;

                for (let k = 0; k <= segmentsPerStrand; k++) {
                    const t = k / segmentsPerStrand;

                    // Attributes
                    barycentrics[vIdx * 3] = u;
                    barycentrics[vIdx * 3 + 1] = v;
                    barycentrics[vIdx * 3 + 2] = w;

                    prismIndices[vIdx] = i;
                    ts[vIdx] = t;

                    vIdx++;
                }

                // Indices for LineStrip
                for (let k = 0; k < segmentsPerStrand; k++) {
                    indices.push(startVIdx + k, startVIdx + k + 1);
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('barycentric', new THREE.BufferAttribute(barycentrics, 3));
        geometry.setAttribute('prismIndex', new THREE.BufferAttribute(prismIndices, 1));
        geometry.setAttribute('t', new THREE.BufferAttribute(ts, 1));
        geometry.setIndex(indices);

        this.strandGeometry = geometry;
    }

    update(params) {
        // Update length, etc.
        // Would need to regenerate or update vertex positions.
        if (params.length !== undefined) {
            this.params.length = params.length;
            this.updatePrismData();
        }
    }
}
