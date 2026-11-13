// The ground: one smooth-shaded mesh. With the assets loaded it is textured: hand-painted grass,
// soil, sand and rock blended by per-vertex weights (sand by the lake, soil on the path, rock up
// high), sampled in world space at two scales so the tiling doesn't show. Without them it falls
// back to painted vertex colours. Either way broad patches of colour vary across the meadow.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { smooth, fbm } from '../core/math.js';
import { height, lakeT, pathAmt, TERRAIN, bakeHeights } from '../core/shape.js';
import { col, weatherize, camU } from '../core/materials.js';
import { world } from '../core/state.js';
import { kit } from '../core/assets.js';

/** Shared with the seasons: how much of the meadow is in flower, and how far into autumn (0..1). */
export const groundU = { bloom: { value: 1 }, autumn: { value: 0 } };

export function buildTerrain() {
  const geo = new THREE.PlaneGeometry(TERRAIN.size, TERRAIN.size, TERRAIN.seg, TERRAIN.seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const g1 = col('#5c9040'), g2 = col('#86b44e'), g3 = col('#3d7034'), sand = col('#dcc895'), bed = col('#7a7856');
  const dirt = col('#c4ab7c'), moss = col('#5c7444'), rock = col('#8d8b7d');
  const c = new THREE.Color();
  const textured = !!(kit && kit.tex.grass_lush), splat = textured ? new Float32Array(p.count * 4) : null;
  const MOSS_TINT = new THREE.Color(0.8, 0.85, 0.7);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const h = height(x, z);
    p.setY(i, h);
    c.copy(g1).lerp(g2, smooth(0.35, 0.7, fbm(x * 0.05 + 11, z * 0.05 - 3)));
    c.lerp(g3, smooth(0.5, 0.75, fbm(x * 0.11 - 5, z * 0.11 + 8)) * 0.6);
    const wSand = 1 - smooth(1.02, 1.16, lakeT(x, z)), wBed = smooth(0.05, -0.8, h), wDirt = pathAmt(x, z) * 0.9;
    const wMoss = smooth(6, 12, h) * 0.6, wRock = smooth(13, 24, h) * 0.85;
    if (textured) {
      // the grass patches become a tint around 1 (the texture brings the colour); weights go apart
      // keep only a little of the patch hue, and its brightness relative to the average green
      const L = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
      c.setRGB(1 + (c.r / L - 1) * 0.25, 1 + (c.g / L - 1) * 0.25, 1 + (c.b / L - 1) * 0.25).multiplyScalar(L / 0.32 * 0.88).lerp(MOSS_TINT, wMoss);
      splat[i * 4] = wSand; splat[i * 4 + 1] = wBed; splat[i * 4 + 2] = wDirt; splat[i * 4 + 3] = wRock;
    } else {
      c.lerp(sand, wSand).lerp(bed, wBed).lerp(dirt, wDirt).lerp(moss, wMoss).lerp(rock, wRock);
    }
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (textured) geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
  geo.computeVertexNormals();
  bakeHeights(p);
  const terrain = new THREE.Mesh(geo, weatherize(groundDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), textured), 'std'));
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  scene.add(terrain);
  world.terrain = terrain;
}

/**
 * Per-pixel variation on top of the vertex colours: broad patches of lighter and darker grass,
 * metre-scale mottling, and a fine grain that fades out with distance (so it doesn't shimmer).
 */
