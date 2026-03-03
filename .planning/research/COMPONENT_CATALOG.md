# UI Component Catalog

**Project:** web_timer productivity app
**Cataloged:** 2026-03-03
**Total components:** 89 files across 17 directories
**Framework:** React 19 + TypeScript 5.7 + Tailwind CSS 4 + Motion + Zustand 5

---

## 1. Reusable Primitives (`components/ui/`)

### Button
- **File:** `client/src/components/ui/Button.tsx`
- **Props:** `ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>` -- `variant?: 'primary' | 'secondary' | 'ghost' | 'danger'`, `size?: 'sm' | 'md' | 'lg'`
- **Shadows:** `NEU.raisedSm` (primary, secondary, danger), none (ghost)
- **Animations:** None (CSS transition-colors only)
- **Hooks/stores:** None
- **Used by:** `ActivityList`, `ActivityForm`, `ManualEntry`, `SyncSettings`, `VaultSettings`, `HabitList`, `ConfirmDialog`, `SettingsPage`

### Card
- **File:** `client/src/components/ui/Card.tsx`
- **Props:** `{ children: React.ReactNode, className?: string, onClick?: () => void }`
- **Shadows:** `NEU.raised`
- **Animations:** Motion -- `whileHover: { y: -6 }` (if onClick), `whileTap: { scale: 0.94 }` (if onClick), spring `stiffness: 400, damping: 25`
- **Hooks/stores:** None
- **Used by:** `SettingsPage` (wraps each settings section), `InboxView` (sort mode cards)

### Modal
- **File:** `client/src/components/ui/Modal.tsx`
- **Props:** `{ open: boolean, onClose: () => void, title: string, children: React.ReactNode }`
- **Shadows:** `NEU.pressedDeep` (backdrop), `NEU.modal` (dialog)
- **Animations:** Motion AnimatePresence -- backdrop: opacity 0->1 (0.2s). Dialog: `opacity: 0, scale: 0.95, y: 10` -> `1, 1, 0`, spring `stiffness: 400, damping: 30`
- **Hooks/stores:** None (manages body scroll lock via useEffect)
- **Used by:** `ActivityForm`, `ManualEntry`, `AddHabitModal`, `PresetFormModal`, `ConfirmModal`, `ConfirmDialog`, `ProcrastinationConfirmModal`, `HomePage` (pomodoro modal), `NoteEditor`, `PdfViewer`, `AddProjectModal`, `AddFolderModal`

### Input
- **File:** `client/src/components/ui/Input.tsx`
- **Props:** `InputProps extends React.InputHTMLAttributes<HTMLInputElement>` -- `label?: string`
- **Shadows:** `NEU.pressed`
- **Animations:** None (CSS transition-colors)
- **Hooks/stores:** None
- **Used by:** `ManualEntry`, `ActivityForm`, `SyncSettings`

### Toggle
- **File:** `client/src/components/ui/Toggle.tsx`
- **Props:** `{ checked: boolean, onChange: (checked: boolean) => void, label?: string }`
- **Shadows:** `NEU.pressedSm` (track), `NEU.raisedSm` (thumb)
- **Animations:** Motion -- thumb `animate: { x: checked ? 24 : 4 }`, spring `stiffness: 500, damping: 30`
- **Hooks/stores:** None
- **Used by:** `SyncSettings`, `TimerNotificationSettings`, `GamificationSettings`

### ConfirmModal
- **File:** `client/src/components/ui/ConfirmModal.tsx`
- **Props:** `{ open: boolean, onClose: () => void, onConfirm: () => void, title: string, message: string }`
- **Shadows:** `NEU.raisedSm` (both buttons) -- inherits Modal shadows
- **Animations:** Inherited from Modal
- **Hooks/stores:** `useTranslation`
- **Used by:** `ProjectsView` (project delete confirm)

### ConfirmDialog
- **File:** `client/src/components/ui/ConfirmDialog.tsx`
- **Props:** `{ open: boolean, onClose: () => void, onConfirm: () => void, title: string, message: string }`
- **Shadows:** Inherited from Modal (via Button variants)
- **Animations:** Inherited from Modal
- **Hooks/stores:** `useTranslation`
- **Used by:** `ActivityList` (activity delete confirm)

### ContextMenu
- **File:** `client/src/components/ui/ContextMenu.tsx`
- **Props:** `{ items: ContextMenuItem[], position: { x: number, y: number } | null, onClose: () => void }` where `ContextMenuItem = { label: string, onClick: () => void, danger?: boolean }`
- **Shadows:** `NEU.modal`
- **Animations:** Motion AnimatePresence -- `scale: 0.95->1, opacity: 0->1` (0.1s)
- **Hooks/stores:** None (useLayoutEffect for viewport adjustment)
- **Used by:** `SelectableTaskRow`, navigation components (Sidebar, BottomNav, DesktopBottomNav, DropdownNav for tab management)

### InfoTooltip
- **File:** `client/src/components/ui/InfoTooltip.tsx`
- **Props:** `{ text: string }`
- **Shadows:** `NEU.raisedSm` (button), `NEU.tooltipSm` (tooltip)
- **Animations:** Motion AnimatePresence -- `opacity: 0, y: 4` -> `1, 0` (0.15s), auto-positions above/below
- **Hooks/stores:** None
- **Used by:** `TaskSelectionView`

### RotaryDial
- **File:** `client/src/components/ui/RotaryDial.tsx`
- **Props:** `{ value: number, onChange: (minutes: number) => void }`
- **Shadows:** None
- **Animations:** Motion -- indicator circle `animate: { cx, cy }`, spring `stiffness: 400, damping: 30`. SVG arc with 9 presets (30min-8hr). Supports pointer drag, scroll wheel, keyboard number input.
- **Hooks/stores:** `useThemeColors`
- **Used by:** `ActivityForm`

### ProcrastinationConfirmModal
- **File:** `client/src/components/ui/ProcrastinationConfirmModal.tsx`
- **Props:** `{ open: boolean, onClose: () => void, onConfirm: () => void }`
- **Shadows:** `NEU.raisedSm` (both buttons), `NEU.pressedSm` (disabled confirm) -- inherits Modal shadows
- **Animations:** Inherited from Modal. 5-second countdown timer disables confirm button.
- **Hooks/stores:** `useTranslation`
- **Used by:** `TodayTaskCard`, `SelectableTaskRow`

### VaultSetupModal
- **File:** `client/src/components/ui/VaultSetupModal.tsx`
- **Props:** None (top-level)
- **Shadows:** `NEU.modal`, `NEU.raisedSm` (button)
- **Animations:** Motion -- `opacity: 0, scale: 0.95, y: 10` -> `1, 1, 0`, spring `stiffness: 400, damping: 30`
- **Hooks/stores:** `useSettingsStore`, `useTranslation`
- **Used by:** `AppShell` (conditional, Tauri desktop only)

---

## 2. Feature Components

### Activities (`components/activities/`)

