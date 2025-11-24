import * as THREE from 'three';

export class HairMaterial extends THREE.ShaderMaterial {
    constructor(params) {
        super({
            uniforms: {
                color: { value: new THREE.Color(params.color || 0x4a3b2a) },
                hairMap: { value: null }, // Data texture containing prism vertices
                hairLength: { value: params.length || 0.5 },
                prismCount: { value: 0 },
                frizzAmount: { value: 0.1 },
                curlFrequency: { value: 10.0 },
                curlAmplitude: { value: 0.05 },
                gravity: { value: 0.0 },
            },
            vertexShader: `
                attribute vec3 barycentric;
                attribute float prismIndex;
                attribute float t; // 0.0 at root, 1.0 at tip

                uniform sampler2D hairMap;
                uniform float prismCount;
                uniform float hairLength;
                
                uniform float frizzAmount;
                uniform float curlFrequency;
                uniform float curlAmplitude;
                uniform float gravity;

                varying float vT;
                varying vec3 vTangent;
                varying vec3 vPosition;

                // Simple pseudo-random noise
                float hash(float n) { return fract(sin(n) * 1e4); }
                float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }

                vec3 noise(vec3 x) {
                    const vec3 step = vec3(110, 241, 171);
                    vec3 i = floor(x);
                    vec3 f = fract(x);
                    float n = dot(i, step);
                    vec3 u = f * f * (3.0 - 2.0 * f);
                    return mix(mix(mix( vec3(hash(n + dot(step, vec3(0, 0, 0)))), vec3(hash(n + dot(step, vec3(1, 0, 0)))), u.x),
                                   mix( vec3(hash(n + dot(step, vec3(0, 1, 0)))), vec3(hash(n + dot(step, vec3(1, 1, 0)))), u.x), u.y),
                               mix(mix( vec3(hash(n + dot(step, vec3(0, 0, 1)))), vec3(hash(n + dot(step, vec3(1, 0, 1)))), u.x),
                                   mix( vec3(hash(n + dot(step, vec3(0, 1, 1)))), vec3(hash(n + dot(step, vec3(1, 1, 1)))), u.x), u.y), u.z);
                }

                // Function to fetch vertex position from data texture
                vec3 getPrismVertex(float pIndex, int vIndex) {
                    vec2 uv = vec2((float(vIndex) + 0.5) / 6.0, (pIndex + 0.5) / prismCount);
                    return texture2D(hairMap, uv).xyz;
                }

                void main() {
                    vT = t;

                    // Fetch prism vertices
                    vec3 p0 = getPrismVertex(prismIndex, 0);
                    vec3 p1 = getPrismVertex(prismIndex, 1);
                    vec3 p2 = getPrismVertex(prismIndex, 2);
                    
                    vec3 p3 = getPrismVertex(prismIndex, 3);
                    vec3 p4 = getPrismVertex(prismIndex, 4);
                    vec3 p5 = getPrismVertex(prismIndex, 5);

                    // Interpolate base position (barycentric)
                    vec3 basePos = p0 * barycentric.x + p1 * barycentric.y + p2 * barycentric.z;
                    
                    // Interpolate top position
                    vec3 topPos = p3 * barycentric.x + p4 * barycentric.y + p5 * barycentric.z;

                    // Interpolate along the strand (t)
                    vec3 finalPos = mix(basePos, topPos, t);
                    
                    // Base direction (tangent before styling)
                    vec3 dir = normalize(topPos - basePos);

                    // --- Styling ---
                    
                    // 1. Gravity
                    // Simple quadratic drop
                    vec3 gravityOffset = vec3(0.0, -1.0, 0.0) * gravity * t * t;
                    finalPos += gravityOffset;
                    
                    // Derivative of gravity for tangent: 2 * g * t
                    vec3 gravityTangent = vec3(0.0, -1.0, 0.0) * gravity * 2.0 * t;

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
                    // Real length of strand approx = length(topPos - basePos)
                    float strandLength = distance(basePos, topPos); // Approx
                    
                    // Total derivative = dir * length + gravityTangent + curlDerivative
                    // (Ignoring frizz derivative for smoothness)
                    vec3 tangent = dir * strandLength + gravityTangent + curlDerivative;
                    
                    vTangent = normalize(tangent); 
                    vPosition = finalPos;

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                
                varying float vT;
                varying vec3 vTangent;
                varying vec3 vPosition;

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
                    vec3 ambient = color * 0.3;
                    vec3 diffColor = color * diffuse * 0.6;
                    vec3 specColor = lightColor * spec * 0.4; // Reduced specular intensity
                    
                    vec3 finalColor = ambient + diffColor + specColor;
                    
                    // Shadow/Occlusion approx based on t (darker at roots)
                    // Roots are at t=0
                    float occlusion = 0.2 + 0.8 * smoothstep(0.0, 0.5, vT);
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
