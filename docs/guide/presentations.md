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

## Built-in slide templates

Use the **Add slide** dropdown in the editor toolbar to choose **Title slide** (title and subtitle),
**Title only**, **Title + list**, **Title + list + image**, or **Blank slide**.
The image layout leaves the right-hand area blank for your own content.
The same layouts are also available in **Presentation → Add slide**.

Templates use your selected frame ratio, with **16:9** as the default when it is
Freeform. New slides are placed to the right of existing content and appended to
the presentation order. After insertion, the editor selects and zooms to the new
slide. Text and frames are ordinary Excalidraw elements: double-click text to edit
it, or move and resize elements freely. Undo removes the entire inserted slide
in one step. Adding templates requires edit access.

### Slide shortcuts

- **Cmd+Return** (Mac) / **Ctrl+Enter** (Windows/Linux): start playback directly
  from the canvas or presentation setup. While editing text or a selected
  line/arrow/image, Excalidraw's existing Enter behavior takes priority.

- **Shift+N**: open the Add slide menu, then use **↑ / ↓** or **K / J** and **Enter** to insert.
- **Shift+Alt+N**: repeat the last template used in this app session, including
  templates added from presentation setup. If none has been used, opens the menu.
- **Esc**: close the menu.

These shortcuts are disabled while typing in text, notes, or form fields and
while a modal dialog is open. Holding a shortcut does not insert repeated slides.

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

## Appear on click

Select an element or group **inside a frame** on the canvas. The **Appear on
click** control lets you choose **Always visible**, an existing click step, or a
new click step. Assign several selections to the same step to reveal them together.
Choose an earlier/later step to change the order, or Always visible to remove a reveal.

Groups and bound text labels appear together. Connected arrows can be assigned
separately. A text element reveals as a whole, including all its bullet points.
Selections must belong to one frame; selecting the frame itself doesn't assign
reveals. Everything remains visible while editing and in presentation setup.

During playback, **click the slide**, press **Space**, or use a forward navigation
key/button to reveal the next step. After the final reveal, advance to the next
slide. Backward navigation hides the last reveal, or returns to the previous slide
with all its content visible. Empty steps are skipped. Restarting playback resets
reveals. Assignments save with the drawing and support undo, sharing, and history.
Moving an element to a different frame resets its effective reveal to Always visible.

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
