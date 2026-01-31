let gl;
let canvas;
let cubeBuffers;
let shaderProgram;
let projectionMatrix;
let modelViewMatrix;
let animationId = null;
let cameraAngle = 0;
let cameraHeight = 8;
let isAnimating = false;

function init() {
  canvas = document.getElementById("glcanvas");
  gl = WebGLDebugUtils.makeDebugContext(canvas.getContext("webgl"));

  if (!gl) {
    alert("Unable to initialize WebGL. Your browser may not support it.");
    return;
  }

  gl.clearColor(0.2, 0.2, 0.2, 1.0);
  gl.enable(gl.DEPTH_TEST);

  initShaders();
  cubeBuffers = initCubeBuffers();

  document.getElementById("startBtn").onclick = startAnimation;
  document.getElementById("stopBtn").onclick = stopAnimation;
  document.getElementById("redrawBtn").onclick = redrawScene;

  redrawScene();
}

function initShaders() {
  const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec4 aVertexColor;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    varying lowp vec4 vColor;
    void main() {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vColor = aVertexColor;
    }
  `;

  const fsSource = `
    varying lowp vec4 vColor;
    void main() {
      gl_FragColor = vColor;
    }
  `;

  const vertexShader = compileShader(gl.VERTEX_SHADER, vsSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fsSource);

  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Unable to initialize the shader program: " + gl.getProgramInfoLog(shaderProgram));
    return;
  }
}

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function initCubeBuffers() {
  const positions = [
    -0.5, -0.5, 0.5,   0.5, -0.5, 0.5,   0.5, 0.5, 0.5,   -0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5,  0.5, 0.5, -0.5,  0.5, -0.5, -0.5,
    -0.5, 0.5, -0.5,  -0.5, 0.5, 0.5,   0.5, 0.5, 0.5,   0.5, 0.5, -0.5,
    -0.5, -0.5, -0.5,  0.5, -0.5, -0.5, 0.5, -0.5, 0.5,  -0.5, -0.5, 0.5,
    0.5, -0.5, -0.5,   0.5, 0.5, -0.5,  0.5, 0.5, 0.5,   0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5,  -0.5, 0.5, -0.5
  ];

  const indices = [
    0, 1, 2, 0, 2, 3,   4, 5, 6, 4, 6, 7,
    8, 9,10, 8,10,11,  12,13,14,12,14,15,
    16,17,18,16,18,19, 20,21,22,20,22,23
  ];

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
    indices: indexBuffer,
    vertexCount: 36
  };
}

function drawCube(color, modelMatrix) {
  const aPos = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
  const aCol = gl.getAttribLocation(shaderProgram, 'aVertexColor');

  const uModel = gl.getUniformLocation(shaderProgram, 'uModelViewMatrix');
  const uProj = gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');

  gl.useProgram(shaderProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffers.position);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPos);

  const colors = new Float32Array(Array(24).fill(color).flat());
  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
  gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aCol);

  gl.uniformMatrix4fv(uModel, false, modelMatrix);
  gl.uniformMatrix4fv(uProj, false, projectionMatrix);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeBuffers.indices);
  gl.drawElements(gl.TRIANGLES, cubeBuffers.vertexCount, gl.UNSIGNED_SHORT, 0);

  gl.deleteBuffer(colorBuffer);
}

function drawRobot(viewMatrix) {
  const unit = 1 / 12;
  const red = [0.8, 0.2, 0.2, 1.0];
  const yellow = [0.9, 0.9, 0.2, 1.0];

  const parts = [
    // Feet
    { t: [-3, -1.5, 1], s: [4, 6, 2], c: red },
    { t: [ 3, -1.5, 1 ], s: [4, 6, 2], c: red },
    // Legs
    { t: [-3, 0, 7], s: [4, 3,10], c: yellow },
    { t: [ 3, 0, 7], s: [4, 3,10], c: yellow },
    // Body
    { t: [ 0, 0,18], s: [10, 6,12], c: red },
    // Arms 
    { t: [-6, 0,18], s: [2, 4,10], c: yellow },
    { t: [ 6, 0,18], s: [2, 4,10], c: yellow },
    // Head
    { t: [ 0, 0,26.5], s: [6, 4, 5], c: yellow }
  ];

  for (const p of parts) {
    let model = mat4.create();
    mat4.translate(model, model, p.t.map(v => v * unit));
    mat4.scale(model, model, p.s.map(v => v * unit));

    let mvp = mat4.create();
    mat4.multiply(mvp, viewMatrix, model);
    drawCube(p.c, mvp);
  }
}

function setupCamera() {
  const angle = parseFloat(document.getElementById("viewAngle").value);
  const dist = parseFloat(document.getElementById("camOrthoDistance").value);
  const selected = document.querySelector('input[name="cameraPos"]:checked').value.split("-");

  let cam;
  if (isAnimating) {
    cam = [dist * Math.cos(cameraAngle), dist * Math.sin(cameraAngle), cameraHeight];
  } else {
    const sign = v => v === "Left" || v === "Front" || v === "Bottom" ? -1 : 1;
    cam = [sign(selected[0]) * dist, sign(selected[1]) * dist, sign(selected[2]) * dist];
  }

  const aspect = canvas.width / canvas.height;
  projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, glMatrix.toRadian(angle), aspect, 0.001, dist * 10);

  modelViewMatrix = mat4.create();
  mat4.lookAt(modelViewMatrix, cam, [0, 0, 0], [0, 0, 1]);
}

function redrawScene() {
  setupCamera();
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawRobot(modelViewMatrix);
}

function animate() {
  if (!isAnimating) return;
  cameraAngle += 0.01;
  cameraHeight = 8 + 2 * Math.sin(cameraAngle * 2);
  redrawScene();
  animationId = requestAnimationFrame(animate);
}

function startAnimation() {
  if (!isAnimating) {
    isAnimating = true;
    animate();
  }
}

function stopAnimation() {
  isAnimating = false;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  redrawScene();
}

window.onload = init;
