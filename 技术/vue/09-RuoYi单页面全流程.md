---
tags: [vue]
---

# 第9章 RuoYi 单页面全流程（跑通一个业务模块）

> 一句话讲清：**把前八章串起来——在 RuoYi-Vue 里新增一个"设备管理"业务模块，
> 从菜单路由 → API → 页面 → 权限 → 联调，完整走一遍。**
> 目标：你能照着这个流程，给 IoT 平台加任何一张管理页面（设备、告警、工单…）。

## 9.1 全链路总览（先看地图）

```
① 后端：表结构 + Controller + Service + Mapper（RuoYi 代码生成器可一键生成）
   ↓
② 前端 API 文件：src/api/monitor/device.js（封装接口）
   ↓
③ 前端页面：src/views/monitor/device/index.vue（列表+弹窗）
   ↓
④ 菜单/权限：系统管理里加菜单，分配角色权限（权限标识与后端注解对应）
   ↓
⑤ 联调验证：登录 → 菜单出现 → 增删改查 → 按钮按权限显隐
```

后端部分（user 已熟悉）简略带过，重点讲前端链路。

## 9.2 第一步：API 封装（src/api/device.js）

```js
// src/api/monitor/device.js
import request from '@/utils/request'

// 列表（分页查询）：后端接收 pageNum/pageSize + 过滤条件
export function listDevice(query) {
  return request({
    url: '/monitor/device/list',
    method: 'get',
    params: query
  })
}
// 详情
export function getDevice(id) {
  return request({ url: '/monitor/device/' + id, method: 'get' })
}
// 新增
export function addDevice(data) {
  return request({ url: '/monitor/device', method: 'post', data })
}
// 修改
export function updateDevice(data) {
  return request({ url: '/monitor/device', method: 'put', data })
}
// 删除（支持批量：RuoYi 删除接口收 ids 数组）
export function delDevice(id) {
  return request({ url: '/monitor/device/' + id, method: 'delete' })
}
```

约定：**每个业务模块一个 api 文件，函数名 listXxx/getXxx/addXxx/updateXxx/delXxx**，
路径和请求方法与后端 Controller `@RequestMapping("/monitor/device")` 对齐。

## 9.3 第二步：页面骨架（views/monitor/device/index.vue）

```vue
<template>
  <div class="app-container">
    <!-- ① 搜索区 -->
    <el-form :model="queryParams" ref="queryForm" :inline="true">
      <el-form-item label="设备名称" prop="deviceName">
        <el-input v-model="queryParams.deviceName" placeholder="请输入设备名称"
                  clearable size="small" @keyup.enter.native="handleQuery" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择" clearable size="small">
          <el-option label="在线" :value="1" />
          <el-option label="离线" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="el-icon-search" size="mini" @click="handleQuery">搜索</el-button>
        <el-button icon="el-icon-refresh" size="mini" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- ② 操作栏（带权限指令） -->
    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button v-hasPermi="['monitor:device:add']" type="primary" plain
                   icon="el-icon-plus" size="mini" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button v-hasPermi="['monitor:device:remove']" type="danger" plain
                   icon="el-icon-delete" size="mini" @click="handleDelete()">删除</el-button>
      </el-col>
    </el-row>

    <!-- ③ 表格（第7章已讲，简写） -->
    <el-table v-loading="loading" :data="deviceList">
      <el-table-column label="设备名称" prop="deviceName" />
      <el-table-column label="操作" align="center" width="140">
        <template slot-scope="scope">
          <el-button v-hasPermi="['monitor:device:edit']" type="text" size="mini"
                     @click="handleUpdate(scope.row)">编辑</el-button>
          <el-button v-hasPermi="['monitor:device:remove']" type="text" size="mini"
                     @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- ④ 分页 -->
    <pagination v-show="total > 0" :total="total"
                :page.sync="queryParams.pageNum" :limit.sync="queryParams.pageSize"
                @pagination="getList" />

    <!-- ⑤ 弹窗表单 -->
    <el-dialog :title="title" :visible.sync="open" width="500px" append-to-body destroy-on-close>
      <el-form ref="form" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="设备名称" prop="deviceName">
          <el-input v-model="form.deviceName" placeholder="请输入设备名称" />
        </el-form-item>
        <el-form-item label="设备编码" prop="deviceCode">
          <el-input v-model="form.deviceCode" placeholder="请输入设备编码" />
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button type="primary" @click="submitForm">确 定</el-button>
        <el-button @click="cancel">取 消</el-button>
      </div>
    </el-dialog>
  </div>
</template>
```

