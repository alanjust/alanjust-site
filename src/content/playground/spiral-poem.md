---
title: "Spiral Poem"
summary: "A coil of line with a sentence wound up inside it. Trace it from the outside in and the words stand up."
date: 2026-10-21T13:00:00Z
type: experiment
cover: /playground/spiral-poem/cover.jpg
demo: true
demoHeight: 1000
demoHeightPhone: 860
draft: false
---

This one grew out of **Line to Signature**. Same idea, different shape: the line is a spiral, and wound up inside it is a sentence. Trace it with a finger or a cursor from the outside in, and the words stand up out of the line as you go, until you arrive at the center.

For now the sentence is the old typing-class standby, the one with every letter of the alphabet in it. Eventually it'll be a poem.

Unlike the signature, the words don't sink back on their own. Reading takes longer than glimpsing, so they stay up until you press **Sink it all**. Set **Linger** lower if you'd rather they slip away behind you. Leave it alone and every so often a ripple runs down the coil, or a letter peeks up and ducks back down.

The lettering comes in script or print. Both are Hershey fonts, drawn in the 1960s as single pen lines for plotting machines, which is exactly what makes them work here.

What I'd like to hear: does reading in a spiral slow you down in a good way, or just make you dizzy?

## Where this comes from

People sometimes ask whose technique this is. Mostly, it's mine. I built it with Claude, writing the code from scratch rather than starting from someone else's project. The one thing borrowed outright is the lettering.

**The letters** are the Hershey fonts, made by Dr. Allen V. Hershey, a physicist at the U.S. Naval Weapons Laboratory in Dahlgren, Virginia. He published them in 1967 in a report called *Calligraphy for Computers* so that early computers could draw text on plotters and screens. They were later distributed through the National Bureau of Standards. Every letter is a single pen line rather than an outline, and that's the only reason this works: an ordinary font has two edges to every stroke, so it can't be pulled out into one line. The digital versions used here were converted by Windell Oskay of Evil Mad Scientist Laboratories, building on earlier work by Marty McGuire and Jeff Epler, and come bundled with the free drawing program Inkscape. The font data's original format was created by James Hurt of Cognition, Inc.

**The rest is very old math.** The spiral is an Archimedean spiral, the even kind Archimedes wrote about around 225 BC. The wobble is a spring, from Robert Hooke in the 1670s. The curves are smoothed with a Catmull–Rom spline, from a 1974 paper by Edwin Catmull and Raphael Rom. Setting type along a curve is what Illustrator's Type on a Path tool does.

**What's new** is the trick it shares with **Line to Signature**: every pen stroke rests on the stretch of line directly beneath it, so the line can stand back up into lettering. I don't know of anyone who's done exactly this. Moving type is everywhere, though, so I wouldn't swear nobody has.
