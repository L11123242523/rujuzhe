/**
 * 入局者 v2 · 3D 棋盘（照老站做法重写实现）
 * ---------------------------------------------------------------------------
 * 老站（game.html L3945-3952 / L4203-4260 / L4330-4412）的做法是：
 *   · **一张美术地图贴图**（10401×6963）当作板面
 *   · 每格是一个 box，**顶面 UV 重新映射**到贴图上对应那块画格（`_map_rects.json` 给像素矩形）
 *     ⇒ 视觉上像"美术地图上立起一块块地砖"
 *   · 金色描边四边、逐类型配色、emoji 图标 sprite、HTML 标签投影到屏幕
 *   · 环绕相机（yaw/pitch/dist）+ 三灯（环境/半球/主光+补光+轮廓光）
 *
 * 这里**照抄观感、重写实现**：参数与老站逐一对应（常量都注明了出处），但代码是新的、无全局变量、
 * 只暴露一个 `createBoard()`；渲染失败（没有 WebGL / 没加载 three）时返回 `ok:false`，
 * 由界面回退到 2D 文字棋盘 —— 不允许因为 3D 挂了就玩不了。
 */

const TYPE_COLOR = {           // 老站 L4000-4002 原值
  start: 0x3ddc84, gift: 0xffb84d, item: 0x4dc3ff, again: 0xb388ff,
  bus: 0xff8a65, card: 0x64b5f6, subway: 0x7986cb, story: 0xba68c8,
  power: 0xffd54f, inspire: 0x81c784, read: 0x4db6ac, shrine: 0xff7043,
};
const TYPE_ICON = {            // 老站 L4006-4007 原值
  start: '🏁', gift: '🎁', item: '🔄', again: '↩️', bus: '🚌', card: '🃏',
  subway: '🚇', story: '📖', power: '⚡', inspire: '💡', read: '📚', shrine: '⛩️',
};
const SLAB_COLOR = 0x101a2c;   // 板身
const TILE_SIDE = 0x1b2537;    // 格身
const GOLD = 0xc9a44a;         // 金色描边
const CAM = { fov: 46, yaw: 0, pitch: 0.86, dist: 17.5, target: { x: 0, y: 0.9, z: 0 } };  // 老站 L4351/L4410

