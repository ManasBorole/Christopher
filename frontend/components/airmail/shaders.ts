// GLSL for the landing scene. Paper shares one sky so fog and sheen match the horizon.

// the harbour sky and sea, shared by the dome, the paper fog and the sheen
export const SKY = /* glsl */ `
uniform vec3 uZen, uMid, uHor, uSea, uSunDir;
vec3 skyS(vec3 d){
  float y = d.y;
  vec2 hz = normalize(d.xz + 1e-5), sz = normalize(uSunDir.xz);
  float az = max(dot(hz, sz), 0.);
  float sunA = pow(az, 3.), sunB = pow(az, 70.);
  vec3 c;
  if (y >= 0.) {
    c = mix(uMid, uZen, smoothstep(0.0, 0.62, y));
    float glow = exp(-y * 15.) * (0.22 + 0.78 * sunA) + exp(-y * 4.) * 0.16 * sunA;
    c = mix(c, uHor, clamp(glow * 0.95, 0., 1.));
    c += uHor * exp(-y * 45.) * sunB * 0.7;
  } else {
    float yy = -y;
    vec3 near = mix(uSea, uMid, 0.35);
    c = mix(mix(uMid, uHor, 0.32 * (0.4 + sunA)), near, smoothstep(0., 0.05, yy));
    c = mix(c, uSea, smoothstep(0.05, 0.6, yy));
    vec2 P = d.xz / max(yy, .02);
    float rip = sin(P.x * 2.1 + sin(P.y * 1.3) * 1.7) * sin(P.y * 3.7 + sin(P.x * .9) * 2.1);
    c *= 1. + rip * .07 * smoothstep(.03, .25, yy);
    c += uHor * .05 * smoothstep(.2, 1., rip) * smoothstep(.03, .3, yy) * (.3 + sunA);
    c += uHor * sunB * exp(-yy * 9.) * 0.45;
  }
  return c;
}
vec3 skyCol(vec3 d){ return pow(skyS(d), vec3(2.2));
}`;

// paper sheets: flock cards (FLOCK), the hero card (HERO), the after card (POSTMARK), polaroids
export const PAPER_VERT = /* glsl */ `
uniform float uTime, uBend, uCurl, uFlut;
uniform vec2 uFold, uSize;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
#ifdef FLOCK
attribute vec4 aData; varying vec2 vTile;
#endif
vec3 fold(vec3 p){
  float W = uSize.x, H = uSize.y, f1 = uFold.x, f2 = uFold.y;
  float u = (p.x + W * .5) / W;
  float taper = mix(1., mix(1., .1, pow(u, 1.25)), f1);
  float s = p.y < 0. ? -1. : 1.;
  float a0 = abs(p.y), a = a0 * taper;
  float d = H * .17;
  vec3 r;
  if (a < d) { float rr = d - a, th = f2 * 1.5708; r = vec3(p.x, s * (d - rr * cos(th)) - s * d * f2, -rr * sin(th)); }
  else { r = vec3(p.x, s * a - s * d * f2, (a - d) * .22 * f2); }
  r.z += sin(f1 * 3.1416) * (a0 - a) * .55;
  return r;
}
void main(){
  vUv = uv;
  vec3 p = position;
  vec3 nl = vec3(0., 0., 1.);
#ifdef FLOCK
  float ph = aData.x, t = uTime * aData.y + ph * 6.2831;
  float A = .045 + uBend, kx = 3.4, w = p.x * kx + t * 2.3;
  float tw = sin(t * 1.1 + ph * 3.) * .5;
  float cup = .12 * sin(t * .8 + ph);
  p.z += A * sin(w) + tw * p.x * p.y + cup * p.y * p.y * 2.;
  float dzdx = A * kx * cos(w) + tw * p.y;
  float dzdy = tw * p.x + cup * 4. * p.y;
  nl = normalize(vec3(-dzdx, -dzdy, 1.));
  vTile = aData.zw;
  if (uFold.x + uFold.y > .001) p = fold(p);
  mat4 M = modelMatrix * instanceMatrix;
#else
  float xn = p.x / (uSize.x * .5), yn = p.y / (uSize.y * .5);
  p.z += uCurl * (xn * xn - .35) * uSize.x * .18;
  p.z += uFlut * (sin(xn * 2.6 + uTime * 1.9) * .6 + sin(yn * 2. + uTime * 1.3) * .3 + xn * yn * sin(uTime * .9) * .5);
  p = fold(p);
  mat4 M = modelMatrix;
#endif
  vec4 wp = M * vec4(p, 1.);
  vW = wp.xyz;
  vN = normalize(mat3(M) * nl);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const PAPER_FRAG = /* glsl */ `
