/* assets/ruri3d.js —— 「小沙香琉璃（普通形态）」程序化 3D 模型（作者 2026-10-12 点名 ✓）
 *
 *  为什么是程序化：本机**没有 Blender** ✗ ⇒ 用 three.js 图元（球/胶囊/圆柱/盒/圆锥）搭出风格化角色 ✓
 *  外观全部**照卡面抄**（`新UI卡图/角色卡/琉璃.png` ✓ read_image 逐字看过 ✓）：
 *    · 亮粉色长直发 ✓  · 紫罗兰瞳 ✓  · 米白西装校服 + 白衬衫 ✓
 *    · 深蓝格子领结 ✓ · 深蓝格子百褶裙 ✓ · 单肩深色书包 ✓
 *
 *  对外接口（只有两个 ✓，接进任何 three.js 场景都行 ✓）：
 *    window.buildRuri3D(THREE, opts) → THREE.Group（name = 'ruri3d' ✓）或 null（缺依赖时 ✓）
 *    window.updateRuri3D(group, dt, opts) → 每帧调用：待机呼吸 + 发梢摆动 ✓
 *
 *  ⚠ 只在有 THREE 时工作 ✓；任何异常都返回 null，让调用方回退原棋子 ✓（**不破坏 2D 回退** ✓）
 */
