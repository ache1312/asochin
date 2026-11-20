/* Draw dense scatter layers with WebGL. The figure keeps its Canvas renderer as a fallback. */
(function () {
  const vertex = `
    attribute vec3 a_position;
    attribute vec3 a_color;
    uniform vec2 u_viewport;
    uniform float u_diameter, u_opacity, u_depthStyle;
    varying vec4 v_color;
    void main() {
      vec2 p = a_position.xy / u_viewport * 2.0 - 1.0;
      gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
      float depth = (a_position.z + 1.0) / 2.0;
      gl_PointSize = u_diameter * mix(1.0, 0.8 + 0.35 * depth, u_depthStyle);
      v_color = vec4(a_color, u_opacity * mix(1.0, 0.55 + 0.45 * depth, u_depthStyle));
    }`;
  const fragment = `
    precision mediump float;
    varying vec4 v_color;
    void main() { gl_FragColor = v_color; }`;

  function makeProgram(gl) {
    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
  }

  window.deckPointCloud = function (canvas, labels, palette, { radius, alpha, depthStyle = false, colorMix = 1 }) {
    if (labels.length > 65_536) return null; // The depth order uses 16-bit indices.
    const layer = document.createElement("canvas");
    layer.className = "deck-point-cloud";
    layer.setAttribute("aria-hidden", "true");
    layer.style.width = canvas.style.width;
    layer.style.height = canvas.style.height;
    layer.width = parseFloat(layer.style.width);
    layer.height = parseFloat(layer.style.height);
    const gl = layer.getContext("webgl", { antialias: false, depth: false, preserveDrawingBuffer: true });
    if (!gl) return null;
    const program = makeProgram(gl);
    if (!program) return null;
    gl.useProgram(program);

    const attribute = (name, type, normalized, data, usage) => {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage);
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 3, type, normalized, 0, 0);
      return buffer;
    };
    const rgb = palette.map(hex => [1, 3, 5].map(i => Math.round(255 + (parseInt(hex.slice(i, i + 2), 16) - 255) * colorMix)));
    const colors = new Uint8Array(labels.length * 3);
    for (let i = 0; i < labels.length; i++) colors.set(rgb[labels[i]], i * 3);
    attribute("a_color", gl.UNSIGNED_BYTE, true, colors, gl.STATIC_DRAW);
    const positions = attribute("a_position", gl.FLOAT, false, labels.length * 12, gl.DYNAMIC_DRAW);
    const indices = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, labels.length * 2, gl.DYNAMIC_DRAW);

    gl.viewport(0, 0, layer.width, layer.height);
    gl.uniform2f(gl.getUniformLocation(program, "u_viewport"), layer.width, layer.height);
    gl.uniform1f(gl.getUniformLocation(program, "u_diameter"), radius * 2);
    gl.uniform1f(gl.getUniformLocation(program, "u_opacity"), alpha);
    gl.uniform1f(gl.getUniformLocation(program, "u_depthStyle"), Number(depthStyle));
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    canvas.before(layer);

    return (projected, order) => {
      if (gl.isContextLost()) {
        layer.remove();
        return false;
      }
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindBuffer(gl.ARRAY_BUFFER, positions);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, projected);
      if (order) {
        gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, order);
        gl.drawElements(gl.POINTS, labels.length, gl.UNSIGNED_SHORT, 0);
      } else {
        gl.drawArrays(gl.POINTS, 0, labels.length);
      }
      return true;
    };
  };
})();