function groundDetail(mat, textured) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCam = camU;
    if (textured) {
      Object.assign(sh.uniforms, {
        tLush: { value: kit.tex.grass_lush }, tFlowers: { value: kit.tex.grass_flowers }, tFine: { value: kit.tex.grass_fine },
        tSoil: { value: kit.tex.soil }, tRock: { value: kit.tex.rocks },
        tViolet: { value: kit.tex.bloom_violet }, tOrange: { value: kit.tex.bloom_orange }, uBloom: groundU.bloom,
        tLeaves: { value: kit.tex.leaves_litter }, uAutumn: groundU.autumn,
      });
    }
    sh.vertexShader = 'varying vec3 vGround;\n' + (textured ? 'attribute vec4 splat;\nvarying vec4 vSplat;\n' : '') + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vGround = (modelMatrix * vec4(transformed, 1.0)).xyz;
      ${textured ? 'vSplat = splat;' : ''}`);
    sh.fragmentShader = 'varying vec3 vGround;\nuniform vec3 uCam;\n' + (textured ? 'varying vec4 vSplat;\nuniform sampler2D tLush, tFlowers, tFine, tSoil, tRock, tViolet, tOrange, tLeaves;\nuniform float uBloom, uAutumn;\n#define SNOW_COLOR gSnow\nvec3 gSnow = vec3(0.93, 0.95, 0.99);\n' : '') + `
      float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float gNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      vec2 gRot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
    ` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 q = vGround.xz;
        float d = length(vGround - uCam);
        float broad = gNoise(q * 0.045) * 0.6 + gNoise(q * 0.11) * 0.4;
        float mid = gNoise(q * 0.55) * 0.6 + gNoise(q * 1.3) * 0.4;
        ${textured ? `
        // grass: two scales and angles of the lush texture (so no tile repeats), patches of the
        // flowery one, and the fine one far off where the others would shimmer
        vec3 lush = mix(texture2D(tLush, q / 4.2).rgb, texture2D(tLush, gRot(q, 0.83) / 9.7).rgb, 0.45);
        vec3 flw = texture2D(tFlowers, gRot(q, 2.1) / 5.3).rgb;
        vec3 grass = mix(lush, flw, smoothstep(0.5, 0.68, gNoise(q * 0.07 + 3.0)) * 0.85);
        // drifts of colour: violet-and-pink and orange meadow flowers in broad patches
        // (as many as the season allows: full in spring and summer, few in autumn, none in winter)
        float bloomP = smoothstep(0.66, 0.8, gNoise(q * 0.045 + 17.0)) * uBloom;
        vec3 bloom = mix(texture2D(tViolet, gRot(q, 1.3) / 4.6).rgb, texture2D(tOrange, gRot(q, 0.4) / 4.6).rgb, step(0.55, gNoise(q * 0.012 - 5.0)));
        grass = mix(grass, bloom * 1.12, bloomP * 0.9);
        grass *= vec3(1.03, 1.0, 0.84); // the painted grasses lean cool; warm them toward the meadow
        grass = mix(grass, texture2D(tFine, q / 7.0).rgb * vec3(1.05, 1.0, 0.95), smoothstep(28.0, 70.0, d));
        // autumn: drifts of fallen leaves over the grass, thickest in hollows of a broad noise
        vec4 lf = texture2D(tLeaves, gRot(q, 0.6) / 3.4);
        float litter = lf.a * smoothstep(0.25, 0.65, gNoise(q * 0.09 + 41.0) * 0.7 + gNoise(q * 0.4) * 0.3) * uAutumn;
        grass = mix(grass, lf.rgb * 0.95, litter);
        // winter: snow with soft drifts, wind ripples, blue in the hollows and glints of sparkle
        {
          float drift = gNoise(q * 0.08 + 7.0) * 0.6 + gNoise(q * 0.3) * 0.4;
          float ripple = sin(q.x * 1.7 + q.y * 0.6 + gNoise(q * 0.5) * 4.0) * 0.5 + 0.5;
          gSnow = mix(vec3(0.74, 0.82, 0.95), vec3(0.97, 0.98, 1.0), smoothstep(0.2, 0.75, drift)) * (0.95 + 0.05 * ripple);
          vec2 cell = floor(q * 22.0);
          float glint = step(0.993, gHash(cell)) * (1.0 - smoothstep(4.0, 22.0, d));
          gSnow += vec3(0.5) * glint * (0.5 + 0.5 * sin(dot(uCam.xz, vec2(3.1, 2.3)) + gHash(cell + 3.0) * 30.0));
        }
        vec3 soil = texture2D(tSoil, q / 3.2).rgb;
        vec3 alb = grass;
        // the colour textures carry their own colour; sand and lake bed are the soil, paled
        float soilL = dot(soil, vec3(0.299, 0.587, 0.114));
        vec3 pale = mix(vec3(soilL), soil, 0.35);
        // (the vertex tint is for grass; the other grounds divide it back out)
        vec3 untint = 1.0 / max(vColor, vec3(0.2));
        alb = mix(alb, pale * vec3(1.95, 1.8, 1.45) * untint, vSplat.x);               // sand
        alb = mix(alb, pale * vec3(1.1, 1.15, 0.95) * untint, vSplat.y);               // lake bed
        alb = mix(alb, soil * vec3(1.3, 1.2, 1.05) * untint, vSplat.z);                // the path
        alb = mix(alb, texture2D(tRock, q / 6.0).rgb * 1.5 * untint, vSplat.w);       // rock up high
        diffuseColor.rgb *= alb;
        float shade = (broad - 0.5) * 0.14 + (mid - 0.5) * 0.08;` : `
        float grain = gNoise(q * 4.0) * 0.5 + gNoise(q * 9.0) * 0.5;
        float nearK = 1.0 - smoothstep(12.0, 40.0, d);
        float shade = (broad - 0.5) * 0.18 + (mid - 0.5) * 0.24 + (grain - 0.5) * 0.22 * nearK;`}
        diffuseColor.rgb *= 1.0 + shade;
        // sunlit patches lean yellow-green, shaded ones blue-green
        diffuseColor.rgb += vec3(0.025, 0.02, -0.02) * (broad - 0.5) * 2.0 * diffuseColor.g;
      }`);
  };
  mat.customProgramCacheKey = () => 'ground' + (textured ? '-tex' : '');
  return mat;
}
