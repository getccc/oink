# yoabocc

一个围绕 **AI 发展、财富增长、人生成长** 的中文个人博客。

线上地址：<https://yoabocc.pages.dev/>

## 写作目录

博客站点根目录是 `yoabocc/`，Markdown 文章按主题放在：

```text
yoabocc/content/blog/
├── ai-development/     # AI 发展
├── wealth-growth/      # 财富增长
└── life-growth/        # 人生成长
```

创建新文章：

```bash
cd yoabocc
hugo new blog/ai-development/my-new-post.md
hugo server -D
```

## 自动发布

`main` 分支已连接 Cloudflare Pages。推送 Markdown 或主题变更后会自动构建发布：

```bash
git add yoabocc/content
git commit -m "content: add a new post"
git push origin main
```

完整的 Cloudflare 构建参数见 [CLOUDFLARE_PAGES.md](CLOUDFLARE_PAGES.md)。

## 技术栈

- [Hugo Extended](https://gohugo.io/) 0.160.1+
- [OINK](https://github.com/pgsty/oink) 主题（本仓库为其 fork）
- Cloudflare Pages 免费计划与默认 `pages.dev` 域名

主题及其衍生代码继续遵循仓库中的 [Apache 2.0 License](LICENSE) 与 [NOTICE](NOTICE)。
