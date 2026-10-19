---
title: "Jelly Curves"
summary: "A button with a skin that wobbles toward your pointer, and four ways of drawing that skin."
date: 2026-10-19
type: component
cover: /playground/jelly-curves/cover.jpg
demo: true
demoHeight: 760
draft: true
---

Move your pointer close to the button and its outline reaches for you, then springs back when you leave. On a phone or iPad, drag your finger near it.

The wobble is the same in every version. What changes is how the outline gets drawn between the pins that do the moving:

- **Straight** joins twelve pins with straight lines, so a tug makes a sharp little tent.
- **Rounded corners** turns each corner pin into a magnet the curve bends toward without touching.
- **Smooth blob** runs a curve through every pin, so peaks become swells.
- **Circle** uses just four anchors and four curves, the closest four Béziers can get to a true circle.

Turn on "Show the anchors and handles" to watch the machinery. The sliders are the design: reach, pull, stiffness and damping decide whether it feels like jelly, rubber or syrup.

What I'd like to hear: which shape feels right for a real button, and whether the wobble is charming or just distracting.