(function () {
  'use strict';
  var PAL = {
    hair: 0xf3a6c6, hairLight: 0xffc9e0, hairDark: 0xd97fae,
    skin: 0xffe0d2, eye: 0x8b6fd6, blazer: 0xf1e9dd, shirt: 0xfbfbfb,
    navy: 0x2a3358, plaid: 0x323c6b, bag: 0x2b2b33, shoe: 0x33261f
  };
  function mat(T, color, rough, metal) {
    return new T.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.72 : rough, metalness: metal || 0 });
  }
  function mesh(T, geo, m, x, y, z) {
    var o = new T.Mesh(geo, m);
    o.position.set(x || 0, y || 0, z || 0);
    o.castShadow = true; o.receiveShadow = true;
    return o;
  }

  function buildRuri3D(T, opts) {
    try {
      if (!T || !T.Group) return null;
      opts = opts || {};
      var g = new T.Group(); g.name = 'ruri3d';
      var mHair = mat(T, PAL.hair, 0.62), mHairL = mat(T, PAL.hairLight, 0.55), mHairD = mat(T, PAL.hairDark, 0.66);
      var mSkin = mat(T, PAL.skin, 0.85), mBlazer = mat(T, PAL.blazer, 0.8), mShirt = mat(T, PAL.shirt, 0.75);
      var mNavy = mat(T, PAL.navy, 0.7), mPlaid = mat(T, PAL.plaid, 0.72), mBag = mat(T, PAL.bag, 0.5), mShoe = mat(T, PAL.shoe, 0.5);
      var mEye = mat(T, PAL.eye, 0.35);

      /* ---- 腿 / 鞋（1.70 单位总高，与引擎原有棋子同量级 ✓）---- */
      [-0.085, 0.085].forEach(function (x) {
        g.add(mesh(T, new T.CapsuleGeometry(0.062, 0.46, 4, 10), mSkin, x, 0.36, 0));
        g.add(mesh(T, new T.BoxGeometry(0.115, 0.06, 0.2), mShoe, x, 0.06, 0.02));
      });
      /* ---- 深蓝格子百褶裙（圆台 + 竖向褶线 ✓）---- */
      var skirt = mesh(T, new T.CylinderGeometry(0.155, 0.33, 0.28, 18, 1, true), mPlaid, 0, 0.735, 0);
      g.add(skirt);
      for (var i = 0; i < 12; i++) {
        var a = (i / 12) * Math.PI * 2;
        var pl = mesh(T, new T.BoxGeometry(0.028, 0.27, 0.02), mNavy, Math.sin(a) * 0.25, 0.735, Math.cos(a) * 0.25);
        pl.rotation.y = a; g.add(pl);
      }
      /* ---- 躯干：米白西装外套 + 白衬衫领 + 深蓝领结 ---- */
      g.add(mesh(T, new T.CapsuleGeometry(0.135, 0.34, 6, 14), mBlazer, 0, 1.05, 0));
      g.add(mesh(T, new T.CylinderGeometry(0.075, 0.09, 0.12, 12), mShirt, 0, 1.235, 0.015));
      g.add(mesh(T, new T.BoxGeometry(0.1, 0.055, 0.045), mNavy, 0, 1.185, 0.1));
      /* 单肩书包（左肩带 + 身侧包体 ✓） */
      var strap = mesh(T, new T.BoxGeometry(0.035, 0.3, 0.02), mBag, -0.11, 1.09, 0.03);
      strap.rotation.z = 0.22; g.add(strap);
      g.add(mesh(T, new T.BoxGeometry(0.13, 0.17, 0.07), mBag, -0.19, 0.87, -0.02));
      /* ---- 手臂（袖子用外套色 ✓ 手用肤色 ✓）---- */
      [-1, 1].forEach(function (s) {
        var arm = new T.Group();
        arm.add(mesh(T, new T.CapsuleGeometry(0.05, 0.26, 4, 10), mBlazer, 0, 0, 0));
        arm.add(mesh(T, new T.SphereGeometry(0.05, 10, 8), mSkin, 0, -0.17, 0));
        arm.position.set(s * 0.185, 1.1, 0);
        arm.rotation.z = -s * 0.13;
        g.add(arm);
      });
      /* ---- 头 / 脸 / 紫瞳 ---- */
      var head = new T.Group(); head.position.set(0, 1.42, 0); g.add(head);
      head.add(mesh(T, new T.SphereGeometry(0.155, 20, 16), mSkin, 0, 0, 0));
      [-0.058, 0.058].forEach(function (x) {
        var e = mesh(T, new T.SphereGeometry(0.026, 12, 10), mEye, x, 0.012, 0.138);
        e.scale.set(1, 1.25, 0.5); head.add(e);
      });
      /* ---- 亮粉长发：后发（长直 ✓）+ 两侧发绺 + 刘海 + 头顶 ---- */
      var back = mesh(T, new T.CapsuleGeometry(0.16, 0.62, 6, 16), mHair, 0, -0.14, -0.085);
      back.scale.set(1, 1, 0.62); head.add(back);
      var tail = mesh(T, new T.CylinderGeometry(0.14, 0.055, 0.5, 14), mHairD, 0, -0.62, -0.1);
      tail.scale.set(1, 1, 0.6); head.add(tail);
      [-1, 1].forEach(function (s) {
        var lock = mesh(T, new T.CapsuleGeometry(0.045, 0.46, 4, 10), mHairL, s * 0.135, -0.3, 0.04);
        lock.rotation.z = s * 0.06; head.add(lock);
      });
      var cap = mesh(T, new T.SphereGeometry(0.172, 20, 16), mHair, 0, 0.012, -0.012);
      cap.scale.set(1, 0.95, 1.02); head.add(cap);
      var bangs = mesh(T, new T.SphereGeometry(0.163, 20, 14), mHairL, 0, 0.045, 0.028);
      bangs.scale.set(1.01, 0.55, 0.98); head.add(bangs);

      /* ---- 脚下的柔光底座（读作"棋子" ✓，也帮她在地图上更醒目 ✓）---- */
      var ring = new T.Mesh(new T.RingGeometry(0.2, 0.27, 32), new T.MeshBasicMaterial({ color: 0xff9ecb, transparent: true, opacity: 0.42, side: T.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; g.add(ring);

      g.userData.ruri3d = { t: 0, head: head, ring: ring, opts: opts };
      return g;
    } catch (e) {
      try { console.error('琉璃 3D 模型构建失败（回退原棋子 ✓）', e); } catch (e2) {}
      return null;
    }
  }

  function updateRuri3D(group, dt, opts) {
    try {
      if (!group || !group.userData || !group.userData.ruri3d) return;
      var d = group.userData.ruri3d;
      d.t += (dt || 0.016);
      /* ⚠ 不碰 group.position ✓ —— 引擎的 frame 循环已经统一做"待机浮动 + 转向" ✓（见 game.html frame ✓）
         这里只做她特有的细节：头部/发梢轻摆 + 脚下柔光底座呼吸 ✓ */
      if (d.head) d.head.rotation.z = Math.sin(d.t * 0.9) * 0.02;
      if (d.ring) { d.ring.material.opacity = 0.34 + Math.sin(d.t * 2.2) * 0.08; }
    } catch (e) { /* 纯动画，绝不抛 ✓ */ }
  }

  try {
    window.buildRuri3D = buildRuri3D;
    window.updateRuri3D = updateRuri3D;
  } catch (e) {}
})();
