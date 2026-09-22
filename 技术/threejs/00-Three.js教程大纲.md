# Three.js 教程：大纲与目录（3D 可视化实战版）

> 读者定位：会前端基础（JS/HTML 已具备）、想上手 3D 可视化或做 IoT 大屏的工程师。
> 目标：从零写出第一个 3D 场景，掌握场景/相机/光源/交互/动画五大块，
> 能做一个"设备点位 3D 可视化"小项目，面试能讲清 WebGL 与 Three.js 的关系。
> 风格：每章"一句话讲清 + 可直接运行的完整代码 + 常见坑 + 面试自测"。

## 一、总规模

- 10 章 + 大纲，约 2.5~3 万字，70 页左右
- 代码示例 60+ 段（全部 ES Module 写法，可贴进 HTML 直接跑）
- 精读 4~5 小时；应急第10章速查 30 分钟

## 二、章节规划

| # | 章节 | 核心知识点 | 星级 |
|---|------|-----------|------|
| 1 | WebGL 与 Three.js 基础 | 3D 坐标、场景三要素、第一个立方体、渲染循环 | ★★★★★ |
| 2 | 几何体与材质 | Geometry/Material/Mesh、常用几何体、颜色与基础材质 | ★★★★ |
| 3 | 相机与控制器 | 透视/正交相机、OrbitControls 视角控制 | ★★★★ |
| 4 | 光源与阴影 | 四种光源、阴影配置、亮度陷阱 | ★★★ |
| 5 | 纹理与贴图 | TextureLoader、材质贴图、透明/发光 | ★★★ |
| 6 | 动画与渲染循环 | requestAnimationFrame、Clock、补间、自转/公转 | ★★★★ |
| 7 | 交互与射线检测 | Raycaster 点击拾取、hover 高亮、拖拽 | ★★★★★ |
| 8 | 粒子与特效 | Points 粒子、飞线、辉光、大屏常用特效 | ★★★★ |
| 9 | IoT 3D 大屏实战 | 设备点位、场景搭建、数据绑定、切换视角 | ★★★★★ |
| 10 | 性能优化与面试速查 | 绘制调用、LOD、帧率、常见坑、面试题 | ★★★★★ |

## 三、贯穿全书的思维主线（5 句）

1. **Three.js 是 WebGL 的封装**：WebGL 是浏览器 3D 底层 API（难用），Three.js 是"对象化封装"。
2. **场景三要素：Scene（舞台）+ Camera（眼睛）+ Renderer（画布）**，缺一不可。
3. **3D 里一切皆 Mesh**：几何体（形状）+ 材质（外表）= 网格（放进场景的对象）。
4. **3D 坐标系**：x 右、y 上、z 朝屏幕外（右手系），旋转单位是弧度。
5. **渲染是循环**：不是画一次就完，是每帧重画（requestAnimationFrame），动画由此而来。

## 四、学习路径

- 第1章跑通第一个立方体（最关键的 30 分钟）
- 第2、3章补形状和视角 → 第4、5章让画面"好看"
- 第6、7章动起来 + 能点 → 第9章 IoT 大屏实战串讲
- 第8章特效按需、第10章性能与面试冲刺

## 五、运行方式（每章代码都能直接跑）

```html
<!-- 方法A：CDN + importmap（最快，推荐学习用） -->
<script type="importmap">
  { "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
  } }
</script>
<script type="module">
  import * as THREE from 'three';
  // 本章代码贴这里
</script>

<!-- 方法B：npm 项目（工程化，做项目用） -->
<!-- npm install three -->
<!-- import * as THREE from 'three' -->
```

## 六、打分自评

- 原理分（40）：WebGL vs Three.js、渲染循环、坐标系能讲清
- 示例分（30）：每章代码贴进 HTML 即可运行
- 坑分（20）：相机位置、光源、阴影、性能高频坑全覆盖
- 实战分（10）：能独立做出 IoT 设备点位 3D 页面