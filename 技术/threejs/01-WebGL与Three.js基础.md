# 第1章 WebGL 与 Three.js 基础:第一个立方体

> 一句话讲清:**Three.js 是 WebGL 的对象化封装——WebGL 是浏览器的 3D 底层 API(又难又啰嗦),
> Three.js 把"场景/相机/灯光/物体"变成一个个对象,让你 30 行代码画出第一个 3D 场景。**
> 本章目标:跑通第一个立方体,彻底理解"场景三要素"和"渲染是循环"这两条主线。

## 1.1 3D 坐标系:右手系,x 右、y 上、z 朝屏幕外

```js
// 记住这张"右手坐标系"图(面试必画):
//        y
//        |  z(朝屏幕外/朝你)
//        | /
//        |/
//   -----+-------> x
//       /
//      /
//  x 轴向右, y 轴向上, z 轴指向屏幕外(右手定则)
```

三个要点:

1. **Three.js 用右手坐标系**:x 右、y 上、z 朝屏幕外(Web 前端约定),这和数学课上的坐标系不一样,注意别搞反。
2. **位置是三维数组**:`new THREE.Vector3(x, y, z)`,不写默认 (0,0,0)。
3. **角度单位是弧度**:`Math.PI / 2` 才是 90 度,直接写 90 会旋转到奇怪的地方(高频坑,见 1.6)。

```js
const pos = new THREE.Vector3(2, 1, 3);   // 表示 (x=2, y=1, z=3) 的空间点
console.log(pos.x, pos.y, pos.z);          // 2 1 3
// 向量还能当"方向"用:new THREE.Vector3(0, 1, 0) 就是"朝上"
```

## 1.2 WebGL vs Three.js:为什么要有 Three.js

**WebGL 是浏览器自带的 3D 绘图 API(类似 Canvas 2D 的 3D 版,但更底层),Three.js 是包在它外面的一层"对象化封装"。**

```js
// 用原生 WebGL 画一个三角形,需要 100+ 行:
// 1. 写 GLSL 着色器源码(字符串)
// 2. 创建 buffer、绑定数据、编译着色器、链接程序
// 3. 逐顶点传坐标,手动管理状态机
// —— 而 Three.js 里,三角形只是 BoxGeometry 的一小块

// 用 Three.js 画立方体(核心就 3 行 + 渲染循环):
// const geometry = new THREE.BoxGeometry(1, 1, 1);   // 形状
// const material = new THREE.MeshBasicMaterial({ color: 0x00aaff }); // 外表
// const mesh = new THREE.Mesh(geometry, material);   // 组合成一个物体
```

| 对比 | 原生 WebGL | Three.js |
|------|-----------|----------|
| 学习成本 | 高(着色器/状态机) | 低(对象化) |
| 创建物体 | 手写顶点+着色器 | `BoxGeometry` 一行 |
| 光源/阴影 | 自己实现光照算法 | `DirectionalLight` 一行 |
| 加载模型 | 手写解析器 | `GLTFLoader` 一行 |
| 适用场景 | 极致性能/自研引擎 | 99% 的业务可视化 |

面试标准答案:**"WebGL 是浏览器原生提供的 3D 渲染 API,基于 GPU 的着色器管线,API 原始繁琐;
Three.js 是对它的封装,提供 Scene/Camera/Mesh/Light 等高层对象,内部自动完成着色器编译、
矩阵计算、渲染状态管理,让开发者专注于业务场景而不是图形细节。WebGL 是'怎么做',Three.js 是'要什么'。"**

## 1.3 场景三要素:Scene(舞台)+ Camera(眼睛)+ Renderer(画布)

这是全书最重要的一张图(背下来):

```
         Scene(舞台:装所有物体/灯光)
         │
    Camera(眼睛:决定从哪看、看到什么)
         │
   Renderer(画布:把"眼睛看到的舞台"画到网页 <canvas> 上)
```

- **Scene**:一个"容器",所有物体(mesh)、灯光、辅助线都 add 进去。
- **Camera**:决定观察视角。透视相机像人眼(近大远小),正交相机像工程图(无透视)。
- **Renderer**:真正调用 WebGL 把画面画出来,输出到 `<canvas>` 元素。

```js
// 三要素创建(每个 Three.js 项目必有,记住这三行)
const scene = new THREE.Scene();                          // 1. 舞台
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
                                                          // 2. 眼睛(参数:视野角/宽高比/近裁剪/远裁剪)
const renderer = new THREE.WebGLRenderer();               // 3. 画布
renderer.setSize(window.innerWidth, window.innerHeight);  //    设置画布尺寸
document.body.appendChild(renderer.domElement);           //    把 canvas 放进页面
```

**相机为什么要放远一点?** 相机默认在原点 (0,0,0),和物体重叠时"什么都看不到"。所以相机要
`camera.position.set(0, 0, 5)` 往后退 5 个单位,再用 `camera.lookAt(0, 0, 0)` 看向原点。
这是新手第一坑,见 1.6。

## 1.4 第一个立方体:完整可运行代码(★ 必跑通)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Three.js 第一个立方体</title>
  <style>
    body { margin: 0; overflow: hidden; }  /* 去掉默认外边距,防止出现滚动条 */
    canvas { display: block; }             /* 去掉 canvas 底部的间隙 */
  </style>
