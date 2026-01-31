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

// Texture variables
let metalTexture;
let headTextures = {};
let skyboxTexture;
let floorTexture;
let texturesLoaded = 0;
const totalTextures = 14;

// Mouse control variables
let mouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;
let manualCameraAngle = 0;
let manualCameraHeight = 8;

// Robot animation variables
let rightArmAngle = 0;
let leftArmAngle = 0;
let headAngle = 0;
let rightLegAngle = 0;
let leftLegAngle = 0;
let currentControl = 'rightArm';

// Parade and Robot Metal animation variables
let paradePhase = 0;
let paradeDirection = 1;
let robotMetalCycles = 0;
let robotMetalPhase = 0;
let isRobotFalling = false;
let robotFallAngle = 0;
let headPulseScale = 1;
let headPulseDirection = 1;

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
  loadTextures();

  // Event listeners
  document.getElementById("startBtn").onclick = startAnimation;
  document.getElementById("stopBtn").onclick = stopAnimation;
  document.getElementById("redrawBtn").onclick = redrawScene;
  
  // Mouse controls
  canvas.addEventListener("mousedown", handleMouseDown, false);
  canvas.addEventListener("mouseup", handleMouseUp, false);
  canvas.addEventListener("mousemove", handleMouseMove, false);
  canvas.addEventListener("wheel", handleMouseWheel, false);
  
  // Robot control radio buttons
  const radioButtons = document.querySelectorAll('input[name="robotControl"]');
  radioButtons.forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentControl = e.target.value;
      console.log("Control changed to:", currentControl); // Debug
      if (currentControl === 'robotMetal') {
        // Initialize Robot Metal animation
        leftArmAngle = 0; // Left arm starts at 0 for 360 degrees rotation
        rightArmAngle = 45; // Right arm fixed at 45 degrees
        robotMetalCycles = 0;
        robotMetalPhase = 0;
        isRobotFalling = false;
        robotFallAngle = 0;
        headPulseScale = 1;
        console.log("Robot Metal - LEFT ARM rotates 360 degrees, RIGHT ARM fixed at 45 degrees");
      }
    });
  });
}

// Mouse control functions
function handleMouseDown(event) {
  mouseDown = true;
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
}

function handleMouseUp(event) {
  mouseDown = false;
}

function handleMouseMove(event) {
  if (!mouseDown) return;
  
  const deltaX = event.clientX - lastMouseX;
  const deltaY = event.clientY - lastMouseY;
  
  // Horizontal movement controls camera rotation
  manualCameraAngle += deltaX * 0.01;
  
  // Vertical movement controls camera height
  manualCameraHeight -= deltaY * 0.05;
  manualCameraHeight = Math.max(1, Math.min(20, manualCameraHeight));
  
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
  
  if (!isAnimating) {
    cameraAngle = manualCameraAngle;
    cameraHeight = manualCameraHeight;
  }
  
  redrawScene();
}

// Mouse wheel control
function handleMouseWheel(event) {
  event.preventDefault();
  const delta = event.deltaY > 0 ? -5 : 5; // 5 degrees per wheel notch
  
  console.log("Current control:", currentControl, "Delta:", delta); // Debug

  if (currentControl === 'rightArm') {
    // Right arm: -90 (down) to +90 (up) - total 180 degrees
    rightArmAngle = Math.max(-90, Math.min(90, rightArmAngle + delta));
    console.log("Right arm angle:", rightArmAngle);
  } else if (currentControl === 'leftArm') {
    // Left arm: -90 (down) to +90 (up) - total 180 degrees
    leftArmAngle = Math.max(-90, Math.min(90, leftArmAngle + delta));
    console.log("Left arm angle:", leftArmAngle);
  } else if (currentControl === 'head') {
    // Head: -45 (looking down) to +45 (looking up) - total 90 degrees
    headAngle = Math.max(-45, Math.min(45, headAngle + delta));
    console.log("Head angle:", headAngle);
  } else if (currentControl === 'rightLeg') {
    // Right leg: 0 (down) to 90 (horizontal forward) - total 90 degrees
    rightLegAngle = Math.max(0, Math.min(90, rightLegAngle + delta));
  } else if (currentControl === 'leftLeg') {
    // Left leg: 0 (down) to 90 (horizontal forward) - total 90 degrees
    leftLegAngle = Math.max(0, Math.min(90, leftLegAngle + delta));
  } else if (currentControl === 'parade') {
    if (!isAnimating) {
      updateParadeAnimation(delta > 0 ? 0.05 : -0.05);
      console.log("Manual parade - Left arm:", leftArmAngle, "Right leg:", rightLegAngle);
    }
  } else if (currentControl === 'robotMetal') {
    // Manual control of robot metal animation
    if (!isAnimating) {
      updateRobotMetalAnimation(delta > 0 ? 0.05 : -0.05);
    }
  }
  
  redrawScene();
}

