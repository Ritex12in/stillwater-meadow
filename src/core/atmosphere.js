// Haze that glows toward the sun. three's fog fades everything to one colour; here the fog takes
// on the sun's glow when you look toward it, matching the sky dome's horizon, so distant hills
// and trees melt into a warm haze on the sunny side and a cooler one on the other.
// Also a gentle colour grade on every surface (highlights roll off softly, shadows lean warm),
// applied to the sky and lake too so the horizon stays seamless.
// Patches the built-in fog shader code, so it must be imported before anything is first drawn.
import * as THREE from 'three';

// plain objects (not Vector3/Color), so every material shares them instead of copying
const sunView = { x: 0, y: 1, z: 0 }, glow = { x: 0, y: 0, z: 0 };
// the path lamps: positions in view space, and how brightly they burn (x)
export const MAX_LAMPS = 12;
const lampView = new Float32Array(MAX_LAMPS * 3), lampInfo = { x: 0, y: 0 };
const extra = { fogSunView: { value: sunView }, fogGlow: { value: glow }, lampView: { value: lampView }, lampInfo: { value: lampInfo } };
Object.assign(THREE.UniformsLib.fog, extra);
Object.values(THREE.ShaderLib).forEach((s) => { if (s.uniforms && s.uniforms.fogColor) Object.assign(s.uniforms, extra); });

/** GLSL: the colour grade. Custom shaders (sky, lake) prepend this and call meadowGrade() last. */
export const GRADE_GLSL = `
vec3 meadowGrade( vec3 g ) {
  float l = dot( g, vec3( 0.299, 0.587, 0.114 ) );
  g = mix( vec3( l ), g, 1.08 );                         // a touch richer
  g = g / ( 1.0 + 0.3 * g ) * 1.2;                      // soft shoulder on the brightest greens
  g += vec3( 0.018, 0.010, -0.004 ) * ( 1.0 - smoothstep( 0.0, 0.6, l ) ); // warm, lifted shade
  return g;
}
`;
/** GLSL: the haze colour toward a direction (world or view space, matching `sunD`). */
export const HAZE_GLSL = `
vec3 meadowHaze( vec3 fogC, vec3 glowC, vec3 dir, vec3 sunD ) {
  float s = max( dot( normalize( dir ), sunD ), 0.0 );
  return fogC + glowC * ( pow( s, 5.0 ) * 0.16 + pow( s, 40.0 ) * 0.3 + pow( s, 2.0 ) * 0.08 );
}
`;

const C = THREE.ShaderChunk;
C.fog_pars_vertex = C.fog_pars_vertex.replace('varying float fogDepth;', 'varying float fogDepth;\n\tvarying vec3 vFogPos;');
C.fog_vertex = C.fog_vertex.replace('fogDepth = - mvPosition.z;', 'fogDepth = - mvPosition.z;\n\tvFogPos = mvPosition.xyz;');
C.fog_pars_fragment = GRADE_GLSL + HAZE_GLSL + C.fog_pars_fragment.replace('varying float fogDepth;', `varying float fogDepth;
\tvarying vec3 vFogPos;
\tuniform vec3 fogSunView;
\tuniform vec3 fogGlow;
\tuniform vec3 lampView[ ${MAX_LAMPS} ];
\tuniform vec2 lampInfo;
\tvec3 meadowLamps( vec3 p ) {
\t\tvec3 l = vec3( 0.0 );
\t\tif ( lampInfo.x < 0.01 ) return l;
\t\tfor ( int i = 0; i < ${MAX_LAMPS}; i ++ ) {
\t\t\tfloat d = distance( p, lampView[ i ] );
\t\t\tfloat k = clamp( 1.0 - d / 9.0, 0.0, 1.0 );
\t\t\tl += k * k * ( 0.35 + 0.65 * k );
\t\t}
\t\treturn l * vec3( 1.0, 0.68, 0.36 ) * lampInfo.x;
\t}`);
// warm light from the lamps on everything near them (lit materials, after their own lighting)
C.aomap_fragment = C.aomap_fragment + `
#ifdef USE_FOG
\treflectedLight.directDiffuse += diffuseColor.rgb * meadowLamps( vFogPos ) * 1.4;
#endif
`;
C.fog_fragment = C.fog_fragment.replace('gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );',
  'gl_FragColor.rgb = mix( gl_FragColor.rgb, meadowHaze( fogColor, fogGlow, vFogPos, fogSunView ), fogFactor );') + '\ngl_FragColor.rgb = meadowGrade( gl_FragColor.rgb );\n';
if (!C.fog_fragment.includes('meadowHaze')) console.warn('Sun haze: fog shader code not as expected; plain fog used.');

const v = new THREE.Vector3();
/** Once a frame, after the camera has its final place: the sun as seen by the camera, its glow, and the lamps. */
export function updateAtmosphere(camera, sunDir, glowColor, amount, lamps = [], lampAmt = 0) {
  for (let i = 0; i < MAX_LAMPS; i++) {
    if (lamps[i]) v.copy(lamps[i]).applyMatrix4(camera.matrixWorldInverse); else v.set(0, 0, 1e5);
    lampView[i * 3] = v.x; lampView[i * 3 + 1] = v.y; lampView[i * 3 + 2] = v.z;
  }
  lampInfo.x = lampAmt;
  v.copy(sunDir).transformDirection(camera.matrixWorldInverse);
  sunView.x = v.x; sunView.y = v.y; sunView.z = v.z;
  glow.x = glowColor.r * amount; glow.y = glowColor.g * amount; glow.z = glowColor.b * amount;
}
