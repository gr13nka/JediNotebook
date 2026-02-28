import type { MindMap, MindMapNode } from '@shared/types';

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getNodeMap(nodes: MindMapNode[]): Map<string, MindMapNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toFreeMindXml(nodeMap: Map<string, MindMapNode>, nodeId: string, indent: string): string {
  const node = nodeMap.get(nodeId);
  if (!node) return '';
  const children = node.children
    .map((cid) => toFreeMindXml(nodeMap, cid, indent + '  '))
    .join('\n');
  if (children) {
    return `${indent}<node TEXT="${escapeXml(node.text)}">\n${children}\n${indent}</node>`;
  }
  return `${indent}<node TEXT="${escapeXml(node.text)}" />`;
}

export function exportFreeMind(mindMap: MindMap) {
  const nodeMap = getNodeMap(mindMap.nodes);
  const xml = `<map version="1.0.1">\n${toFreeMindXml(nodeMap, mindMap.rootNodeId, '  ')}\n</map>`;
  downloadFile(xml, `${mindMap.title}.mm`, 'application/xml');
}

function toMarkdown(nodeMap: Map<string, MindMapNode>, nodeId: string, depth: number): string {
  const node = nodeMap.get(nodeId);
  if (!node) return '';
  const prefix = '  '.repeat(depth) + '- ';
  const lines = [prefix + node.text];
  for (const cid of node.children) {
    lines.push(toMarkdown(nodeMap, cid, depth + 1));
  }
  return lines.join('\n');
}

export function exportMarkdown(mindMap: MindMap) {
  const nodeMap = getNodeMap(mindMap.nodes);
  const md = toMarkdown(nodeMap, mindMap.rootNodeId, 0);
  downloadFile(md, `${mindMap.title}.md`, 'text/markdown');
}

export function exportJSON(mindMap: MindMap) {
  const json = JSON.stringify(mindMap, null, 2);
  downloadFile(json, `${mindMap.title}.json`, 'application/json');
}
