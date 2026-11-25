const VERTEX = `
attribute vec2 a_corner;
varying vec2 v_uv;
void main() {
  v_uv = a_corner * .5 + .5;
  gl_Position = vec4(a_corner, 0., 1.);
}
`;

const FRAGMENT = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_plate;
uniform vec3 u_hue;
uniform float u_time;
uniform float u_energy;
uniform float u_heat;
uniform float u_axis;

float hash(vec3 p) {
  p = fract(p * .3183099 + vec3(.13,.27,.42)) * 17.;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f*f*(3.-2.*f);
  return mix(
    mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),
    f.z
  );
}

mat2 rotate(float a) {
  float s=sin(a), c=cos(a);
  return mat2(c,-s,s,c);
}

void main() {
  vec2 p = (v_uv-.5)*4.8;
  vec2 q = vec2(p.x + p.y*.22*u_axis, p.y*1.1);
  float d = length(q);
  float lens = 1. - smoothstep(.30,1.28,d);
  float bend = exp(-pow((d-.87)*4.8,2.)) * (.026 + .014*u_heat);
  vec2 lensShift = q * bend * u_energy;
  vec3 plate = vec3(
    texture2D(u_plate, v_uv+lensShift*1.25).r,
    texture2D(u_plate, v_uv+lensShift).g,
    texture2D(u_plate, v_uv+lensShift*.73).b
  );

  float cloud = 0.;
  float threads = 0.;
  float transmittance = 1.;
  if (d < 1.24) {
    for (int i=0; i<13; i++) {
      float z = 1.12 - float(i)*.18;
      vec3 w = vec3(q,z);
      float r = length(w);
      vec3 flow = w;
      flow.xy = rotate(z*1.36-r*1.8+u_time*.90)*flow.xy;
      flow.xz = rotate(w.y*.87-u_time*.48)*flow.xz;
      vec3 f = flow*3.2 + vec3(0.,u_time*.46,u_time*.20);
      float coarse = noise(f);
      float detail = noise(f*2.35+coarse*.72);
      float billow = coarse*.70 + detail*.30;
      float shell = 1.-smoothstep(.79,1.18,r + (billow-.47)*.38);
      float dye = shell * smoothstep(.19,.86,billow);
      float filament = pow(1.-abs(sin(flow.y*14. + flow.z*8. + billow*5.)),11.);
      float hot = dye * filament * smoothstep(.35,.75,coarse) * (.40+.60*smoothstep(.15,1.,r));
      cloud += transmittance*dye*.11;
      threads += transmittance*hot*.28;
      transmittance *= 1.-dye*.095;
    }
  }

  float rim = exp(-pow((d-.83)*6.9,2.));
  float interference = noise(vec3(q*4.4,u_time*.72));
  float arcs = rim * pow(smoothstep(.28,.78,interference),2.);
  float angle = atan(q.y,q.x);
  float spiral = angle*3. + log(max(.10,d))*4.4 - u_time*3.2;
  spiral += noise(vec3(q*6.7,u_time*.72))*1.26;
  float curls = 1.-smoothstep(.046,.255,abs(sin(spiral)));
  float breaks = smoothstep(.29,.64,noise(vec3(q*2.8+vec2(.1,-.23),u_time*.47)));
  float corona = curls * breaks * smoothstep(.29,.74,d) * (1.-smoothstep(.92,1.32,d));
  float brightKnots = corona * pow(smoothstep(.39,.79,interference),1.42);
  float halo = exp(-d*d*1.16) * (1.-smoothstep(1.48,2.27,d));
  float haze = exp(-d*d*.63) * (1.-smoothstep(1.47,2.29,d)) * interference;
  float luminance = dot(plate,vec3(.2126,.7152,.0722));
  vec3 reflected = u_hue*(halo*.20+haze*.068)*(.35+.65*luminance);
  float shade = lens*.84 + cloud*.23;
  vec3 ink = plate*(1.-shade) + reflected;
  vec3 ion = mix(u_hue,vec3(.82,.84,1.),smoothstep(.16,.87,threads+arcs*.54+brightKnots)*.63);
  float power = cloud*.36 + threads*2.65 + arcs*.86 + corona*.47 + brightKnots*.56;
  power *= .94 + u_heat*.31;
  vec3 result = 1. - (1.-ink)*exp(-ion*power*2.2);
  float alpha = clamp(max(lens*1.14+cloud*.62,arcs*.7+corona*.89+halo*.66)*u_energy, 0., 1.);
  gl_FragColor = vec4(clamp(result,0.,1.),alpha);
}
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const reason = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(reason || 'Gojo shader did not compile.');
  }
  return shader;
}

export function createPlasmaTile(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const gl = canvas.getContext('webgl', {
    alpha: true, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, powerPreference: 'low-power',
  });
  if (!gl) return null;

  let program;
  const shaders = [];
  try {
    shaders.push(compile(gl, gl.VERTEX_SHADER, VERTEX));
    shaders.push(compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    program = gl.createProgram();
    for (const shader of shaders) gl.attachShader(program, shader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Gojo shader did not link.');
    }
  } catch (error) {
    if (program) gl.deleteProgram(program);
    throw error;
  } finally {
    for (const shader of shaders) gl.deleteShader(shader);
  }

  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, 'a_corner');
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.viewport(0, 0, size, size);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  const uniform = name => gl.getUniformLocation(program, name);
  const hue = uniform('u_hue'), time = uniform('u_time'), energy = uniform('u_energy');
  const heat = uniform('u_heat'), axis = uniform('u_axis');
  return {
    canvas,
    paint(plate, tint, seconds, strength, charge, direction) {
      if (gl.isContextLost()) return false;
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, plate);
      gl.uniform3fv(hue, tint);
      gl.uniform1f(time, seconds);
      gl.uniform1f(energy, strength);
      gl.uniform1f(heat, charge);
      gl.uniform1f(axis, direction);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return true;
    },
  };
}