## 9.4 第三步：脚本（data + methods 全量，关注数据流）

```js
import { listDevice, getDevice, addDevice, updateDevice, delDevice } from "@/api/monitor/device"

export default {
  name: "Device",
  data() {
    return {
      loading: true,                    // 表格加载遮罩
      deviceList: [],                   // 表格数据
      total: 0,                         // 总数（分页用）
      open: false,                      // 弹窗开关
      title: "",                        // 弹窗标题
      queryParams: {                    // 查询参数（含分页）
        pageNum: 1,
        pageSize: 10,
        deviceName: undefined,
        status: undefined
      },
      form: {},                         // 表单模型
      rules: {                          // 表单校验
        deviceName: [{ required: true, message: "设备名称不能为空", trigger: "blur" }]
      }
    }
  },
  created() {
    this.getList();                     // 进入页面加载（第1章生命周期）
  },
  methods: {
    // —— 查询链路 ——
    getList() {
      this.loading = true;
      listDevice(this.queryParams).then(response => {
        this.deviceList = response.rows;
        this.total = response.total;
        this.loading = false;
      });
    },
    handleQuery() {                     // 搜索：重置页码再查（第4章套路）
      this.queryParams.pageNum = 1;
      this.getList();
    },
    resetQuery() {
      this.resetForm("queryForm");      // 全局方法：清空表单字段
      this.handleQuery();
    },
    // —— 新增/编辑链路（第7章弹窗套路） ——
    handleAdd() {
      this.reset();
      this.open = true;
      this.title = "新增设备";
    },
    handleUpdate(row) {
      this.reset();
      getDevice(row.id).then(response => {
        this.form = response.data;      // 回填
        this.open = true;
        this.title = "编辑设备";
      });
    },
    submitForm() {
      this.$refs.form.validate(valid => {
        if (!valid) return;
        if (this.form.id != null) {
          updateDevice(this.form).then(() => {
            this.$modal.msgSuccess("修改成功");
            this.open = false;
            this.getList();             // 成功刷新
          });
        } else {
          addDevice(this.form).then(() => {
            this.$modal.msgSuccess("新增成功");
            this.open = false;
            this.getList();
          });
        }
      });
    },
    // —— 删除链路（单条/批量） ——
    handleDelete(row) {
      const ids = row && row.id ? [row.id] : this.deviceList.map(d => d.id);  // 批量没选中
      this.$modal.confirm(`是否确认删除数据？`).then(() =>
        delDevice(ids.join(","))
      ).then(() => {
        this.getList();
        this.$modal.msgSuccess("删除成功");
      }).catch(() => {});
    },
    cancel() {
      this.open = false;
      this.reset();
    },
    reset() {
      this.form = { id: null, deviceName: "", deviceCode: "" };
      this.$nextTick(() => this.$refs.form && this.$refs.form.resetFields());
    }
  }
}
```

## 9.5 第四步：菜单与权限（系统管理里配置）

后端（RuoYi 项目熟，简略）：
- 菜单表（sys_menu）加"设备管理"，填写：
  - 路由地址 device、组件路径 monitor/device/index、权限标识 monitor:device:list
  - 按钮权限：新增 monitor:device:add / 修改 monitor:device:edit / 删除 monitor:device:remove
  - 菜单类型：目录/菜单/按钮 三种
