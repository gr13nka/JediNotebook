import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { NEU } from '../../utils/shadows';
import type { MindMap, MindMapNode } from '@shared/types';
import { useMindMapUIStore } from '../../stores/mindMapUIStore';

type Direction = 'right' | 'left' | 'top' | 'bottom';

interface Props {
  mindMap: MindMap;
  onEditSave: (nodeId: string, text: string) => void;
  onAddChild: (parentId: string, direction?: Direction) => void;
  onAddSibling: (nodeId: string) => void;
  onAddSiblingAbove: (nodeId: string) => void;
  onAddSiblingBelow: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
}

interface HandleDragState {
  fromNodeId: string;
  direction: Direction;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface NodeDragState {
  nodeId: string;
  startMouseX: number;
  startMouseY: number;
  startNodeX: number;
  startNodeY: number;
}

interface Position { x: number; y: number }

const H_GAP = 180;
const V_GAP = 120;
const SIBLING_GAP = 16;
const NODE_HEIGHT = 36;
const NODE_WIDTH_EST = 120;

function computeSubtreeSpan(
  nodeId: string,
  nodeMap: Map<string, MindMapNode>,
  dir: Direction,
  spanCache: Map<string, number>,
): number {
  const cached = spanCache.get(nodeId);
  if (cached !== undefined) return cached;

  const node = nodeMap.get(nodeId);
  if (!node || node.collapsed || node.children.length === 0) {
    const span = dir === 'right' || dir === 'left' ? NODE_HEIGHT : NODE_WIDTH_EST;
    spanCache.set(nodeId, span);
    return span;
  }

  let total = 0;
  for (const childId of node.children) {
    total += computeSubtreeSpan(childId, nodeMap, dir, spanCache);
  }
  total += (node.children.length - 1) * SIBLING_GAP;

  const minSpan = dir === 'right' || dir === 'left' ? NODE_HEIGHT : NODE_WIDTH_EST;
  const span = Math.max(total, minSpan);
  spanCache.set(nodeId, span);
  return span;
}

function layoutSubtree(
  nodeId: string,
  parentPos: Position,
  dir: Direction,
  nodeMap: Map<string, MindMapNode>,
  positions: Map<string, Position>,
  spanCache: Map<string, number>,
) {
  const node = nodeMap.get(nodeId);
  if (!node || node.collapsed) return;

  const children = node.children;
  if (children.length === 0) return;

  const isHorizontal = dir === 'right' || dir === 'left';
  const sign = dir === 'right' || dir === 'bottom' ? 1 : -1;

  // Total span of all children
  let totalSpan = 0;
  const childSpans: number[] = [];
  for (const cid of children) {
    const s = computeSubtreeSpan(cid, nodeMap, dir, spanCache);
    childSpans.push(s);
    totalSpan += s;
  }
  totalSpan += (children.length - 1) * SIBLING_GAP;

  // Starting offset (perpendicular axis), centered on parent
  let offset = -totalSpan / 2;

  for (let i = 0; i < children.length; i++) {
    const cid = children[i];
    const span = childSpans[i];
    const center = offset + span / 2;

    let cx: number, cy: number;
    if (isHorizontal) {
      cx = parentPos.x + sign * H_GAP;
      cy = parentPos.y + center;
    } else {
      cx = parentPos.x + center;
      cy = parentPos.y + sign * V_GAP;
    }

    positions.set(cid, { x: cx, y: cy });

    // Recurse — children inherit direction from this node (or their own if set)
    const childNode = nodeMap.get(cid);
    const childDir = childNode?.direction || dir;
    layoutSubtree(cid, { x: cx, y: cy }, childDir, nodeMap, positions, spanCache);

    offset += span + SIBLING_GAP;
  }
}

function computeLayoutPositions(
  nodeMap: Map<string, MindMapNode>,
  rootNodeId: string,
): Map<string, Position> {
  const positions = new Map<string, Position>();
  const root = nodeMap.get(rootNodeId);
  if (!root) return positions;

  positions.set(rootNodeId, { x: 0, y: 0 });

  // Group root's children by direction
  const groups = new Map<Direction, string[]>();
  for (const childId of root.children) {
    const childNode = nodeMap.get(childId);
    const dir: Direction = childNode?.direction || 'right';
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir)!.push(childId);
  }

