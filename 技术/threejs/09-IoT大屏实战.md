# 第9章 IoT 3D 大屏实战:设备点位可视化(全书核心)

> 一句话讲清:**3D 大屏 = 场景底子(厂区/罐区) + 设备点位(球体/模型) + 数据绑定(状态→颜色/动画)
> + 交互(点击看详情) + 数据刷新(轮询/WebSocket)。本章用一个"燃气场站"Demo 串起全书。**
> 本章目标:独立完成一个"设备点位 3D 大屏",能讲清数据从后端到 3D 呈现的完整链路。

## 9.1 大屏结构设计:先想清楚四层

```
┌────────────────────────────────────────────┐
│  第1层  HTML 覆盖层:标题、统计面板、图表(不是3D画的)  │
├────────────────────────────────────────────┤
│  第2层  3D 场景:罐区地面、厂房、围栏(静态底子)       │
│  第3层  设备点位:球体/模型 + 光圈(动态,随数据变)     │
│  第4层  特效:飞线、粒子、告警闪烁(数据驱动)          │
└────────────────────────────────────────────┘
```

**核心思路:能用 HTML 画的别用 3D。** 数字统计、图表、文字信息用 HTML/CSS 覆盖层
(性能好、样式好做);3D 只负责"空间关系和状态可视化"。面试讲大屏,这个分层是加分点。

## 9.2 场景搭建:罐区底子(静态层)

```js
// 厂区地面:大平面 + 网格 + 半透明(参考系)
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x1a2b3c, roughness: 0.9, side: THREE.DoubleSide })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 网格线(定位辅助,大屏里也是"科技感"元素)
const grid = new THREE.GridHelper(80, 20, 0x2a4a6a, 0x1a3550);
grid.position.y = 0.01;   // 略高于地面防 z-fighting(闪烁)
scene.add(grid);

// 储罐:圆柱体 + 顶部球冠(简化的 LPG 储罐)
function createTank(x, z, radius = 3, height = 6) {
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 32),
    new THREE.MeshStandardMaterial({ color: 0x4a6a8a, metalness: 0.4, roughness: 0.5 })
  );
  tank.position.set(x, height / 2, z);
  tank.castShadow = true;
  scene.add(tank);
  return tank;
}

// 厂房:一个大方块
const factory = new THREE.Mesh(
  new THREE.BoxGeometry(16, 5, 10),
  new THREE.MeshStandardMaterial({ color: 0x2c3e50 })
);
factory.position.set(15, 2.5, 0);
scene.add(factory);

// 围栏:一圈矮柱子(循环生成)
for (let i = 0; i < 24; i++) {
  const angle = (i / 24) * Math.PI * 2;
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  post.position.set(Math.cos(angle) * 30, 0.6, Math.sin(angle) * 30);
  scene.add(post);
}

// 灯光三件套(第4章):环境光 + 主光 + 补光
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const main = new THREE.DirectionalLight(0xffffff, 1.5);
main.position.set(20, 30, 10);
main.castShadow = true;
main.shadow.mapSize.set(2048, 2048);
main.shadow.camera.left = -40; main.shadow.camera.right = 40;
main.shadow.camera.top = 40;   main.shadow.camera.bottom = -40;
scene.add(main);
const fill = new THREE.DirectionalLight(0xffffff, 0.4);
fill.position.set(-20, 10, -20);
scene.add(fill);
```

## 9.3 设备点位:数据驱动生成(动态层核心)

```js
// 设备数据(模拟后端返回;实际是 fetch('/api/devices') 拉取)
const devices = [
  { id: 1, name: '1号储罐', type: 'tank',    x: -8, z: -6, status: 'normal',  temp: 23.5, pressure: 0.8 },
  { id: 2, name: '2号储罐', type: 'tank',    x: -3, z: -6, status: 'warning', temp: 45.2, pressure: 1.6 },
  { id: 3, name: '3号储罐', type: 'tank',    x: 2,  z: -6, status: 'normal',  temp: 21.0, pressure: 0.7 },
  { id: 4, name: '加气机A', type: 'machine', x: 8,  z: 0,  status: 'normal',  temp: 30.1, pressure: 1.1 },
  { id: 5, name: '加气机B', type: 'machine', x: 12, z: 0,  status: 'alarm',   temp: 88.9, pressure: 2.3 },
  // ... 真实项目会有几十上百个设备
];

// 状态 → 颜色/动画 映射(大屏视觉约定)
const STATUS_STYLE = {
  normal:  { color: 0x00aaff },        // 正常:蓝
  warning: { color: 0xffaa00, blink: true },   // 预警:橙 + 闪烁
  alarm:   { color: 0xff3333, blink: true },   // 告警:红 + 闪烁
};

// 为每个设备生成 3D 点位:球体 + 光圈
const deviceMeshes = new Map();   // id → mesh 映射(点击/刷新时用)

devices.forEach((dev) => {
  // 主体:球体(设备点位)
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 24, 16),
    new THREE.MeshStandardMaterial({ color: STATUS_STYLE[dev.status].color, emissiveIntensity: 0.3 })
  );
  mesh.position.set(dev.x, 1.2, dev.z);
  mesh.userData = dev;            // ★ 业务数据直接挂上去(第7章)
  scene.add(mesh);

  // 脚下光圈(第8章)
  const ring = createRing(STATUS_STYLE[dev.status].color);
  ring.position.set(dev.x, 0.05, dev.z);
  scene.add(ring);

  deviceMeshes.set(dev.id, { mesh, ring, data: dev });
});

// 生产环境:设备不在代码里写死,而是
// fetch('/api/devices').then(res => res.json()).then(devices => renderDevices(devices));
// 后端返回 JSON 数组,前端遍历生成 —— 数据驱动渲染
```

