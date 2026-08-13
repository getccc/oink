# Cloudflare Pages 发布配置

本站使用 Cloudflare Pages 免费计划和默认的 `pages.dev` 域名，不需要购买域名。

## Pages 项目设置

- 项目名：`yoabocc`
- Production branch：`main`
- Root directory：`yoabocc`
- Framework preset：`Hugo`
- Build command：`hugo --gc --minify`
- Build output directory：`public`
- 环境变量：`HUGO_VERSION=0.164.0`

首次连接 GitHub 仓库后，每次向 `main` 分支推送提交，Cloudflare Pages 都会自动构建并发布到：

<https://yoabocc.pages.dev/>

## 本地写作

文章放在以下目录之一：

- `yoabocc/content/blog/ai-development/`
- `yoabocc/content/blog/wealth-growth/`
- `yoabocc/content/blog/life-growth/`

创建文章示例：

```bash
cd yoabocc
hugo new blog/ai-development/my-new-post.md
```

完成后将文章头部的 `draft: true` 改为 `draft: false`（或删除该行），然后提交并推送：

```bash
git add yoabocc/content
git commit -m "content: add my new post"
git push origin main
```

## 本地预览

需要 Hugo Extended 0.160.1 或更高版本：

```bash
cd yoabocc
hugo server -D
```

访问 <http://localhost:1313/> 预览。按 `Ctrl+C` 停止。
