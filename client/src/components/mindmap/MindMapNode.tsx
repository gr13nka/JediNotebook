import { useState, useRef, useEffect } from 'react';
import { NEU } from '../../utils/shadows';
import type { MindMapNode as MindMapNodeType } from '@shared/types';

interface Props {
  node: MindMapNodeType;
  isRoot: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEditSave: (id: string, text: string) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  nodeMap: Map<string, MindMapNodeType>;
}

export function MindMapNodeComponent({
  node,
  isRoot,
  isSelected,
  onSelect,
  onEditSave,
  onAddChild,
  onAddSibling,
  onDelete,
  onToggleCollapse,
  nodeMap,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(node.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    setEditText(node.text);
    setEditing(true);
  };

  const saveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== node.text) {
      onEditSave(node.id, trimmed);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') setEditing(false);
  };

  const handleNodeKeyDown = (e: React.KeyboardEvent) => {
    if (editing) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      onAddChild(node.id);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onAddSibling(node.id);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (!isRoot) onDelete(node.id);
    }
  };

  const hasChildren = node.children.length > 0;

  return (
    <div className="flex items-start gap-0">
      <div className="flex flex-col items-start">
        <div
          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm cursor-pointer select-none transition-colors min-w-[60px] ${
            isSelected ? 'ring-2 ring-accent' : ''
          } ${isRoot ? 'font-semibold' : ''}`}
          style={{
            boxShadow: NEU.raisedSm,
            backgroundColor: node.color || 'var(--color-bg-card)',
            color: node.color ? '#fff' : 'var(--color-text-primary)',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(node.id);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            startEdit();
          }}
          onKeyDown={handleNodeKeyDown}
          tabIndex={0}
          data-node-id={node.id}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(node.id);
              }}
              className="shrink-0 w-4 h-4 flex items-center justify-center opacity-60 hover:opacity-100"
            >
              <svg
                width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: node.collapsed ? 'rotate(-90deg)' : undefined, transition: 'transform 0.15s' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
          {editing ? (
            <input
              ref={inputRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={saveEdit}
              className="bg-transparent outline-none text-sm min-w-[40px] w-full"
              style={{ color: 'inherit' }}
            />
          ) : (
            <span className="whitespace-nowrap">{node.text}</span>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && !node.collapsed && (
        <div className="flex flex-col gap-1.5 ml-1 relative">
          {node.children.map((childId) => {
            const childNode = nodeMap.get(childId);
            if (!childNode) return null;
            return (
              <MindMapNodeComponent
                key={childId}
                node={childNode}
                isRoot={false}
                isSelected={isSelected && false}
                onSelect={onSelect}
                onEditSave={onEditSave}
                onAddChild={onAddChild}
                onAddSibling={onAddSibling}
                onDelete={onDelete}
                onToggleCollapse={onToggleCollapse}
                nodeMap={nodeMap}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