// Parade animation logic
function updateParadeAnimation(speed) {
  paradePhase += speed;

  const sineValue = Math.sin(paradePhase);
  
  // Map sine values to your desired ranges
  // When sineValue = +1: leftArm=-90, rightLeg=90, rightArm=90, leftLeg=0
  // When sineValue = -1: leftArm=90, rightLeg=0, rightArm=-90, leftLeg=90
  
  leftArmAngle = -90 * sineValue;     // +90 to -90
  rightLegAngle = Math.max(0, 90 * sineValue);  // 0 to 90
  rightArmAngle = 90 * sineValue;     // -90 to +90 (opposite of left arm)
  leftLegAngle = Math.max(0, 90 * -sineValue);  // 0 to 90 (opposite phase of right leg)
  
  console.log("Parade smooth - Left arm:", leftArmAngle.toFixed(1), "Right leg:", rightLegAngle.toFixed(1), "Right arm:", rightArmAngle.toFixed(1), "Left leg:", leftLegAngle.toFixed(1));
}

// Robot Metal animation logic
function updateRobotMetalAnimation(speed) {
  if (isRobotFalling) {
    // falling and head pulsing
    robotFallAngle = Math.min(90, robotFallAngle + speed * 50);
    
    // Continue arm movements while falling
    robotMetalPhase += speed;
    
    // Same arm movements as before falling
    leftArmAngle = (robotMetalPhase * 360) % 360; // LEFT ARM still rotates 360 degrees
    rightArmAngle = -45; // RIGHT ARM still fixed at -45 degrees
    
    // Same head bobbing as before + pulsing
    const headPhase = robotMetalPhase % 1;
    if (headPhase < 0.5) {
      headAngle = 45 - (headPhase * 2) * 90; // From +45 to -45 
    } else {
      headAngle = -45 + ((headPhase - 0.5) * 2) * 90; // From -45 to +45 
    }
    
    // ADD head pulsing on top of the bobbing
    headPulseScale += headPulseDirection * speed * 2;
    if (headPulseScale >= 2) {
      headPulseScale = 2;
      headPulseDirection = -1;
    } else if (headPulseScale <= 0.5) {
      headPulseScale = 0.5;
      headPulseDirection = 1;
    }
    
    console.log("Easter Egg - Falling + All movements continue! Left arm:", leftArmAngle.toFixed(1), "Head pulse:", headPulseScale.toFixed(2));
  } else {
    robotMetalPhase += speed;
    
    // Left arm rotates 360 degrees, Right arm stays at 45 degrees
    leftArmAngle = (robotMetalPhase * 360) % 360;
    rightArmAngle = -45; 
    
    // Head bobbing synchronized with arm
    const headPhase = robotMetalPhase % 1;
    if (headPhase < 0.5) {
      headAngle = 45 - (headPhase * 2) * 90; // From +45 to -45
    } else {
      headAngle = -45 + ((headPhase - 0.5) * 2) * 90; // From -45 to +45
    }
    
    // Check for 5 cycles completion (Easter egg)
    if (robotMetalPhase >= 5) {
      isRobotFalling = true;
      robotFallAngle = 0;
      headPulseScale = 1;
      headPulseDirection = 1;
    }
  }
}

