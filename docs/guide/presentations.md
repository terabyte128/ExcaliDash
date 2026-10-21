---
title: Frame presentations
description: Present your Excalidraw frames as fullscreen slides with saved speaker notes.
---

# Frame presentations

1. Open a drawing and use the **Frame tool** (`F`) to frame each slide. Frame
   names become slide titles; frames can have different sizes and aspect ratios.
2. Choose **Presentation** in the editor toolbar or canvas menu.
3. Select a slide to preview it and add **Speaker notes**. Use the up/down
   buttons to change slide order without changing the canvas stacking order.
4. Click **Present** to start at the selected slide in fullscreen. If your
   browser blocks fullscreen, playback continues in the current window.

## Frame ratio prototype

Select the native **Frame tool** (`F`) to show the **New frame ratio** control
near the bottom of the canvas. Choose **16:9**, **4:3**, **1:1**, or **Freeform**.
The selection is remembered in this browser.

When a ratio is selected, a dashed outline previews the final frame while you
drag. Releasing expands the frame to that outline, preserving everything inside
your dragged rectangle. Alt-dragging keeps the frame centered. Hold **Shift** to
bypass the ratio preference and use Excalidraw's native square constraint.
This applies to newly drawn frames; resizing existing frames remains native.

The prototype uses the public pointer-up callback and element mutation helper;
it relies on Excalidraw 0.18.1 calling that callback before frame-child assignment
and the history commit. The browser regression test covers this ordering, undo,
redo, and peer delivery, and should be run when upgrading Excalidraw.

## Playback controls

- **Right / Down / Page Down / Space**: next slide.
- **Left / Up / Page Up**: previous slide.
- **Home / End**: first / last slide.
- **N** or the notes button: show or hide notes.
- **Escape** or the exit button: return to presentation setup.

Navigation buttons also work with a mouse or touch screen. Slides fit the
available screen while preserving their aspect ratio and clipping to the frame.
Slides use vector rendering for crisp text and shapes at any screen resolution.
Playback controls overlay the slide and disappear after two seconds of inactivity;
move the pointer, touch the screen, or press Tab to reveal them. Frames with a
different aspect ratio from the screen retain letterboxing to avoid cropping.
Playback displays rendered slides, so embedded websites and videos are not interactive.

Notes are hidden when playback starts. Showing notes displays them **on the same
screen as the slide**; this is not a separate private presenter window.

## Saving and sharing

Slide order and notes autosave with the drawing. They are included in drawing
exports, collaboration, and version history. Anyone with access to the drawing
can read the notes and present it; editing notes or order requires edit access.

New frames appear after explicitly ordered slides. Deleted frames are omitted.
Playback takes a snapshot when it starts so collaborators' edits cannot disrupt
your presentation. Exit and start again to present updated content.
