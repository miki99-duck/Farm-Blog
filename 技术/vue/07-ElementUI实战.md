---
tags: [vue]
---

# 第7章 Element UI 实战（表格/表单/弹窗/分页的标准组合）

> 一句话讲清：**Element UI 提供现成的"组件积木"（表格、表单、弹窗、分页…）；
> RuoYi 页面的标准套路 = 搜索区 + 表格 + 分页 + 弹窗表单 + 增删改查接口。**
> 本章带你拆解"一个标准的 RuoYi 管理页面"长什么样，学会后能套模板写新页面。

## 7.1 页面骨架：RuoYi 业务页的"五段式"（背下来）

```
┌──────────────────────────────────────────┐
│ ① 搜索区（el-form inline）                  │  ← queryParams + 搜索/重置按钮
├──────────────────────────────────────────┤
│ ② 操作栏（新增/导出/批量删除按钮）             │  ← 权限指令 v-hasPermi 控制
├──────────────────────────────────────────┤
│ ③ 数据表格（el-table）                      │  ← v-for 数据 + 操作列（编辑/删除）
├──────────────────────────────────────────┤
│ ④ 分页（el-pagination）                     │  ← 页码/条数变化重新查
├──────────────────────────────────────────┤
│ ⑤ 弹窗表单（el-dialog + el-form）           │  ← 新增/编辑共用，保存后刷新
└──────────────────────────────────────────┘
```

对照你项目 `src/views/monitor/device/index.vue`，几乎就是这个模板。

## 7.2 表格 el-table：渲染 + 自定义列 + 操作列

{% raw %}
```vue
<template>
  <el-table :data="tableData" v-loading="loading" border stripe>
    <!-- ① 简单列：prop 绑字段 -->
    <el-table-column prop="deviceName" label="设备名称" min-width="120" />

    <!-- ② 自定义列：插槽拿 row（作用域插槽实战） -->
    <el-table-column label="在线状态" width="100">
      <template slot-scope="scope">
        <el-tag :type="scope.row.online ? 'success' : 'info'">
          {{ scope.row.online ? '在线' : '离线' }}
        </el-tag>
      </template>
    </el-table-column>

    <!-- ③ 格式化列：时间/枚举转换 -->
    <el-table-column label="更新时间" width="160">
      <template slot-scope="scope">
        {{ parseTime(scope.row.updateTime) }}     <!-- RuoYi 的工具函数 -->
      </template>
    </el-table-column>

    <!-- ④ 操作列：编辑/删除（宽度固定，按钮紧凑） -->
    <el-table-column label="操作" width="140" align="center">
      <template slot-scope="scope">
        <el-button size="mini" type="text" icon="el-icon-edit"
                   @click="handleUpdate(scope.row)">编辑</el-button>
        <el-button size="mini" type="text" icon="el-icon-delete"
                   @click="handleDelete(scope.row)">删除</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
```
{% endraw %}

要点：
- `scope.row` 拿当前行数据（作用域插槽带来的）；
- 操作按钮用 `size="mini" type="text"` 是 RuoYi 风格（不占空间）；
- border（边框）+ stripe（斑马纹）+ v-loading（加载遮罩）是标准配置。

## 7.3 搜索区与分页：查询参数的闭环

```vue
<!-- 搜索区（第4章见过，集中在这里） -->
<el-form :model="queryParams" ref="queryForm" :inline="true" @submit.native.prevent>
  <el-form-item label="设备名称" prop="deviceName">
    <el-input v-model="queryParams.deviceName" placeholder="请输入"
              clearable size="small" @keyup.enter.native="handleQuery" />
  </el-form-item>
  <el-form-item>
    <el-button type="primary" icon="el-icon-search" size="mini"
               @click="handleQuery">搜索</el-button>
    <el-button icon="el-icon-refresh" size="mini" @click="resetQuery">重置</el-button>
  </el-form-item>
</el-form>

<!-- 分页：RuoYi 标准块（通常抽成全局组件 Pagination） -->
<pagination
  v-show="total > 0"
  :total="total"
  :page.sync="queryParams.pageNum"
  :limit.sync="queryParams.pageSize"
  @pagination="getList" />
```

```js
// 数据流闭环：queryParams → 请求 → 回填 tableData/total → 分页同步 → 再请求
methods: {
  getList() {
    this.loading = true;
    listDevice(this.queryParams).then(response => {
      this.tableData = response.rows;       // RuoYi 后端返回 {rows:[], total}
      this.total = response.total;
      this.loading = false;
    });
  },
  handleQuery() {
    this.queryParams.pageNum = 1;           // 重置第一页（第4章套路）
    this.getList();
  },
  resetQuery() {
    this.resetForm('queryForm');            // 清空表单（RuoYi 工具：this.$refs.xxx.resetFields）
    this.handleQuery();
  }
}
```

注意 queryParams 必须包含 pageNum/pageSize（RuoYi 后端分页靠这两个参数）。

## 7.4 弹窗表单：新增/编辑复用（核心套路）

```vue
<!-- 弹窗：标题动态（新增/编辑）、关闭后销毁（destroy-on-close） -->
<el-dialog :title="title" :visible.sync="open" width="500px"
           append-to-body destroy-on-close>
  <el-form ref="form" :model="form" :rules="rules" label-width="100px">
    <el-form-item label="设备名称" prop="deviceName">
      <el-input v-model="form.deviceName" placeholder="请输入设备名称" />
    </el-form-item>
    <el-form-item label="设备编码" prop="deviceCode">
      <el-input v-model="form.deviceCode" placeholder="请输入设备编码" />
    </el-form-item>
  </el-form>
  <div slot="footer" class="dialog-footer">
    <el-button type="primary" @click="submitForm">确 定</el-button>
    <el-button @click="cancel">取 消</el-button>
  </div>
</el-dialog>
```

