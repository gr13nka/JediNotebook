# Task Selection swipe sorting

This note documents the Task Selection swipe interaction for engineers changing
the task triage flow. After reading it, you should be able to adjust the
gesture thresholds, add another action, or change the desktop preference without
breaking task box or project ordering.

## Purpose

Task Selection is the place where a user triages project tasks into time boxes.
The swipe interaction makes that triage fast on phones while keeping the
existing desktop controls available for mouse users.

The screen supports two gestures:

- Swipe right to reveal Today and Week. A full right swipe moves the task to
  Today.
- Swipe left to reveal Project and Later. A full left swipe moves the task to
  Later.

The Project action is intentionally explicit. It opens a bottom sheet and moves
the task only after the user chooses a target project.

## Availability

Swipe is always enabled on mobile-width screens. Desktop swipe is opt-in through
the Tasks settings section because horizontal gestures are useful on touchpads
but awkward for many mouse users.

The desktop preference is device-local. It belongs with other installation
preferences and must not be exported through vault sync.

When desktop swipe is disabled, rows keep the older inline quick-move buttons.
When swipe is enabled, those inline buttons are replaced by the hidden action
rails so there is a single primary move surface.

## Gesture contract

The row body handles horizontal pointer movement and horizontal wheel movement.
Vertical movement remains page scrolling. A plain click on a non-interactive
part of the row opens title editing and visually lifts the row. Interactive
descendants such as checkboxes, text editors, menu targets, and the drag handle
do not start a swipe or title edit.

Gestures resolve to one of three outcomes:

- short movement snaps the row closed
- medium movement parks the row open on the matching action rail
- full movement animates the row offscreen and commits the default action

The pure swipe resolver owns the reveal and commit thresholds. Keep threshold
changes there so tests can describe the behavior without mounting React.

## Data rules

Moving to a time box appends the task to that box order. Moving to the current
box is a no-op, so a full swipe on a task already in Today or Later does not
silently bump its order.

Moving to another project changes only project membership and per-project task
order. The task keeps its current time box, box order, completion state,
recurrence fields, and scheduled date. The target project's task order is append
only.

All task writes go through the repository update helpers so updated timestamps
and vault sync hooks continue to work.

## Interaction with reorder

Task row reorder still uses HTML drag and drop, but the draggable source is the
handle, not the whole row. This prevents horizontal swipes from fighting row
reorder. Project section reorder is unchanged.

Grouped task reorder is still gated by the existing rule: it is only meaningful
when the full task set is visible. Filtered box tabs do not persist reorder
changes over hidden rows.

## Verification

Before changing this flow, run the normal test suite and production build. The
test suite includes pure swipe-resolution coverage for short drags, reveal
drags, commit drags, and clamping.

Manual checks should cover:

- mobile swipe with vertical page scrolling
- desktop with swipe disabled
- desktop with swipe enabled
- project picker move to another active project
- completion, single-click rename, context menu, delete, and reorder on rows
