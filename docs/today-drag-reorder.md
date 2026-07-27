# Today drag reorder

This note documents the Today screen's card reorder interaction for engineers
changing the task list. After reading it, you should be able to adjust the
gesture, hit targets, or ordering rules without breaking task completion,
editing, or scrolling.

## Purpose

Today is a short execution list, so manual order should feel direct. The user
drags the card itself instead of clicking step buttons or aiming at insertion
lines. While a card is dragged, the other cards move out of the way and the
order is committed when the pointer is released.

The interaction exists in both normal Today and Focus mode. Focus mode uses its
own scroll container; normal Today scrolls the page.

## Gesture contract

Only incomplete tasks are reorderable. Completed tasks are shown in their own
section and are never drag sources.

Mouse and pen start a reorder after a small movement from a non-interactive
part of the card. Touch starts after a short hold, so a normal vertical swipe on
the list remains page scrolling.

Dragging near the top or bottom edge auto-scrolls the active scroll container.
The drag uses pointer events rather than native HTML drag and drop because the
app runs in mobile WebViews where native DnD is inconsistent.

## Interactive targets

The completion button, title text, and inline title editor do not start a card
drag. Keep those areas excluded from drag start so completion and editing remain
reliable.

During an active drag, text selection is disabled at the document level and the
current selection is cleared. Restore the previous selection styles when the
drag ends or is cancelled.

Click suppression must be narrow and one-shot. It exists only to absorb the
synthetic click after an actual drag; it must not swallow later clicks on the
completion button or title.

## Data rules

Reorder commits only the incomplete task ids in their new visual order.
Completed task ids are appended after them in their existing order before the
box order is persisted.

If the live task query changes while a drag is active and the active task
disappears or becomes completed, cancel the drag and sync back to the live
order. If other tasks are added or removed during a drag, reconcile the local
visual order with the live ids before committing.

## Verification

Before changing this flow, run the normal test suite and production build.

Manual checks should cover:

- normal Today drag up and down
- Focus mode drag and auto-scroll
- completion button before and after a drag
- title click and inline edit
- dragging over text without selecting it
- touch scrolling without a long press
- touch long-press drag
- completed tasks staying outside the reorderable list