```js
export default {
  data() {
    return {
      open: false,                 // 弹窗开关
      title: '',                   // 弹窗标题
      form: {},                    // 表单模型（新增/编辑共用）
      rules: {                     // 校验规则（Element UI 表单校验）
        deviceName: [{ required: true, message: '设备名称不能为空', trigger: 'blur' }]
      }
    }
  },
  methods: {
    // 新增：清空表单 + 打开
    handleAdd() {
      this.reset();
      this.open = true;
      this.title = '新增设备';
    },
    // 编辑：回填数据 + 打开
    handleUpdate(row) {
      this.reset();
      getDevice(row.id).then(response => {
        this.form = response.data;
        this.open = true;
        this.title = '编辑设备';
      });
    },
    // 提交：校验 → 按有无 id 调新增/更新 → 关闭 → 刷新列表
    submitForm() {
      this.$refs.form.validate(valid => {
        if (!valid) return;
        if (this.form.id != null) {
          updateDevice(this.form).then(() => {
            this.$modal.msgSuccess('修改成功');     // RuoYi 提示工具
            this.open = false;
            this.getList();
          });
        } else {
          addDevice(this.form).then(() => {
            this.$modal.msgSuccess('新增成功');
            this.open = false;
            this.getList();
          });
        }
      });
    },
    // 删除：二次确认（MessageBox）
    handleDelete(row) {
      this.$modal.confirm('是否确认删除设备"' + row.deviceName + '"？').then(() => {
        return delDevice(row.id);
      }).then(() => {
        this.getList();
        this.$modal.msgSuccess('删除成功');
      }).catch(() => {});
    },
    reset() {
      this.form = { id: null, deviceName: '', deviceCode: '' };
      this.$nextTick(() => this.$refs.form && this.$refs.form.resetFields());
    }
  }
}
```

面试讲法："RuoYi 的新增/编辑是同一个弹窗：handleAdd 重置表单，handleUpdate 回填；
submitForm 校验后按有无 id 走 add/update，成功关闭弹窗刷新列表；删除用 MessageBox 二次确认。"

## 7.5 权限指令 v-hasPermi（RuoYi 特色）

```vue
<!-- 按钮级权限：后端返回的 permissions 里没有 "monitor:device:add" 就不渲染 -->
<el-button v-hasPermi="['monitor:device:add']" type="primary"
           @click="handleAdd">新增</el-button>

<!-- 角色级： -->
<el-button v-hasRole="['admin']" @click="special">管理员专用</el-button>
```

实现原理（面试可讲）：自定义指令（directives），mounted 时检查 store 的
permissions 集合；没有则调用 el.remove() 移除元素。

## 7.6 常用 Element 组件速查（知道有这些、用时会查就行）

| 组件 | 场景 | 关键属性 |
|------|------|---------|
| el-table | 列表展示 | :data、v-loading、自定义列 slot-scope |
| el-form | 表单校验 | :model、:rules、validate() |
| el-dialog | 弹窗 | :visible.sync、append-to-body、destroy-on-close |
| el-pagination | 分页 | :total、:page.sync、:limit.sync |
| el-select / el-option | 下拉选择 | v-model、el-option :key :label :value |
| el-date-picker | 日期范围 | value-format="yyyy-MM-dd" |
| el-tag | 状态标签 | :type success/info/warning/danger |
| el-message / MessageBox | 提示/确认 | $message.success / $msgbox.confirm |
| el-tree | 树（菜单/部门） | :data、node-key、@node-click |
| el-tabs | 页签 | v-model、el-tab-pane |

RuoYi 二次封装（你会在项目里看到）：$modal（确认/提示）、$download、
Pagination 全局组件、DictTag 字典标签、RightToolbar 等——**先学会用原生的，再认识封装**。

## 7.7 常见坑快查

| 坑 | 现象 | 解法 |
|----|------|------|
| 表格数据不更新 | 改的是响应式边界字段 | $set 或整体替换 this.tableData=[...] |
| 弹窗表单校验残留 | 二次打开还报错 | destroy-on-close + resetFields |
| 分页点不动 | .sync 没写 | :page.sync :limit.sync |
| 后端返回结构对不上 | rows/total 名不同 | 对齐后端 { code, rows, total, msg } |
| 时间显示一串数字 | 没格式化 | parseTime(工具) 或 value-format |
| 弹窗在 table 里被遮挡 | 层级问题 | append-to-body |

## 7.8 面试自测

- Q：el-table 自定义列怎么拿 row 数据？
  A：作用域插槽 `<template slot-scope="scope">`，scope.row 是当前行。
- Q：新增/编辑复用弹窗怎么设计？★
  A：同一 dialog + form；编辑先查详情回填；提交按 id 有无分 add/update；成功刷新列表。
- Q：表单校验流程？
  A：rules 规则 + this.$refs.form.validate(valid => ...)；不过校验不提交。
- Q：分页参数怎么和查询联动？
  A：queryParams 里 pageNum/pageSize，分页事件 .sync 同步后再 getList。
- Q：v-hasPermi 原理？
  A：自定义指令检查 store 的 permissions，没有就移除元素。

## 小结

- RuoYi 页面五段式：搜索 → 操作栏 → 表格 → 分页 → 弹窗表单。
- el-table 自定义列（slot-scope）、弹窗复用（reset/回填/校验/刷新）是套路核心。
- 权限指令 v-hasPermi/role 做按钮级控制。
- 面试手写/面试问：拿到"给设备加增删改查页面"的需求能讲出完整套路。

下一篇：第8章 Vue3 组合式 API 对比（面试与迁移的必答题）。