export function createBoard(root, map3d, opts = {}) {
  const T = (typeof window !== 'undefined' && window.THREE) || null;
  if (!T || !root || !map3d || !Array.isArray(map3d.tiles) || !map3d.tiles.length) {
    return { ok: false, reason: !T ? '没加载 three.js' : '缺少棋盘数据' };
  }
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    return { ok: false, reason: '无法创建 WebGL 渲染器：' + e.message };
  }

  const canvas = renderer.domElement;
  canvas.className = 'board3d-canvas';
  root.appendChild(canvas);

  const scene = new T.Scene();
  scene.background = new T.Color(0x0a0f18);
  const camera = new T.PerspectiveCamera(CAM.fov, 1, 0.1, 400);

  /* ── 灯光（老站 L4330-4344 原值）──────────────────────────────────── */
  scene.add(new T.AmbientLight(0x9fb8e8, 0.62));
  scene.add(new T.HemisphereLight(0xd8e6ff, 0x141a2a, 0.8));
  const key = new T.DirectionalLight(0xfff3dd, 2.1);
  key.position.set(6, 14, 9);
  if (key.castShadow) { key.castShadow = true; }
  scene.add(key);
  const fill = new T.DirectionalLight(0x6fa8ff, 0.85); fill.position.set(-10, 9, -8); scene.add(fill);
  const rim = new T.DirectionalLight(0xffb27a, 0.55); rim.position.set(-5, 6, 13); scene.add(rim);

  /* ── 贴图与板身（老站 L4209-4225）────────────────────────────────── */
  const tex = new T.TextureLoader().load(opts.texture || ('./assets/' + (map3d.texture || 'map3d_board.webp')));
  if (T.SRGBColorSpace && 'colorSpace' in tex) tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  const slabT = 0.55;
  const slabMat = new T.MeshStandardMaterial({ color: SLAB_COLOR, metalness: 0.6, roughness: 0.4 });
  const topMat = new T.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.02 });
  const board = new T.Mesh(new T.BoxGeometry(map3d.boardW, slabT, map3d.boardD),
    [slabMat, slabMat, topMat, slabMat, slabMat, slabMat]);
  board.position.y = -slabT / 2;
  scene.add(board);

  const trimMat = new T.MeshStandardMaterial({ color: GOLD, metalness: 0.95, roughness: 0.28, emissive: 0x3a2a08, emissiveIntensity: 0.6 });
  const halfW = map3d.boardW / 2, halfD = map3d.boardD / 2;
  [[0, -halfD - 0.05], [0, halfD + 0.05]].forEach((p) => {
    const b = new T.Mesh(new T.BoxGeometry(map3d.boardW + 0.18, 0.1, 0.09), trimMat);
    b.position.set(p[0], -0.03, p[1]); scene.add(b);
  });
  [[-halfW - 0.05, 0], [halfW + 0.05, 0]].forEach((p) => {
    const b = new T.Mesh(new T.BoxGeometry(0.09, 0.1, map3d.boardD + 0.18), trimMat);
    b.position.set(p[0], -0.03, p[1]); scene.add(b);
  });

  /* ── 每格 box：顶面 UV 重映射 + 类型色 + emoji 图标 ────────────────── */
  const tileMeshes = new Map();
  const sideMat = new T.MeshStandardMaterial({ color: TILE_SIDE, metalness: 0.55, roughness: 0.42 });
  const topArt = new T.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0.02 });
  const iconSprite = (emoji) => {
    try {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const ctx = cv.getContext('2d');
      if (!ctx) return null;
      ctx.font = '62px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 64, 68);
      const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), transparent: true, depthTest: false }));
      s.scale.set(0.62, 0.62, 1);        // 老站 L4186
      return s;
    } catch (e) { return null; }
  };
  for (const t of map3d.tiles) {
    const h = t.big ? map3d.bigH : map3d.smallH;
    const geo = new T.BoxGeometry(t.sx, h, t.sz);
    // BoxGeometry 顶面 uv 的序号是 8..11（老站 remapTopUV 同口径）
    const a = geo.attributes.uv;
    if (a && a.count >= 12 && t.uv) {
      for (let i = 8; i <= 11; i++) {
        const u = a.getX(i), v = a.getY(i);
        a.setXY(i, t.uv.u0 + u * (t.uv.u1 - t.uv.u0), t.uv.v0 + v * (t.uv.v1 - t.uv.v0));
      }
      a.needsUpdate = true;
    }
    const mat = [sideMat, sideMat, topArt, sideMat, sideMat, sideMat];
    const mesh = new T.Mesh(geo, mat);
    mesh.position.set(t.x, h / 2, t.z);
    mesh.userData.tileId = t.id;
    mesh.userData.baseY = h / 2;
    scene.add(mesh);
    tileMeshes.set(t.id, mesh);
    const icon = iconSprite(TYPE_ICON[t.type] || '');
    if (icon) { icon.position.set(t.x, h + 0.42, t.z); scene.add(icon); mesh.userData.icon = icon; }
    // 高亮用的描边环（默认隐藏）
    const ring = new T.Mesh(
      new T.TorusGeometry(Math.max(t.sx, t.sz) * 0.42, 0.035, 8, 28),
      new T.MeshStandardMaterial({ color: 0xffd76a, emissive: 0x8a6a12, emissiveIntensity: 1.2 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(t.x, h + 0.02, t.z);
    ring.visible = false;
    scene.add(ring);
    mesh.userData.ring = ring;
  }

  /* ── 棋子（老站：金环 + 十字标记 + 落影面）────────────────────────── */
  const pawns = new Map();
  const makePawn = (color) => {
    const g = new T.Group();
    const ring = new T.Mesh(new T.TorusGeometry(0.34, 0.075, 12, 36),
      new T.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35, emissive: color, emissiveIntensity: 0.35 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.09; g.add(ring);
    const body = new T.Mesh(new T.CylinderGeometry(0.17, 0.22, 0.62, 20),
      new T.MeshStandardMaterial({ color, metalness: 0.45, roughness: 0.4 }));
    body.position.y = 0.36; g.add(body);
    const cap = new T.Mesh(new T.SphereGeometry(0.16, 20, 14),
      new T.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.35 }));
    cap.position.y = 0.74; g.add(cap);
    const glow = new T.Mesh(new T.PlaneGeometry(1.25, 1.25),
      new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02; g.add(glow);
    return g;
  };

  /* ── 交互：拖动旋转 / 滚轮缩放（"地图位置感"来自这里）─────────────── */
  let yaw = CAM.yaw, pitch = CAM.pitch, dist = CAM.dist;
  let dragging = false, lastX = 0, lastY = 0, dirty = true;
  const markDirty = () => { dirty = true; };
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    yaw -= (e.clientX - lastX) * 0.006;
    pitch = Math.max(0.32, Math.min(1.32, pitch + (e.clientY - lastY) * 0.004));
    lastX = e.clientX; lastY = e.clientY; markDirty();
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    dist = Math.max(9, Math.min(30, dist + e.deltaY * 0.012)); markDirty();
  }, { passive: false });
  /** 点击格子（老站也能点地图看信息） */
  const raycaster = new T.Raycaster ? new T.Raycaster() : null;
  const pointer = new T.Vector2 ? new T.Vector2() : null;
  canvas.addEventListener('click', (e) => {
    if (!raycaster || !opts.onTileClick) return;
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...tileMeshes.values()], false)[0];
    if (hit) opts.onTileClick(hit.object.userData.tileId);
  });

  function resize() {
    const w = root.clientWidth || 900, h = root.clientHeight || 520;
    renderer.setPixelRatio(Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
    renderer.setSize(w, h, false);
    canvas.style.width = '100%'; canvas.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    markDirty();
  }

  /** 拖影/发光都靠这个循环；只有 dirty 时才真正重绘（省电） */
  let raf = 0;
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!dirty) return;
    dirty = false;
    const flat = dist * Math.cos(pitch);
    camera.position.set(CAM.target.x + Math.sin(yaw) * flat, CAM.target.y + dist * Math.sin(pitch), CAM.target.z + Math.cos(yaw) * flat);
    camera.lookAt(CAM.target.x, CAM.target.y, CAM.target.z);
    renderer.render(scene, camera);
  }

  resize();
  loop();

  return {
    ok: true,
    canvas,
    /** 把引擎状态画到棋盘上：两个棋子的位置 */
    setState(state) {
      const colors = { p1: 0x66b3ff, p2: 0xff8f8f };
      for (const id of state.seatIds) {
        const seat = state.seats[id];
        const tile = map3d.tiles.find((t) => t.id === seat.position) || map3d.tiles[0];
        if (!tile) continue;
        let pawn = pawns.get(id);
        if (!pawn) { pawn = makePawn(colors[id] || 0xffffff); scene.add(pawn); pawns.set(id, pawn); }
        const h = tile.big ? map3d.bigH : map3d.smallH;
        // 两个人站同一格时错开一点，避免重叠成一根
        const other = state.seatIds.find((x) => x !== id);
        const same = other && state.seats[other].position === seat.position;
        const off = same ? (id === state.seatIds[0] ? -0.28 : 0.28) : 0;
        pawn.position.set(tile.x + off, h, tile.z + (same ? 0.22 : 0));
      }
      markDirty();
    },
    /** 高亮一批格子（合法目标/可达范围） */
    highlight(ids) {
      for (const mesh of tileMeshes.values()) {
        const on = ids && ids.includes(mesh.userData.tileId);
        if (mesh.userData.ring) mesh.userData.ring.visible = !!on;
      }
      markDirty();
    },
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      try { renderer.dispose(); } catch (e) { /* 忽略 */ }
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
}
