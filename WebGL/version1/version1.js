let gl;
let program;
let vertexBuffer;
let colorBuffer;

function initGL() {
  const canvas = document.getElementById("glcanvas");
  gl = WebGLDebugUtils.makeDebugContext(canvas.getContext("webgl"));
  if (!gl) {
    alert("Unable to initialize WebGL.");
    return;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.2, 0.2, 0.2, 1.0);
  gl.enable(gl.DEPTH_TEST);
}

function createShaders() {
  const vsSource = `
    attribute vec3 position;
    attribute vec3 color;
    varying vec3 vColor;
    uniform mat4 uMVPMatrix;
    void main(void) {
      gl_Position = uMVPMatrix * vec4(position, 1.0);
      vColor = color;
    }
  `;

  const fsSource = `
    precision mediump float;
    varying vec3 vColor;
    void main(void) {
      gl_FragColor = vec4(vColor, 1.0);
    }
  `;

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vsSource);
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSource);
  gl.compileShader(fs);

  program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.useProgram(program);
}

function createCube() {
  const size = 0.5;
  const positions = [
    // Front face (red)
    -size, -size,  size,
     size, -size,  size,
     size,  size,  size,
    -size, -size,  size,
     size,  size,  size,
    -size,  size,  size,
    // Back face (green)
    -size, -size, -size,
    -size,  size, -size,
     size,  size, -size,
    -size, -size, -size,
     size,  size, -size,
     size, -size, -size,
    // Top face (blue)
    -size,  size, -size,
    -size,  size,  size,
     size,  size,  size,
    -size,  size, -size,
     size,  size,  size,
     size,  size, -size,
    // Bottom face (yellow)
    -size, -size, -size,
     size, -size, -size,
     size, -size,  size,
    -size, -size, -size,
     size, -size,  size,
    -size, -size,  size,
    // Right face (magenta)
     size, -size, -size,
     size,  size, -size,
     size,  size,  size,
     size, -size, -size,
     size,  size,  size,
     size, -size,  size,
    // Left face (cyan)
    -size, -size, -size,
    -size, -size,  size,
    -size,  size,  size,
    -size, -size, -size,
    -size,  size,  size,
    -size,  size, -size,
  ];

  const faceColors = [
    [1.0, 0.0, 0.0], // red
    [0.0, 1.0, 0.0], // green
    [0.0, 0.0, 1.0], // blue
    [1.0, 1.0, 0.0], // yellow
    [1.0, 0.0, 1.0], // magenta
    [0.0, 1.0, 1.0], // cyan
  ];

  let colors = [];
  faceColors.forEach(color => {
    for (let i = 0; i < 6; i++) {
      colors.push(...color);
    }
  });

  vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
}

function getCameraPosition(dist) {
  const selected = document.querySelector('input[name="cameraPos"]:checked').value.split("-");
  const sign = v => v === "Left" || v === "Front" || v === "Bottom" ? -1 : 1;
  return [sign(selected[0]) * dist, sign(selected[1]) * dist, sign(selected[2]) * dist];
}

function redrawScene() {
  const angle = parseFloat(document.getElementById("viewAngle").value);
  const camDist = parseFloat(document.getElementById("camOrthoDistance").value);
  const camPos = getCameraPosition(camDist);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const aspect = gl.canvas.width / gl.canvas.height;
  const proj = mat4.create();
  mat4.perspective(proj, glMatrix.toRadian(angle), aspect, 0.001, camDist * 10);

  const view = mat4.create();
  mat4.lookAt(view, camPos, [0, 0, 0], [0, 0, 1]);

  const mvp = mat4.create();
  mat4.multiply(mvp, proj, view);

  const uMVP = gl.getUniformLocation(program, "uMVPMatrix");
  gl.uniformMatrix4fv(uMVP, false, mvp);

  const posLoc = gl.getAttribLocation(program, "position");
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(posLoc);

  const colLoc = gl.getAttribLocation(program, "color");
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(colLoc);

  gl.drawArrays(gl.TRIANGLES, 0, 36);
}

window.onload = () => {
  initGL();
  createShaders();
  createCube();
  redrawScene();
};