#### ActivityCard
- **File:** `client/src/components/activities/ActivityCard.tsx`
- **Props:** `{ activity: Activity, elapsedSeconds: number, liveElapsed: number, isActive: boolean, onToggle: () => void, onEdit?: () => void, onDelete?: () => void, onLongPress?: () => void }`
- **Shadows:** Active: `NEU.pressed` + inset border. Inactive: `NEU.raised`
- **Animations:** Motion -- `whileHover: { y: -6 }`, `whileTap: { scale: 0.93 }`, spring `stiffness: 400, damping: 25`. CSS `breathe` animation on live indicator dot.
- **Hooks/stores:** `useTranslation`
- **Used by:** `ActivityList`

#### ActivityForm
- **File:** `client/src/components/activities/ActivityForm.tsx`
- **Props:** `{ open: boolean, onClose: () => void, onSubmit: (name: string, budgetMinutes: number, color: string) => void, usedColors?: string[], initialName?: string, initialBudget?: number, initialColor?: string, title?: string }`
- **Shadows:** `NEU.raisedSm` (color buttons)
- **Animations:** Motion -- color button `animate: { scale: selected ? 1.15 : 1 }`, spring `stiffness: 400, damping: 25`, `whileTap: { scale: 0.9 }`
- **Hooks/stores:** `useTranslation`
- **Uses:** `Modal`, `Input`, `Button`, `RotaryDial`
- **Used by:** `ActivityList`

#### ActivityList
- **File:** `client/src/components/activities/ActivityList.tsx`
- **Props:** None (top-level feature component)
- **Shadows:** `NEU.raised` (empty state icon)
- **Animations:** Motion stagger -- container `staggerChildren: 0.05`, items `opacity: 0, y: 12, scale: 0.98` -> `1, 0, 1`
- **Hooks/stores:** `useActivities`, `useTimeEntries`, `useTimer`, `useTranslation`
- **Uses:** `ActivityCard`, `ActivityForm`, `ConfirmDialog`, `Button`
- **Used by:** `HomePage`

#### ActivityMenu
- **File:** `client/src/components/activities/ActivityMenu.tsx`
- **Props:** `{ onEdit: () => void, onDelete: () => void }`
- **Shadows:** `NEU.raisedSm` (trigger), `NEU.modal` (dropdown)
- **Animations:** None (CSS transitions)
- **Hooks/stores:** `useTranslation`
- **Used by:** `ActivityCard`

### Timer (`components/timer/`)

#### TimerDisplay
- **File:** `client/src/components/timer/TimerDisplay.tsx`
- **Props:** None
- **Shadows:** `NEU.pressed` + inset colored border
- **Animations:** Motion AnimatePresence -- `opacity: 0, y: -10, scale: 0.98` -> `1, 0, 1`, spring `stiffness: 400, damping: 30`
- **Hooks/stores:** `useTimerStore`, `useActivities`
- **Used by:** `HomePage`, `TodayPage`

#### ManualEntry
- **File:** `client/src/components/timer/ManualEntry.tsx`
- **Props:** `{ open: boolean, onClose: () => void, activities: Activity[], onSubmit: (activityId: string, durationSeconds: number) => void }`
- **Shadows:** `NEU.pressed` (select)
- **Animations:** Inherited from Modal
- **Hooks/stores:** `useTranslation`
- **Uses:** `Modal`, `Input`, `Button`
- **Used by:** `ActivityList` (via form action)

### Pomodoro (`components/pomodoro/`)

#### PomodoroTimer
- **File:** `client/src/components/pomodoro/PomodoroTimer.tsx`
- **Props:** `{ embedded?: boolean }`
- **Shadows:** `NEU.raised`, `NEU.raisedSm`, `NEU.pressed`, `NEU.pressedSm`
- **Animations:** Motion spring animations for circular timer, phase transitions
- **Hooks/stores:** `usePomodoroStore`, `useActivities`, `useTranslation`
- **Uses:** `PresetSelector`
- **Used by:** `HomePage` (inside Modal)

#### PresetSelector
- **File:** `client/src/components/pomodoro/PresetSelector.tsx`
- **Props:** Preset selection interface
- **Shadows:** `NEU.raisedSm`, `NEU.pressedSm`
- **Hooks/stores:** `usePomodoroStore`, `usePomodoroPresets`, `useTranslation`
- **Uses:** `PresetFormModal`
- **Used by:** `PomodoroTimer`

#### PresetFormModal
- **File:** `client/src/components/pomodoro/PresetFormModal.tsx`
- **Props:** Modal for create/edit preset
- **Shadows:** Inherited from Modal
- **Hooks/stores:** `useTranslation`
- **Uses:** `Modal`, `Input`, `Button`
- **Used by:** `PresetSelector`

### Fatigue (`components/fatigue/`)

#### FatigueCheck
- **File:** `client/src/components/fatigue/FatigueCheck.tsx`
- **Props:** `{ open: boolean, onClose: () => void }`
- **Shadows:** `NEU.raisedSm`, `NEU.pressedSm`
- **Animations:** Motion AnimatePresence for question transitions
- **Hooks/stores:** `useTranslation`
- **Uses:** `Modal`
- **Used by:** `HomePage`

### Habits (`components/habits/`)

#### HabitCard
- **File:** `client/src/components/habits/HabitCard.tsx`
- **Props:** `{ habit: Habit, entries: HabitEntry[], weekDates: string[], today: string, streak: number, onToggle: (habitId: string, date: string) => void, onLog: (habitId: string, date: string, value: number) => void, onDelete: (id: string) => void }`
- **Shadows:** `NEU.raised` (card), `NEU.pressed`/`NEU.raisedSm` (boolean action), `NEU.raisedSm` (numeric quick-add buttons)
- **Animations:** None (static Motion div)
- **Hooks/stores:** `useTranslation`
- **Uses:** `WeeklyTracker`, `HabitProgressBar`
- **Used by:** `HabitList`

#### HabitList
- **File:** `client/src/components/habits/HabitList.tsx`
- **Props:** None (top-level feature component)
- **Shadows:** None directly
- **Animations:** Motion stagger -- container `staggerChildren: 0.06`, items `opacity: 0, y: 12` -> `1, 0`
- **Hooks/stores:** `useHabits`, `useTranslation`
- **Uses:** `HabitCard`, `AddHabitModal`, `Button`
- **Used by:** `HabitsPage`

#### WeeklyTracker
- **File:** `client/src/components/habits/WeeklyTracker.tsx`
- **Props:** `{ weekDates: string[], entries: HabitEntry[], today: string, color: string, targetValue?: number }`
- **Shadows:** `NEU.pressedSm` (day cells)
- **Animations:** None
- **Hooks/stores:** None
- **Used by:** `HabitCard`

#### AddHabitModal
- **File:** `client/src/components/habits/AddHabitModal.tsx`
- **Props:** `{ open: boolean, onClose: () => void, onAdd: (habit: CreateHabitData) => void }`
- **Shadows:** `NEU.raisedSm` (icon/type buttons), `NEU.pressedSm` (active states)
- **Animations:** Motion color button scaling
- **Hooks/stores:** `useTranslation`
- **Uses:** `Modal`, `Input`, `Button`
- **Used by:** `HabitList`