function initShaders() {
  const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec2 aTextureCoord;
    
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    
    varying highp vec2 vTextureCoord;
    
    void main() {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vTextureCoord = aTextureCoord;
    }
  `;

  const fsSource = `
    varying highp vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform bool uUseTexture;
    uniform lowp vec4 uColor;
    
    void main() {
      if (uUseTexture) {
        gl_FragColor = texture2D(uSampler, vTextureCoord);
      } else {
        gl_FragColor = uColor;
      }
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
    // Front face
    -0.5, -0.5, 0.5,   0.5, -0.5, 0.5,   0.5, 0.5, 0.5,   -0.5, 0.5, 0.5,
    // Back face
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5,  0.5, 0.5, -0.5,  0.5, -0.5, -0.5,
    // Top face
    -0.5, 0.5, -0.5,  -0.5, 0.5, 0.5,   0.5, 0.5, 0.5,   0.5, 0.5, -0.5,
    // Bottom face
    -0.5, -0.5, -0.5,  0.5, -0.5, -0.5, 0.5, -0.5, 0.5,  -0.5, -0.5, 0.5,
    // Right face
    0.5, -0.5, -0.5,   0.5, 0.5, -0.5,  0.5, 0.5, 0.5,   0.5, -0.5, 0.5,
    // Left face
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5,  -0.5, 0.5, -0.5
  ];

  const textureCoordinates = [
    // Front
    0.0, 0.0,  1.0, 0.0,  1.0, 1.0,  0.0, 1.0,
    // Back
    0.0, 0.0,  1.0, 0.0,  1.0, 1.0,  0.0, 1.0,
    // Top
    0.0, 0.0,  1.0, 0.0,  1.0, 1.0,  0.0, 1.0,
    // Bottom
    0.0, 0.0,  1.0, 0.0,  1.0, 1.0,  0.0, 1.0,
    // Right
    0.0, 0.0,  1.0, 0.0,  1.0, 1.0,  0.0, 1.0,
    // Left
    0.0, 0.0,  1.0, 0.0,  1.0, 1.0,  0.0, 1.0
  ];

  const indices = [
    0, 1, 2, 0, 2, 3,       // Front
    4, 5, 6, 4, 6, 7,       // Back
    8, 9, 10, 8, 10, 11,    // Top
    12, 13, 14, 12, 14, 15, // Bottom
    16, 17, 18, 16, 18, 19, // Right
    20, 21, 22, 20, 22, 23  // Left
  ];

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
    textureCoord: textureCoordBuffer,
    indices: indexBuffer,
    vertexCount: 36
  };
}

function loadTexture(url, callback) {
  const texture = gl.createTexture();
  const image = new Image();
  
  image.onload = function() {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    
    const isPowerOf2 = (value) => (value & (value - 1)) === 0;
    
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    texturesLoaded++;
    if (callback) callback();
    
    if (texturesLoaded === totalTextures) {
      redrawScene();
    }
  };
  
  image.src = url;
  return texture;
}

function loadTextures() {
  metalTexture = loadTexture('textures/Metal053C_1K-JPG_Color.jpg');
  
  headTextures.front = loadTexture('textures/robot_face_front.jpg');
  headTextures.left = loadTexture('textures/robot_face_right.jpg');
  headTextures.right = loadTexture('textures/robot_face_left.jpg');
  headTextures.back = loadTexture('textures/robot_face_back.jpg');
  headTextures.top = loadTexture('textures/robot_face_top.jpg');
  headTextures.bottom = loadTexture('textures/robot_face_bottom.jpg');
  
  floorTexture = loadTexture('textures/floor_names.jpg');
  
  skyboxTexture = {
    front: loadTexture('textures/Daylight_Box_Front.jpg'),
    back: loadTexture('textures/Daylight_Box_Back.jpg'),
    top: loadTexture('textures/Daylight_Box_Top.jpg'),
    bottom: loadTexture('textures/Daylight_Box_Bottom.jpg'),
    left: loadTexture('textures/Daylight_Box_Left.jpg'),
    right: loadTexture('textures/Daylight_Box_Right.jpg')
  };
}

