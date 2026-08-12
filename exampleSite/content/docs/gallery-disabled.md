---
title: Gallery with Zoom disabled
description: Gallery remains complete when page-level Image Zoom is disabled.
params:
  ui:
    image_zoom:
      enable: false
---

{{< gallery columns=2 label="Static Gallery" >}}
  {{< gallery/image src="/media/content-primitives-static.svg" alt="Static Gallery overview" caption="The first static figure remains readable without JavaScript." >}}
  {{< gallery/image src="/media/content-primitives-tall.svg" alt="Static Gallery detail" caption="The second static figure keeps its caption and author order." >}}
{{< /gallery >}}
