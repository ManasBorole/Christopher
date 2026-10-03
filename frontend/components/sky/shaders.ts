/* GLSL for the progress sky. Every day star stores (ra, dec, radius) in its
   position: ra counts months since the learner's first month, dec is how far
   north of the band the star sits. skyDir() turns that into a direction under
   a sky that rotates about the pole like a real night (uT = the month on the
   meridian, uS = radians of turn per month, uLat = the viewer's latitude,
   uDec = the tilt that brings the language in focus to a comfortable height). */

export const WATER = -6; // harbour surface, in scene units below the eye

export const SKYFN = /* glsl */ `
uniform float uT, uS, uLat, uDec;
vec3 skyDir(vec3 p, out float H){ H = (uT - p.x) * uS; float dc = p.y + uDec, cd = cos(dc);
  return cd * cos(H) * vec3(0., cos(uLat), -sin(uLat)) + vec3(cd * sin(H), 0., 0.) + sin(dc) * vec3(0., sin(uLat), cos(uLat)); }
float hillAt(vec3 d){ float a = atan(d.x, -d.z); return .012 + .009 * sin(a * 4. + 1.3) + .006 * sin(a * 11. + 2.) + .003 * sin(a * 29.); }
// how much of a star gets through the air: none behind the hills, dim and warm near the horizon
float extinct(vec3 d, float H){ if (abs(H) > 2.1) return 0.; float h = hillAt(d); return smoothstep(h + .004, h + .05, d.y) * mix(.38, 1., smoothstep(0., .35, d.y)); }`;

/* the dome: the landing's dusk sky after dark, its hills, cranes and harbour
   lights. The milky way turns with the stars; the land stays put. */
