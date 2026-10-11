/* assets/ruri3d.js -- Ruri as a Blue-Archive-style CHIBI 3D figure (author 2026-10-12)
 *
 *  History (why this version):
 *    v1 = realistic-proportioned primitives  -> author: "too ugly"
 *    v2 = 2.5D billboard standee             -> author: "what is this" (squashed by the top-down camera)
 *    v3 = THIS: chibi (big head ~45% of height, short thick limbs) -- the proportions are what sell it.
 *
 *  Palette copied from the author's material art (read_image verified):
 *    pink hair / skin / cream blazer / white shirt / navy plaid skirt / navy bow / violet eyes / brown shoes.
 *  Face is drawn on a canvas (big violet eyes + highlights + smile + blush) and applied to a small
 *  transparent plane in front of the head -- geometric primitives alone cannot make a cute face.
 *
 *  API (unchanged, so game.html needs no further edits):
 *    window.buildRuri3D(THREE, opts) -> THREE.Group named 'ruri3d'  (or null -> caller falls back to the old piece)
 *    window.updateRuri3D(group, dt, opts)
 *  Every failure is swallowed and returns null: the 2D fallback and all rules stay untouched.
 */
(function () {
  'use strict';
  var C = {
    hair: 0xf6a8c8, hairShade: 0xe58bb2, skin: 0xffe2d4,
    blazer: 0xf2ead9, shirt: 0xfdfdfd, plaid: 0x2f3a68, navy: 0x243056,
    shoe: 0x3a2b22, bag: 0x2b2b33
  };

  function mat(T, color, rough) {
    return new T.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.85 : rough, metalness: 0 });
  }
  function add(T, parent, geo, m, x, y, z, rot) {
    var o = new T.Mesh(geo, m);
    o.position.set(x || 0, y || 0, z || 0);
    if (rot) { o.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0); }
    o.castShadow = true; o.receiveShadow = true;
    parent.add(o);
    return o;
  }

  /* ---- 脸：canvas 画（大眼睛/高光/眉/嘴/腮红）✓ ---- */
  function faceTexture(T) {
    try {
      var s = 256, cv = document.createElement('canvas'); cv.width = cv.height = s;
      var x = cv.getContext('2d');
      x.clearRect(0, 0, s, s);
      function eye(cx) {
        x.save();
        x.fillStyle = '#f6f7ff';                                  // 眼白
        x.beginPath(); x.ellipse(cx, s * 0.46, s * 0.105, s * 0.135, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#8f74d8';                                  // 紫瞳
        x.beginPath(); x.ellipse(cx, s * 0.475, s * 0.082, s * 0.108, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#5b3fa8';                                  // 瞳下缘加深
        x.beginPath(); x.ellipse(cx, s * 0.515, s * 0.066, s * 0.062, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.95)';                    // 高光（两枚 ✓）
        x.beginPath(); x.ellipse(cx - s * 0.028, s * 0.425, s * 0.028, s * 0.034, 0, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.ellipse(cx + s * 0.03, s * 0.498, s * 0.016, s * 0.02, 0, 0, Math.PI * 2); x.fill();
        x.strokeStyle = '#4a3a52'; x.lineWidth = s * 0.022; x.lineCap = 'round';   // 上睫毛
        x.beginPath(); x.ellipse(cx, s * 0.455, s * 0.108, s * 0.115, 0, Math.PI * 1.06, Math.PI * 1.94); x.stroke();
        x.strokeStyle = '#8a5f7a'; x.lineWidth = s * 0.014;                        // 眉
        x.beginPath(); x.ellipse(cx, s * 0.315, s * 0.085, s * 0.05, 0, Math.PI * 1.15, Math.PI * 1.85); x.stroke();
        x.restore();
      }
      eye(s * 0.34); eye(s * 0.66);
      x.fillStyle = 'rgba(255,150,175,0.42)';                      // 腮红 ✓
      x.beginPath(); x.ellipse(s * 0.19, s * 0.62, s * 0.075, s * 0.045, 0, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.ellipse(s * 0.81, s * 0.62, s * 0.075, s * 0.045, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#b5636f'; x.lineWidth = s * 0.018; x.lineCap = 'round';     // 小嘴 ✓
      x.beginPath(); x.ellipse(s * 0.5, s * 0.655, s * 0.045, s * 0.03, 0, Math.PI * 0.14, Math.PI * 0.86); x.stroke();
      var t = new T.CanvasTexture(cv);
      if (T.SRGBColorSpace && 'colorSpace' in t) t.colorSpace = T.SRGBColorSpace;
      else if (T.sRGBEncoding !== undefined && 'encoding' in t) t.encoding = T.sRGBEncoding;
      return t;
    } catch (e) { return null; }
  }

  function buildRuri3D(T, opts) {
    try {
      if (!T || !T.Group) return null;
      opts = opts || {};
      var g = new T.Group(); g.name = 'ruri3d';

      var mHair = mat(T, C.hair, 0.7), mHair2 = mat(T, C.hairShade, 0.75), mSkin = mat(T, C.skin, 0.9),
          mBlazer = mat(T, C.blazer, 0.85), mShirt = mat(T, C.shirt, 0.8), mPlaid = mat(T, C.plaid, 0.8),
          mNavy = mat(T, C.navy, 0.8), mShoe = mat(T, C.shoe, 0.6), mBag = mat(T, C.bag, 0.65);

      /* ---------- 腿 + 鞋（短粗 ✓ Q 版）---------- */
      [-0.115, 0.115].forEach(function (x) {
        add(T, g, new T.CapsuleGeometry(0.085, 0.16, 4, 12), mSkin, x, 0.22, 0);
        var shoe = add(T, g, new T.SphereGeometry(0.115, 14, 10), mShoe, x, 0.075, 0.035);
        shoe.scale.set(1, 0.6, 1.35);
      });
      /* ---------- 百褶裙（圆锥 ✓ 深蓝格子）---------- */
      add(T, g, new T.ConeGeometry(0.42, 0.30, 22, 1, true), mPlaid, 0, 0.46, 0, [Math.PI, 0, 0]);
      for (var i = 0; i < 14; i++) {
        var a = (i / 14) * Math.PI * 2;
        add(T, g, new T.BoxGeometry(0.05, 0.28, 0.03), mNavy, Math.sin(a) * 0.33, 0.46, Math.cos(a) * 0.33, [0, a, 0]);
      }
      /* ---------- 躯干（米白西装 ✓）+ 白领 + 深蓝领结 ---------- */
      add(T, g, new T.CapsuleGeometry(0.215, 0.26, 6, 16), mBlazer, 0, 0.78, 0);
      add(T, g, new T.CylinderGeometry(0.115, 0.135, 0.11, 14), mShirt, 0, 0.95, 0.015);
      add(T, g, new T.BoxGeometry(0.155, 0.075, 0.055), mNavy, 0, 0.90, 0.185);
      add(T, g, new T.BoxGeometry(0.075, 0.075, 0.05), mNavy, 0, 0.90, 0.205);
      /* 单肩书包（小一号 ✓） */
      var strap = add(T, g, new T.BoxGeometry(0.045, 0.30, 0.025), mBag, -0.17, 0.82, 0.06);
      strap.rotation.z = 0.22;
      add(T, g, new T.BoxGeometry(0.17, 0.20, 0.09), mBag, -0.27, 0.55, -0.03);
      /* ---------- 手臂（短粗 + 球手 ✓）---------- */
      var arms = [];
      [-1, 1].forEach(function (s) {
        var arm = new T.Group(); arm.position.set(s * 0.30, 0.86, 0);
        add(T, arm, new T.CapsuleGeometry(0.072, 0.20, 4, 12), mBlazer, 0, -0.10, 0);
        add(T, arm, new T.SphereGeometry(0.078, 12, 10), mSkin, 0, -0.245, 0);
        arm.rotation.z = -s * 0.22;
        g.add(arm); arms.push(arm);
      });
      /* ---------- 大脑袋（Q 版关键 ✓ 半径 0.42 ≈ 总高 45%）---------- */
      var head = new T.Group(); head.position.set(0, 1.20, 0); g.add(head);
      add(T, head, new T.SphereGeometry(0.42, 28, 22), mSkin, 0, 0, 0);
      var ft = faceTexture(T);
      if (ft) {
        var face = new T.Mesh(new T.PlaneGeometry(0.66, 0.66),
          new T.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false }));
        face.position.set(0, -0.015, 0.415);
        face.renderOrder = 5;
        head.add(face);
      }
      /* ---------- 粉色长发：头罩 + 刘海 + 两侧发绺 + 背后长直发 ---------- */
      var cap = add(T, head, new T.SphereGeometry(0.445, 28, 22), mHair, 0, 0.02, -0.02);
      cap.scale.set(1.0, 0.98, 1.02);
      var bangGeo = new T.SphereGeometry(0.15, 14, 10);
      [-0.20, 0.0, 0.20].forEach(function (x) {
        var b = add(T, head, bangGeo, mHair2, x, 0.30, 0.325);
        b.scale.set(1.15, 0.5, 0.55);
      });
      var locks = [];
      [-1, 1].forEach(function (s) {
        var lk = add(T, head, new T.CapsuleGeometry(0.075, 0.52, 4, 12), mHair, s * 0.40, -0.30, 0.06);
        lk.rotation.z = s * 0.05; locks.push(lk);
      });
      var back = add(T, head, new T.CylinderGeometry(0.34, 0.16, 1.0, 18, 1, true), mHair2, 0, -0.52, -0.16);
      back.scale.set(1, 1, 0.66);
      var tail = add(T, head, new T.CylinderGeometry(0.16, 0.07, 0.42, 16, 1, true), mHair, 0, -1.10, -0.16);
      tail.scale.set(1, 1, 0.66);
      /* ---------- 脚下柔光圆环（读作棋子 ✓）---------- */
      var ring = add(T, g, new T.RingGeometry(0.34, 0.44, 40),
        new T.MeshBasicMaterial({ color: 0xff9ecb, transparent: true, opacity: 0.38, side: T.DoubleSide, depthWrite: false }),
        0, 0.015, 0, [-Math.PI / 2, 0, 0]);
      ring.renderOrder = 0;

      g.userData.ruri3d = { t: 0, head: head, arms: arms, locks: locks, back: back, ring: ring };
      return g;
    } catch (e) {
      try { console.error('琉璃 Q 版小人构建失败（回退原棋子）', e); } catch (e2) {}
      return null;
    }
  }

  function updateRuri3D(group, dt, opts) {
    try {
      var d = group && group.userData && group.userData.ruri3d; if (!d) return;
      d.t += (dt || 0.016);
      var t = d.t;
      /* 保持竖直（俯视地图里才像"站在格子上"）✓；只做很轻的整体朝向偏转 ✓ */
      var cam = opts && opts.camera;
      if (cam && cam.position) {
        var want = Math.atan2(cam.position.x - group.position.x, cam.position.z - group.position.z);
        group.rotation.y += (want - group.rotation.y) * 0.06;
      }
      if (d.head) { d.head.rotation.z = Math.sin(t * 1.1) * 0.02; d.head.position.y = 1.20 + Math.sin(t * 1.9) * 0.014; }
      if (d.arms) d.arms.forEach(function (a, i) { a.rotation.x = Math.sin(t * 1.9 + i * Math.PI) * 0.10; });
      if (d.locks) d.locks.forEach(function (l, i) { l.rotation.x = Math.sin(t * 1.6 + i) * 0.05; });
      if (d.back) d.back.rotation.x = Math.sin(t * 1.3) * 0.035;
      if (d.ring) d.ring.material.opacity = 0.30 + Math.sin(t * 2.1) * 0.10;
    } catch (e) { /* pure animation: never throw */ }
  }

  try {
    window.buildRuri3D = buildRuri3D;
    window.updateRuri3D = updateRuri3D;
  } catch (e) {}
})();
