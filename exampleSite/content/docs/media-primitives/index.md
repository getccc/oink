---
title: Media primitives
description: Regression fixtures for shared image resolution and imgproc compatibility.
outputs: [HTML, markdown]
weight: 31
resources:
  - src: page.png
    params:
      alt: Page resource metadata alternative
      byline: OINK fixture byline
---

## Named page resource

{{< imgproc src="page.png" command="Fit" options="48x32" alt="Blue and gold page-resource test pattern" >}}
A **page resource** caption with `inline code`.
{{< /imgproc >}}

## Named global resource

{{< imgproc src="media/content-primitives-global.png" command="Resize" options="32x" alt="Green and violet global-resource test pattern" >}}
A global asset caption.
{{< /imgproc >}}

## Explicit decorative image

{{< imgproc src="page.png" command="Crop" options="24x24" decorative=true >}}{{< /imgproc >}}

## Legacy positional form

{{< imgproc "page" Fill "40x24" >}}
Legacy **caption** retains resource metadata for alternative text and byline.
{{< /imgproc >}}