${SKY}
uniform float uFocus, uDof, uFogN, uFogF, uDim, uTime, uGlint;
uniform vec2 uFold;
uniform vec3 uKey, uKeyCol, uAmb;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
#ifdef FLOCK
uniform sampler2D tAtlas; uniform vec2 uGrid; varying vec2 vTile;
#else
uniform sampler2D tFront, tBack;
#endif
#ifdef HERO
uniform sampler2D tInk, tMask; uniform float uDraw;
#endif
#ifdef POSTMARK
uniform sampler2D tPost; uniform vec4 uPM; uniform vec2 uStamp;
#endif
void main(){
  bool front = gl_FrontFacing;
  vec2 uv = front ? vUv : vec2(1. - vUv.x, vUv.y);
  float dist = length(vW - cameraPosition);
  float bias = clamp(abs(dist - uFocus) * uDof, 0., 2.6);
#ifdef FLOCK
  float tile = front ? vTile.x : vTile.y;
  vec2 cell = vec2(mod(tile, uGrid.x), floor(tile / uGrid.x));
  vec2 iuv = mix(vec2(.012), vec2(.988), uv);
  vec2 auv = vec2((cell.x + iuv.x) / uGrid.x, 1. - (cell.y + 1. - iuv.y) / uGrid.y);
  vec3 base = texture2D(tAtlas, auv, bias).rgb;
  vec3 n = uFold.y > .001 ? normalize(cross(dFdx(vW), dFdy(vW))) : normalize(vN);
#else
  vec3 base = front ? texture2D(tFront, uv, bias).rgb : texture2D(tBack, uv, bias).rgb;
  #ifdef HERO
  if (!front) {
    vec3 ink = texture2D(tInk, uv, bias).rgb;
    float m = texture2D(tMask, uv).r;
    float k = m < .02 ? 1. : 1. - smoothstep(uDraw - .012, uDraw + .004, m);
    base = mix(base, ink, k);
  }
  #endif
  #ifdef POSTMARK
  if (front) {
    vec2 q = (uv - uPM.xy) / uPM.zw * uStamp.x + .5;
    if (q.x > 0. && q.y > 0. && q.x < 1. && q.y < 1.) { vec4 pm = texture2D(tPost, q); base = mix(base, pm.rgb, pm.a * uStamp.y); }
  }
  #endif
  vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
#endif
  vec3 v = normalize(cameraPosition - vW);
  if (dot(n, v) < 0.) n = -n;
  vec3 L = normalize(uKey);
  float hl = dot(n, L) * .5 + .5;
  vec3 light = mix(uAmb, uKeyCol, hl * hl);
  vec3 S = normalize(uSunDir);
  float trans = pow(max(dot(-n, S), 0.), 2.) * .22;
  vec3 h = normalize(L + v);
  float spec = pow(max(dot(n, h), 0.), 28.) * .1;
  float rim = pow(1. - max(dot(n, v), 0.), 3.) * .18;
  vec3 HL = pow(uHor, vec3(2.2));
  vec3 col = base * (light + trans * HL) + (spec + rim * .5) * uKeyCol + rim * HL * .25;
  // warm sheen when the sheet turns toward the horizon glow
  vec3 hs = normalize(S + v);
  col += HL * (pow(max(dot(n, hs), 0.), 14.) * .28 + pow(max(dot(n, S), 0.), 2.) * .1 * base);
  col += HL * uGlint * pow(max(dot(n, hs), 0.), 5.) * 1.1;
  if (!front) col *= .84;
  vec2 e = min(vUv, 1. - vUv);
  col *= mix(.72, 1., smoothstep(0., .014, min(e.x * 1.5, e.y)));
  col *= uDim;
  float fog = smoothstep(uFogN, uFogF, dist);
  col = mix(col, skyCol(normalize(vW - cameraPosition)), fog * .94);
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;

// sky dome: hills, harbour cranes, shore lights, and stars once night falls
export const DOME_VERT = /* glsl */ `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;

export const DOME_FRAG = /* glsl */ `${SKY}
      varying vec3 vD; uniform float uTime, uNight;
      float h1(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vD); vec3 c = skyS(d);
        float a = atan(d.x, -d.z);
        float hill = .012 + .009 * sin(a * 4. + 1.3) + .006 * sin(a * 11. + 2.) + .003 * sin(a * 29.);
        float aa = fwidth(d.y) * 1.2;
        float land = (1. - smoothstep(hill - aa, hill + aa, d.y)) * step(-.002, d.y);
        float crane = 0.;
        for (int i = 0; i < 4; i++) {
          float a0 = -.62 + float(i) * .19 + (i > 1 ? .55 : 0.);
          float ht = .055 + .012 * float(i % 2);
          float fa = fwidth(a) * 1.2;
          float mast = (1. - smoothstep(.0012, .0012 + fa, abs(a - a0))) * step(d.y, ht);
          float boom = (1. - smoothstep(.0011, .0011 + aa, abs(d.y - ht + .002))) * step(a0 - .045, a) * step(a, a0 + .016);
          float tie = (1. - smoothstep(.0007, .0007 + aa, abs(d.y - (ht + .012 - (a - a0 + .045) * .27)))) * step(a0 - .045, a) * step(a, a0);
          crane = max(crane, max(mast, max(boom, tie)));
        }
        vec3 sil = mix(uZen, uMid, .55) + uHor * .05;
        c = mix(c, sil, max(land, crane * step(0., d.y)) * .9);
        float lights = step(.985, h1(vec2(floor(a * 260.), 3.))) * (1. - smoothstep(0., .004, abs(d.y - .004))) * step(abs(a), 1.4);
        c += uHor * lights * 1.4 * (1. - uNight * .7);
        float st = step(.9965, h1(floor(vec2(a * 520., d.y * 520.)))) * smoothstep(.03, .25, d.y) * uNight;
        c += vec3(.85, .9, .95) * st * (.5 + .5 * h1(floor(vec2(a * 520., d.y * 520.)) + 3.));
        c += (h1(gl_FragCoord.xy + uTime) - .5) / 255. * 2.;
        gl_FragColor = vec4(pow(max(c, 0.), vec3(2.2)), 1.);
        #include <colorspace_fragment>
      }`;

// text dust: glowing wind-streaked particles, positions a pure function of the sweep
export const DUST_VS = /* glsl */ `
attribute vec2 aO; attribute vec3 aS;
uniform float uX, uSpan, uMode, uPR, uSz, uGlow;
varying float vT, vHot, vF; varying vec2 vDir; varying vec3 vS;
vec2 disp(float t, vec2 o, vec3 s) {
  vec2 d = vec2((70. + 560. * s.x) * t * t * (.55 + .45 * t), -(40. + 320. * s.z) * pow(t, 1.6));
  float a = 6.2831 * s.y + t * 5. + o.x * .011 + o.y * .019;
  d += vec2(sin(a), cos(a * 1.31)) * (16. + 56. * s.z) * pow(t, 1.3);
  d += vec2(sin(o.y * .05 + t * 9.), cos(o.x * .04 + t * 7.)) * 9. * t;
  return d;
}
void main() {
  float raw = uMode > 0. ? (uX - aO.x) / uSpan : (aO.x - uX) / uSpan;
  if (raw <= -.004 || raw >= 1. || (uGlow > 0. && aS.y > .13)) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
  float t = max(raw, 0.);
  vec2 d = disp(t, aO, aS), d2 = disp(min(t + .02, 1.), aO, aS);
  vec2 v = uMode * (d2 - d); float sp = length(v);
  vDir = sp > 1e-3 ? v / sp : vec2(1., 0.);
  float len = clamp(sp * .9, 0., 16.), base = uSz * (1. + uGlow * 7.);
  vF = base / (base + len);
  vT = t; vHot = exp(-t * 24.); vS = aS;
  gl_PointSize = (base + len) * uPR;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(aO + uMode * d, 0., 1.);
}`;

export const DUST_FS = /* glsl */ `
uniform float uGlow, uMode, uHotK;
varying float vT, vHot, vF; varying vec2 vDir; varying vec3 vS;
void main() {
  vec2 c = gl_PointCoord * 2. - 1.;
  float al = dot(c, vDir), ac = dot(c, vec2(-vDir.y, vDir.x));
  float f = exp(-(al * al * 2.2 + ac * ac / max(vF * vF, .02) * 2.4));
  // paper cream throughout; the faintest warm cast from the horizon glow as it drifts; near-white at the front
  vec3 paper = vec3(.953, .91, .82), warm = vec3(.96, .88, .78), hot = vec3(1., .98, .94);
  vec3 col = mix(paper, warm, smoothstep(.2, .9, vT) * vS.z * .6);
  col = mix(col, hot, vHot * (uHotK > .6 ? .8 : .45));
  float a = (1. - vT) * (.3 + uHotK * vHot) * f;
  if (uGlow > 0.) a *= .09;
  if (uHotK < .6) a *= .7; // phones: fewer, larger particles stack up brighter
  gl_FragColor = vec4(col * a, a * .35);
}`;

// the paper plane's glowing trail
export const TRAIL_VERT = /* glsl */ `attribute float aA; attribute float aV; varying float vA; varying float vV; void main(){ vA = aA; vV = aV; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;

export const TRAIL_FRAG = /* glsl */ `uniform float uO; varying float vA; varying float vV; void main(){ float e = sin(vV * 3.1416); gl_FragColor = vec4(vec3(1.,.88,.74) * vA * uO * .3 * e * e, 1.); }`;

// harbour lights and constellation stars
export const STAR_VERT = /* glsl */ `attribute float aOn, aSize, aHue; uniform float uPR, uK; varying float vOn, vHue; void main(){ vOn = aOn; vHue = aHue; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uPR * uK; }`;

export const STAR_FRAG = /* glsl */ `varying float vOn, vHue; void main(){ vec2 c = gl_PointCoord * 2. - 1.; float d = dot(c, c); float core = exp(-d * 18.), halo = exp(-d * 4.) * .4; vec3 col = mix(vec3(1., .74, .42), vec3(.86, .96, 1.), vHue); gl_FragColor = vec4(col * (core * 1.7 + halo) * vOn, 1.); }`;

// the lights' reflections, rippling on the water
export const REFLECT_FRAG = /* glsl */ `uniform float uT; varying float vOn, vHue; void main(){ vec2 c = gl_PointCoord * 2. - 1.; float a = exp(-c.x * c.x * 34.) * smoothstep(1., .05, abs(c.y)) * (.55 + .45 * sin(c.y * 22. + uT * 2.6 + vHue * 40.)); vec3 col = mix(vec3(1., .72, .4), vec3(.8, .92, 1.), vHue); gl_FragColor = vec4(col * a * vOn * .55, 1.); }`;

// constellation strokes, drawn in left to right like a pen
export const LINE_VERT = /* glsl */ `attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

export const LINE_FRAG = /* glsl */ `uniform float uDraw, uO; varying float vT; void main(){ float a = clamp((uDraw - vT) * 60., 0., 1.) * uO; gl_FragColor = vec4(vec3(1., .93, .8) * a, 1.); }`;

// the giant postcard: the rendered harbour on its picture side, the written back behind
export const GIANT_VERT = /* glsl */ `uniform float uCurl; uniform vec2 uSize; varying vec2 vUv, vL; varying vec3 vW;
      void main(){ vUv = uv; vec3 p = position; vL = p.xy; float xn = p.x / (uSize.x * .5); p.z += uCurl * (xn * xn - .35) * uSize.x * .1;
        vec4 wp = modelMatrix * vec4(p, 1.); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;

export const GIANT_FRAG = /* glsl */ `uniform sampler2D tPic, tBack, tPost; uniform vec2 uSize, uM, uStamp; uniform vec4 uPM; uniform vec3 uPaper, uRed, uBlue;
      varying vec2 vUv, vL; varying vec3 vW;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); vec3 v = normalize(cameraPosition - vW); if (dot(n, v) < 0.) n = -n;
        float sh = .84 + .16 * max(dot(n, normalize(vec3(-.35, .5, .8))), 0.);
        vec3 col;
        if (gl_FrontFacing) {
          vec2 q = (vL + uSize * .5 - uM) / (uSize - 2. * uM);
          if (q.x > 0. && q.y > 0. && q.x < 1. && q.y < 1.) col = texture2D(tPic, q).rgb;
          else {
            vec2 e = min(vL + uSize * .5, uSize * .5 - vL); float de = min(e.x, e.y);
            vec3 paper = uPaper * (.9 + .1 * hh(floor(vL * 140.)));
            col = paper;
            if (de < uM.x * .55) { float s = fract((vL.x + vL.y) / (uM.x * 1.1)); col = s < .36 ? uRed : s < .5 ? paper : s < .86 ? uBlue : paper; }
            col *= sh;
          }
        } else {
          vec2 uv = vec2(1. - vUv.x, vUv.y);
          col = texture2D(tBack, uv).rgb;
          vec2 qq = (uv - uPM.xy) / uPM.zw * uStamp.x + .5;
          if (qq.x > 0. && qq.y > 0. && qq.x < 1. && qq.y < 1.) { vec4 pm = texture2D(tPost, qq); col = mix(col, pm.rgb, pm.a * uStamp.y * .92); }
          col *= sh;
        }
        gl_FragColor = vec4(col, 1.);
        #include <colorspace_fragment>
      }`;