#### HabitProgressBar
- **File:** `client/src/components/habits/HabitProgressBar.tsx`
- **Props:** `{ value: number, target: number, unit: string, color: string }`
- **Shadows:** `NEU.pressedSm` (track)
- **Animations:** None
- **Hooks/stores:** None
- **Used by:** `HabitCard`

### Inbox (`components/inbox/`)

#### InboxView
- **File:** `client/src/components/inbox/InboxView.tsx`
- **Props:** `{ embedded?: boolean }`
- **Shadows:** `NEU.pressed` (input area), `NEU.raisedSm` (items, buttons, undo bar, project picker items), `NEU.pressedSm` (task mode active button), `NEU.raised` (task mode project picker dropdown)
- **Animations:** Motion AnimatePresence -- items: `opacity: 0, height: 0` -> `1, auto`. Sort mode cards: `opacity: 0, x: 40` -> `1, 0` (mode="wait"). Undo bar: `opacity: 0, y: 8` -> `1, 0`. Dash hint: `opacity: 0, height: 0` -> `1, auto`
- **Hooks/stores:** `useInbox`, `useProjects`, `useTranslation`, `useSearchParams`
- **Uses:** `Card`
- **Used by:** `InboxPage`, `MindMapView` (embedded)

### Today (`components/today/`)

#### TodayTaskCard
- **File:** `client/src/components/today/TodayTaskCard.tsx`
- **Props:** `{ task: EnrichedTodayTask, onComplete: () => void, onMoveUp?: () => void, onMoveDown?: () => void, onEditTitle: (title: string) => void, isFirst: boolean, isTaskActive?: boolean, countdownDisplay?: string, countdownComplete?: boolean, isPaused?: boolean, onStartTask?: () => void, onStopTask?: () => void, onPauseTask?: () => void, onResumeTask?: () => void }`
- **Shadows:** `NEU.raised` (card), `NEU.raisedSm` (timer control buttons, play button), `NEU.pressedSm`/`NEU.raisedSm` (complete button toggle)
- **Animations:** Motion layout -- `initial: { opacity: 0, y: 10 }`, `animate: { opacity: 1, y: 0 }`, `exit: { opacity: 0, y: -10 }`, spring `stiffness: 400, damping: 30`. Checkmark: spring `stiffness: 500, damping: 20`.
- **Hooks/stores:** `useSettingsStore` (procrastinationWords, dismissedIds), `useTranslation`
- **Uses:** `ProcrastinationConfirmModal`
- **Used by:** `TodayPage`

### Review (`components/review/`)

#### ReviewView
- **File:** `client/src/components/review/ReviewView.tsx`
- **Props:** None (top-level feature component)
- **Shadows:** `NEU.raisedSm` (checklist items, reset button, add button), `NEU.pressedSm` (progress bar track), `NEU.pressed` (add input area)
- **Animations:** Motion -- progress bar spring `stiffness: 300, damping: 30`. Items: AnimatePresence layout with `opacity: 0, y: -8` -> `1, 0`. All-done: `opacity: 0, scale: 0.95` -> `1, 1`.
- **Hooks/stores:** `useTranslation`
- **Used by:** `ReviewPage`

### Notes (`components/notes/`)

#### NoteCard
- **File:** `client/src/components/notes/NoteCard.tsx`
- **Props:** `{ note: Note, onClick: () => void, onTogglePin: () => void }`
- **Shadows:** `NEU.raised`
- **Animations:** Motion hover/tap (Card-like behavior)
- **Hooks/stores:** None
- **Used by:** `NoteList`

#### NoteEditor
- **File:** `client/src/components/notes/NoteEditor.tsx`
- **Props:** `{ open: boolean, onClose: () => void, onSave: (data) => void, onDelete?: () => void, note: Note | null }`
- **Shadows:** Inherited from Modal, `NEU.raisedSm` (color picker, action buttons)
- **Hooks/stores:** `useTranslation`
- **Uses:** `Modal`
- **Used by:** `NoteList`

#### NoteList
- **File:** `client/src/components/notes/NoteList.tsx`
- **Props:** None (top-level feature component)
- **Shadows:** `NEU.pressed` (new note button)
- **Hooks/stores:** `useNotes`, `usePdfDocuments`, `useTranslation`
- **Uses:** `NoteCard`, `NoteEditor`, `PdfCard`, `PdfViewer`, `PdfUploadButton`
- **Used by:** `NotesPage`

#### PdfCard
- **File:** `client/src/components/notes/PdfCard.tsx`
- **Props:** `{ pdf: PdfDocument, onClick: () => void, onTogglePin: () => void }`
- **Shadows:** `NEU.raised`
- **Animations:** None
- **Hooks/stores:** None
- **Used by:** `NoteList`

#### PdfUploadButton
- **File:** `client/src/components/notes/PdfUploadButton.tsx`
- **Props:** `{ onUpload: (data) => void }`
- **Shadows:** `NEU.pressed`
- **Hooks/stores:** `useTranslation`
- **Used by:** `NoteList`

#### PdfViewer
- **File:** `client/src/components/notes/PdfViewer.tsx`
- **Props:** `{ open: boolean, onClose: () => void, onDelete?: () => void, pdf: PdfDocument | null }`
- **Shadows:** Inherited from Modal
- **Hooks/stores:** `useTranslation`
- **Uses:** `Modal`
- **Used by:** `NoteList`

### Mind Map (`components/mindmap/`)

#### MindMapView
- **File:** `client/src/components/mindmap/MindMapView.tsx`
- **Props:** None (top-level feature component)
- **Shadows:** Various via child components
- **Animations:** Motion AnimatePresence for floating timer panel (opacity, scale 0.9->1)
- **Hooks/stores:** `useMindMaps`, `useMindMapUIStore`, `useTranslation`
- **Uses:** `MindMapCanvas`, `MindMapToolbar`, `MindUnloadMode`, `CountdownTimer`, `InboxView` (embedded)
- **Used by:** `MindMapPage`

#### MindMapCanvas
- **File:** `client/src/components/mindmap/MindMapCanvas.tsx`
- **Props:** `{ mindMap: MindMap, onEditSave, onAddChild, onAddSibling, onAddSiblingAbove, onAddSiblingBelow, onDeleteNode, onToggleCollapse }`
- **Shadows:** `NEU.raisedSm` (nodes)
- **Animations:** Complex pan/zoom/drag canvas with computed layout positions
- **Hooks/stores:** `useMindMapUIStore`
- **Uses:** `MindMapNode`
- **Used by:** `MindMapView`

#### MindMapNode
- **File:** `client/src/components/mindmap/MindMapNode.tsx`
- **Props:** `{ node: MindMapNodeType, isRoot, isSelected, onSelect, onEditSave, onAddChild, onAddSibling, onDelete, onToggleCollapse, nodeMap }`
- **Shadows:** `NEU.raisedSm`
- **Animations:** None
- **Hooks/stores:** None
- **Used by:** `MindMapCanvas`