  // Layout each direction group
  for (const [dir, childIds] of groups) {
    const isHorizontal = dir === 'right' || dir === 'left';
    const sign = dir === 'right' || dir === 'bottom' ? 1 : -1;

    const spanCache = new Map<string, number>();

    let totalSpan = 0;
    const childSpans: number[] = [];
    for (const cid of childIds) {
      const s = computeSubtreeSpan(cid, nodeMap, dir, spanCache);
      childSpans.push(s);
      totalSpan += s;
    }
    totalSpan += (childIds.length - 1) * SIBLING_GAP;

    let offset = -totalSpan / 2;

    for (let i = 0; i < childIds.length; i++) {
      const cid = childIds[i];
      const span = childSpans[i];
      const center = offset + span / 2;

      let cx: number, cy: number;
      if (isHorizontal) {
        cx = sign * H_GAP;
        cy = center;
      } else {
        cx = center;
        cy = sign * V_GAP;
      }

      positions.set(cid, { x: cx, y: cy });
      layoutSubtree(cid, { x: cx, y: cy }, dir, nodeMap, positions, spanCache);

      offset += span + SIBLING_GAP;
    }
  }

  return positions;
}

function getVisibleNodes(
  nodeMap: Map<string, MindMapNode>,
  rootNodeId: string,
): { nodeId: string; node: MindMapNode; isRoot: boolean }[] {
  const result: { nodeId: string; node: MindMapNode; isRoot: boolean }[] = [];
  const walk = (id: string, isRoot: boolean) => {
    const node = nodeMap.get(id);
    if (!node) return;
    result.push({ nodeId: id, node, isRoot });
    if (!node.collapsed) {
      for (const cid of node.children) walk(cid, false);
    }
  };
  walk(rootNodeId, true);
  return result;
}

function getVisibleEdges(
  nodeMap: Map<string, MindMapNode>,
  rootNodeId: string,
): { parentId: string; childId: string }[] {
  const edges: { parentId: string; childId: string }[] = [];
  const walk = (id: string) => {
    const node = nodeMap.get(id);
    if (!node || node.collapsed) return;
    for (const cid of node.children) {
      edges.push({ parentId: id, childId: cid });
      walk(cid);
    }
  };
  walk(rootNodeId);
  return edges;
}