## 9.4 数据刷新与状态联动:轮询/WebSocket

```js
// 方式1:轮询(简单,大屏常用)
async function refreshData() {
  const res = await fetch('/api/devices/status');   // 后端实时状态接口
  const list = await res.json();
  updateDevices(list);
}
setInterval(refreshData, 5000);   // 每 5 秒刷新一次

// 方式2:WebSocket(实时性要求高:告警秒级)
// const ws = new WebSocket('ws://server/ws/device');
// ws.onmessage = (e) => { const d = JSON.parse(e.data); updateDevices([d]); };

// 更新逻辑:对比状态,改颜色/触发闪烁
function updateDevices(list) {
  list.forEach((d) => {
    const item = deviceMeshes.get(d.id);
    if (!item) return;
    const style = STATUS_STYLE[d.status] || STATUS_STYLE.normal;
    item.mesh.material.color.set(style.color);
    item.mesh.userData = { ...item.mesh.userData, ...d };   // 更新业务数据
    // 告警设备加光圈放大 + 闪烁(在渲染循环里按 userData 判断)
  });
}
```

**面试核心链路(必须能讲):**

```
后端(Spring Boot /api/devices) → 前端 fetch 轮询 5s →
遍历设备数据 → 更新 mesh 颜色/光圈/闪烁 → 点击射线拾取 → 查详情接口 → 信息面板
```

## 9.5 视角切换:全景 / 罐区特写 / 告警定位

```js
import { TWEEN } from '...';   // 第6章补间

// 预设视角(大屏"视角切换按钮")
const VIEWS = {
  overview: { pos: [0, 35, 45],  look: [0, 0, 0] },     // 全景俯瞰
  tankArea: { pos: [-10, 12, 18], look: [0, 0, -6] },    // 罐区特写
  factory:  { pos: [25, 10, 20],  look: [15, 0, 0] },    // 厂房
};

// 飞往预设视角
function flyToView(name) {
  const v = VIEWS[name];
  new TWEEN.Tween(camera.position)
    .to({ x: v.pos[0], y: v.pos[1], z: v.pos[2] }, 1200)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .start();
  // lookAt 目标也要同步(用中间变量或第二个 Tween)
}

// 告警自动定位:点"告警列表"跳到告警设备
function focusDevice(id) {
  const item = deviceMeshes.get(id);
  const p = item.mesh.position;
  new TWEEN.Tween(camera.position)
    .to({ x: p.x + 6, y: p.y + 5, z: p.z + 6 }, 800)
    .start();
  // 高亮目标设备(放大 + 光圈变色)
}

function animate() {
  requestAnimationFrame(animate);
  TWEEN.update();
  controls.update();
  updateAlarmBlink();      // 告警闪烁(9.6)
  renderer.render(scene, camera);
}
```

## 9.6 告警闪烁 + 全局状态

```js
const clock = new THREE.Clock();

function updateAlarmBlink() {
  const t = clock.getElapsedTime();
  deviceMeshes.forEach(({ mesh, data }) => {
    const style = STATUS_STYLE[data.status];
    if (style && style.blink) {
      // 告警:球体缩放呼吸 + 颜色脉动
      const s = 1 + Math.sin(t * 6) * 0.2;
      mesh.scale.set(s, s, s);
      mesh.material.emissive.set(style.color);
      mesh.material.emissiveIntensity = 1 + Math.sin(t * 6) * 0.8;
    } else {
      mesh.scale.set(1, 1, 1);
      mesh.material.emissiveIntensity = 0.3;
    }
  });
}

// 顶部统计面板(HTML 覆盖层):正常/预警/告警数量
function updateStats(list) {
  const normal = list.filter(d => d.status === 'normal').length;
  const warning = list.filter(d => d.status === 'warning').length;
  const alarm = list.filter(d => d.status === 'alarm').length;
  document.getElementById('stat-normal').textContent = normal;
  document.getElementById('stat-warning').textContent = warning;
  document.getElementById('stat-alarm').textContent = alarm;
}
```