function drawCube(texture, modelMatrix, useTexture = true, color = [1, 1, 1, 1]) {
  const aPos = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
  const aTexCoord = gl.getAttribLocation(shaderProgram, 'aTextureCoord');
  
  const uModel = gl.getUniformLocation(shaderProgram, 'uModelViewMatrix');
  const uProj = gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');
  const uSampler = gl.getUniformLocation(shaderProgram, 'uSampler');
  const uUseTexture = gl.getUniformLocation(shaderProgram, 'uUseTexture');
  const uColor = gl.getUniformLocation(shaderProgram, 'uColor');

  gl.useProgram(shaderProgram);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffers.position);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPos);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffers.textureCoord);
  gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aTexCoord);

  gl.uniformMatrix4fv(uModel, false, modelMatrix);
  gl.uniformMatrix4fv(uProj, false, projectionMatrix);
  gl.uniform1i(uUseTexture, useTexture ? 1 : 0);
  gl.uniform4fv(uColor, color);
  
  if (useTexture && texture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uSampler, 0);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeBuffers.indices);
  gl.drawElements(gl.TRIANGLES, cubeBuffers.vertexCount, gl.UNSIGNED_SHORT, 0);
}

function drawHeadFaceByFace(transformMatrix) {
  const aPos = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
  const aTexCoord = gl.getAttribLocation(shaderProgram, 'aTextureCoord');
  const uModel = gl.getUniformLocation(shaderProgram, 'uModelViewMatrix');
  const uProj = gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');
  const uSampler = gl.getUniformLocation(shaderProgram, 'uSampler');
  const uUseTexture = gl.getUniformLocation(shaderProgram, 'uUseTexture');

  gl.useProgram(shaderProgram);
  gl.uniformMatrix4fv(uModel, false, transformMatrix);
  gl.uniformMatrix4fv(uProj, false, projectionMatrix);
  gl.uniform1i(uUseTexture, 1);
  gl.uniform1i(uSampler, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffers.position);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPos);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffers.textureCoord);
  gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aTexCoord);

  const faces = [
    { indices: [0, 1, 2, 0, 2, 3], texture: headTextures.front || metalTexture },
    { indices: [4, 5, 6, 4, 6, 7], texture: headTextures.back || metalTexture },
    { indices: [8, 9, 10, 8, 10, 11], texture: headTextures.bottom || metalTexture },
    { indices: [12, 13, 14, 12, 14, 15], texture: headTextures.top || metalTexture },
    { indices: [16, 17, 18, 16, 18, 19], texture: headTextures.right || metalTexture },
    { indices: [20, 21, 22, 20, 22, 23], texture: headTextures.left || metalTexture }
  ];

  faces.forEach(face => {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, face.texture);
    
    const faceIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, faceIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(face.indices), gl.STATIC_DRAW);
    
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    gl.deleteBuffer(faceIndexBuffer);
  });
}

function drawRobotHead(viewMatrix) {
  const unit = 1 / 12;
  const neckPos = [0, 0, 24];
  const headOffset = [0, 0, 2.5];
  const headScale = [6, 4, 5];
  
  let model = mat4.create();
  
  if (isRobotFalling) {
    mat4.translate(model, model, [0, -1.5 * unit, 0]); // Move to heel position
    mat4.rotateX(model, model, glMatrix.toRadian(-robotFallAngle)); // Fall backwards around X axis
    mat4.translate(model, model, [0, 1.5 * unit, 0]);
  }

  mat4.translate(model, model, neckPos.map(v => v * unit));
  
  // Apply head rotation
  mat4.rotateX(model, model, glMatrix.toRadian(headAngle)); // Rotate to look down (forward/back movement)
  
  // Move to head center
  mat4.translate(model, model, headOffset.map(v => v * unit));
  
  // Apply head pulsing (Easter egg)
  if (isRobotFalling) {
    mat4.scale(model, model, [headPulseScale, headPulseScale, headPulseScale]);
  }
  
  // Apply final transformations for proper face alignment
  mat4.rotateX(model, model, Math.PI / 2);
  mat4.rotateZ(model, model, Math.PI);
  mat4.scale(model, model, headScale.map(v => v * unit));
  
  let mvp = mat4.create();
  mat4.multiply(mvp, viewMatrix, model);
  
  drawHeadFaceByFace(mvp);
}

