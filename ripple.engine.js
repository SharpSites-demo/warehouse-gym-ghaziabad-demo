/*!
 * Canvas UI — Ripple (vanilla WebGL build)
 * Vendored from https://github.com/DavidHDev/canvas-ui — src/lib/Ripple/RippleVanilla.ts
 * © 2026 David Haz — MIT + Commons Clause (see LICENSE.md shipped alongside).
 * Lightly transpiled to plain JavaScript for a no-build static site.
 * Water ripples spread from clicks and refract the captured page like a pond surface.
 * When the experimental html-in-canvas capture API is unavailable, the engine
 * degrades gracefully to crest-glints only over the untouched live DOM.
 */
(function () {
  "use strict";
  var MAX_RIPPLES = 12;
  var BASE_SPEED = 340;
  var VERT = "#version 300 es\nprecision highp float;\nlayout(location = 0) in vec2 aPos;\nout vec2 vUv;\nvoid main () {\n  vUv = aPos * 0.5 + 0.5;\n  gl_Position = vec4(aPos, 0.0, 1.0);\n}";
  var FRAG = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nout vec4 outColor;\nuniform sampler2D uContent;\nuniform vec2 uResolution;\nuniform vec4 uRipples[12];\nuniform int uCount;\nuniform float uSpeed;\nuniform float uWavelength;\nuniform float uWidth;\nuniform float uDecay;\nuniform float uRefraction;\nuniform float uDispersion;\nuniform float uShine;\nuniform float uHasContent;\nuniform float uMaxX;\nvec4 page (vec2 p) {\n  p.x = clamp(p.x, 0.0005, uMaxX - 0.0005);\n  p.y = clamp(p.y, 0.0005, 0.9995);\n  return texture(uContent, p);\n}\nvoid main () {\n  vec2 pUv = vec2(vUv.x, 1.0 - vUv.y);\n  vec2 frag = pUv * uResolution;\n  vec2 grad = vec2(0.0);\n  float k = 6.28318530718 / uWavelength;\n  float w2 = uWidth * uWidth;\n  for (int i = 0; i < 12; i++) {\n    if (i >= uCount) break;\n    vec4 rp = uRipples[i];\n    vec2 dv = frag - rp.xy;\n    float r = length(dv);\n    float front = uSpeed * rp.z;\n    float s = r - front;\n    float env = exp(-s * s / w2) * exp(-uDecay * rp.z) * rp.w;\n    env *= smoothstep(0.0, 0.08, rp.z);\n    env *= inversesqrt(1.0 + front / max(uWavelength, 1.0) * 0.2);\n    if (env < 0.0015) continue;\n    float dh = (k * cos(s * k) - 2.0 * s / w2 * sin(s * k)) * env;\n    grad += dv / max(r, 1.0) * dh * uWavelength * 0.16;\n  }\n  float g = dot(grad, vec2(-0.55, -0.8));\n  float glint = pow(clamp(g * 2.2, 0.0, 1.0), 2.0) * uShine;\n  float shade = pow(clamp(-g * 1.6, 0.0, 1.0), 2.0) * uShine * 0.3;\n  if (uHasContent < 0.5) {\n    float a = clamp(glint * 0.9 + shade * 0.5, 0.0, 0.85);\n    outColor = vec4(vec3(glint * 0.9), a);\n    return;\n  }\n  vec2 offs = grad * uRefraction / uResolution;\n  vec3 col;\n  if (uDispersion > 0.001) {\n    float d = uDispersion * 0.35;\n    col = vec3(page(pUv + offs * (1.0 + d)).r, page(pUv + offs).g, page(pUv + offs * (1.0 - d)).b);\n  } else {\n    col = page(pUv + offs).rgb;\n  }\n  col += glint;\n  col *= 1.0 - shade;\n  outColor = vec4(col, 1.0);\n}";
  function supportsHtmlInCanvas() {
    if (typeof document === "undefined") return false;
    var probe = document.createElement("canvas");
    var ctx = probe.getContext("2d");
    return Boolean(ctx && typeof ctx.drawElementImage === "function" && typeof probe.requestPaint === "function");
  }
  function createRipple(elements, options) {
    var DEFAULTS = { amplitude: 0.5, speed: 0.65, wavelength: 80, rings: 2, decay: 1, refraction: 100, dispersion: 0.5, shine: 0.5, trigger: "click", interval: 0 };
    var config = Object.assign({}, DEFAULTS, options || {});
    var source = elements.source;
    var content = elements.content;
    var output = elements.output;
    var gl = output.getContext("webgl2", { alpha: true, depth: false, stencil: false, antialias: false, premultipliedAlpha: true });
    if (!gl || gl.isContextLost()) return null;
    var sourceCtx = source.getContext("2d");
    var paintable = source;
    var htmlInCanvas = Boolean(sourceCtx && typeof sourceCtx.drawElementImage === "function" && typeof paintable.requestPaint === "function");
    var contentDirty = false;
    var wake = function () {};
    if (htmlInCanvas) {
      paintable.onpaint = function () {
        try { sourceCtx.reset(); sourceCtx.drawElementImage(content, 0, 0); contentDirty = true; wake(); } catch (e) {}
      };
    }
    function compile(type, text) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.error("Ripple shader error:", gl.getShaderInfoLog(shader));
      return shader;
    }
    var vertexShader = compile(gl.VERTEX_SHADER, VERT);
    var fragmentShader = compile(gl.FRAGMENT_SHADER, FRAG);
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    var uniforms = {};
    var uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var u = 0; u < uniformCount; u++) {
      var info = gl.getActiveUniform(program, u);
      uniforms[info.name.replace("[0]", "")] = gl.getUniformLocation(program, info.name);
    }
    var quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    var contentTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, contentTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    var contentMaxX = 1;
    function syncCanvasSize() {
      var dpr = Math.min(window.devicePixelRatio || , 2);
      var width = Math.max(1, Math.round(output.clientWidth * dpr));
      var height = Math.max(1, Math.round(output.clientHeight * dpr));
      if (output.width !== width || output.height !== height) { output.width = width; output.height = height; }
      contentMaxX = Math.min(1, Math.max(0.05, content.clientWidth / Math.max(output.clientWidth, 1)));
      if (htmlInCanvas) {
        var cssWidth = Math.max(1, Math.round(source.clientWidth));
        var cssHeight = Math.max(1, Math.round(source.clientHeight));
        if (source.width !== cssWidth * dpr || source.height !== cssHeight * dpr) { source.width = cssWidth * dpr; source.height = cssHeight * dpr; }
        paintable.requestPaint();
      }
    }
    syncCanvasSize();
    function uploadContent() {
      if (!htmlInCanvas || !contentDirty) return;
      contentDirty = false;
      gl.bindTexture(gl.TEXTURE_2D, contentTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }
    var ripples = [];
    var rippleData = new Float32Array(MAX_RIPPLES * 4);
    function splash(x, y, strength) {
      if (reducedMotion) return;
      if (ripples.length >= MAX_RIPPLES) ripples.shift();
      ripples.push({ x: x, y: y, age: 0, amp: strength === undefined ? 1 : strength });
      start();
    }
    function pruneRipples(delta) {
      var diag = Math.hypot(output.clientWidth, output.clientHeight);
      var speedPx = BASE_SPEED * Math.max(config.speed, 0.05);
      var width = config.wavelength * Math.max(config.rings, 1) * 0.5;
      for (var i = ripples.length - 1; i >= 0; i--) {
        var rp = ripples[i];
        rp.age += delta;
        var gone = rp.age * speedPx > diag + width * 3 || Math.exp(-Math.max(config.decay, 0.05) * rp.age) * rp.amp < 0.012;
        if (gone) ripples.splice(i, 1);
      }
    }
    function render() {
      uploadContent();
      var dpr = output.width / Math.max(output.clientWidth, 1);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, contentTexture);
      gl.uniform1i(uniforms.uContent, 0);
      gl.uniform2f(uniforms.uResolution, output.width, output.height);
      for (var i = 0; i < MAX_RIPPLES; i++) {
        var rp = ripples[i];
        rippleData[i * 4] = rp ? rp.x * dpr : 0;
        rippleData[i * 4 + 1] = rp ? rp.y * dpr : 0;
        rippleData[i * 4 + 2] = rp ? rp.age : 0;
        rippleData[i * 4 + 3] = rp ? rp.amp * Math.max(config.amplitude, 0) : 0;
      }
      gl.uniform4fv(uniforms.uRipples, rippleData);
      gl.uniform1i(uniforms.uCount, ripples.length);
      gl.uniform1f(uniforms.uSpeed, BASE_SPEED * Math.max(config.speed, 0.05) * dpr);
      gl.uniform1f(uniforms.uWavelength, Math.max(config.wavelength, 4) * dpr);
      gl.uniform1f(uniforms.uWidth, Math.max(config.wavelength, 4) * Math.max(config.rings, 1) * 0.5 * dpr);
      gl.uniform1f(uniforms.uDecay, Math.max(config.decay, 0.05));
      gl.uniform1f(uniforms.uRefraction, Math.max(config.refraction, 0) * dpr);
      gl.uniform1f(uniforms.uDispersion, Math.max(config.dispersion, 0));
      gl.uniform1f(uniforms.uShine, Math.max(config.shine, 0));
      gl.uniform1f(uniforms.uHasContent, htmlInCanvas ? 1 : 0);
      gl.uniform1f(uniforms.uMaxX, contentMaxX);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, output.width, output.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    function renderIdle() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, output.width, output.height);
      if (htmlInCanvas) { render(); } else { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    }
    var raf = 0;
    var lastTime = performance.now();
    var destroyed = false;
    var running = false;
    var visible = true;
    var ambientTimer = 0;
    var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    var reducedMotion = motionQuery.matches;
    function spawnAmbient() {
      var w = output.clientWidth;
      var h = output.clientHeight;
      if (w < 10 || h < 10) return;
      splash(w * (0.15 + Math.random() * 0.7), h * (0.15 + Math.random() * 0.7), 0.6 + Math.random() * 0.5);
    }
    function frame(now) {
      if (destroyed) return;
      if (!visible) { running = false; return; }
      var delta = Math.min(Math.max((now - lastTime) / 1000, 0), 1 / 30);
      lastTime = now;
      if (!reducedMotion) {
        pruneRipples(delta);
        if (config.interval > 0) {
          ambientTimer += delta;
          if (ambientTimer >= config.interval) { ambientTimer = 0; spawnAmbient(); }
        }
      }
      if (ripples.length > 0) { render(); } else {
        renderIdle();
        if (!contentDirty && (config.interval <= 0 || reducedMotion)) { running = false; return; }
      }
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (destroyed || running || !visible) return;
      running = true;
      lastTime = performance.now();
      raf = requestAnimationFrame(frame);
    }
    wake = start;
    start();
    function localPoint(event) {
      var rect = output.getBoundingClientRect();
      return [event.clientX - rect.left, event.clientY - rect.top];
    }
    var hoverX = -1e5;
    var hoverY = -1e5;
    function onPointerDown(event) {
      if (config.trigger === "none") return;
      var pt = localPoint(event);
      splash(pt[0], pt[1], 1);
    }
    function onPointerMove(event) {
      if (config.trigger !== "hover") return;
      var pt = localPoint(event);
      if (Math.hypot(pt[0] - hoverX, pt[1] - hoverY) < 56) return;
      hoverX = pt[0];
      hoverY = pt[1];
      splash(pt[0], pt[1], 0.3);
    }
    content.addEventListener("pointerdown", onPointerDown, { passive: true });
    content.addEventListener("pointermove", onPointerMove, { passive: true });
    function onMotionChange() {
      reducedMotion = motionQuery.matches;
      if (reducedMotion) ripples.length = 0;
      start();
    }
    motionQuery.addEventListener("change", onMotionChange);
    var observer = new ResizeObserver(function () { syncCanvasSize(); start(); });
    observer.observe(output);
    observer.observe(content);
    var intersection = new IntersectionObserver(function (entries) {
      visible = entries[entries.length - 1] ? entries[entries.length - 1].isIntersecting : true;
      if (visible) start();
    });
    intersection.observe(output);
    return {
      setOptions: function (next) {
        var changed = Object.keys(next).some(function (key) { return config[key] !== next[key]; });
        if (!changed) return;
        Object.assign(config, next);
        start();
      },
      splash: splash,
      resize: function () { syncCanvasSize(); start(); },
      destroy: function () {
        destroyed = true;
        cancelAnimationFrame(raf);
        content.removeEventListener("pointerdown", onPointerDown);
        content.removeEventListener("pointermove", onPointerMove);
        observer.disconnect();
        intersection.disconnect();
        motionQuery.removeEventListener("change", onMotionChange);
        gl.deleteTexture(contentTexture);
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        gl.deleteBuffer(quad);
        if (htmlInCanvas) paintable.onpaint = null;
      },
    };
  }
  window.CanvasRipple = { supportsHtmlInCanvas: supportsHtmlInCanvas, createRipple: createRipple };
})();
