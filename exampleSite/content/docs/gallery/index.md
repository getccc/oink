---
title: Gallery
description: Regression fixtures for a static-first responsive image Gallery.
outputs: [HTML, markdown]
params:
  ui:
    image_zoom:
      enable: true
---

{{< gallery columns=4 label="Console screenshots and architecture views" >}}
  {{< gallery/image src="page.png" alt="Blue and gold local dashboard overview" caption="Local page resource with intrinsic dimensions." >}}
  {{< gallery/image src="media/content-primitives-global.png" alt="Green and violet global dashboard detail" caption="A deliberately long caption that must wrap inside its own card without widening the page or covering the neighboring image." >}}
  {{< gallery/image src="/media/content-primitives-tall.svg" alt="Tall static SVG settings overview" caption="واجهة إعدادات عربية طويلة لاختبار الالتفاف والاتجاه التلقائي" >}}
  {{< gallery/image src="https://example.invalid/gallery/remote.webp?view=full" alt="Remote deployment history view" caption="远程图片保持静态 URL，构建过程不会下载它。" >}}
{{< /gallery >}}