#### MindMapToolbar
- **File:** `client/src/components/mindmap/MindMapToolbar.tsx`
- **Props:** `{ activeMindMap: MindMap | null, onAddChild, onDeleteNode }`
- **Shadows:** `NEU.raisedSm`, `NEU.pressedSm`, `NEU.raised`
- **Animations:** AnimatePresence for dropdown menus
- **Hooks/stores:** `useMindMapUIStore`, `useMindMaps`, `useTranslation`
- **Used by:** `MindMapView`

#### MindUnloadMode
- **File:** `client/src/components/mindmap/MindUnloadMode.tsx`
- **Props:** None
- **Shadows:** `NEU.raisedSm`, `NEU.pressed`
- **Animations:** AnimatePresence for banner
- **Hooks/stores:** `useMindMapUIStore`, `useMindMaps`, `useTranslation`
- **Used by:** `MindMapView`

#### CountdownTimer
- **File:** `client/src/components/mindmap/CountdownTimer.tsx`
- **Props:** None
- **Shadows:** `NEU.raised`, `NEU.raisedSm`
- **Animations:** Motion pulse animation when finished
- **Hooks/stores:** `useMindMapUIStore`
- **Used by:** `MindMapView`

#### exportMindMap.ts
- **File:** `client/src/components/mindmap/exportMindMap.ts`
- **Type:** Utility (not a component)
- **Exports:** `exportFreeMind`, `exportMarkdown`, `exportJSON`
- **Used by:** `MindMapToolbar`

### Projects (`components/projects/`)

#### ProjectsView
- **File:** `client/src/components/projects/ProjectsView.tsx`
- **Props:** None (top-level feature component)
- **Shadows:** `NEU.raisedSm` (mobile tree toggle), `NEU.sidebarRight` (mobile drawer)
- **Animations:** Motion AnimatePresence -- mobile drawer: `x: -260 -> 0`, spring `stiffness: 400, damping: 30`. Overlay: opacity. Content panel: `opacity: 0 -> 1` (0.15s). Resizable panels via mouse drag (sidebar 160-400px, task panel vertical 200-500px, horizontal 80px-70%).
- **Hooks/stores:** `useProjects`, `useActivities`, `useProjectUIStore`, `useTranslation`, `useLiveQuery` (inbox count)
- **Uses:** `FileTree`, `ProjectTabs`, `ProjectDraftEditor`, `ProjectTaskList`, `ConfirmModal`
- **Used by:** `ProjectsPage`

#### FileTree
- **File:** `client/src/components/projects/FileTree.tsx`
- **Props:** None
- **Shadows:** `NEU.raisedSm`, `NEU.pressedSm`, `NEU.modal`
- **Animations:** Motion for folder expand/collapse. Custom mouse-based DnD (replaces HTML5 DnD for WKWebView compatibility).
- **Hooks/stores:** `useFolders`, `useProjects`, `useProjectUIStore`, `useTranslation`
- **Uses:** `AddProjectModal`, `AddFolderModal`, `ContextMenu`
- **Used by:** `ProjectsView`

#### ProjectTabs
- **File:** `client/src/components/projects/ProjectTabs.tsx`
- **Props:** None
- **Shadows:** `NEU.pressedSm`
- **Animations:** None
- **Hooks/stores:** `useProjectUIStore`, `useProjects`
- **Used by:** `ProjectsView`

#### ProjectDraftEditor
- **File:** `client/src/components/projects/ProjectDraftEditor.tsx`
- **Props:** `{ title: string, description: string, onSaveTitle: (title: string) => void, onSave: (description: string) => void, linkedActivityId?: string | null, onLinkActivity?: (activityId: string | null) => void, activities?: Activity[] }`
- **Shadows:** `NEU.pressedSm` (editor container, activity selector)
- **Animations:** None (auto-resize textarea)
- **Hooks/stores:** `useTranslation`
- **Used by:** `ProjectsView`

#### ProjectTaskList
- **File:** `client/src/components/projects/ProjectTaskList.tsx`
- **Props:** `{ projectId: string }`
- **Shadows:** `NEU.pressedSm`, `NEU.raisedSm`
- **Animations:** Motion stagger for task items
- **Hooks/stores:** `useProjectTasks`, `useSettingsStore`
- **Uses:** `TaskItem`, `RecurrenceEditor`
- **Used by:** `ProjectsView`

#### TaskItem
- **File:** `client/src/components/projects/TaskItem.tsx`
- **Props:** `{ task: ProjectTask, onToggle, onDelete, onRename, onUpdateRecurrence?, draggable?, onDragStart?, onDragOver?, onDrop?, isDragOver? }`
- **Shadows:** `NEU.pressedSm`, `NEU.raisedSm`
- **Animations:** Motion checkmark spring `stiffness: 500, damping: 20`
- **Hooks/stores:** `useSettingsStore`
- **Used by:** `ProjectTaskList`

#### RecurrenceEditor
- **File:** `client/src/components/projects/RecurrenceEditor.tsx`
- **Props:** `{ rule: RecurrenceRule | null, onChange: (rule: RecurrenceRule | null) => void }`
- **Shadows:** `NEU.pressedSm`, `NEU.raisedSm`
- **Animations:** None
- **Hooks/stores:** `useTranslation`
- **Used by:** `ProjectTaskList`

#### AddProjectModal
- **File:** `client/src/components/projects/AddProjectModal.tsx`
- **Props:** `{ open: boolean, onClose: () => void, onAdd: (data) => void }`
- **Shadows:** `NEU.pressedSm`, `NEU.raisedSm`
- **Animations:** Motion color button scaling
- **Uses:** `Modal`, `Button`
- **Used by:** `FileTree`

#### AddFolderModal
- **File:** `client/src/components/projects/AddFolderModal.tsx`
- **Props:** `{ open: boolean, onClose: () => void, onAdd: (data) => void }`
- **Shadows:** `NEU.pressedSm`, `NEU.raisedSm`
- **Animations:** Motion color button scaling
- **Uses:** `Modal`, `Button`
- **Used by:** `FileTree`

#### ProjectSelector
- **File:** `client/src/components/projects/ProjectSelector.tsx`
- **Props:** `{ projects: Project[], selectedId: string, onSelect: (id: string) => void, onAdd: () => void }`
- **Shadows:** `NEU.pressedSm`, `NEU.raisedSm`
- **Animations:** None
- **Hooks/stores:** None
- **Used by:** Not currently used (available for future features)

### Task Selection (`components/taskSelection/`)

#### TaskSelectionView
- **File:** `client/src/components/taskSelection/TaskSelectionView.tsx`
- **Props:** None (top-level feature component)
- **Shadows:** None directly (delegated to children)
- **Animations:** Motion stagger -- container `staggerChildren: 0.06`, items `opacity: 0, y: 12` -> `1, 0`. Completed section: AnimatePresence height collapse.
- **Hooks/stores:** `useAllProjectTasks`, `useTodayTasks`, `useProjects`, `useProjectTasks`, `useSettingsStore`, `useTranslation`
- **Uses:** `InfoTooltip`, `PointsCounter`, `TaskGroupCard`, `FolderGroupSection`, `SelectableTaskRow`
- **Used by:** `TaskSelectionPage`

