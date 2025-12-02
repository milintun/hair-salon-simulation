import * as THREE from 'three';

export class HairMaterial extends THREE.ShaderMaterial {
    constructor(params) {
        super({
            uniforms: {
                // Global Max Length (used for geometry generation)
                uMaxLength: { value: params.length || 0.5 },

                // Maps
                lengthMap: { value: null },
                colorMap: { value: null },
                curlMap: { value: null },

                hairMap: { value: null }, // Geometry
                prismCount: { value: 0 },

                // Global Modifiers (optional, can be baked into maps or kept as multipliers)
                frizzAmount: { value: 0.1 },
                gravity: { value: 0.0 },

                // Wind
                windSource: { value: new THREE.Vector3(0, 0, 0) },
                windStrength: { value: 0.0 },
            },
            vertexShader: `
                attribute vec3 barycentric;
                attribute float prismIndex;
                attribute float t; // 0.0 at root, 1.0 at tip

                uniform sampler2D hairMap;
                uniform sampler2D lengthMap;
                uniform sampler2D colorMap;
                uniform sampler2D curlMap;

                uniform float prismCount;
                uniform float uMaxLength;

                uniform float frizzAmount;
                uniform float gravity;

                uniform vec3 windSource;
                uniform float windStrength;

                varying float vT;
                varying vec3 vTangent;
                varying vec3 vPosition;
                varying vec3 vColor;

                // Simple pseudo-random noise
                float hash1(float n) { return fract(sin(n) * 1e4); }
                float hash2(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }

                vec3 noise(vec3 x) {
                    const vec3 step = vec3(110, 241, 171);
                    vec3 i = floor(x);
                    vec3 f = fract(x);
                    float n = dot(i, step);
                    vec3 u = f * f * (3.0 - 2.0 * f);
                    return mix(mix(mix( vec3(hash1(n + dot(step, vec3(0, 0, 0)))), vec3(hash1(n + dot(step, vec3(1, 0, 0)))), u.x),
                                   mix( vec3(hash1(n + dot(step, vec3(0, 1, 0)))), vec3(hash1(n + dot(step, vec3(1, 1, 0)))), u.x), u.y),
                               mix(mix( vec3(hash1(n + dot(step, vec3(0, 0, 1)))), vec3(hash1(n + dot(step, vec3(1, 0, 1)))), u.x),
                                   mix( vec3(hash1(n + dot(step, vec3(0, 1, 1)))), vec3(hash1(n + dot(step, vec3(1, 1, 1)))), u.x), u.y), u.z);
                }

                // Function to fetch vertex position from data texture
                vec3 getPrismVertex(float pIndex, int vIndex) {
                    vec2 uv = vec2((float(vIndex) + 0.5) / 6.0, (pIndex + 0.5) / prismCount);
                    return texture2D(hairMap, uv).xyz;
                }

                // Fetch property from 1D map (prismCount x 1)
                vec4 getProperty(sampler2D map, float pIndex) {
                    vec2 uv = vec2((pIndex + 0.5) / prismCount, 0.5);
                    return texture2D(map, uv);
                }

                void main() {
                    vT = t;

                    // Fetch Properties
                    float localLength = getProperty(lengthMap, prismIndex).r;
                    vec3 localColor = getProperty(colorMap, prismIndex).rgb;
                    vec2 localCurl = getProperty(curlMap, prismIndex).rg;
                    float curlFrequency = localCurl.x;
                    float curlAmplitude = localCurl.y;

                    vColor = localColor;

                    // Fetch prism vertices
                    vec3 p0 = getPrismVertex(prismIndex, 0);
                    vec3 p1 = getPrismVertex(prismIndex, 1);
                    vec3 p2 = getPrismVertex(prismIndex, 2);

                    vec3 p3 = getPrismVertex(prismIndex, 3);
                    vec3 p4 = getPrismVertex(prismIndex, 4);
                    vec3 p5 = getPrismVertex(prismIndex, 5);

                    // Interpolate base position (barycentric)
                    vec3 basePos = p0 * barycentric.x + p1 * barycentric.y + p2 * barycentric.z;

                    // Interpolate top position (Geometry Max Length)
                    vec3 topPos = p3 * barycentric.x + p4 * barycentric.y + p5 * barycentric.z;

                    // Calculate actual position based on local length
                    // The geometry (topPos) is at uMaxLength.
                    // We want the strand to end at localLength.
                    // So we scale the vector (topPos - basePos) by (localLength / uMaxLength).

                    vec3 geoDir = topPos - basePos;
                    // Avoid divide by zero if uMaxLength is 0 (unlikely)
                    float scale = localLength / max(uMaxLength, 0.001);

                    // Interpolate along the strand (t)
                    // t goes 0..1. We want the physical position at t to be:
                    // basePos + geoDir * scale * t

                    vec3 finalPos = basePos + geoDir * scale * t;

                    // Base direction (tangent before styling)
                    vec3 dir = normalize(geoDir);

                    // --- Styling ---

                    // 1. Gravity
                    // Simple quadratic drop
                    vec3 gravityOffset = vec3(0.0, -1.0, 0.0) * gravity * t * t;
                    finalPos += gravityOffset;

                    // Derivative of gravity for tangent: 2 * g * t
                    vec3 gravityTangent = vec3(0.0, -1.0, 0.0) * gravity * 2.0 * t;

                    // 4. Wind (Point Source)
                    if (windStrength > 0.0) {
                        vec3 toWind = finalPos - windSource;
                        float dist = length(toWind);
                        vec3 windDir = normalize(toWind);

                        // Force falls off with distance
                        float windForce = windStrength / (dist * dist + 0.1);

                        // Apply wind offset (quadratic with t, similar to gravity but directional)
                        vec3 windOffset = windDir * windForce * t * t;
                        finalPos += windOffset;

                        // Derivative
                        vec3 windTangent = windDir * windForce * 2.0 * t;
                        gravityTangent += windTangent; // Add to tangent calculation
                    }

                    // 2. Curl (Sine wave along the strand)
                    // We need a perpendicular vector.
                    vec3 perp1 = normalize(cross(dir, vec3(0, 1, 0) + vec3(0.001)));
                    vec3 perp2 = cross(dir, perp1);

                    float angle = t * curlFrequency + prismIndex * 13.0;
                    float cosA = cos(angle);
                    float sinA = sin(angle);

                    // Offset = (P1*cos + P2*sin) * Amp * t
                    vec3 curlVec = (perp1 * cosA + perp2 * sinA);
                    vec3 curlOffset = curlVec * curlAmplitude * t;

                    finalPos += curlOffset;

                    // Derivative of Curl for Tangent
                    // d(Offset)/dt = Amp * (curlVec + t * w * (P1*-sin + P2*cos))
                    vec3 curlDerivative = curlAmplitude * (curlVec + t * curlFrequency * (perp1 * -sinA + perp2 * cosA));

                    // 3. Frizz (High frequency noise)
                    float seed = prismIndex + barycentric.x * 10.0 + barycentric.y * 20.0;
                    vec3 frizzOffset = (noise(vec3(t * 20.0, seed, 0.0)) - 0.5) * frizzAmount * t;
                    finalPos += frizzOffset;

                    // Calculate final tangent
                    // Base tangent is 'dir' * length? No, t is normalized 0..1.
                    // Real length of strand approx = length(topPos - basePos) * scale
                    float strandLength = distance(basePos, topPos) * scale; // Approx

                    // Total derivative = dir * length + gravityTangent + curlDerivative
                    // (Ignoring frizz derivative for smoothness)
                    vec3 tangent = dir * strandLength + gravityTangent + curlDerivative;

                    vTangent = normalize(tangent);
                    vPosition = finalPos;

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
                }
            `,
            fragmentShader: `
                varying float vT;
                varying vec3 vTangent;
                varying vec3 vPosition;
                varying vec3 vColor;

                void main() {
                    // Simple Kajiya-Kay approximation

                    vec3 T = normalize(vTangent);
                    vec3 L = normalize(vec3(5.0, 10.0, 7.0) - vPosition); // Point light approx
                    vec3 V = normalize(cameraPosition - vPosition);

                    // Diffuse (Kajiya-Kay uses sin(T,L))
                    float dotTL = dot(T, L);
                    float sinTL = sqrt(1.0 - dotTL * dotTL);
                    float diffuse = clamp(sinTL, 0.0, 1.0);

                    // Specular (Kajiya-Kay)
                    // spec = pow(max(0, cos(angle between reflected L and V)), p)
                    // For hair, we use the "shifted" highlight.
                    // H = normalize(L + V)
                    // dot(T, H) is related to the angle.

                    vec3 H = normalize(L + V);
                    float dotTH = dot(T, H);
                    float sinTH = sqrt(1.0 - dotTH * dotTH);

                    float alpha = 80.0; // Shininess
                    float spec = pow(max(0.0, sinTH), alpha);

                    // Clamp specular to avoid artifacts
                    spec = clamp(spec, 0.0, 1.0);

                    vec3 lightColor = vec3(1.0);

                    // Combine
                    // Ambient + Diffuse + Specular
                    vec3 ambient = vColor * 0.5; // Increased ambient for fuller look
                    vec3 diffColor = vColor * diffuse * 0.5;
                    vec3 specColor = lightColor * spec * 0.3; // Reduced specular

                    vec3 finalColor = ambient + diffColor + specColor;

                    // Shadow/Occlusion approx based on t (darker at roots)
                    // Roots are at t=0
                    float occlusion = 0.4 + 0.6 * smoothstep(0.0, 0.5, vT); // Less contrast
                    finalColor *= occlusion;

                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false, // For better hair sorting look (simple alpha blending)
        });
    }
}
