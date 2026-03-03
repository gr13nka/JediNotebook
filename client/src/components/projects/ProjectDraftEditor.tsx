import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NEU } from '../../utils/shadows';
import { renderLineMd } from '../../utils/markdown';
import { useTranslation } from '../../i18n/useTranslation';
import type { Activity } from '@shared/types';

interface ProjectDraftEditorProps {
  title: string;
  description: string;
  onSaveTitle: (title: string) => void;
  onSave: (description: string) => void;
  linkedActivityId?: string | null;
  onLinkActivity?: (activityId: string | null) => void;
  activities?: Activity[];
}

export function ProjectDraftEditor({ title, description, onSaveTitle, onSave, linkedActivityId, onLinkActivity, activities }: ProjectDraftEditorProps) {
  const [localTitle, setLocalTitle] = useState(title);
  const [localDesc, setLocalDesc] = useState(description);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalDesc(description);
  }, [description]);

  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  // Auto-resize and focus when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      // Place cursor at end
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
      // Auto-resize
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, [isEditing]);

  const autoResize = useCallback(() => {
    if (textareaRef.current) {
      const ta = textareaRef.current;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, []);

  const handleTitleBlur = () => {
    if (localTitle !== title) {
      onSaveTitle(localTitle.trim());
    }
  };

  const handleDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalDesc(e.target.value);
    autoResize();
  };

  const handleDescBlur = () => {
    setIsEditing(false);
    if (localDesc !== description) {
      onSave(localDesc);
    }
  };

  const handlePreviewClick = () => {
    setIsEditing(true);
  };

  // Click on empty area to start editing
  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      setIsEditing(true);
    }
  };

  const hasContent = localDesc.trim().length > 0;

  // Render markdown preview lines
  const renderPreview = () => {
    const lines = localDesc.split('\n');
    return lines.map((line, i) => {
      if (line.trim() === '') {
        return <div key={i} className="h-6" />;
      }
      const rendered = renderLineMd(line);
      return (
        <div
          key={i}
          className="py-0.5 markdown-preview"
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      );
    });
  };

  const { t } = useTranslation();
  const nonBreakActivities = activities?.filter((a) => !a.isBreak) ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Title input - Google Keep style */}
      <input
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={handleTitleBlur}
        placeholder="Title"
        className="w-full bg-transparent text-xl font-bold text-text-primary placeholder:text-text-muted/40 focus:outline-none border-none mb-2 px-1"
      />

      {/* Activity link selector */}
      {onLinkActivity && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <select
            value={linkedActivityId ?? ''}
            onChange={(e) => onLinkActivity(e.target.value || null)}
            className="text-xs bg-transparent text-text-secondary border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-accent cursor-pointer"
            style={{ boxShadow: NEU.pressedSm }}
          >
            <option value="">{t('projects.noLinkedActivity')}</option>
            {nonBreakActivities.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="mx-auto w-full max-w-prose">
        <div
          ref={containerRef}
          onClick={handleContainerClick}
          className="rounded-xl p-4 text-sm text-text-primary leading-relaxed cursor-text overflow-y-auto no-scrollbar"
          style={{ boxShadow: NEU.pressedSm, minHeight: '300px' }}
        >
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={localDesc}
              onChange={handleDescChange}
              onBlur={handleDescBlur}
              className="w-full bg-transparent text-sm text-text-primary focus:outline-none border-none font-mono resize-none overflow-hidden selection:bg-accent/30 selection:text-text-primary"
              style={{ lineHeight: '1.625', whiteSpace: 'pre-wrap' }}
            />
          ) : (
            <div onClick={handlePreviewClick}>
              {!hasContent && (
                <span className="text-text-muted/40">Take a note...</span>
              )}
              {hasContent && renderPreview()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
