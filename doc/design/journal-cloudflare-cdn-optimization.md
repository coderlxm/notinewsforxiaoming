# Journal Cloudflare CDN 优化备忘

状态：待评估  
日期：2026-07-25  
范围：`feeds.xmcloud.buzz` 的公开页面、静态资源、公开媒体、公开 API 与订阅源  
目标：在不破坏私有内容隔离和即时发布体验的前提下，进一步利用 Cloudflare 边缘缓存

## 1. 当前事实

`feeds.xmcloud.buzz` 已经过 Cloudflare 代理。当前线上响应具有以下特征：

- HTML、JS 和 CSS 均由 Cloudflare 接入；
- 支持 HTTP/2 和 HTTP/3；
- 首页 HTML 的 `cf-cache-status` 为 `DYNAMIC`；
- 带内容哈希的 `/assets/*` 资源设置了约 4 小时公共缓存；
- 首次访问静态资源时可能显示 `MISS`，后续请求具备边缘缓存条件；
- Journal 应用对 HTML 设置 `Cache-Control: no-cache`；
- 公开媒体和预览图设置 `Cache-Control: public, no-cache`；
- 私有页面、私有 API 和私有媒体设置或覆盖为 `private, no-store`。

当前访问已经获得 Cloudflare 在连接、TLS、HTTP/2、HTTP/3 和部分静态资源缓存方面的收益，但公开媒体和公开数据仍会频繁回源。

## 2. 优化优先级

### 2.1 第一优先级：长期缓存哈希静态资源

Vite 产出的 JS 和 CSS 文件名包含内容哈希，例如：

```text
/assets/index-zGIwL5f5.js
/assets/index-Ct2aF2ix.css
```

内容变化时文件名也会变化，因此旧 URL 可以安全地作为不可变资源长期缓存。后续可考虑为 `/assets/*` 设置：

```text
Cache-Control: public, max-age=31536000, immutable
```

预期收益：

- 回访和跨页面加载更快；
- Cloudflare 边缘节点可以长期复用同一构建产物；
- 减少源站静态文件请求；
- 不影响新版本发布，新 HTML 会引用新的哈希文件名。

这是当前风险最低、实现边界最清晰的优化。

### 2.2 第二优先级：缓存公开媒体和预览图

图片、视频和预览图通常比 HTML、JSON 更大，边缘缓存的潜在收益最高。当前公开 `/media/*` 使用 `public, no-cache`，浏览器和 Cloudflare 可以保存副本，但通常仍需向源站重新确认。

不能直接对整个 `/media/*` 设置长期公共缓存，因为同一资产可能从公开转为私有。若公开副本仍留在 Cloudflare 边缘节点，私有化后可能继续通过原 URL 获取，破坏现有可见性语义。

实施前必须先选择一种明确机制：

- 公开转私有、替换或删除媒体时，主动清除对应 Cloudflare 缓存；
- 或将公开媒体改为不可变且与私有访问分离的 URL，状态变化后旧公开 URL 不再有效；
- 或只给公开预览图设置较短且可接受的缓存窗口，并明确接受该窗口内的可见性延迟。

在缓存失效机制确定前，不应通过 Cloudflare Cache Rule 强制覆盖所有 `/media/*` 的源站缓存头。

### 2.3 第三优先级：短时间缓存公开 API 与订阅源

可评估的公开端点包括：

```text
/api/feed
/api/entries/:publicId
/rss.xml
/feed.json
```

可考虑使用几十秒至几分钟的边缘缓存，降低 SQLite 查询和源站动态响应次数。

需要先确认是否接受以下行为：

- 新发布内容不会立即出现在所有边缘节点；
- 删除或公开转私有后，旧响应可能在缓存窗口内短暂存在；
- 标签筛选、游标分页和详情 URL 会产生不同缓存键；
- 登录 Cookie 和管理端请求绝不能进入共享缓存。

当前 Journal 强调发布、删除和可见性切换立即生效。在没有主动失效机制前，这项优化优先级低于哈希静态资源。

### 2.4 暂不优化：首页 HTML

首页 HTML 只是 Vue 应用入口，体积较小，实际内容由 API 加载。保持 `no-cache` 有两个直接价值：

- 每次部署后立即取得引用新哈希资源的 HTML；
- 避免边缘节点继续返回旧应用入口。

缓存首页 HTML 的收益有限，目前没有必要改变。

## 3. 明确禁止共享缓存的范围

以下内容必须继续保持 `private, no-store`，不能被 Cloudflare Cache Rule 覆盖：

```text
/me
/me/*
/api/me
/api/me/*
/api/auth
/api/auth/*
/api/internal
/api/internal/*
任何需要管理员 Cookie 才能访问的媒体
```

Cloudflare 规则如按宽泛路径或“缓存所有内容”配置，可能覆盖应用的源站缓存语义。实施任何公开内容缓存前，应先固定上述排除范围。

## 4. 推荐实施顺序

后续若决定优化，建议拆成独立小步骤：

1. 只调整 `/assets/*` 的长期不可变缓存；
2. 单独设计公开媒体的 URL 与缓存失效机制；
3. 根据实际源站压力决定是否缓存公开 API、RSS 和 JSON Feed；
4. 继续保持 HTML、管理端和私有内容现状。

不要一次性启用全站 Cache Everything，也不要把公开与私有媒体合并到同一条长期缓存规则。

## 5. 当前结论

当前性能已经足够好，暂无必须立即处理的瓶颈。

最适合下一步实施的是 `/assets/*` 长期不可变缓存。公开媒体具有更大潜在收益，但必须先解决公开转私有、删除与替换后的边缘缓存失效问题。公开 API 和订阅源缓存应以真实访问量或源站压力为依据，不为理论性能提前增加复杂度。
