import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { generateId, getDeviceId } from '../utils/uuid';
import type { MindMap, MindMapNode } from '@shared/types';
import { ACTIVITY_COLORS } from '@shared/constants';

export function useMindMaps() {
  const mindMaps = useLiveQuery(
    () =>
      db.mindMaps
        .filter((m) => !m.deletedAt)
        .toArray()
        .then((arr) => arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
    [],
  );

  const createMindMap = async (title: string) => {
    const now = new Date().toISOString();
    const rootId = generateId();
    const color = ACTIVITY_COLORS[Math.floor(Math.random() * ACTIVITY_COLORS.length)];
    const mindMap: MindMap = {
      id: generateId(),
      title,
      nodes: [{ id: rootId, text: title, children: [] }],
      rootNodeId: rootId,
      color,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(),
    };
    await db.mindMaps.add(mindMap);
    return mindMap;
  };

  const updateMindMap = async (id: string, patch: Partial<Pick<MindMap, 'title' | 'nodes' | 'color'>>) => {
    await db.mindMaps.update(id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteMindMap = async (id: string) => {
    const now = new Date().toISOString();
    await db.mindMaps.update(id, {
      deletedAt: now,
      updatedAt: now,
    });
  };

  const addNode = async (mindMapId: string, parentNodeId: string, text: string, direction?: MindMapNode['direction']) => {
    const mindMap = await db.mindMaps.get(mindMapId);
    if (!mindMap) return;
    const newNode: MindMapNode = { id: generateId(), text, children: [], ...(direction ? { direction } : {}) };
    const nodes = mindMap.nodes.map((n) =>
      n.id === parentNodeId ? { ...n, children: [...n.children, newNode.id] } : n,
    );
    nodes.push(newNode);
    await db.mindMaps.update(mindMapId, { nodes, updatedAt: new Date().toISOString() });
    return newNode;
  };

  const addNodeAtIndex = async (mindMapId: string, parentNodeId: string, text: string, index: number, direction?: MindMapNode['direction']) => {
    const mindMap = await db.mindMaps.get(mindMapId);
    if (!mindMap) return;
    const newNode: MindMapNode = { id: generateId(), text, children: [], ...(direction ? { direction } : {}) };
    const nodes = mindMap.nodes.map((n) => {
      if (n.id === parentNodeId) {
        const children = [...n.children];
        children.splice(index, 0, newNode.id);
        return { ...n, children };
      }
      return n;
    });
    nodes.push(newNode);
    await db.mindMaps.update(mindMapId, { nodes, updatedAt: new Date().toISOString() });
    return newNode;
  };

  const updateNode = async (mindMapId: string, nodeId: string, patch: Partial<Pick<MindMapNode, 'text' | 'color' | 'collapsed'>>) => {
    const mindMap = await db.mindMaps.get(mindMapId);
    if (!mindMap) return;
    const nodes = mindMap.nodes.map((n) =>
      n.id === nodeId ? { ...n, ...patch } : n,
    );
    await db.mindMaps.update(mindMapId, { nodes, updatedAt: new Date().toISOString() });
  };

  const deleteNode = async (mindMapId: string, nodeId: string) => {
    const mindMap = await db.mindMaps.get(mindMapId);
    if (!mindMap || nodeId === mindMap.rootNodeId) return;

    // Collect all descendant IDs to remove
    const toRemove = new Set<string>();
    const collect = (id: string) => {
      toRemove.add(id);
      const node = mindMap.nodes.find((n) => n.id === id);
      node?.children.forEach(collect);
    };
    collect(nodeId);

    const nodes = mindMap.nodes
      .filter((n) => !toRemove.has(n.id))
      .map((n) => ({
        ...n,
        children: n.children.filter((c) => !toRemove.has(c)),
      }));

    await db.mindMaps.update(mindMapId, { nodes, updatedAt: new Date().toISOString() });
  };

  return {
    mindMaps: mindMaps ?? [],
    createMindMap,
    updateMindMap,
    deleteMindMap,
    addNode,
    addNodeAtIndex,
    updateNode,
    deleteNode,
  };
}