export function MindMapCanvas({
  mindMap,
  onEditSave,
  onAddChild,
  onAddSibling,
  onAddSiblingAbove,
  onAddSiblingBelow,
  onDeleteNode,
  onToggleCollapse,
}: Props) {
  const selectedNodeId = useMindMapUIStore((s) => s.selectedNodeId);
  const setSelectedNode = useMindMapUIStore((s) => s.setSelectedNode);
  const pendingEditNodeId = useMindMapUIStore((s) => s.pendingEditNodeId);
  const setPendingEditNode = useMindMapUIStore((s) => s.setPendingEditNode);

  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const hasCentered = useRef(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle drag state (for handle dots)
  const handleDragRef = useRef<HandleDragState | null>(null);
  const [handleDragState, setHandleDragState] = useState<HandleDragState | null>(null);

  // Node drag state (for moving nodes)
  const nodeDragRef = useRef<NodeDragState | null>(null);
  const [isNodeDragging, setIsNodeDragging] = useState(false);

  // Node positions — layout-computed + drag overrides
  const [positionOverrides, setPositionOverrides] = useState<Map<string, Position>>(new Map());

  const nodeMap = useMemo(() => new Map(mindMap.nodes.map((n) => [n.id, n])), [mindMap.nodes]);

  // Compute layout positions
  const layoutPositions = useMemo(
    () => computeLayoutPositions(nodeMap, mindMap.rootNodeId),
    [nodeMap, mindMap.rootNodeId],
  );

  // Merge layout with overrides
  const positions = useMemo(() => {
    const merged = new Map(layoutPositions);
    for (const [id, pos] of positionOverrides) {
      merged.set(id, pos);
    }
    return merged;
  }, [layoutPositions, positionOverrides]);

  // Clear overrides when layout changes (new nodes added, etc.)
  useEffect(() => {
    setPositionOverrides(new Map());
  }, [mindMap.nodes]);

  // Center canvas on mount
  useEffect(() => {
    if (hasCentered.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTranslate({ x: rect.width / 2, y: rect.height / 2 });
      hasCentered.current = true;
    }
  }, []);

  const visibleNodes = useMemo(
    () => getVisibleNodes(nodeMap, mindMap.rootNodeId),
    [nodeMap, mindMap.rootNodeId],
  );

  const visibleEdges = useMemo(
    () => getVisibleEdges(nodeMap, mindMap.rootNodeId),
    [nodeMap, mindMap.rootNodeId],
  );

  // Zoom with Ctrl+scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((s) => Math.max(0.3, Math.min(3, s + delta)));
    } else {
      setTranslate((t) => ({
        x: t.x - e.deltaX,
        y: t.y - e.deltaY,
      }));
    }
  }, []);

  // Pan with mouse drag on background
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).closest('[data-canvas-bg]')) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      translateStart.current = { ...translate };
      setSelectedNode(null);
    }
  };

  // Touch pan/pinch
  const touchStartRef = useRef<{
    touches: { x: number; y: number }[];
    scale: number;
    translate: { x: number; y: number };
  } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touches = Array.from(e.touches).map((t) => ({ x: t.clientX, y: t.clientY }));
    touchStartRef.current = { touches, scale, translate: { ...translate } };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const ts = touchStartRef.current;
    if (e.touches.length === 2 && ts.touches.length === 2) {
      const d1 = Math.hypot(ts.touches[1].x - ts.touches[0].x, ts.touches[1].y - ts.touches[0].y);
      const d2 = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY,
      );
      const ratio = d2 / d1;
      setScale(Math.max(0.3, Math.min(3, ts.scale * ratio)));
    } else if (e.touches.length === 1 && ts.touches.length >= 1) {
      setTranslate({
        x: ts.translate.x + (e.touches[0].clientX - ts.touches[0].x),
        y: ts.translate.y + (e.touches[0].clientY - ts.touches[0].y),
      });
    }
  };

  // Keyboard handling
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedNodeId || editingId) return;
      const isRoot = selectedNodeId === mindMap.rootNodeId;
      if (e.key === 'Tab') {
        e.preventDefault();
        onAddChild(selectedNodeId);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!isRoot) onAddSibling(selectedNodeId);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (!isRoot) {
          onDeleteNode(selectedNodeId);
          setSelectedNode(null);
        }
      } else if (e.key === 'F2') {
        e.preventDefault();
        const node = nodeMap.get(selectedNodeId);
        if (node) {
          setEditText(node.text);
          setEditingId(selectedNodeId);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, editingId, mindMap.rootNodeId, onAddChild, onAddSibling, onDeleteNode, setSelectedNode, nodeMap]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const saveEdit = () => {
    if (editingId) {
      const trimmed = editText.trim();
      if (trimmed) onEditSave(editingId, trimmed);
      setEditingId(null);
    }
  };

  // Auto-enter edit mode for newly created nodes
  useEffect(() => {
    if (pendingEditNodeId) {
      const node = nodeMap.get(pendingEditNodeId);
      if (node) {
        setEditText(node.text);
        setEditingId(pendingEditNodeId);
      }
      setPendingEditNode(null);
    }
  }, [pendingEditNodeId, mindMap.nodes]);

  // Handle dot drag
  const handleHandleMouseDown = (
    e: React.MouseEvent,
    nodeId: string,
    direction: Direction,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const state: HandleDragState = {
      fromNodeId: nodeId,
      direction,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
    };
    handleDragRef.current = state;
    setHandleDragState(state);
  };

  // Node drag
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    // Don't start drag if clicking on a handle dot, collapse button, or while editing
    if (
      (e.target as HTMLElement).closest('[data-handle-dot]') ||
      (e.target as HTMLElement).closest('[data-collapse-btn]') ||
      editingId === nodeId
    ) return;

    e.stopPropagation();
    const pos = positions.get(nodeId);
    if (!pos) return;

    nodeDragRef.current = {
      nodeId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startNodeX: pos.x,
      startNodeY: pos.y,
    };
  };

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Handle dot drag
      if (handleDragRef.current) {
        const updated = { ...handleDragRef.current, currentX: e.clientX, currentY: e.clientY };
        handleDragRef.current = updated;
        setHandleDragState(updated);
        return;
      }

      // Node drag
      if (nodeDragRef.current) {
        const { nodeId, startMouseX, startMouseY, startNodeX, startNodeY } = nodeDragRef.current;
        const dx = (e.clientX - startMouseX) / scale;
        const dy = (e.clientY - startMouseY) / scale;
        const dist = Math.hypot(e.clientX - startMouseX, e.clientY - startMouseY);

        if (dist > 3) {
          setIsNodeDragging(true);
          setPositionOverrides((prev) => {
            const next = new Map(prev);
            next.set(nodeId, { x: startNodeX + dx, y: startNodeY + dy });
            return next;
          });
        }
        return;
      }

      // Pan
      if (!isPanning) return;
      setTranslate({
        x: translateStart.current.x + (e.clientX - panStart.current.x),
        y: translateStart.current.y + (e.clientY - panStart.current.y),
      });
    },
    [isPanning, scale],
  );

  const handleCanvasMouseUp = useCallback(() => {
    // Handle dot drag end
    if (handleDragRef.current) {
      const { fromNodeId, direction } = handleDragRef.current;
      handleDragRef.current = null;
      setHandleDragState(null);

      // All handles create a child in that direction
      onAddChild(fromNodeId, direction);
      return;
    }

    // Node drag end
    if (nodeDragRef.current) {
      const { nodeId, startMouseX, startMouseY } = nodeDragRef.current;
      const wasDragging = isNodeDragging;
      nodeDragRef.current = null;
      setIsNodeDragging(false);

      if (!wasDragging) {
        // It was a click, not a drag
        if (nodeId === selectedNodeId) {
          // Already selected — enter edit mode
          const node = nodeMap.get(nodeId);
          if (node) {
            setEditText(node.text);
            setEditingId(nodeId);
          }
        } else {
          setSelectedNode(nodeId);
        }
      }
      return;
    }

    setIsPanning(false);
  }, [
    onAddChild,
    setSelectedNode,
    selectedNodeId,
    nodeMap,
    isNodeDragging,
  ]);

  // Compute connector lines from positions
  const connectorLines = useMemo(() => {
    const lines: {
      x1: number; y1: number;
      x2: number; y2: number;
      isVertical: boolean;
    }[] = [];

    for (const { parentId, childId } of visibleEdges) {
      const pp = positions.get(parentId);
      const cp = positions.get(childId);
      if (!pp || !cp) continue;

      const dx = cp.x - pp.x;
      const dy = cp.y - pp.y;
      const isVertical = Math.abs(dy) > Math.abs(dx);

      let x1: number, y1: number, x2: number, y2: number;

      if (isVertical) {
        // Vertical connection
        x1 = pp.x;
        y1 = pp.y + (dy > 0 ? NODE_HEIGHT / 2 : -NODE_HEIGHT / 2);
        x2 = cp.x;
        y2 = cp.y + (dy > 0 ? -NODE_HEIGHT / 2 : NODE_HEIGHT / 2);
      } else {
        // Horizontal connection
        const halfW = NODE_WIDTH_EST / 2;
        x1 = pp.x + (dx > 0 ? halfW : -halfW);
        y1 = pp.y;
        x2 = cp.x + (dx > 0 ? -halfW : halfW);
        y2 = cp.y;
      }

      lines.push({ x1, y1, x2, y2, isVertical });
    }

    return lines;
  }, [visibleEdges, positions]);

  // Get drag preview line (for handle dot drag)
  const getDragPreviewLine = (): { x1: number; y1: number; x2: number; y2: number; isVertical: boolean } | null => {
    if (!handleDragState || !containerRef.current) return null;
    const pos = positions.get(handleDragState.fromNodeId);
    if (!pos) return null;

    const containerRect = containerRef.current.getBoundingClientRect();

    // Convert mouse position to canvas coordinates
    const mouseCanvasX = (handleDragState.currentX - containerRect.left - translate.x) / scale;
    const mouseCanvasY = (handleDragState.currentY - containerRect.top - translate.y) / scale;

    const dir = handleDragState.direction;
    const isVertical = dir === 'top' || dir === 'bottom';

    let x1: number, y1: number;
    if (isVertical) {
      x1 = pos.x;
      y1 = pos.y + (dir === 'bottom' ? NODE_HEIGHT / 2 : -NODE_HEIGHT / 2);
    } else {
      const halfW = NODE_WIDTH_EST / 2;
      x1 = pos.x + (dir === 'right' ? halfW : -halfW);
      y1 = pos.y;
    }

    return { x1, y1, x2: mouseCanvasX, y2: mouseCanvasY, isVertical };
  };

  const handleDotClasses =
    'absolute w-4 h-4 rounded-full bg-accent border border-white cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:scale-125';
  const handleDotClassesSelected =
    'absolute w-4 h-4 rounded-full bg-accent border border-white cursor-crosshair transition-opacity z-10 hover:scale-125';

  const dragPreview = getDragPreviewLine();

  return (
    <div
      ref={containerRef}
      className={`flex-1 overflow-hidden relative bg-bg-primary ${
        isNodeDragging ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'
      }`}
      style={{ touchAction: 'none' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      data-canvas-bg
    >
      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
        }}
      >
        {/* SVG connector lines */}
        <svg
          className="absolute pointer-events-none"
          style={{
            left: '-4000px',
            top: '-4000px',
            width: '8000px',
            height: '8000px',
            overflow: 'visible',
          }}
        >
          <g transform="translate(4000, 4000)">
            {connectorLines.map((line, i) => {
              let d: string;
              if (line.isVertical) {
                const my = (line.y1 + line.y2) / 2;
                d = `M ${line.x1} ${line.y1} C ${line.x1} ${my}, ${line.x2} ${my}, ${line.x2} ${line.y2}`;
              } else {
                const mx = (line.x1 + line.x2) / 2;
                d = `M ${line.x1} ${line.y1} C ${mx} ${line.y1}, ${mx} ${line.y2}, ${line.x2} ${line.y2}`;
              }
              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke="var(--color-border)"
                  strokeWidth="1.5"
                  opacity="0.5"
                />
              );
            })}
            {/* Drag preview line */}
            {dragPreview && (() => {
              let d: string;
              if (dragPreview.isVertical) {
                const my = (dragPreview.y1 + dragPreview.y2) / 2;
                d = `M ${dragPreview.x1} ${dragPreview.y1} C ${dragPreview.x1} ${my}, ${dragPreview.x2} ${my}, ${dragPreview.x2} ${dragPreview.y2}`;
              } else {
                const mx = (dragPreview.x1 + dragPreview.x2) / 2;
                d = `M ${dragPreview.x1} ${dragPreview.y1} C ${mx} ${dragPreview.y1}, ${mx} ${dragPreview.y2}, ${dragPreview.x2} ${dragPreview.y2}`;
              }
              return (
                <path
                  d={d}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.6"
                />
              );
            })()}
          </g>
        </svg>

        {/* Absolutely-positioned nodes */}
        <div className="relative" style={{ width: 0, height: 0 }}>
          {visibleNodes.map(({ nodeId, node, isRoot }) => {
            const pos = positions.get(nodeId);
            if (!pos) return null;

            const hasChildren = node.children.length > 0;
            const isSelected = selectedNodeId === nodeId;
            const isEditing = editingId === nodeId;

            return (
              <div
                key={nodeId}
                className="group absolute"
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isNodeDragging && nodeDragRef.current?.nodeId === nodeId ? 50 : isSelected ? 10 : 1,
                }}
              >
                <div
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm select-none transition-all whitespace-nowrap ${
                    isSelected ? 'ring-2 ring-accent ring-offset-1' : ''
                  } ${isRoot ? 'font-semibold text-base' : ''} ${
                    isNodeDragging && nodeDragRef.current?.nodeId === nodeId
                      ? 'cursor-grabbing'
                      : 'cursor-grab'
                  }`}
                  style={{
                    boxShadow: NEU.raisedSm,
                    backgroundColor: node.color || 'var(--color-bg-card)',
                    color: node.color ? '#fff' : 'var(--color-text-primary)',
                  }}
                  onMouseDown={(e) => handleNodeMouseDown(e, nodeId)}
                  data-node-id={nodeId}
                >
                  {hasChildren && (
                    <button
                      data-collapse-btn
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleCollapse(nodeId);
                      }}
                      className="shrink-0 w-4 h-4 flex items-center justify-center opacity-60 hover:opacity-100"
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          transform: node.collapsed ? 'rotate(-90deg)' : undefined,
                          transition: 'transform 0.15s',
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  )}

                  {isEditing ? (
                    <input
                      ref={inputRef}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') saveEdit();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={saveEdit}
                      className="bg-transparent outline-none text-sm min-w-[40px]"
                      style={{ color: 'inherit' }}
                    />
                  ) : (
                    <span>{node.text}</span>
                  )}

                  {hasChildren && node.collapsed && (
                    <span className="text-xs opacity-50 ml-1">({node.children.length})</span>
                  )}

                  {/* Handle dots */}
                  {/* Right handle */}
                  <div
                    data-handle-dot
                    className={isSelected ? handleDotClassesSelected : handleDotClasses}
                    style={{ right: 0, top: '50%', transform: 'translateX(50%) translateY(-50%)' }}
                    onMouseDown={(e) => handleHandleMouseDown(e, nodeId, 'right')}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      onAddChild(nodeId, 'right');
                    }}
                  />
                  {/* Top handle */}
                  <div
                    data-handle-dot
                    className={isSelected ? handleDotClassesSelected : handleDotClasses}
                    style={{ top: 0, left: '50%', transform: 'translateX(-50%) translateY(-50%)' }}
                    onMouseDown={(e) => handleHandleMouseDown(e, nodeId, 'top')}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      onAddChild(nodeId, 'top');
                    }}
                  />
                  {/* Bottom handle */}
                  <div
                    data-handle-dot
                    className={isSelected ? handleDotClassesSelected : handleDotClasses}
                    style={{ bottom: 0, left: '50%', transform: 'translateX(-50%) translateY(50%)' }}
                    onMouseDown={(e) => handleHandleMouseDown(e, nodeId, 'bottom')}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      onAddChild(nodeId, 'bottom');
                    }}
                  />
                  {/* Left handle */}
                  <div
                    data-handle-dot
                    className={isSelected ? handleDotClassesSelected : handleDotClasses}
                    style={{ left: 0, top: '50%', transform: 'translateX(-50%) translateY(-50%)' }}
                    onMouseDown={(e) => handleHandleMouseDown(e, nodeId, 'left')}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      onAddChild(nodeId, 'left');
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 text-xs text-text-muted tabular-nums bg-bg-card/80 px-2 py-1 rounded-lg">
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