</head>
<body>
  <!-- 方法A:CDN + importmap(学习最快,直接双击 HTML 打开即可) -->
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
    }
  }
  </script>

  <script type="module">
    import * as THREE from 'three';

    // 1. 场景三要素
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);      // 相机往后退 5 个单位(否则和立方体重叠)
    camera.lookAt(0, 0, 0);            // 看向原点

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 2. 物体:几何体(形状) + 材质(外表) = 网格(Mesh)
    const geometry = new THREE.BoxGeometry(1, 1, 1);              // 长宽高 1 的立方体
    const material = new THREE.MeshBasicMaterial({ color: 0x00aaff }); // 纯色材质(不受光照影响,先够亮)
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);                   // 放进舞台!

    // 3. 渲染循环:每帧重画 → 旋转动画
    function animate() {
      requestAnimationFrame(animate);  // 浏览器每帧(约 60fps)回调自己
      cube.rotation.x += 0.01;         // 每帧转一点,立方体就"自己转"起来了
      cube.rotation.y += 0.01;
      renderer.render(scene, camera);  // 用相机视角,把场景画出来
    }
    animate();
  </script>
</body>
</html>
```

**运行方式**:保存为 `01-cube.html`,双击用浏览器打开(需联网加载 CDN)。看到蓝色旋转立方体即成功。

## 1.5 渲染循环:为什么"画一次"不够?

**3D 场景是动态的:相机动了、物体转了、数据变了,都要重新画。所以 Three.js 的渲染是"每帧重画"的循环。**

```js
// 核心机制:requestAnimationFrame(raf)
// 浏览器每帧(1/60 秒)调用一次传入的函数,形成无限循环
function animate() {
  requestAnimationFrame(animate);  // 先注册下一帧(递归)
  // ... 更新物体的位置/旋转 ...
  renderer.render(scene, camera);  // 再用当前状态画一帧
}
animate();
```

两个理解要点:

1. **raf 是浏览器原生的",和 setTimeout 的区别**:raf 由浏览器在"即将重绘屏幕前"调用,
   帧率自动匹配显示器(60Hz→每秒约 60 次),标签页切后台自动暂停(省电)。
2. **动画的本质**:每帧修改物体的属性(rotation/position),然后重画,视觉上就连贯了。
   第6章会引入 Clock 做"时间驱动"动画(帧率无关),这里先用"每帧 +0.01"的简化版。

## 1.6 常见坑(新手必踩)

| # | 坑 | 现象 | 解决 |
|---|----|------|------|
| 1 | **相机和物体重叠** | 打开页面一片空白 | 相机 position.set(0,0,5) 后退,lookAt(0,0,0) |
| 2 | **忘了 scene.add** | 物体代码写了但看不见 | 创建 mesh 后必须 `scene.add(mesh)` |
| 3 | **旋转写度数** | 物体旋转角度怪 | 弧度制:`Math.PI / 2` = 90°,`Math.PI` = 180° |
| 4 | **body 有 margin** | 页面出现滚动条,场景偏移 | `body { margin: 0; overflow: hidden; }` |
| 5 | **importmap 写错路径** | 控制台报 "Failed to resolve module specifier" | 用大纲第5节的 CDN 模板,路径别改 |
| 6 | **双击 HTML 打不开** | 白屏,控制台报 CORS 错误 | importmap 方式可直接双击;若用了本地文件加载器,需起 http 服务:`npx serve .` |
| 7 | **看不见物体但是颜色不对/全黑** | 物体黑色 | MeshBasicMaterial 不受光,检查是否错用受光的材质且没加光源(第4章) |

## 1.7 面试自测(追问链)

**Q1:WebGL 和 Three.js 的关系?**
一句话:"WebGL 是浏览器原生 3D API,Three.js 是它的对象化封装。"
追问1:WebGL 底层怎么画一个三角形?(要答出:顶点坐标 → buffer → 着色器程序 → drawArrays)
追问2:为什么不用原生 WebGL?(开发效率、封装了矩阵/光照/模型加载,业务可视化场景用 Three.js)

**Q2:场景三要素是什么?各干什么?**
一句话:"Scene 是舞台装物体,Camera 是眼睛定视角,Renderer 是画布执行渲染。"
追问:Renderer 调用了什么底层 API?(WebGL;renderer.domElement 就是 canvas 元素)

**Q3:为什么要 requestAnimationFrame 而不是 setInterval 做动画?**
一句话:"raf 由浏览器在重绘前调用,帧率匹配屏幕,切后台自动暂停;setInterval 固定间隔,容易丢帧/耗电。"
追问:动画为什么不是画一次?(场景是动态的,每帧状态可能变化,必须重画)

**Q4:相机在原点为什么看不到物体?**
一句话:"相机和物体位置重叠,近裁剪面内的物体被裁掉/看不到,需要把相机移开再 lookAt。"
追问:PerspectiveCamera 四个参数是什么?(视野角 fov、宽高比 aspect、近裁剪面 near、远裁剪面 far)

**Q5:颜色 0x00aaff 是什么格式?**
一句话:"十六进制 RGB,等价于 CSS 的 #00aaff,0x 是 JS 的十六进制前缀。"

---

**本章验收**:能不看代码写出三要素创建 + 立方体 + 旋转循环(约 15 行);
能答出"WebGL vs Three.js"追问链。下一步:第2章 几何体与材质。