export const DOME_VERT = /* glsl */ `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
export const DOME_FRAG = /* glsl */ `
uniform vec3 uZen, uMid, uHor, uSea, uSunDir; uniform float uTime, uOct, uT, uS, uLat, uDec;
varying vec3 vD;
float h1(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h1(i), h1(i+vec2(1,0)), f.x), mix(h1(i+vec2(0,1)), h1(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ if (float(i) >= uOct) break; s += a * vn(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
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
    float rip = sin(P.x * 2.1 + sin(P.y * 1.3) * 1.7 + uTime * .25) * sin(P.y * 3.7 + sin(P.x * .9) * 2.1 - uTime * .2);
    c *= 1. + rip * .09 * smoothstep(.03, .25, yy);
    c += uHor * .05 * smoothstep(.2, 1., rip) * smoothstep(.03, .3, yy) * (.3 + sunA);
    c += uHor * sunB * exp(-yy * 9.) * 0.45;
  }
  return c;
}
void main(){
  vec3 d = normalize(vD); vec3 c = skyS(d);
  float a = atan(d.x, -d.z);
  if (d.y > 0.) {
    vec3 P = vec3(0., sin(uLat), cos(uLat)), Q = vec3(0., cos(uLat), -sin(uLat));
    float dec = asin(clamp(dot(d, P), -1., 1.)) - uDec;
    float ra = uT * uS - atan(d.x, dot(d, Q));
    float band = exp(-pow((dec - (.3 + .42 * sin(ra * .5 + .4))) * 2.6, 2.));
    float n = fbm(vec2(ra * 2.4, dec * 4.6));
    float lift = smoothstep(.0, .25, d.y);
    c += vec3(.045, .095, .105) * band * smoothstep(.32, .85, n) * 1.3 * lift;
    c += vec3(.03, .06, .07) * band * .35 * lift;
  }
  float hill = .012 + .009 * sin(a * 4. + 1.3) + .006 * sin(a * 11. + 2.) + .003 * sin(a * 29.);
  float aa = fwidth(d.y) * 1.2, fa = fwidth(a) * 1.2;
  float land = (1. - smoothstep(hill - aa, hill + aa, d.y)) * step(-.002, d.y);
  float crane = 0., beacon = 0.;
  for (int i = 0; i < 4; i++) {
    float a0 = -.62 + float(i) * .19 + (i > 1 ? .55 : 0.);
    float ht = .036 + .008 * float(i - (i / 2) * 2);
    float mast = (1. - smoothstep(.0009, .0009 + fa, abs(a - a0))) * step(d.y, ht);
    float boom = (1. - smoothstep(.0011, .0011 + aa, abs(d.y - ht + .002))) * step(a0 - .03, a) * step(a, a0 + .011);
    float tie = (1. - smoothstep(.0007, .0007 + aa, abs(d.y - (ht + .008 - (a - a0 + .03) * .27)))) * step(a0 - .03, a) * step(a, a0);
    crane = max(crane, max(mast, max(boom, tie)));
    vec2 q = vec2(a - a0, d.y - ht - .0085);
    float bl = .35 + .65 * smoothstep(.0, .25, sin(uTime * 1.6 + float(i) * 1.9));
    beacon += (exp(-dot(q, q) / 1.6e-6) + exp(-dot(q, q) / 4e-5) * .18) * bl;
  }
  vec3 sil = mix(uZen, uMid, .5) + uHor * .04;
  c = mix(c, sil, max(land, crane * step(0., d.y)) * .92);
  c += vec3(.84, .27, .27) * beacon;
  float col = floor(a * 260.);
  float on = step(.955, h1(vec2(col, 3.))) * step(abs(a), 1.5);
  float fx = abs(fract(a * 260.) - .5);
  vec3 lc = mix(vec3(1., .74, .4), vec3(.82, .95, 1.), step(.78, h1(vec2(col, 9.))));
  float flick = .85 + .15 * sin(uTime * 2.3 + col);
  c += lc * on * (1. - smoothstep(.0, .0032 + aa, abs(d.y - .0045))) * (1. - smoothstep(.18, .5, fx)) * 1.25 * flick;
  if (d.y < 0.) {
    float yy = -d.y;
    float w = fx + .14 * sin(yy * 520. + uTime * 1.4 + col);
    float streak = on * (1. - smoothstep(.12, .48, w)) * exp(-yy * 34.) * (.55 + .45 * sin(yy * 900. - uTime * 2. + col)) * smoothstep(0., .003, yy);
    c += lc * streak * .6;
  }
  // interleaved gradient noise fixed to the pixel grid: no banding, and nothing that crawls
  c += (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))) - .5) / 255. * 1.5;
  gl_FragColor = vec4(max(c, 0.), 1.);
}`;

// faint background stars over the whole sphere; they turn with the sky
export const BG_VERT = /* glsl */ `attribute float aS, aD; attribute vec3 aC; uniform float uTime, uPR, uTw; ${SKYFN} varying vec3 vC; varying float vA;
void main(){ float H; vec3 d = skyDir(position, H); gl_Position = projectionMatrix * viewMatrix * vec4(d * position.z, 1.); gl_PointSize = aS * uPR * 1.6;
  float h = hillAt(d); vA = (.32 + .5 * aD) * smoothstep(h, h + .14, d.y) * (1. + uTw * .35 * sin(uTime * (1. + aD * 2.) + aD * 50.)); vC = mix(aC, aC * vec3(1.1, .7, .5), 1. - smoothstep(.02, .25, d.y)); }`;
export const BG_FRAG = /* glsl */ `varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord * 2. - 1.; float d = dot(c, c); gl_FragColor = vec4(vC * exp(-d * 5.) * vA, 1.); }`;

/* the day stars. aDim = how much the star's language is in focus (lit stars
   are coloured and large, the rest small warm-white background stars; uTint
   tints them all for "All"). aToday: 1 = today's star, 2 = tonight's star
   still waiting for today's first conversation, which breathes. */
export const STAR_VERT = /* glsl */ `
attribute float aSize, aDim, aSeed, aIdx, aToday; attribute vec3 aCol;
uniform float uTime, uPR, uTw, uHover, uSel, uTint;
${SKYFN}
varying vec3 vCol; varying float vA, vToday, vHot, vBig, vK;
void main(){
  float H; vec3 d = skyDir(position, H);
  float ext = extinct(d, H);
  vec3 wp = d * position.z;
  #ifdef MIR
  wp.y = ${2 * WATER}. - wp.y;
  #endif
  vec4 mv = viewMatrix * vec4(wp, 1.);
  gl_Position = ext > 0. ? projectionMatrix * mv : vec4(2., 2., 2., 1.);
  float hov = 1. - step(.5, abs(aIdx - uHover)), sel = 1. - step(.5, abs(aIdx - uSel));
  vHot = max(hov, sel);
  float z = clamp(150. / max(-mv.z, 1.), .75, 3.4);
  float tw = 1. + uTw * (.09 * sin(uTime * 1.3 + aSeed * 40.) + .06 * sin(uTime * 2.9 + aSeed * 17.));
  float k = mix(1.3, aToday > .5 ? 3.4 : 1.6, aDim);
  vK = k;
  vBig = smoothstep(14., 26., aSize) * aDim;
  float pulse = aToday > .5 ? 1. + uTw * .12 * sin(uTime * 2.1) : 1.;
  gl_PointSize = mix((3.2 + aSize * .2) * (1. + .35 * uTint), aSize, aDim) * z * (1. + vHot * .3) * k * pulse * uPR * mix(.7, 1., smoothstep(.0, .3, d.y));
  vA = mix(.5 + .2 * uTint, 1., aDim) * tw * ext * (aToday > 1.5 ? .7 + .3 * sin(uTime * 1.7) : 1.);
  vToday = step(.5, aToday) * step(.5, aDim);
  vec3 c0 = mix(mix(vec3(1., .93, .82), aCol, uTint * .85), aCol, aDim);
  vCol = mix(c0, c0 * vec3(1.12, .6, .4), (1. - smoothstep(.04, .3, d.y)) * .85);
}`;
export const STAR_FRAG = /* glsl */ `
uniform float uTime, uTw;
varying vec3 vCol; varying float vA, vToday, vHot, vBig, vK;
void main(){
  vec2 c = gl_PointCoord * 2. - 1.;
  vec2 q = c * vK; float d = dot(q, q);
  float core = exp(-d * 26.) * 1.7 + exp(-d * 6.) * .5 + exp(-d * 1.7) * (.13 + vHot * .22);
  if (vToday > .5) core = core * 1.35 + exp(-d * .9) * .1;
  float sp = (exp(-abs(q.x) * 22.) * exp(-q.y * q.y * .9) + exp(-abs(q.y) * 22.) * exp(-q.x * q.x * .9)) * (.12 + .3 * vBig + .25 * vHot);
  vec3 col = mix(vCol, vec3(1.), clamp(core * .5, 0., .8)) * (core + sp);
  float r = length(c);
  if (vHot > .5) col += vCol * exp(-pow((r * vK - .82) * 9., 2.)) * .5;
  if (vToday > .5) {
    for (int i = 0; i < 2; i++) {
      float ph = fract(uTime * .22 + float(i) * .5);
      col += vCol * exp(-pow((r - ph * .92) * 22., 2.)) * (1. - ph) * (1. - ph) * .55 * uTw;
    }
  }
  col *= smoothstep(1., .7, r);
  gl_FragColor = vec4(col * vA, 1.);
}`;
// reflections on the harbour: only what is low in the sky reaches the water in view
export const REFL_FRAG = /* glsl */ `
uniform float uTime, uTw; varying vec3 vCol; varying float vA, vToday, vHot, vBig, vK;
void main(){ vec2 c = gl_PointCoord * 2. - 1.; c *= vK / 1.6;
  float a = exp(-c.x * c.x * 40.) * smoothstep(1., .1, abs(c.y)) * (.55 + .45 * sin(c.y * 24. + uTime * 2.4 * uTw + vK));
  gl_FragColor = vec4(vCol * a * vA * .45, 1.); }`;

// constellation lines: soft ribbons with a gap at each star, drawn in screen space
export const LINE_VERT = /* glsl */ `
attribute vec3 aOther, aCol; attribute float aSide, aEnd, aDim;
uniform vec2 uRes; uniform float uW, uGap, uPR;
${SKYFN}
varying float vSide, vA; varying vec3 vCol;
void main(){
  float Ha, Hb; vec3 da = skyDir(position, Ha), db = skyDir(aOther, Hb);
  float ext = min(extinct(da, Ha), extinct(db, Hb));
  vec4 a = projectionMatrix * viewMatrix * vec4(da * position.z, 1.);
  vec4 b = projectionMatrix * viewMatrix * vec4(db * aOther.z, 1.);
  if (a.w < 1. || b.w < 1. || ext <= 0. || aDim <= 0.) { gl_Position = vec4(2., 2., 2., 1.); return; }
  vec2 na = a.xy / a.w, nb = b.xy / b.w;
  vec2 d = (nb - na) * uRes * .5; float L = length(d); d = L > .001 ? d / L : vec2(1., 0.);
  vec2 n = vec2(-d.y, d.x);
  float z = clamp(150. / a.w, 1., 2.6);
  float g = min(uGap * z * uPR, L * .38);
  float w = uW * uPR * mix(1., 1.6, (z - 1.) / 1.6) + 1.5;
  vec2 off = d * g + n * aSide * (aEnd > .5 ? -1. : 1.) * w;
  gl_Position = vec4((na + off * 2. / uRes) * a.w, 0., a.w);
  vSide = aSide; vA = aDim * ext * smoothstep(0., uGap * 2.5 * uPR, L);
  vCol = mix(aCol, aCol * vec3(1.12, .6, .4), (1. - smoothstep(.04, .3, min(da.y, db.y))) * .85);
}`;
export const LINE_FRAG = /* glsl */ `
varying float vSide, vA; varying vec3 vCol;
void main(){ float s = 1. - abs(vSide); gl_FragColor = vec4(vCol * s * s * (3. - 2. * s) * vA * .36, 1.); }`;
