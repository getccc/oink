---
title: Image Zoom
description: Regression fixtures for opt-in native image preview.
outputs: [HTML, markdown]
weight: 32
---

## Standalone Markdown image

![Blue and gold standalone preview](/media/content-primitives-static.svg)

## Processed image with a long caption

{{< imgproc src="media/content-primitives-global.png" command="Resize" options="56x" alt="Green and violet processed preview" >}}
This intentionally long caption verifies that the shared preview remains readable on narrow screens, preserves its accessible image name, and wraps without introducing page-level horizontal overflow.
{{< /imgproc >}}

## Legacy image without alternative metadata

{{< imgproc "legacy-empty" Fit "48x32" >}}
Legacy content without resource alt metadata remains previewable because its standalone caption still supplies visible context.
{{< /imgproc >}}

## Linked image exclusion

[![Linked image remains a link](/media/content-primitives-static.svg)](/docs/)
