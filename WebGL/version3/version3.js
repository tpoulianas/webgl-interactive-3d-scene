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
let headTextures = {}; // For different point of views of the head
let skyboxTexture;
let floorTexture;
let texturesLoaded = 0;
const totalTextures = 14; 

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
  
  // Load all textures
  loadTextures();

  document.getElementById("startBtn").onclick = startAnimation;
  document.getElementById("stopBtn").onclick = stopAnimation;
  document.getElementById("redrawBtn").onclick = redrawScene;
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
  // Positions for cube vertices
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

  // Texture coordinates
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
    0, 1, 2, 0, 2, 3,       // front
    4, 5, 6, 4, 6, 7,       // back
    8, 9, 10, 8, 10, 11,    // top
    12, 13, 14, 12, 14, 15, // bottom
    16, 17, 18, 16, 18, 19, // right
    20, 21, 22, 20, 22, 23  // left
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
      // Generate mipmap for power-of-2 textures
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      // No mipmap for non-power-of-2 textures
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
  // Metal texture for the body (except of the head)
  metalTexture = loadTexture('textures/Metal053C_1K-JPG_Color.jpg');
  
  // Head textures 
  headTextures.front = loadTexture('textures/robot_face_front.jpg');
  headTextures.left = loadTexture('textures/robot_face_right.jpg');
  headTextures.right = loadTexture('textures/robot_face_left.jpg');
  headTextures.back = loadTexture('textures/robot_face_back.jpg');
  headTextures.top = loadTexture('textures/robot_face_top.jpg');
  headTextures.bottom = loadTexture('textures/robot_face_bottom.jpg');
  
  // Floor textures
  floorTexture = loadTexture('textures/floor_names.jpg');
  
  // Skybox textures
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
  
  // Position attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffers.position);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPos);
  
  // Texture coordinate attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffers.textureCoord);
  gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aTexCoord);

  // Set uniforms
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

// Draw a multi-textured cube head
function drawMultiTextureCube(transformMatrix, headTextures) {
  const aPos = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
  const aTexCoord = gl.getAttribLocation(shaderProgram, 'aTextureCoord');
  const uModel = gl.getUniformLocation(shaderProgram, 'uModelViewMatrix');
  const uProj = gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');
  const uSampler = gl.getUniformLocation(shaderProgram, 'uSampler');
  const uUseTexture = gl.getUniformLocation(shaderProgram, 'uUseTexture');

  gl.useProgram(shaderProgram);
  
  // Set up position attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffers.position);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPos);
  
  // Set up texture coordinates
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffers.textureCoord);
  gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aTexCoord);

  // Set uniforms
  gl.uniformMatrix4fv(uModel, false, transformMatrix);
  gl.uniformMatrix4fv(uProj, false, projectionMatrix);
  gl.uniform1i(uUseTexture, 1);
  gl.uniform1i(uSampler, 0);
  
  const faceData = [
    // Front face buffer
    { texture: headTextures.top, indices: [0, 1, 2, 0, 2, 3] },
    
    // Back face buffer
    { texture: headTextures.bottom, indices: [4, 5, 6, 4, 6, 7] },
    
    // Top face buffer
    { texture: headTextures.front, indices: [8, 9, 10, 8, 10, 11] },
    
    // Bottom face buffer
    { texture: headTextures.back, indices: [12, 13, 14, 12, 14, 15] },
    
    // Right face buffer
    { texture: headTextures.right, indices: [16, 17, 18, 16, 18, 19] },
    
    // Left face buffer 
    { texture: headTextures.left, indices: [20, 21, 22, 20, 22, 23] }
  ];
  
  faceData.forEach(face => {
    if (face.texture) {
      // Bind texture for this face
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, face.texture);
      
      // Create index buffer for this face
      const faceIndexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, faceIndexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(face.indices), gl.STATIC_DRAW);
      
      // Draw this face
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      
      // Clean up
      gl.deleteBuffer(faceIndexBuffer);
    }
  });
}

function drawRobotHead(viewMatrix) {
  const unit = 1 / 12;
  const headPos = [0, 0, 26.5];
  const headScale = [6, 4, 5];
  
  let model = mat4.create();
  mat4.translate(model, model, headPos.map(v => v * unit));

  mat4.rotateX(model, model, Math.PI / 2); // 90 degrees
  
  mat4.rotateZ(model, model, Math.PI);

  mat4.scale(model, model, headScale.map(v => v * unit));
  
  let mvp = mat4.create();
  mat4.multiply(mvp, viewMatrix, model);

  drawHeadFaceByFace(mvp);
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

  // Set up position attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffers.position);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPos);
  
  // Set up texture coordinates
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffers.textureCoord);
  gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aTexCoord);
  
  const faces = [
    // Front face buffer 
    { indices: [0, 1, 2, 0, 2, 3], texture: headTextures.front || metalTexture },
    
    // Back face buffer
    { indices: [4, 5, 6, 4, 6, 7], texture: headTextures.back || metalTexture },
    
    // Top face buffer
    { indices: [8, 9, 10, 8, 10, 11], texture: headTextures.bottom || metalTexture },
    
    // Bottom face buffer
    { indices: [12, 13, 14, 12, 14, 15], texture: headTextures.top || metalTexture },
    
    // Right face buffer
    { indices: [16, 17, 18, 16, 18, 19], texture: headTextures.right || metalTexture },
    
    // Left face buffer
    { indices: [20, 21, 22, 20, 22, 23], texture: headTextures.left || metalTexture }
  ];

  faces.forEach(face => {
    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, face.texture);
    
    // Create index buffer for this face
    const faceIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, faceIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(face.indices), gl.STATIC_DRAW);
    
    // Draw this face
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    
    // Clean up
    gl.deleteBuffer(faceIndexBuffer);
  });
}