#### TaskGroupCard
- **File:** `client/src/components/taskSelection/TaskGroupCard.tsx`
- **Props:** `{ project: Project, tasks: ProjectTask[], completedTasks: ProjectTask[], onToggleToday, todayTaskIds: Set<string>, sortMode: TaskSortMode, isCollapsed?: boolean, onToggleCollapse?, draggableProject?, onProjectDragStart/Over/Drop?, isProjectDragOver? }`
- **Shadows:** None directly
- **Animations:** Motion AnimatePresence -- project expand/collapse: `height: 0, opacity: 0` -> `auto, 1` (0.2s ease). Completed section same pattern (0.15s).
- **Hooks/stores:** `useProjectTasks`, `useTranslation`
- **Uses:** `SelectableTaskRow`
- **Used by:** `TaskSelectionView`

#### SelectableTaskRow
- **File:** `client/src/components/taskSelection/SelectableTaskRow.tsx`
- **Props:** `{ task: ProjectTask, onToggleToday, onToggleComplete, onDelete, isInToday: boolean, draggable: boolean, onDragStart/Over/Drop?, isDragOver?: 'above' | 'below' | null, projectInfo?: { name: string, color: string } }`
- **Shadows:** None directly
- **Animations:** None (CSS transitions)
- **Hooks/stores:** `useSettingsStore` (pointsCounterVisible, pointsColorFixed, procrastinationWords, dismissedProcrastinationTaskIds), `useTranslation`
- **Uses:** `ProcrastinationConfirmModal`, `ContextMenu`
- **Used by:** `TaskSelectionView`, `TaskGroupCard`

#### FolderGroupSection
- **File:** `client/src/components/taskSelection/FolderGroupSection.tsx`
- **Props:** `{ folder: ProjectFolder | null, children: React.ReactNode, isCollapsed: boolean, onToggle: () => void, projectCount: number }`
- **Shadows:** None
- **Animations:** Motion AnimatePresence -- `height: 0, opacity: 0` -> `auto, 1` (0.2s ease)
- **Hooks/stores:** `useTranslation`
- **Used by:** `TaskSelectionView`

#### PointsCounter
- **File:** `client/src/components/taskSelection/PointsCounter.tsx`
- **Props:** None
- **Shadows:** None
- **Animations:** Motion AnimatePresence -- score number: `opacity: 0, y: -4` -> `1, 0` (mode="wait", 0.2s)
- **Hooks/stores:** `usePointsCounter`, `useSettingsStore`, `useTranslation`
- **Used by:** `TaskSelectionView`

### Analytics (`components/analytics/`)

#### DailyView
- **File:** `client/src/components/analytics/DailyView.tsx`
- **Props:** None
- **Shadows:** `NEU.raised`, `NEU.raisedSm`
- **Animations:** Recharts animations
- **Hooks/stores:** `useTimeEntries`, `useActivities`, `useSettingsStore`, `useThemeColors`, `useTranslation`
- **Used by:** `AnalyticsPage`

#### WeeklyView
- **File:** `client/src/components/analytics/WeeklyView.tsx`
- **Props:** None
- **Shadows:** `NEU.raised`, `NEU.raisedSm`
- **Animations:** Recharts animations
- **Hooks/stores:** `useTimeEntries`, `useActivities`, `useSettingsStore`, `useThemeColors`, `useTranslation`
- **Used by:** `AnalyticsPage`

#### MonthlyView
- **File:** `client/src/components/analytics/MonthlyView.tsx`
- **Props:** None
- **Shadows:** `NEU.raised`, `NEU.raisedSm`
- **Animations:** Recharts animations
- **Hooks/stores:** `useTimeEntries`, `useActivities`, `useSettingsStore`, `useThemeColors`, `useTranslation`
- **Used by:** `AnalyticsPage`

#### StreaksView
- **File:** `client/src/components/analytics/StreaksView.tsx`
- **Props:** None
- **Shadows:** `NEU.raised`, `NEU.raisedSm`
- **Animations:** Recharts animations
- **Hooks/stores:** `useTimeEntries`, `useActivities`, `useSettingsStore`, `useThemeColors`, `useTranslation`
- **Used by:** `AnalyticsPage`

### Progress (`components/progress/`)

#### ProgressBar
- **File:** `client/src/components/progress/ProgressBar.tsx`
- **Props:** `{ ratio: number, color: string, isActive?: boolean }`
- **Shadows:** `NEU.pressedSm` (track)
- **Animations:** Conditional -- renders based on `barStyle` setting (delegates to ThickLinearBar, SegmentedBar, or CircularBar)
- **Hooks/stores:** `useSettingsStore` (barStyle)
- **Used by:** `ActivityCard`

#### ThickLinearBar
- **File:** `client/src/components/progress/ThickLinearBar.tsx`
- **Props:** `{ ratio: number, color: string }`
- **Shadows:** `NEU.pressedSm` (track)
- **Animations:** CSS transition-all for width
- **Hooks/stores:** None
- **Used by:** `ProgressBar`, `BarStylePicker`

#### SegmentedBar
- **File:** `client/src/components/progress/SegmentedBar.tsx`
- **Props:** `{ ratio: number, color: string, segments?: number }`
- **Shadows:** `NEU.pressedSm` (track)
- **Animations:** None
- **Hooks/stores:** None
- **Used by:** `ProgressBar`, `BarStylePicker`

#### CircularBar
- **File:** `client/src/components/progress/CircularBar.tsx`
- **Props:** `{ ratio: number, color: string, size?: number }`
- **Shadows:** None (SVG circle)
- **Animations:** SVG stroke-dashoffset transition
- **Hooks/stores:** None
- **Used by:** `ProgressBar`, `BarStylePicker`

### Gamification (`components/gamification/`)

#### SidebarStreakIndicator
- **File:** `client/src/components/gamification/SidebarStreakIndicator.tsx`
- **Props:** `{ collapsed: boolean }`
- **Shadows:** None
- **Animations:** None
- **Hooks/stores:** `useSettingsStore` (gamificationEnabled, currentStreak, totalXP)
- **Used by:** `Sidebar`

#### StreakXPBanner
- **File:** `client/src/components/gamification/StreakXPBanner.tsx`
- **Props:** None
- **Shadows:** `NEU.raised` (banner), `NEU.pressedSm` (XP bar track)
- **Animations:** Motion -- XP bar width spring `stiffness: 400, damping: 30`
- **Hooks/stores:** `useSettingsStore` (gamificationEnabled, currentStreak, totalXP, todayXP), `useTranslation`
- **Used by:** `HomePage`

### Layout (`components/layout/`)