function drawRobot(viewMatrix) {
  const unit = 1 / 12;
  
  // Base transformation for falling robot
  let baseTransform = mat4.create();
  if (isRobotFalling) {
    mat4.translate(baseTransform, baseTransform, [0, -1.5 * unit, 0]);
    mat4.rotateX(baseTransform, baseTransform, glMatrix.toRadian(-robotFallAngle)); // Fall backwards around X axis
    mat4.translate(baseTransform, baseTransform, [0, 1.5 * unit, 0]);
  }
  
  // Left leg
  let leftLegBase = mat4.create();
  mat4.copy(leftLegBase, baseTransform);
  mat4.translate(leftLegBase, leftLegBase, [-3 * unit, 0, 12 * unit]);
  mat4.rotateX(leftLegBase, leftLegBase, glMatrix.toRadian(-leftLegAngle)); // Rotate around X axis (forward/back)
  
  // Left leg (upper part)
  let model = mat4.create();
  mat4.copy(model, leftLegBase);
  mat4.translate(model, model, [0, 0, -5 * unit]);
  mat4.scale(model, model, [4 * unit, 3 * unit, 10 * unit]);
  let mvp = mat4.create();
  mat4.multiply(mvp, viewMatrix, model);
  drawCube(metalTexture, mvp);
  
  // Left foot (attached to leg)
  model = mat4.create();
  mat4.copy(model, leftLegBase);
  mat4.translate(model, model, [0, -1.5 * unit, -11 * unit]); // At bottom of leg
  mat4.scale(model, model, [4 * unit, 6 * unit, 2 * unit]);
  mvp = mat4.create();
  mat4.multiply(mvp, viewMatrix, model);
  drawCube(metalTexture, mvp);
  
  // Right leg
  let rightLegBase = mat4.create();
  mat4.copy(rightLegBase, baseTransform);
  mat4.translate(rightLegBase, rightLegBase, [3 * unit, 0, 12 * unit]);
  mat4.rotateX(rightLegBase, rightLegBase, glMatrix.toRadian(-rightLegAngle)); // Rotate around X axis (forward/back)
  
  // Right leg (upper part)
  model = mat4.create();
  mat4.copy(model, rightLegBase);
  mat4.translate(model, model, [0, 0, -5 * unit]);
  mat4.scale(model, model, [4 * unit, 3 * unit, 10 * unit]);
  mvp = mat4.create();
  mat4.multiply(mvp, viewMatrix, model);
  drawCube(metalTexture, mvp);
  
  // Right foot (attached to leg)
  model = mat4.create();
  mat4.copy(model, rightLegBase);
  mat4.translate(model, model, [0, -1.5 * unit, -11 * unit]); // At bottom of leg
  mat4.scale(model, model, [4 * unit, 6 * unit, 2 * unit]);
  mvp = mat4.create();
  mat4.multiply(mvp, viewMatrix, model);
  drawCube(metalTexture, mvp);
  
  // Draw body
  model = mat4.create();
  mat4.copy(model, baseTransform);
  mat4.translate(model, model, [0, 0, 18 * unit]);
  mat4.scale(model, model, [10 * unit, 6 * unit, 12 * unit]);
  mvp = mat4.create();
  mat4.multiply(mvp, viewMatrix, model);
  drawCube(metalTexture, mvp);
  
  // Left arm rotation 
  model = mat4.create();
  mat4.copy(model, baseTransform);
  mat4.translate(model, model, [-6 * unit, 0, 23 * unit]);
  mat4.rotateX(model, model, glMatrix.toRadian(leftArmAngle)); // Rotate around X axis (up/down)
  mat4.translate(model, model, [0, 0, -5 * unit]); // Move to arm center
  mat4.scale(model, model, [2 * unit, 4 * unit, 10 * unit]);
  mvp = mat4.create();
  mat4.multiply(mvp, viewMatrix, model);
  drawCube(metalTexture, mvp);
  
  // Right arm rotation 
  model = mat4.create();
  mat4.copy(model, baseTransform);
  mat4.translate(model, model, [6 * unit, 0, 23 * unit]);
  
  if (currentControl === 'robotMetal' && Math.abs(rightArmAngle) > 90) {
    // For Robot Metal 360° rotation
    mat4.rotateZ(model, model, glMatrix.toRadian(rightArmAngle));
  } else {
    mat4.rotateX(model, model, glMatrix.toRadian(rightArmAngle)); // Rotate around X axis (up/down)
  }
  
  mat4.translate(model, model, [0, 0, -5 * unit]); // Move to arm center
  mat4.scale(model, model, [2 * unit, 4 * unit, 10 * unit]);
  mvp = mat4.create();
  mat4.multiply(mvp, viewMatrix, model);
  drawCube(metalTexture, mvp);
  
  // Draw head
  drawRobotHead(viewMatrix);
}

