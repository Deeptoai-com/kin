# 任务：三档权限模式选择器 UI 打磨

> 任务来源：PR-B（已合并到 main）  
> 日期：2026-06-01  
> 优先级：中  
> 负责人：前端工程师（C 或 D）

---

## 背景

PR-B 已实现三档权限模式的**完整后端逻辑**（tier → SDK 模式映射、ws-server 透传、store 状态管理），并提供了一个**基础可用的选择器组件**。

当前实现功能正确但 UI 比较简陋，需要前端同学按照现有设计语言做打磨。

---

## 当前实现位置

| 文件 | 说明 |
|---|---|
| `src/components/claude-chat/permission-tier-selector.tsx` | 选择器组件（需打磨） |
| `src/lib/permission-tier.js` | 三档数据定义（**不要动**，后端共用） |
| `src/components/claude-chat/chat-composer.tsx` | 挂载点（`PermissionBadge` 旁边） |

---

## 三档定义（不变）

| 档位 | 图标 | 标签 | 副标签 | 说明文案 |
|---|---|---|---|---|
| `explore` | 🔍 SearchIcon | Explore | 探索 | 只读 · 出方案 · 不改文件 · 不跑脚本 |
| `auto` | ⚡ ZapIcon | Auto | 默认 | 自动编辑 · 危险才问 · 可跑脚本（沙箱） |
| `act` | 🚀 RocketIcon | Act | 执行 | 放手干 · 少打断 · 含沙箱 Bash |

**默认选中：`act`（执行档）**

---

## UI 设计要求

### 触发器（底部工具栏按钮）
- 位置：输入框底部工具栏，紧贴现有 `PermissionBadge` 徽章左侧
- 样式：与 PermissionBadge 一致的圆角胶囊形态
- 显示：当前档位的图标 + 标签 + 向下箭头（`ChevronDownIcon`）
- 颜色参考：
  - Explore：`text-muted-foreground / bg-muted`（低调灰）
  - Auto：`text-success / bg-success/10`（绿色，"安全默认"）
  - Act：`text-primary / bg-primary/10`（主色，"全力执行"）
- 运行中（`isRunning=true`）时隐藏（与 PermissionBadge 一致）

### 下拉面板
- 从触发器往上弹出（`bottom-full`），不遮挡输入框
- 三个选项竖排，每项包含：图标 + 标签 + 副标签 + 一行描述文案
- 当前选中项右侧显示 `CheckIcon`（绿色）
- 悬停高亮：`hover:bg-accent`
- 点击外部或按 Esc 关闭
- 面板宽度：`w-64` 左右，和现有弹出层统一

### 参考样式
- 对标 Coze 输入框底部的 Auto 模式下拉
- 与现有 `ContextBadges`、`SessionInfoPanel` 等弹出层保持一致的 `bg-popover border-border rounded-lg shadow-lg` 风格

---

## 技术注意事项

1. **`permission-tier.js` 是前后端共用的纯 ESM 模块，不要改**。只改 `.tsx` 组件。
2. **`PERMISSION_TIERS` 数组**（`['explore', 'auto', 'act']`）从 `~/lib/permission-tier` 导入，不要在组件里硬编码档位列表。
3. **所有档位对用户始终可选**（无锁定），后端负责安全边界，UI 不需要禁用任何选项。
4. **store 和 ws-adapter 已接好**，组件只需 `onSelect(tier)` 回调，不需要动其他文件。
5. 测试：切换档位 → 发一条消息 → 看 ws-server 日志出现 `Permission tier: explore/auto/act → mode=plan/acceptEdits` 即可确认链路通。

---

## 验收标准

- [ ] 三档外观符合设计语言，与工具栏其他元素协调
- [ ] 默认显示 Act（执行）
- [ ] 切换流畅，下拉开关/关闭行为正常
- [ ] 运行中隐藏（与 PermissionBadge 一致）
- [ ] 切换后发消息，后端日志确认档位生效
- [ ] 移动端/窄屏不溢出（响应式）