#### AppShell
- **File:** `client/src/components/layout/AppShell.tsx`
- **Props:** `{ children: React.ReactNode }`
- **Shadows:** None directly
- **Animations:** Motion AnimatePresence for page transitions -- `y: 10, opacity: 0` -> `0, 1` (0.2s)
- **Hooks/stores:** `useSettingsStore` (navPosition, theme, uiZoom), `useTranslation`
- **Uses:** `Sidebar`, `BottomNav`, `DesktopBottomNav`, `DropdownNav`, `VaultSetupModal` (conditional)
- **Used by:** `App.tsx` (root layout wrapper)
- **Layout config:** `WIDE_PAGES` = `/projects`, `/tasks`, `/notes`, `/mindmap`; `FULL_BLEED_PAGES` = `/projects`, `/mindmap`

#### Sidebar
- **File:** `client/src/components/layout/Sidebar.tsx`
- **Props:** None
- **Shadows:** `NEU.sidebarRight`, `NEU.raisedSm` (nav items), `NEU.pressedSm` (active item)
- **Animations:** Motion -- sidebar width collapse/expand: spring `stiffness: 400, damping: 35`. Nav items: hover y shift.
- **Hooks/stores:** `useSettingsStore` (hiddenNavTabs, navTabOrder), `useTranslation`
- **Uses:** `SidebarStreakIndicator`, `ContextMenu`
- **Used by:** `AppShell`

#### BottomNav
- **File:** `client/src/components/layout/BottomNav.tsx`
- **Props:** None
- **Shadows:** `NEU.bottomNavUp`
- **Animations:** Motion -- active indicator layoutId spring, "More" popup AnimatePresence
- **Hooks/stores:** `useSettingsStore` (hiddenNavTabs, navTabOrder), `useTranslation`
- **Uses:** `ContextMenu`
- **Used by:** `AppShell` (mobile, all nav modes)

#### DesktopBottomNav
- **File:** `client/src/components/layout/DesktopBottomNav.tsx`
- **Props:** None
- **Shadows:** `NEU.bottomNavUp`
- **Animations:** Motion -- active indicator layoutId spring
- **Hooks/stores:** `useSettingsStore` (hiddenNavTabs, navTabOrder), `useTranslation`
- **Uses:** `ContextMenu`
- **Used by:** `AppShell` (desktop, navPosition='bottom')

#### DropdownNav
- **File:** `client/src/components/layout/DropdownNav.tsx`
- **Props:** None
- **Shadows:** `NEU.raised` (FAB), `NEU.modal` (dropdown)
- **Animations:** Motion -- FAB draggable, dropdown AnimatePresence scale+opacity. Spring configs.
- **Hooks/stores:** `useSettingsStore` (hiddenNavTabs, navTabOrder, dropdownFabCorner), `useTranslation`
- **Uses:** `ContextMenu`
- **Used by:** `AppShell` (navPosition='dropdown')

### Settings (`components/settings/`)

#### ThemeToggle
- **File:** `client/src/components/settings/ThemeToggle.tsx`
- **Props:** None
- **Shadows:** `NEU.pressedSm` (active swatch)
- **Animations:** None (CSS transitions)
- **Hooks/stores:** `useSettingsStore` (theme, customThemeColors), `useTranslation`
- **Uses:** `CustomThemeEditor` (conditional, when theme='custom')
- **Used by:** `SettingsPage`

#### CustomThemeEditor
- **File:** `client/src/components/settings/CustomThemeEditor.tsx`
- **Props:** None
- **Shadows:** None
- **Animations:** None
- **Hooks/stores:** `useSettingsStore` (customThemeColors)
- **Used by:** `ThemeToggle`

#### AccentColorPicker
- **File:** `client/src/components/settings/AccentColorPicker.tsx`
- **Props:** None
- **Shadows:** None
- **Animations:** CSS `scale` transition (active: 1.1 + ring)
- **Hooks/stores:** `useSettingsStore` (accentColor), `useTranslation`
- **Used by:** `SettingsPage`

#### BarStylePicker
- **File:** `client/src/components/settings/BarStylePicker.tsx`
- **Props:** None
- **Shadows:** `NEU.pressed` (active), `NEU.raisedSm` (inactive)
- **Animations:** None
- **Hooks/stores:** `useSettingsStore` (barStyle), `useThemeColors`, `useTranslation`
- **Uses:** `ThickLinearBar`, `SegmentedBar`, `CircularBar`
- **Used by:** `SettingsPage`

#### NavPositionPicker
- **File:** `client/src/components/settings/NavPositionPicker.tsx`
- **Props:** None
- **Shadows:** `NEU.pressedSm` (active), `NEU.raisedSm` (inactive)
- **Animations:** None
- **Hooks/stores:** `useSettingsStore` (navPosition), `useTranslation`
- **Used by:** `SettingsPage`

#### LanguagePicker
- **File:** `client/src/components/settings/LanguagePicker.tsx`
- **Props:** None
- **Shadows:** `NEU.pressed` (active), `NEU.raisedSm` (inactive)
- **Animations:** None
- **Hooks/stores:** `useSettingsStore` (language), `useTranslation`
- **Used by:** `SettingsPage`

#### DayBoundarySettings
- **File:** `client/src/components/settings/DayBoundarySettings.tsx`
- **Props:** None
- **Shadows:** `NEU.pressed` (select dropdowns)
- **Animations:** None
- **Hooks/stores:** `useSettingsStore` (dayStartHour, dayEndHour), `useTranslation`
- **Used by:** `SettingsPage`

#### TimezoneSettings
- **File:** `client/src/components/settings/TimezoneSettings.tsx`
- **Props:** None
- **Shadows:** `NEU.pressed` (select)
- **Animations:** None
- **Hooks/stores:** `useSettingsStore` (timezone), `useTranslation`
- **Used by:** `SettingsPage`

#### TaskSettings
- **File:** `client/src/components/settings/TaskSettings.tsx`
- **Props:** None
- **Shadows:** `NEU.raisedSm` (increment/decrement buttons), `NEU.pressedSm` (value display)
- **Animations:** None
- **Hooks/stores:** `useSettingsStore` (maxTasksPerProject), `useTranslation`
- **Used by:** `SettingsPage`

#### TaskTimerSettings
- **File:** `client/src/components/settings/TaskTimerSettings.tsx`
- **Props:** None
- **Shadows:** `NEU.raisedSm` (increment/decrement buttons), `NEU.pressedSm` (value display)
- **Animations:** None
- **Hooks/stores:** `useSettingsStore` (taskTimerMinutes), `useTranslation`
- **Used by:** `SettingsPage`

#### TimerNotificationSettings
- **File:** `client/src/components/settings/TimerNotificationSettings.tsx`
- **Props:** None
- **Shadows:** `NEU.raisedSm` (increment/decrement buttons), `NEU.pressedSm` (value display)
- **Animations:** None
- **Hooks/stores:** `useSettingsStore` (timerNotificationsEnabled, timerNotificationIntervalMinutes), `useTranslation`
- **Uses:** `Toggle`
- **Used by:** `SettingsPage`

