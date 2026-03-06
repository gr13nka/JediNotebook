import React, { useState, useEffect, useRef, useMemo } from 'react';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';

interface EmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  onRemove?: () => void;
  anchorRect?: DOMRect | null;
}

const RECENT_KEY = 'emoji-picker-recent';
const MAX_RECENT = 8;

interface Category {
  labelKey: string;
  emojis: string[];
}

const CATEGORIES: Category[] = [
  {
    labelKey: 'emoji.smileys',
    emojis: ['😀','😄','😊','🥰','😎','🤓','🧐','😤','🔥','💪','👋','👍','👏','🎉','✨','💡','❤️','⭐'],
  },
  {
    labelKey: 'emoji.work',
    emojis: ['📋','📌','📎','📁','📂','📊','📈','💼','🗂️','🗓️','✏️','📝','🖊️','💻','🎯','🏆','🔑','🔒','⚙️','🛠️','📐','🧩','📦','🚀'],
  },
  {
    labelKey: 'emoji.objects',
    emojis: ['💎','💰','🎵','🎨','📷','🎬','📚','📖','🔔','💡','🔍','⏰','🧪','🧲','🪄','🎲','🎭','🏷️'],
  },
  {
    labelKey: 'emoji.nature',
    emojis: ['🌱','🌿','🍀','🌸','🌻','🌲','🌊','☀️','🌙','⚡','🌈','🦋','🐝','🐱','🐶','🦊'],
  },
  {
    labelKey: 'emoji.food',
    emojis: ['☕','🍵','🧃','🍎','🍊','🍋','🍇','🥑','🍕','🍰','🍩','🧁'],
  },
  {
    labelKey: 'emoji.travel',
    emojis: ['🏠','🏢','🏫','🏥','✈️','🚗','🚀','🗺️','🌍','🏔️','🏖️','⛺'],
  },
  {
    labelKey: 'emoji.symbols',
    emojis: ['✅','❌','⭕','❗','❓','💬','💭','🔴','🟠','🟡','🟢','🔵','🟣','⬛','⬜','🔶'],
  },
];

const SEARCH_MAP: Record<string, string[]> = {
  '😀': ['smile','happy','grin'],
  '😄': ['laugh','happy','joy'],
  '😊': ['blush','smile','happy'],
  '🥰': ['love','hearts','adore'],
  '😎': ['cool','sunglasses'],
  '🤓': ['nerd','glasses','smart'],
  '🧐': ['monocle','inspect','think'],
  '😤': ['angry','huff','determined'],
  '🔥': ['fire','hot','trending'],
  '💪': ['strong','muscle','power'],
  '👋': ['wave','hello','hi'],
  '👍': ['thumbsup','good','ok'],
  '👏': ['clap','bravo'],
  '🎉': ['party','celebrate','tada'],
  '✨': ['sparkle','magic','new'],
  '💡': ['idea','lightbulb','tip'],
  '❤️': ['heart','love','red'],
  '⭐': ['star','favorite'],
  '📋': ['clipboard','list','tasks'],
  '📌': ['pin','important','pushpin'],
  '📎': ['clip','attach','paperclip'],
  '📁': ['folder','directory'],
  '📂': ['folder','open'],
  '📊': ['chart','graph','analytics'],
  '📈': ['growth','chart','trending'],
  '💼': ['briefcase','work','business'],
  '🗂️': ['index','files','organize'],
  '🗓️': ['calendar','date','schedule'],
  '✏️': ['pencil','edit','write'],
  '📝': ['note','memo','write'],
  '🖊️': ['pen','write'],
  '💻': ['computer','laptop','code'],
  '🎯': ['target','goal','aim'],
  '🏆': ['trophy','win','champion'],
  '🔑': ['key','access','unlock'],
  '🔒': ['lock','secure','private'],
  '⚙️': ['gear','settings','config'],
  '🛠️': ['tools','build','fix'],
  '📐': ['ruler','design','measure'],
  '🧩': ['puzzle','piece','fit'],
  '📦': ['package','box','ship'],
  '🚀': ['rocket','launch','fast'],
  '💎': ['gem','diamond','premium'],
  '💰': ['money','bag','finance'],
  '🎵': ['music','note','song'],
  '🎨': ['art','palette','design'],
  '📷': ['camera','photo'],
  '🎬': ['movie','film','action'],
  '📚': ['books','library','study'],
  '📖': ['book','read','open'],
  '🔔': ['bell','notification','alert'],
  '🔍': ['search','magnify','find'],
  '⏰': ['clock','alarm','time'],
  '🧪': ['test','experiment','science'],
  '🧲': ['magnet','attract'],
  '🪄': ['wand','magic'],
  '🎲': ['dice','game','random'],
  '🎭': ['theater','drama','masks'],
  '🏷️': ['tag','label','price'],
  '🌱': ['seedling','grow','start'],
  '🌿': ['herb','nature','green'],
  '🍀': ['clover','luck','four'],
  '🌸': ['cherry','blossom','spring'],
  '🌻': ['sunflower','sun'],
  '🌲': ['tree','evergreen','pine'],
  '🌊': ['wave','ocean','water'],
  '☀️': ['sun','sunny','bright'],
  '🌙': ['moon','night','crescent'],
  '⚡': ['lightning','bolt','energy'],
  '🌈': ['rainbow','colors'],
  '🦋': ['butterfly','transform'],
  '🐝': ['bee','busy','honey'],
  '🐱': ['cat','kitty'],
  '🐶': ['dog','puppy'],
  '🦊': ['fox','clever'],
  '☕': ['coffee','morning','cafe'],
  '🍵': ['tea','matcha','cup'],
  '🧃': ['juice','box'],
  '🍎': ['apple','red','fruit'],
  '🍊': ['orange','citrus'],
  '🍋': ['lemon','yellow','citrus'],
  '🍇': ['grape','purple','wine'],
  '🥑': ['avocado','green','healthy'],
  '🍕': ['pizza','food'],
  '🍰': ['cake','dessert','birthday'],
  '🍩': ['donut','sweet'],
  '🧁': ['cupcake','sweet'],
  '🏠': ['house','home'],
  '🏢': ['office','building','work'],
  '🏫': ['school','education'],
  '🏥': ['hospital','health','medical'],
  '✈️': ['plane','travel','flight'],
  '🚗': ['car','drive','vehicle'],
  '🗺️': ['map','world','explore'],
  '🌍': ['earth','globe','world'],
  '🏔️': ['mountain','summit','peak'],
  '🏖️': ['beach','vacation','sun'],
  '⛺': ['tent','camp','outdoor'],
  '✅': ['check','done','complete'],
  '❌': ['cross','no','cancel'],
  '⭕': ['circle','ring'],
  '❗': ['exclamation','important','alert'],
  '❓': ['question','help','unknown'],
  '💬': ['speech','chat','comment'],
  '💭': ['thought','think','bubble'],
  '🔴': ['red','circle','stop'],
  '🟠': ['orange','circle'],
  '🟡': ['yellow','circle'],
  '🟢': ['green','circle','go'],
  '🔵': ['blue','circle'],
  '🟣': ['purple','circle'],
  '⬛': ['black','square'],
  '⬜': ['white','square'],
  '🔶': ['diamond','orange'],
};

function getRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addRecent(emoji: string) {
  const recent = getRecent().filter((e) => e !== emoji);
  recent.unshift(emoji);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export function EmojiPicker({ open, onClose, onSelect, onRemove, anchorRect }: EmojiPickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [recent] = useState(getRecent);

  // Position calculation
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open || !anchorRect) return;
    const pickerW = 288;
    const pickerH = 360;
    let top = anchorRect.bottom + 6;
    let left = anchorRect.left;

    // Keep within viewport
    if (top + pickerH > window.innerHeight) {
      top = anchorRect.top - pickerH - 6;
    }
    if (left + pickerW > window.innerWidth) {
      left = window.innerWidth - pickerW - 8;
    }
    if (left < 8) left = 8;
    if (top < 8) top = 8;

    setPos({ top, left });
  }, [open, anchorRect]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [open, onClose]);

  // Filter emojis by search
  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const results: string[] = [];
    for (const [emoji, keywords] of Object.entries(SEARCH_MAP)) {
      if (keywords.some((kw) => kw.includes(q)) || emoji.includes(q)) {
        results.push(emoji);
      }
    }
    return results;
  }, [search]);

  const handleSelect = (emoji: string) => {
    addRecent(emoji);
    onSelect(emoji);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      ref={pickerRef}
      className="fixed z-[60] w-[288px] max-h-[360px] flex flex-col rounded-xl bg-bg-card border border-border overflow-hidden"
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        boxShadow: NEU.modal,
      }}
    >
      {/* Search + remove */}
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('emoji.search')}
          className="flex-1 text-sm bg-transparent text-text-primary placeholder:text-text-muted/50 focus:outline-none rounded-lg px-2 py-1"
          style={{ boxShadow: NEU.pressedSm }}
        />
        {onRemove && (
          <button
            onClick={() => { onRemove(); onClose(); }}
            className="text-[11px] text-red hover:text-red/80 whitespace-nowrap px-1.5 py-1 rounded transition-colors"
          >
            {t('projects.removeIcon')}
          </button>
        )}
      </div>

      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {filtered ? (
          /* Search results */
          filtered.length > 0 ? (
            <div className="grid grid-cols-8 gap-0.5">
              {filtered.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleSelect(emoji)}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg-elevated transition-colors text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted text-center py-4">No results</p>
          )
        ) : (
          <>
            {/* Recent */}
            {recent.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted/60 mb-1 px-0.5">
                  {t('emoji.recent')}
                </p>
                <div className="grid grid-cols-8 gap-0.5">
                  {recent.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleSelect(emoji)}
                      className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg-elevated transition-colors text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Categories */}
            {CATEGORIES.map((cat) => (
              <div key={cat.labelKey} className="mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted/60 mb-1 px-0.5">
                  {t(cat.labelKey as any)}
                </p>
                <div className="grid grid-cols-8 gap-0.5">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleSelect(emoji)}
                      className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg-elevated transition-colors text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
