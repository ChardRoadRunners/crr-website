---
title: Build alert test - delete me
races:
  - name: Build alert test
    raceDate: 2026-09-24
dateApproximate: false
category: Race Report
clubRace: false
heroImage: ./images/this-file-does-not-exist.webp
heroImageAlt: Deliberately broken image reference, used to test the build alert
excerpt: Deliberate build break, testing the failure alert. Delete this file.
draft: true
---

This post exists only to make the build fail, so the build-check workflow can be
tested end to end: the issue opening, the email arriving, and the issue closing
itself when this file is removed.

It is `draft: true`, so even if it did build it would not appear on the site.