function drawRobot(viewMatrix) {
  const unit = 1 / 12;
  
  //Textures for the parts of the body
  const parts = [
    { t: [-3, -1.5, 1], s: [4, 6, 2], texture: metalTexture },
    { t: [ 3, -1.5, 1], s: [4, 6, 2], texture: metalTexture },
    { t: [-3, 0, 7], s: [4, 3, 10], texture: metalTexture },
    { t: [ 3, 0, 7], s: [4, 3, 10], texture: metalTexture },
    { t: [ 0, 0, 18], s: [10, 6, 12], texture: metalTexture },
    { t: [-6, 0, 18], s: [2, 4, 10], texture: metalTexture },
    { t: [ 6, 0, 18], s: [2, 4, 10], texture: metalTexture }
  ];

  // Draw body parts with metal texture
  for (const p of parts) {
    let model = mat4.create();
    mat4.translate(model, model, p.t.map(v => v * unit));
    mat4.scale(model, model, p.s.map(v => v * unit));

    let mvp = mat4.create();
    mat4.multiply(mvp, viewMatrix, model);
    drawCube(p.texture, mvp);
  }
  
  // Draw head with special textures
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
    // Front face (-Y direction)
    { 
      position: [0, -size, 0], 
      rotation: [Math.PI/2, 0, 0], 
      scale: [size, size, size],
      texture: skyboxTexture.front 
    },
    // Back face (+Y direction)
    { 
      position: [0, size, 0], 
      rotation: [Math.PI/2, 0, Math.PI], 
      scale: [size, size, size],
      texture: skyboxTexture.back 
    },
    // Left face (-X direction)
    { 
      position: [-size, 0, 0], 
      rotation: [Math.PI/2, Math.PI/2, 0], 
      scale: [size, size, size],
      texture: skyboxTexture.left 
    },
    // Right face (+X direction)
    { 
      position: [size, 0, 0], 
      rotation: [Math.PI/2, -Math.PI/2, 0], 
      scale: [size, size, size],
      texture: skyboxTexture.right 
    },
    // Top face (+Z direction)
    { 
      position: [0, 0, size], 
      rotation: [0, 0, 0], 
      scale: [size, size, size],
      texture: skyboxTexture.top 
    },
    // Bottom face (-Z direction)
    { 
      position: [0, 0, -size], 
      rotation: [Math.PI, 0, 0], 
      scale: [size, size, size],
      texture: skyboxTexture.bottom 
    }
  ];
  
  // Draw each face
  faces.forEach(face => {
    let model = mat4.create();
    mat4.translate(model, model, face.position);
    mat4.rotateX(model, model, face.rotation[0]);
    mat4.rotateY(model, model, face.rotation[1]);
    mat4.rotateZ(model, model, face.rotation[2]);
    mat4.scale(model, model, face.scale);
    
    let mvp = mat4.create();
    mat4.multiply(mvp, skyboxView, model);
    
    // Draw as a simple quad
    drawSkyboxFace(face.texture, mvp);
  });
  
  // Re-enable depth test
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
}

// Function for each point of view of the skybox
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
  // Creation of different buffers for the floor
  const floorPositions = [
    // Floor face
    -30, -30, 0,   // Bottom-left
     30, -30, 0,   // Bottom-right  
     30,  30, 0,   // Top-right
    -30,  30, 0    // Top-left
  ];
  

  const floorTextureCoords = [
    0.0, 1.0,  // Bottom-left
    1.0, 1.0,  // Bottom-right
    1.0, 0.0,  // Top-right
    0.0, 0.0   // Top-left
  ];
  
  const floorIndices = [
    0, 1, 2,  // First triangle
    0, 2, 3   // Second triangle
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
  
  // Modification of model-view matrix for floor
  const floorMatrix = mat4.clone(viewMatrix);
  
  // Get shader locations
  const aPos = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
  const aTexCoord = gl.getAttribLocation(shaderProgram, 'aTextureCoord');
  const uModel = gl.getUniformLocation(shaderProgram, 'uModelViewMatrix');
  const uProj = gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');
  const uSampler = gl.getUniformLocation(shaderProgram, 'uSampler');
  const uUseTexture = gl.getUniformLocation(shaderProgram, 'uUseTexture');
  
  gl.useProgram(shaderProgram);
  
  // Set uniforms
  gl.uniformMatrix4fv(uModel, false, floorMatrix);
  gl.uniformMatrix4fv(uProj, false, projectionMatrix);
  
  // Set vertex positions
  gl.bindBuffer(gl.ARRAY_BUFFER, floorPositionBuffer);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPos);
  
  // Set texture coordinates
  gl.bindBuffer(gl.ARRAY_BUFFER, floorTextureBuffer);
  gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aTexCoord);
  
  // Set texture
  if (floorTexture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, floorTexture);
    gl.uniform1i(uSampler, 0);
    gl.uniform1i(uUseTexture, 1);
  } else {
    gl.uniform1i(uUseTexture, 0);
  }
  
  // Draw the floor
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorIndexBuffer);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  
  // Clean up buffers
  gl.deleteBuffer(floorPositionBuffer);
  gl.deleteBuffer(floorTextureBuffer);
  gl.deleteBuffer(floorIndexBuffer);
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
  
  // Draw skybox first
  drawSkybox(modelViewMatrix);
  
  // Draw floor
  drawFloor(modelViewMatrix);
  
  // Draw robot
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