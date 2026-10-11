/* assets/ruri3d.js —— 「小沙香琉璃（普通形态）」2.5D 分层立牌（作者 2026-10-12 点名 ✓）
 *
 *  为什么这样：本机没有 Blender ✗，作者又说"几何体人偶太丑"✗ ⇒ 改用**她的真实素材插画**做立牌 ✓
 *  素材：`入局者素材库/角色卡图素材/琉璃.png`（1254×1254 纯插画 ✓ 作者指定 ✓）
 *  贴图：`assets/models/ruri_bg.webp`（整幅插画 + 椭圆柔化 ✓ 253KB）+ `ruri_fg.webp`（身形抠图 + 羽化 ✓ 174KB）
 *        —— 由 `port-old/cardface/_make_ruri_standee.py` 生成 ✓（都带透明通道 ✓）
 *
 *  构成（三层 ✓）：背景平面（z=0）→ 人物平面（z 略前 ⇒ 有视差 ✓）→ 脚下柔光圆环 ✓
 *  朝向：`updateRuri3D(group, dt, { camera })` 里**只绕 Y 轴**转向相机 ✓（立牌永远面向镜头 ✓）
 *
 *  对外接口（只有两个 ✓）：window.buildRuri3D(THREE, opts) / window.updateRuri3D(group, dt, opts)
 *  ⚠ 任何异常都返回 null / 静默 ⇒ 调用方回退原棋子 ✓（**绝不破坏 2D 回退与任何规则** ✗）
 */
(function () {
  'use strict';
  var BG = 'assets/models/ruri_bg.webp?v=1';
  var FG = 'assets/models/ruri_fg.webp?v=1';

  function srgb(T, tex) {
    try {
      if (T.SRGBColorSpace && 'colorSpace' in tex) tex.colorSpace = T.SRGBColorSpace;
      else if (T.sRGBEncoding !== undefined && 'encoding' in tex) tex.encoding = T.sRGBEncoding;
    } catch (e) {}
    return tex;
  }
  /* 柔和的径向渐变贴图（给脚下的落地阴影用 ✓；用 canvas 现画，零外部资源 ✓） */
  function softShadowTexture(T) {
    try {
      var s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
      var ctx = cv.getContext('2d');
      var g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.55, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      var t = new T.CanvasTexture(cv); return srgb(T, t);
    } catch (e) { return null; }
  }
  function loadTex(T, url) {
    try {
      var l = new T.TextureLoader();
      var t = l.load(url, undefined, undefined, function () { /* 加载失败静默 ✓：立牌退化成空白，不影响场景 ✓ */ });
      t.anisotropy = 4;
      return srgb(T, t);
    } catch (e) { return null; }
  }

  function buildRuri3D(T, opts) {
    try {
      if (!T || !T.Group) return null;
      opts = opts || {};
      var g = new T.Group(); g.name = 'ruri3d';
      var SZ = opts.size || 2.2;                       // 立牌边长（会再乘 game.html 的 PIECE_SCALE ✓）
      var botY = (opts.bottomY != null) ? opts.bottomY : 0;

      /* ① 背景层（整幅插画 ✓ 柔化边缘 ✓）：不写深度 ⇒ 与前景叠加不会互相裁掉 ✓ */
      var tbg = loadTex(T, opts.bgUrl || BG);
      if (tbg) {
        var bg = new T.Mesh(new T.PlaneGeometry(SZ, SZ),
          new T.MeshBasicMaterial({ map: tbg, transparent: true, depthWrite: false, side: T.DoubleSide }));
        bg.position.set(0, botY + SZ / 2, 0);
        bg.renderOrder = 1;
        g.add(bg);
      }
      /* ② 人物层（抠图 ✓ 略靠前 ⇒ 相机移动时有视差 ✓） */
      var tfg = loadTex(T, opts.fgUrl || FG);
      if (tfg) {
        var fg = new T.Mesh(new T.PlaneGeometry(SZ, SZ),
          new T.MeshBasicMaterial({ map: tfg, transparent: true, depthWrite: false, side: T.DoubleSide }));
        fg.position.set(0, botY + SZ / 2, 0.07);
        fg.renderOrder = 2;
        g.add(fg);
      }
      /* ③ 脚下落地阴影 + 柔光圆环（读作"棋子"✓，也让她在地图上更醒目 ✓） */
      var st = softShadowTexture(T);
      if (st) {
        var sh = new T.Mesh(new T.PlaneGeometry(SZ * 0.62, SZ * 0.3),
          new T.MeshBasicMaterial({ map: st, transparent: true, opacity: 0.75, depthWrite: false }));
        sh.rotation.x = -Math.PI / 2; sh.position.set(0, botY + 0.012, 0.02);
        sh.renderOrder = 0;
        g.add(sh);
      }
      try {
        var ring = new T.Mesh(new T.RingGeometry(SZ * 0.22, SZ * 0.30, 40),
          new T.MeshBasicMaterial({ color: 0xff9ecb, transparent: true, opacity: 0.4, side: T.DoubleSide, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = botY + 0.02; ring.renderOrder = 0;
        g.add(ring);
        g.userData.ruri3d = { t: 0, ring: ring };
      } catch (e) { g.userData.ruri3d = { t: 0, ring: null }; }
      g.userData.ruri3d.size = SZ;
      return g;
    } catch (e) {
      try { console.error('琉璃立牌构建失败（回退原棋子 ✓）', e); } catch (e2) {}
      return null;
    }
  }

  function updateRuri3D(group, dt, opts) {
    try {
      var d = group && group.userData && group.userData.ruri3d; if (!d) return;
      d.t += (dt || 0.016);
      /* 立牌**只绕 Y 轴**面向相机 ✓（覆盖 game.html 里对棋子统一的左右摆动 ✗） */
      var cam = opts && opts.camera;
      if (cam && cam.position) {
        group.rotation.y = Math.atan2(cam.position.x - group.position.x, cam.position.z - group.position.z);
      }
      group.rotation.z = Math.sin(d.t * 1.2) * 0.012;                 // 极轻的呼吸摆动 ✓
      if (d.ring) d.ring.material.opacity = 0.30 + Math.sin(d.t * 2.1) * 0.10;
    } catch (e) { /* 纯动画，绝不抛 ✓ */ }
  }

  try {
    window.buildRuri3D = buildRuri3D;
    window.updateRuri3D = updateRuri3D;
  } catch (e) {}
})();