function drawSkybox(viewMatrix) {
  let skyboxView = mat4.create();
  mat4.copy(skyboxView, viewMatrix);
  skyboxView[12] = 0;
  skyboxView[13] = 0;
  skyboxView[14] = 0;
  
  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(false);
  
  const size = 2000;
  
  const faces = [
    { 
      position: [0, -size, 0], 
      rotation: [Math.PI/2, 0, 0], 
      scale: [size, size, size],
      texture: skyboxTexture.front 
    },
    { 
      position: [0, size, 0], 
      rotation: [Math.PI/2, 0, Math.PI], 
      scale: [size, size, size],
      texture: skyboxTexture.back 
    },
    { 
      position: [-size, 0, 0], 
      rotation: [Math.PI/2, Math.PI/2, 0], 
      scale: [size, size, size],
      texture: skyboxTexture.left 
    },
    { 
      position: [size, 0, 0], 
      rotation: [Math.PI/2, -Math.PI/2, 0], 
      scale: [size, size, size],
      texture: skyboxTexture.right 
    },
    { 
      position: [0, 0, size], 
      rotation: [0, 0, 0], 
      scale: [size, size, size],
      texture: skyboxTexture.top 
    },
    { 
      position: [0, 0, -size], 
      rotation: [Math.PI, 0, 0], 
      scale: [size, size, size],
      texture: skyboxTexture.bottom 
    }
  ];
  
  faces.forEach(face => {
    let model = mat4.create();
    mat4.translate(model, model, face.position);
    mat4.rotateX(model, model, face.rotation[0]);
    mat4.rotateY(model, model, face.rotation[1]);
    mat4.rotateZ(model, model, face.rotation[2]);
    mat4.scale(model, model, face.scale);
    
    let mvp = mat4.create();
    mat4.multiply(mvp, skyboxView, model);
    
    drawSkyboxFace(face.texture, mvp);
  });
  
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
}

function drawSkyboxFace(texture, modelMatrix) {
  const positions = [
    -1, -1, 0,   1, -1, 0,   1, 1, 0,   -1, 1, 0
  ];
  
  const texCoords = [
    0, 1,   1, 1,   1, 0,   0, 0
  ];
  
  const indices = [
    0, 1, 2,   0, 2, 3
  ];
  
  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  
  const texBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
  
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  
  const aPos = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
  const aTexCoord = gl.getAttribLocation(shaderProgram, 'aTextureCoord');
  const uModel = gl.getUniformLocation(shaderProgram, 'uModelViewMatrix');
  const uProj = gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');
  const uSampler = gl.getUniformLocation(shaderProgram, 'uSampler');
  const uUseTexture = gl.getUniformLocation(shaderProgram, 'uUseTexture');
  
  gl.useProgram(shaderProgram);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPos);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
  gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aTexCoord);
  
  gl.uniformMatrix4fv(uModel, false, modelMatrix);
  gl.uniformMatrix4fv(uProj, false, projectionMatrix);
  gl.uniform1i(uUseTexture, 1);
  
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(uSampler, 0);
  
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  
  gl.deleteBuffer(posBuffer);
  gl.deleteBuffer(texBuffer);
  gl.deleteBuffer(indexBuffer);
}