## 9.7 完整 Demo 骨架(把 9.2~9.6 拼起来)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>燃气场站 3D 监控大屏</title>
  <style>
    body { margin: 0; overflow: hidden; background: #0a1628; font-family: sans-serif; }
    #stats {
      position: fixed; top: 16px; left: 16px; z-index: 10;
      background: rgba(10, 22, 40, 0.85); color: #aaccff;
      padding: 12px 20px; border-radius: 8px; border: 1px solid #2a4a6a;
    }
    #stats span { color: #fff; font-weight: bold; margin-right: 16px; }
    #info {
      display: none; position: fixed; right: 16px; bottom: 16px; z-index: 10;
      background: rgba(10, 22, 40, 0.9); color: #fff;
      padding: 16px 20px; border-radius: 8px; border: 1px solid #00aaff;
    }
  </style>
</head>
<body>
  <div id="stats">正常:<span id="stat-normal">0</span>
    预警:<span id="stat-warning">0</span>
    告警:<span id="stat-alarm">0</span></div>
  <div id="info"></div>

  <script type="importmap">
  { "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
  } }
  </script>
  <script src="https://cdn.jsdelivr.net/npm/@tweenjs/tween.js@21.3.0/dist/tween.umd.js"></script>

  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

    // —— 9.2 场景底子 + 9.3 设备点位 + 9.5 视角 + 9.6 闪烁 + 7.4 点击面板 ——
    // (把上面各节的代码按顺序合并进来,即组成完整大屏)
    // 本节略(已在 9.2~9.6 给出每一块的完整代码)
  </script>
</body>
</html>
```

**真实项目还要加(面试可提):**
- 设备 3D 模型(GLTFLoader 加载 .glb 模型,替换球体点位)
- 数据用 WebSocket 秒级推送告警
- 飞线展示"加气站 → 储罐"的气流走向(第8章)
- 图表用 ECharts 放在 HTML 覆盖层,与 3D 联动

## 9.8 常见坑汇总(大屏专项)

| # | 坑 | 现象 | 解决 |
|---|----|------|------|
| 1 | 设备数据写死 | 换环境要改代码 | 数据驱动:fetch 接口 → 遍历生成 |
| 2 | 轮询间隔太短 | 接口被打爆 | 5s~30s 按需;告警用 WebSocket |
| 3 | 所有设备一个材质 | 点一个全变色 | 每设备独立材质,或用 userData 区分 |
| 4 | 忘记 dispose | 刷新后内存涨 | 重新渲染前 geometry/material 要 dispose(第10章) |
| 5 | z-fighting | 地面/网格闪烁 | 两层贴一起时 y 偏移 0.01~0.05 |
| 6 | 大屏分辨率高 | 卡 | 降 shadow mapSize、降粒子数、关抗锯齿(第10章) |
| 7 | 视角切换突兀 | 体验差 | TWEEN 缓动 + 限制 minDistance/maxPolarAngle |
| 8 | 点击穿透到地面 | 点地面也弹信息 | intersectObjects 只传设备数组(第7章) |

## 9.9 面试自测(追问链)

**Q1:3D 大屏的分层设计?**
一句话:"HTML 覆盖层管数据统计/图表,3D 场景管空间和状态可视化,数据驱动生成设备点位。"
追问:为什么图表不用 3D 画?(HTML/ECharts 性能好、样式成熟,3D 只做空间表达)

**Q2:设备点位怎么做到数据驱动?**
一句话:"后端返回设备 JSON 数组,前端遍历生成 3D 点位;轮询/WebSocket 刷新时只更新颜色和动画,不重建。"
追问:为什么不整个场景重建?(重建开销大:要重新创建几何体/材质;增量更新只改属性,毫秒级)

**Q3:点击设备看数据的完整链路?**
一句话:"Raycaster 拾取 → userData 拿设备 id → fetch 详情接口 → 渲染信息面板。"
追问:userData 里存什么?(id/名称/坐标/状态;实时数据不要全存,点的时候再查)

**Q4:告警怎么呈现?**
一句话:"状态映射颜色(蓝/橙/红)+ 呼吸闪烁动画 + 光圈强调 + 统计面板数字 + 可定位跳转。"
追问:闪烁会耗性能吗?(只有告警设备参与动画,正常设备不动;别让所有设备都算 sin)

**Q5:数据刷新用轮询还是 WebSocket?**
一句话:"轮询简单适合 5s+ 的批量刷新;WebSocket 适合告警等秒级实时推送。"
追问:大屏推荐哪种?(数据量大用轮询批量拉,告警事件用 WebSocket 单点推——两种组合)

---

**本章验收**:能搭出"罐区底子 + 设备点位 + 状态联动 + 点击详情"的完整大屏;
能画出数据从后端到 3D 呈现的完整链路图并讲 2 分钟。
下一步:第10章 性能优化与面试速查(全书收尾)。