#### ProcrastinationWordSettings
- **File:** `client/src/components/settings/ProcrastinationWordSettings.tsx`
- **Props:** None
- **Shadows:** `NEU.pressedSm` (word tags, input), `NEU.raisedSm` (add button)
- **Animations:** None
- **Hooks/stores:** `useSettingsStore` (procrastinationWords), `useTranslation`
- **Used by:** `SettingsPage`

#### GamificationSettings
- **File:** `client/src/components/settings/GamificationSettings.tsx`
- **Props:** None
- **Shadows:** None directly (via Toggle)
- **Animations:** None
- **Hooks/stores:** `useSettingsStore` (gamificationEnabled, currentStreak, longestStreak, totalXP), `useTranslation`
- **Uses:** `Toggle`
- **Used by:** `SettingsPage`

#### ZoomSettings
- **File:** `client/src/components/settings/ZoomSettings.tsx`
- **Props:** None
- **Shadows:** `NEU.raisedSm` (increment/decrement buttons), `NEU.pressedSm` (value display)
- **Animations:** None
- **Hooks/stores:** `useSettingsStore` (uiZoom), `useTranslation`
- **Used by:** `SettingsPage`

#### SyncSettings
- **File:** `client/src/components/settings/SyncSettings.tsx`
- **Props:** None
- **Shadows:** None directly (via Toggle, Input, Button primitives)
- **Animations:** None
- **Hooks/stores:** `useSettingsStore` (syncEnabled, syncServerUrl, syncApiKey), `useTranslation`
- **Uses:** `Toggle`, `Input`, `Button`
- **Used by:** `SettingsPage`

#### VaultSettings
- **File:** `client/src/components/settings/VaultSettings.tsx`
- **Props:** None
- **Shadows:** None directly (via Button)
- **Animations:** None
- **Hooks/stores:** `useTranslation`
- **Uses:** `Button`
- **Used by:** `SettingsPage`

---

## 3. Page Composition

### HomePage (`/`)
- **File:** `client/src/pages/HomePage.tsx`
- **Components:** `StreakXPBanner`, `TimerDisplay`, `ActivityList`, `PomodoroTimer` (in Modal), `FatigueCheck`
- **Shadows:** `NEU.raisedSm` (Pomodoro/Fatigue buttons)
- **Animations:** CSS `breathe` animation on pomodoro active indicator
- **Hooks/stores:** `usePomodoroStore`, `useTranslation`

### ProjectsPage (`/projects`)
- **File:** `client/src/pages/ProjectsPage.tsx`
- **Components:** `ProjectsView`
- **Layout:** Wide + full-bleed

### TaskSelectionPage (`/tasks`)
- **File:** `client/src/pages/TaskSelectionPage.tsx`
- **Components:** `TaskSelectionView`
- **Layout:** Wide

### TodayPage (`/today`)
- **File:** `client/src/pages/TodayPage.tsx`
- **Components:** `TimerDisplay`, `TodayTaskCard`
- **Shadows:** `NEU.raisedSm` (focus mode button, hide/show completed, exit focus)
- **Animations:** Motion AnimatePresence -- focus mode overlay: `opacity: 0->1` (0.3s). All-done celebration: `scale: 0.8->1`, spring `stiffness: 400, damping: 25`. Completed section: `height: 0->auto` (0.3s ease). Task cards: `AnimatePresence mode="popLayout"`. Vignette radial gradient overlay.
- **Hooks/stores:** `useTodayTasks`, `useTaskTimer`, `useTranslation`

### InboxPage (`/inbox`)
- **File:** `client/src/pages/InboxPage.tsx`
- **Components:** `InboxView`

### MindMapPage (`/mindmap`)
- **File:** `client/src/pages/MindMapPage.tsx`
- **Components:** `MindMapView`
- **Layout:** Wide + full-bleed

### HabitsPage (`/habits`)
- **File:** `client/src/pages/HabitsPage.tsx`
- **Components:** `HabitList`

### AnalyticsPage (`/analytics`)
- **File:** `client/src/pages/AnalyticsPage.tsx`
- **Components:** `DailyView`, `WeeklyView`, `MonthlyView`, `StreaksView`
- **Shadows:** `NEU.pressed` (tab bar container), `NEU.raisedSm` (active tab indicator)
- **Animations:** Motion -- tab indicator `layoutId` spring `stiffness: 400, damping: 30`. Tab content: AnimatePresence `mode="wait"`, `opacity: 0, x: 8` -> `1, 0` (0.15s)

### NotesPage (`/notes`)
- **File:** `client/src/pages/NotesPage.tsx`
- **Components:** `NoteList`
- **Layout:** Wide

### SettingsPage (`/settings`)
- **File:** `client/src/pages/SettingsPage.tsx`
- **Components:** All 14 settings components wrapped in `Card` primitives: `LanguagePicker`, `ThemeToggle`, `AccentColorPicker`, `BarStylePicker`, `NavPositionPicker`, `ZoomSettings`, `DayBoundarySettings`, `TimezoneSettings`, `TaskSettings`, `TaskTimerSettings`, `ProcrastinationWordSettings`, `TimerNotificationSettings`, `GamificationSettings`, `VaultSettings`
- **Shadows:** Via Card wrapper (`NEU.raised`)
- **Animations:** Motion stagger -- container `staggerChildren: 0.06`, items `opacity: 0, y: 12` -> `1, 0`
- **Hooks/stores:** `useTranslation`

### ReviewPage (`/review`)
- **File:** `client/src/pages/ReviewPage.tsx`
- **Components:** `ReviewView`

---

## 4. Component Statistics

### Totals by Directory

| Directory | Component Count | Notes |
|-----------|----------------|-------|
| `ui/` | 12 | Reusable primitives |
| `activities/` | 4 | Activity CRUD + timer toggle |
| `timer/` | 2 | Timer display + manual entry |
| `pomodoro/` | 3 | Pomodoro timer + presets |
| `fatigue/` | 1 | Fatigue assessment modal |
| `habits/` | 5 | Habit tracking + weekly grid |
| `inbox/` | 1 | Capture + sort dual-mode |
| `today/` | 1 | Daily task card with timer |
| `review/` | 1 | Review checklist |
| `notes/` | 6 | Notes + PDF support |
| `mindmap/` | 6 + 1 util | Mind map canvas + toolbar + modes |
| `gamification/` | 2 | Streak + XP display |
| `projects/` | 10 | Project management + editor |
| `taskSelection/` | 5 | Task picker + points + sorting |
| `analytics/` | 4 | Charts (daily/weekly/monthly/streaks) |
| `progress/` | 4 | Bar style variants |
| `layout/` | 5 | App shell + 4 navigation modes |
| `settings/` | 16 | One per setting category |
| **Total** | **88 components + 1 utility** | |

### Shadow Token Usage

