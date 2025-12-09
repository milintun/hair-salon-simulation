import * as THREE from 'three';

export class HairMesh {
    constructor(scalpMesh, params = {}) {
        this.scalpMesh = scalpMesh;
        this.params = {
            length: params.length || 0.5,
            color: new THREE.Color(params.color || 0x4a3b2a),
            curlFrequency: params.curlFrequency || 10.0,
            curlAmplitude: params.curlAmplitude || 0.05,
            partingStrength: params.partingStrength || 0.0,
            ...params
        };

        this.prismGeometry = null;
        this.prismMesh = null;

        // Data Textures
        this.lengthMap = null;
        this.colorMap = null;
        this.curlMap = null;

        this.generatePrisms();
    }

    generatePrisms() {
        // Get Scalp Geometry Data
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

        // --- Initialize Property Maps (Length, Color, Curl) ---
        // Size: prismCount x 1

        // Length Map (R channel)
        this.lengthData = new Float32Array(faceCount * 4); // RGBA just in case, or Red? RGBA is safer for alignment
        this.lengthMap = new THREE.DataTexture(this.lengthData, faceCount, 1, THREE.RGBAFormat, THREE.FloatType);
        this.lengthMap.minFilter = THREE.NearestFilter;
        this.lengthMap.magFilter = THREE.NearestFilter;

        // Color Map (RGBA)
        this.colorData = new Float32Array(faceCount * 4);
        this.colorMap = new THREE.DataTexture(this.colorData, faceCount, 1, THREE.RGBAFormat, THREE.FloatType);
        this.colorMap.minFilter = THREE.NearestFilter;
        this.colorMap.magFilter = THREE.NearestFilter;

        // Curl Map (R=Freq, G=Amp)
        this.curlData = new Float32Array(faceCount * 4);
        this.curlMap = new THREE.DataTexture(this.curlData, faceCount, 1, THREE.RGBAFormat, THREE.FloatType);
        this.curlMap.minFilter = THREE.NearestFilter;
        this.curlMap.magFilter = THREE.NearestFilter;

        // Initialize with default values
        this.resetProperties();

        // Update prism data (initial)
        this.updatePrismData();

        this.generateStrands();
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
            const partStrength = this.params.partingStrength;

            // Calculate growth direction with parting
            // Simple parting along X=0
            const applyParting = (pos, normal) => {
                if (partStrength <= 0.001) return normal;

                const sign = pos.x >= 0 ? 1 : -1;
                const partDir = new THREE.Vector3(sign, 0, 0); // Push sideways

                // Bias the normal towards the side
                // We want to keep some upward component, so we lerp
                const newDir = normal.clone().lerp(partDir, partStrength).normalize();
                return newDir;
            };

            const dirA = applyParting(pA, nA);
            const dirB = applyParting(pB, nB);
            const dirC = applyParting(pC, nC);

            const pA_top = pA.clone().add(dirA.multiplyScalar(len));
            const pB_top = pB.clone().add(dirB.multiplyScalar(len));
            const pC_top = pC.clone().add(dirC.multiplyScalar(len));

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
        const strandsPerFace = 35; // Balanced density for performance and appearance
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

        console.log("HairMesh Generated:");
        console.log("  Vertices:", vertexCount);
        console.log("  Indices:", indices.length);
        console.log("  Positions:", positions.length);
        console.log("  First Position:", positions[0], positions[1], positions[2]);

        this.strandGeometry = geometry;
    }

    resetProperties() {
        const len = this.params.length;
        const col = this.params.color;
        const freq = this.params.curlFrequency;
        const amp = this.params.curlAmplitude;

        for (let i = 0; i < this.prismCount; i++) {
            // Length
            this.lengthData[i * 4] = len;

            // Color
            this.colorData[i * 4] = col.r;
            this.colorData[i * 4 + 1] = col.g;
            this.colorData[i * 4 + 2] = col.b;
            this.colorData[i * 4 + 3] = 1.0;

            // Curl
            this.curlData[i * 4] = freq;
            this.curlData[i * 4 + 1] = amp;
        }

        this.lengthMap.needsUpdate = true;
        this.colorMap.needsUpdate = true;
        this.curlMap.needsUpdate = true;
    }

    update(params) {
        // Update global params if provided, then reset/update maps
        if (params.length !== undefined) this.params.length = params.length;
        if (params.color !== undefined) this.params.color.set(params.color);
        if (params.partingStrength !== undefined) this.params.partingStrength = params.partingStrength;

        if (params.length !== undefined || params.partingStrength !== undefined) {
            this.updatePrismData();
            for (let i = 0; i < this.prismCount; i++) this.lengthData[i * 4] = this.params.length;
            this.lengthMap.needsUpdate = true;
        }

        if (params.color !== undefined) {
            // Update all color data
            for (let i = 0; i < this.prismCount; i++) {
                this.colorData[i * 4] = this.params.color.r;
                this.colorData[i * 4 + 1] = this.params.color.g;
                this.colorData[i * 4 + 2] = this.params.color.b;
            }
            this.colorMap.needsUpdate = true;
        }
    }

    // Methods for tools to call
    setLengthAt(index, value) {
        if (index >= 0 && index < this.prismCount) {
            this.lengthData[index * 4] = value;
            this.lengthMap.needsUpdate = true;
        }
    }

    setColorAt(index, color) {
        if (index >= 0 && index < this.prismCount) {
            this.colorData[index * 4] = color.r;
            this.colorData[index * 4 + 1] = color.g;
            this.colorData[index * 4 + 2] = color.b;
            this.colorMap.needsUpdate = true;
        }
    }

    setCurlAt(index, freq, amp) {
        if (index >= 0 && index < this.prismCount) {
            this.curlData[index * 4] = freq;
            this.curlData[index * 4 + 1] = amp;
            this.curlMap.needsUpdate = true;
        }
    }
}
