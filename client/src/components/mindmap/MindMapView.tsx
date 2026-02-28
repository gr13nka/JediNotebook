import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useMindMaps } from '../../hooks/useMindMaps';
import { useMindMapUIStore } from '../../stores/mindMapUIStore';
import { useTranslation } from '../../i18n/useTranslation';
import { NEU } from '../../utils/shadows';
import { MindMapCanvas } from './MindMapCanvas';
import { MindMapToolbar } from './MindMapToolbar';
import { MindUnloadMode } from './MindUnloadMode';
import { CountdownTimer } from './CountdownTimer';
import { InboxView } from '../inbox/InboxView';

export function MindMapView() {
  const { t } = useTranslation();
  const { mindMaps, addNode, addNodeAtIndex, updateNode, deleteNode } = useMindMaps();
  const activeMindMapId = useMindMapUIStore((s) => s.activeMindMapId);
  const setActiveMindMap = useMindMapUIStore((s) => s.setActiveMindMap);
  const selectedNodeId = useMindMapUIStore((s) => s.selectedNodeId);
  const setSelectedNode = useMindMapUIStore((s) => s.setSelectedNode);
  const mindUnloadActive = useMindMapUIStore((s) => s.mindUnloadActive);
  const timerVisible = useMindMapUIStore((s) => s.timerVisible);
  const setPendingEditNode = useMindMapUIStore((s) => s.setPendingEditNode);

  const [mobileTab, setMobileTab] = useState<'map' | 'inbox'>('map');

  const activeMindMap = mindMaps.find((m) => m.id === activeMindMapId) ?? null;

  // Auto-select first mind map if none active
  useEffect(() => {
    if (!activeMindMapId && mindMaps.length > 0) {
      setActiveMindMap(mindMaps[0].id);
    }
  }, [activeMindMapId, mindMaps, setActiveMindMap]);

  const handleAddChild = async () => {
    if (!activeMindMapId || !selectedNodeId) return;
    const newNode = await addNode(activeMindMapId, selectedNodeId, t('mindmap.newNode'));
    if (newNode) {
      setSelectedNode(newNode.id);
      setPendingEditNode(newNode.id);
    }
  };

  const handleAddSibling = async (nodeId: string) => {
    if (!activeMindMap) return;
    const parent = activeMindMap.nodes.find((n) => n.children.includes(nodeId));
    if (!parent) return;
    const refNode = activeMindMap.nodes.find((n) => n.id === nodeId);
    const dir = refNode?.direction;
    const newNode = await addNode(activeMindMap.id, parent.id, t('mindmap.newNode'), dir);
    if (newNode) {
      setSelectedNode(newNode.id);
      setPendingEditNode(newNode.id);
    }
  };

  const handleAddSiblingAbove = async (nodeId: string) => {
    if (!activeMindMap) return;
    const parent = activeMindMap.nodes.find((n) => n.children.includes(nodeId));
    if (!parent) return;
    const index = parent.children.indexOf(nodeId);
    const refNode = activeMindMap.nodes.find((n) => n.id === nodeId);
    const dir = refNode?.direction;
    const newNode = await addNodeAtIndex(activeMindMap.id, parent.id, t('mindmap.newNode'), index, dir);
    if (newNode) {
      setSelectedNode(newNode.id);
      setPendingEditNode(newNode.id);
    }
  };

  const handleAddSiblingBelow = async (nodeId: string) => {
    if (!activeMindMap) return;
    const parent = activeMindMap.nodes.find((n) => n.children.includes(nodeId));
    if (!parent) return;
    const index = parent.children.indexOf(nodeId) + 1;
    const refNode = activeMindMap.nodes.find((n) => n.id === nodeId);
    const dir = refNode?.direction;
    const newNode = await addNodeAtIndex(activeMindMap.id, parent.id, t('mindmap.newNode'), index, dir);
    if (newNode) {
      setSelectedNode(newNode.id);
      setPendingEditNode(newNode.id);
    }
  };

  const handleEditSave = async (nodeId: string, text: string) => {
    if (!activeMindMapId) return;
    await updateNode(activeMindMapId, nodeId, { text });
  };

  const handleDeleteNode = async (nodeId?: string) => {
    const targetId = nodeId || selectedNodeId;
    if (!activeMindMapId || !targetId) return;
    await deleteNode(activeMindMapId, targetId);
    setSelectedNode(null);
  };

  const handleToggleCollapse = async (nodeId: string) => {
    if (!activeMindMap) return;
    const node = activeMindMap.nodes.find((n) => n.id === nodeId);
    if (node) {
      await updateNode(activeMindMap.id, nodeId, { collapsed: !node.collapsed });
    }
  };

  // Mobile tab toggle
  const mobileTabToggle = (
    <div className="flex md:hidden border-b border-border bg-bg-primary">
      <button
        onClick={() => setMobileTab('map')}
        className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
          mobileTab === 'map' ? 'text-accent border-b-2 border-accent' : 'text-text-muted'
        }`}
      >
        {t('mindmap.title')}
      </button>
      <button
        onClick={() => setMobileTab('inbox')}
        className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
          mobileTab === 'inbox' ? 'text-accent border-b-2 border-accent' : 'text-text-muted'
        }`}
      >
        {t('nav.inbox')}
      </button>
    </div>
  );

  const mapContent = (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {mindUnloadActive ? (
        <MindUnloadMode />
      ) : activeMindMap ? (
        <MindMapCanvas
          mindMap={activeMindMap}
          onEditSave={handleEditSave}
          onAddChild={(parentId, direction) => {
            if (!activeMindMapId) return;
            // For non-root nodes without explicit direction, inherit from parent
            let dir = direction;
            if (!dir && activeMindMap) {
              const parentNode = activeMindMap.nodes.find((n) => n.id === parentId);
              if (parentNode?.direction) dir = parentNode.direction;
            }
            addNode(activeMindMapId, parentId, t('mindmap.newNode'), dir).then((n) => {
              if (n) {
                setSelectedNode(n.id);
                setPendingEditNode(n.id);
              }
            });
          }}
          onAddSibling={handleAddSibling}
          onAddSiblingAbove={handleAddSiblingAbove}
          onAddSiblingBelow={handleAddSiblingBelow}
          onDeleteNode={(id) => handleDeleteNode(id)}
          onToggleCollapse={handleToggleCollapse}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-text-muted text-sm gap-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="3" x2="12" y2="9" />
            <line x1="12" y1="15" x2="12" y2="21" />
            <line x1="3" y1="12" x2="9" y2="12" />
            <line x1="15" y1="12" x2="21" y2="12" />
          </svg>
          <p>{t('mindmap.empty')}</p>
        </div>
      )}

      {/* Floating timer */}
      <AnimatePresence>
        {timerVisible && (
          <motion.div
            className="absolute top-3 right-3 z-20"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <CountdownTimer />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const inboxContent = (
    <div className="w-full md:w-80 lg:w-96 shrink-0 border-l border-border overflow-y-auto bg-bg-primary p-3">
      <InboxView embedded />
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] md:h-screen overflow-hidden">
      <MindMapToolbar
        activeMindMap={activeMindMap}
        onAddChild={handleAddChild}
        onDeleteNode={() => handleDeleteNode()}
      />

      {mobileTabToggle}

      <div className="flex-1 flex min-h-0">
        {/* Desktop: split pane */}
        <div className="hidden md:flex flex-1 min-h-0">
          {mapContent}
          {inboxContent}
        </div>

        {/* Mobile: tab toggle */}
        <div className="flex md:hidden flex-1 min-h-0">
          {mobileTab === 'map' ? mapContent : (
            <div className="flex-1 overflow-y-auto p-3">
              <InboxView embedded />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