| Token | Usage Count | Primary Use |
|-------|-------------|-------------|
| `NEU.raisedSm` | 40+ | Buttons, cards, small interactive elements |
| `NEU.raised` | 15+ | Card containers, major panels |
| `NEU.pressedSm` | 30+ | Active/selected states, input tracks, toggles |
| `NEU.pressed` | 12+ | Input fields, select dropdowns, editor containers |
| `NEU.modal` | 8 | Modal dialogs, context menus, dropdown overlays |
| `NEU.pressedDeep` | 1 | Modal backdrop only |
| `NEU.sidebarRight` | 2 | Sidebar shadow, mobile drawer |
| `NEU.bottomNavUp` | 2 | BottomNav, DesktopBottomNav |
| `NEU.tooltipSm` | 1 | InfoTooltip only |
| `NEU.raisedLg` | 0 | Defined but unused in current components |
| `NEU.topBar` | 0 | Defined but unused in current components |

### Animation Patterns

| Pattern | Count | Spring Config |
|---------|-------|--------------|
| Card hover y:-6 + tap scale:0.93-0.94 | 3 | `stiffness: 400, damping: 25` |
| Modal enter scale:0.95->1 + opacity | 5 | `stiffness: 400, damping: 30` |
| Stagger children opacity+y | 6 | `staggerChildren: 0.05-0.06` |
| AnimatePresence height collapse | 8 | `duration: 0.15-0.3, ease: easeInOut` |
| Toggle thumb x translation | 1 | `stiffness: 500, damping: 30` |
| Checkmark scale spring | 2 | `stiffness: 500, damping: 20` |
| Tab indicator layoutId | 2 | `stiffness: 400, damping: 30` |
| Page transitions y+opacity | 1 | `duration: 0.2` |
| Sidebar collapse width | 1 | `stiffness: 400, damping: 35` |
| RotaryDial indicator cx/cy | 1 | `stiffness: 400, damping: 30` |

### Store Consumption

| Store | Components Using |
|-------|-----------------|
| `useSettingsStore` | 35+ (all settings, theme-dependent, procrastination, gamification) |
| `useTimerStore` | 1 (`TimerDisplay`) |
| `usePomodoroStore` | 2 (`PomodoroTimer`, `HomePage`) |
| `useProjectUIStore` | 4 (`ProjectsView`, `FileTree`, `ProjectTabs`, `MindMapCanvas`) -- note: MindMapCanvas uses `useMindMapUIStore` not projectUI |
| `useMindMapUIStore` | 4 (`MindMapView`, `MindMapCanvas`, `MindMapToolbar`, `MindUnloadMode`, `CountdownTimer`) |

### Hook Consumption (Data Hooks)

| Hook | Components Using |
|------|-----------------|
| `useTranslation` | 60+ (nearly all components) |
| `useActivities` | 3 (`ActivityList`, `TimerDisplay`, `ProjectsView`) |
| `useProjects` | 5 (`ProjectsView`, `FileTree`, `TaskSelectionView`, `InboxView`, `ProjectTabs`) |
| `useProjectTasks` | 3 (`ProjectTaskList`, `TaskGroupCard`, `TaskSelectionView`) |
| `useTodayTasks` | 2 (`TodayPage`, `TaskSelectionView`) |
| `useHabits` | 1 (`HabitList`) |
| `useNotes` | 1 (`NoteList`) |
| `usePdfDocuments` | 1 (`NoteList`) |
| `useInbox` | 1 (`InboxView`) |
| `useMindMaps` | 2 (`MindMapView`, `MindMapToolbar`) |
| `useTimer` | 1 (`ActivityList`) |
| `useTimeEntries` | 5 (`ActivityList`, analytics views) |
| `useThemeColors` | 5 (`RotaryDial`, `BarStylePicker`, analytics views) |
| `useAllProjectTasks` | 1 (`TaskSelectionView`) |
| `usePointsCounter` | 1 (`PointsCounter`) |
| `useTaskTimer` | 1 (`TodayPage`) |
| `useFolders` | 1 (`FileTree`) |
| `useLiveQuery` (direct) | 1 (`ProjectsView` for inbox count) |

---

## 5. Component Dependency Graph (Key Flows)

```
App.tsx
  -> AppShell
       -> Sidebar / BottomNav / DesktopBottomNav / DropdownNav
       -> [Page Components via Router]

HomePage
  -> StreakXPBanner
  -> TimerDisplay
  -> ActivityList
       -> ActivityCard -> ActivityMenu, ProgressBar
       -> ActivityForm -> Modal, Input, Button, RotaryDial
       -> ConfirmDialog -> Modal, Button
  -> Modal -> PomodoroTimer -> PresetSelector -> PresetFormModal
  -> FatigueCheck -> Modal

ProjectsPage -> ProjectsView
  -> FileTree -> AddProjectModal, AddFolderModal, ContextMenu
  -> ProjectTabs
  -> ProjectDraftEditor
  -> ProjectTaskList -> TaskItem, RecurrenceEditor
  -> ConfirmModal -> Modal

TaskSelectionPage -> TaskSelectionView
  -> InfoTooltip
  -> PointsCounter
  -> TaskGroupCard -> SelectableTaskRow -> ProcrastinationConfirmModal, ContextMenu
  -> FolderGroupSection

TodayPage
  -> TimerDisplay
  -> TodayTaskCard -> ProcrastinationConfirmModal

SettingsPage -> [14 settings components] wrapped in Card

AnalyticsPage -> DailyView / WeeklyView / MonthlyView / StreaksView

HabitsPage -> HabitList -> HabitCard -> WeeklyTracker, HabitProgressBar
                        -> AddHabitModal -> Modal, Input, Button

NotesPage -> NoteList -> NoteCard, NoteEditor, PdfCard, PdfViewer, PdfUploadButton

MindMapPage -> MindMapView -> MindMapCanvas -> MindMapNode
                            -> MindMapToolbar
                            -> MindUnloadMode
                            -> CountdownTimer
                            -> InboxView (embedded)

InboxPage -> InboxView -> Card

ReviewPage -> ReviewView
```

---

## 6. Design System Patterns

### Consistent Shadow Idiom
- **Raised** = clickable, interactive surface (`NEU.raised`, `NEU.raisedSm`)
- **Pressed** = recessed, input-like surface (`NEU.pressed`, `NEU.pressedSm`)
- **Active toggle** = switch from raised to pressed when selected

### Consistent Spring Configs
- **Standard interactive:** `stiffness: 400, damping: 25-30`
- **Tight interactive (toggles, checkmarks):** `stiffness: 500, damping: 20-30`
- **Sidebar collapse:** `stiffness: 400, damping: 35`
- **Page transitions:** `duration: 0.2` (no spring)

### Consistent Color Pattern
- Entity color used as: left accent bar, progress fill, active state tint
- `color-mix(in srgb, ${color} 10-15%, var(--color-bg-card))` for active backgrounds
- `${color}50`/`${color}60` for inset borders on active states

### Component Size Naming
- Buttons: `sm`/`md`/`lg`
- All shadows available: `raisedSm` vs `raised` vs `raisedLg`
- No formal T-shirt sizing on most feature components