- 角色分配该菜单（sys_role_menu）

前端自动生效的原因（回顾第6章）：
```
登录 → router.beforeEach 守卫 → getInfo() 拿 permissions
→ permission/generateRoutes() 用后端返回菜单生成动态路由 → 侧边栏渲染菜单
→ v-hasPermi 指令检查按钮权限
```
**所以你后端配完菜单，前端刷新登录即可出现；按钮显隐由权限标识控制。**

后端对应权限校验：

```java
// Controller 里加注解（后端兜底权限，前端只是隐藏）
@PreAuthorize("@ss.hasPermi('monitor:device:add')")
@PostMapping
public AjaxResult add(@RequestBody Device device) { ... }
```

面试讲法："权限是前后端双层：前端 v-hasPermi 控制显隐、动态路由控制菜单；
后端 @PreAuthorize 兜底校验，防止跳过前端直接调接口。"

## 9.6 第五步：联调验证清单（新页面验收标准）

```
1. 登录后菜单出现设备管理（分配了角色的账号）
2. 列表加载：进入页面自动查第一页
3. 搜索：输入名称+状态 → 搜索 → 页码重置 + 结果正确
4. 新增：弹窗 → 校验必填 → 提交 → 提示成功 → 列表刷新
5. 编辑：表格点编辑 → 回填 → 修改 → 保存 → 刷新
6. 删除：单条确认删除 → 成功；批量勾选删除
7. 权限：没有权限标识的账号看不到新增/删除按钮；直接调接口返回 403
8. 分页：切页/改条数 → 重新查询正常
```

## 9.7 新页面开发速查（照着抄的三问）

1. 数据从哪来？→ api 文件里加函数（listXxx/getXxx/addXxx/updateXxx/delXxx）
2. 页面怎么展示？→ 五段式模板：搜索+操作+表格+分页+弹窗
3. 权限怎么控？→ 菜单配权限标识 + v-hasPermi 指令 + 后端 @PreAuthorize

也可以先用 RuoYi 的**代码生成器**：后端建表 → 前端一键生成 api+页面 → 微调。

## 9.8 常见坑快查

| 坑 | 现象 | 解法 |
|----|------|------|
| 页面 404 / 刷新丢失 | 动态路由未生成 | 检查菜单的组件路径（monitor/device/index） |
| 列表一直 loading | 接口报错未处理 | 看 Network 响应；响应拦截器有统一报错 |
| 新增按钮不显示 | 权限标识没配 | 菜单里加按钮 + 角色分配 |
| 分页总条数不对 | total 没回填 | 后端返回 total 字段名对齐 |
| 弹窗校验不触发 | rules 没加 prop | el-form-item 的 prop 必须与 rules 键一致 |
| 提交 500 | 字段没传全/类型不对 | 看后端日志 + Network payload |

## 9.9 面试自测

- Q：RuoYi 前端新增一个模块要几步？★
  A：api 封装 → 页面五段式 → 菜单配权限标识 → 联调（权限前后端双层）。
- Q：前端权限怎么实现的？★★
  A：登录后 getInfo 拿 permissions → 动态路由（addRoutes）→ v-hasPermi 指令显隐按钮 → 后端 @PreAuthorize 兜底。
- Q：为什么菜单后端返回前端还能动态生成？
  A：菜单数据在 sys_menu，登录接口返回有权限的菜单树 → 前端转成路由表 → addRoutes。

## 小结

- 全链路：后端接口 → api 文件 → 五段式页面 → 菜单权限 → 联调。
- 前端增删改查的用户闭环：查询 → 弹窗新增/编辑 → 提交刷新 → 删除确认。
- 权限双层：前端显隐 + 后端兜底；动态路由来自后端菜单。
- 本章是"RuoYi 二开"的实战地图：照着五段式抄，就能加任何页面。

下一篇：第10章 Vue 面试速查与常见坑（考前 30 分钟冲刺）。