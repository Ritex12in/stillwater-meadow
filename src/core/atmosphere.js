// Haze that glows toward the sun. three's fog fades everything to one colour; here the fog takes
// on the sun's glow when you look toward it, matching the sky dome's horizon, so distant hills
// and trees melt into a warm haze on the sunny side and a cooler one on the other.
// Also a gentle colour grade on every surface (highlights roll off softly, shadows lean warm),
// applied to the sky and lake too so the horizon stays seamless.
// Patches the built-in fog shader code, so it must be imported before anything is first drawn.
import * as THREE from 'three';

// plain objects (not Vector3/Color), so every material shares them instead of copying
const sunView = { x: 0, y: 1, z: 0 }, glow = { x: 0, y: 0, z: 0 };
const extra = { fogSunView: { value: sunView }, fogGlow: { value: glow } };
Object.assign(THREE.UniformsLib.fog, extra);
Object.values(THREE.ShaderLib).forEach((s) => { if (s.uniforms && s.uniforms.fogColor) Object.assign(s.uniforms, extra); });

/** GLSL: the colour grade. Custom shaders (sky, lake) prepend this and call meadowGrade() last. */
export const GRADE_GLSL = `
vec3 meadowGrade( vec3 g ) {
  float l = dot( g, vec3( 0.299, 0.587, 0.114 ) );
  g = mix( vec3( l ), g, 0.9 );                          // a little less neon
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
C.fog_pars_fragment = GRADE_GLSL + HAZE_GLSL + C.fog_pars_fragment.replace('varying float fogDepth;', 'varying float fogDepth;\n\tvarying vec3 vFogPos;\n\tuniform vec3 fogSunView;\n\tuniform vec3 fogGlow;');
C.fog_fragment = C.fog_fragment.replace('gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );',
  'gl_FragColor.rgb = mix( gl_FragColor.rgb, meadowHaze( fogColor, fogGlow, vFogPos, fogSunView ), fogFactor );') + '\ngl_FragColor.rgb = meadowGrade( gl_FragColor.rgb );\n';
if (!C.fog_fragment.includes('meadowHaze')) console.warn('Sun haze: fog shader code not as expected; plain fog used.');

const v = new THREE.Vector3();
/** Once a frame, after the camera has its final place: the sun as seen by the camera, and its glow. */
export function updateAtmosphere(camera, sunDir, glowColor, amount) {
  v.copy(sunDir).transformDirection(camera.matrixWorldInverse);
  sunView.x = v.x; sunView.y = v.y; sunView.z = v.z;
  glow.x = glowColor.r * amount; glow.y = glowColor.g * amount; glow.z = glowColor.b * amount;
}