function drawFloor(viewMatrix) {
  const floorPositions = [
    -30, -30, 0,
     30, -30, 0,
     30,  30, 0,
    -30,  30, 0
  ];
  
  const floorTextureCoords = [
    0.0, 1.0,
    1.0, 1.0,
    1.0, 0.0,
    0.0, 0.0
  ];
  
  const floorIndices = [
    0, 1, 2,
    0, 2, 3
  ];
  
  const floorPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, floorPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(floorPositions), gl.STATIC_DRAW);
  
  const floorTextureBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, floorTextureBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(floorTextureCoords), gl.STATIC_DRAW);
  
  const floorIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(floorIndices), gl.STATIC_DRAW);
  
  const floorMatrix = mat4.clone(viewMatrix);
  
  const aPos = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
  const aTexCoord = gl.getAttribLocation(shaderProgram, 'aTextureCoord');
  const uModel = gl.getUniformLocation(shaderProgram, 'uModelViewMatrix');
  const uProj = gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');
  const uSampler = gl.getUniformLocation(shaderProgram, 'uSampler');
  const uUseTexture = gl.getUniformLocation(shaderProgram, 'uUseTexture');
  
  gl.useProgram(shaderProgram);
  
  gl.uniformMatrix4fv(uModel, false, floorMatrix);
  gl.uniformMatrix4fv(uProj, false, projectionMatrix);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, floorPositionBuffer);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPos);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, floorTextureBuffer);
  gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aTexCoord);
  
  if (floorTexture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, floorTexture);
    gl.uniform1i(uSampler, 0);
    gl.uniform1i(uUseTexture, 1);
  } else {
    gl.uniform1i(uUseTexture, 0);
  }
  
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorIndexBuffer);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  
  gl.deleteBuffer(floorPositionBuffer);
  gl.deleteBuffer(floorTextureBuffer);
  gl.deleteBuffer(floorIndexBuffer);
}

function setupCamera() {
  const angle = parseFloat(document.getElementById("viewAngle").value);
  const dist = parseFloat(document.getElementById("camOrthoDistance").value);
  const selected = document.querySelector('input[name="cameraPos"]:checked').value.split("-");

  let cam;
  if (mouseDown) {
    // Manual control with mouse
    cam = [dist * Math.cos(manualCameraAngle), dist * Math.sin(manualCameraAngle), manualCameraHeight];
  } else if (isAnimating) {
    // Automatic spiral animation
    cam = [dist * Math.cos(cameraAngle), dist * Math.sin(cameraAngle), cameraHeight];
  } else {
    // Predefined positions
    const sign = v => v === "Left" || v === "Front" || v === "Bottom" ? -1 : 1;
    cam = [sign(selected[0]) * dist, sign(selected[1]) * dist, sign(selected[2]) * dist];
  }

  const aspect = canvas.width / canvas.height;
  projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, glMatrix.toRadian(angle), aspect, 0.001, 10000);

  modelViewMatrix = mat4.create();
  mat4.lookAt(modelViewMatrix, cam, [0, 0, 0], [0, 0, 1]);
}

function redrawScene() {
  if (texturesLoaded < totalTextures) {
    console.log(`Waiting for textures... ${texturesLoaded}/${totalTextures}`);
    return;
  }
  
  setupCamera();
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  drawSkybox(modelViewMatrix);
  drawFloor(modelViewMatrix);
  drawRobot(modelViewMatrix);
}

function animate() {
  if (!isAnimating) return;
  
  // Camera animation
  cameraAngle += 0.01;
  cameraHeight = 8 + 2 * Math.sin(cameraAngle * 2);
  
  // Automatic animations only when the respective mode is selected
  if (currentControl === 'parade') {
    updateParadeAnimation(0.05);
    console.log("Parade animation - Left arm:", leftArmAngle, "Right leg:", rightLegAngle, "Right arm:", rightArmAngle, "Left leg:", leftLegAngle);
  } else if (currentControl === 'robotMetal') {
    updateRobotMetalAnimation(0.02);
  }
  
  redrawScene();
  animationId = requestAnimationFrame(animate);
}

function startAnimation() {
  if (!isAnimating) {
    isAnimating = true;
    
    // Reset manual camera control when starting animation
    manualCameraAngle = cameraAngle;
    manualCameraHeight = cameraHeight;
    
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