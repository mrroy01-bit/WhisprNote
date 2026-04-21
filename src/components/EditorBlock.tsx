import { useEffect, useRef, useState } from 'react';
import type {
  ClipboardEvent,
  DragEvent,
  KeyboardEvent,
  MouseEvent,
} from 'react';
import {
  ArrowUp,
  ChevronDown,
  Copy,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { buttonHoverVariants } from '../lib/animations';
import { cn } from '../lib/cn';
import { Block } from '../types';

interface SlashCommandMatch {
  query: string;
  start: number;
  end: number;
  beforeText: string;
  afterText: string;
}

interface EditorBlockProps {
  block: Block;
  index: number;
  readOnly?: boolean;
  focusNonce?: number;
  isSlashMenuActive?: boolean;
  isDragging?: boolean;
  dragPosition?: 'above' | 'below' | null;
  onFocus: () => void;
  onChange: (updates: Partial<Block>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onTypeChange: (event: MouseEvent<HTMLButtonElement>) => void;
  onAddAbove: () => void;
  onAddBelow: () => void;
  onInsertParagraphBelow: () => void;
  onRemoveIfEmpty: () => void;
  onSplitPaste: (text: string) => void;
  onRequestSlashMenu: (payload: {
    blockId: string;
    query: string;
    start: number;
    end: number;
    beforeText: string;
    afterText: string;
    rect: DOMRect;
  }) => void;
  onCloseSlashMenu: () => void;
  onSlashMenuMove: (direction: 1 | -1) => void;
  onSelectSlashMenu: () => void;
  onDragStart: (blockId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, blockId: string) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, blockId: string) => void;
}

function getSlashCommandMatch(value: string): SlashCommandMatch | null {
  const match = /(^|\s)\/([^\s]*)$/.exec(value);

  if (!match) {
    return null;
  }

  const prefix = match[1] ?? '';
  const query = match[2] ?? '';
  const start = (match.index ?? 0) + prefix.length;

  return {
    query,
    start,
    end: value.length,
    beforeText: value.slice(0, start),
    afterText: value.slice(value.length),
  };
}

export function EditorBlock({
  block,
  index,
  readOnly = false,
  focusNonce = 0,
  isSlashMenuActive = false,
  isDragging = false,
  dragPosition = null,
  onFocus,
  onChange,
  onDelete,
  onDuplicate,
  onTypeChange,
  onAddAbove,
  onAddBelow,
  onInsertParagraphBelow,
  onRemoveIfEmpty,
  onSplitPaste,
  onRequestSlashMenu,
  onCloseSlashMenu,
  onSlashMenuMove,
  onSelectSlashMenu,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: EditorBlockProps) {
  const [isFocused, setIsFocused] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!textRef.current) {
      return;
    }

    textRef.current.style.height = '0px';
    textRef.current.style.height = `${textRef.current.scrollHeight}px`;
  }, [block.content, block.imageUrl, block.type]);

  useEffect(() => {
    if (!focusNonce || !textRef.current || block.type === 'divider') {
      return;
    }

    const element = textRef.current;
    element.focus();
    const valueLength = element.value.length;
    element.setSelectionRange(valueLength, valueLength);
  }, [block.type, focusNonce]);

  const currentValue = block.type === 'image' ? block.imageUrl || '' : block.content;

  const baseInputClasses =
    'w-full resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-slate-900 placeholder:text-slate-300 focus:outline-none disabled:cursor-default';

  const typeStyles: Record<Block['type'], string> = {
    paragraph: `${baseInputClasses} text-[15px] leading-7`,
    heading1: `${baseInputClasses} text-3xl font-semibold tracking-tight md:text-4xl`,
    heading2: `${baseInputClasses} text-2xl font-semibold tracking-tight md:text-3xl`,
    heading3: `${baseInputClasses} text-xl font-semibold tracking-tight md:text-2xl`,
    bullet: `${baseInputClasses} text-[15px] leading-7`,
    numbered: `${baseInputClasses} text-[15px] leading-7`,
    todo: `${baseInputClasses} text-[15px] leading-7`,
    code: 'w-full resize-none overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 font-mono text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:cursor-default disabled:opacity-100',
    quote: `${baseInputClasses} border-l-2 border-slate-300 pl-4 text-[15px] italic leading-7 text-slate-600`,
    divider: `${baseInputClasses} text-center text-slate-400`,
    image: `${baseInputClasses} text-[15px] leading-7 text-blue-600`,
  };

  const placeholder =
    block.type === 'code'
      ? 'Paste code…'
      : block.type === 'image'
        ? 'Paste image URL…'
        : 'Start typing…';

  const syncSlashMenu = (value: string, element: HTMLTextAreaElement) => {
    if (readOnly || block.type === 'code' || block.type === 'divider' || block.type === 'image') {
      onCloseSlashMenu();
      return;
    }

    const match = getSlashCommandMatch(value);

    if (!match) {
      onCloseSlashMenu();
      return;
    }

    onRequestSlashMenu({
      blockId: block.id,
      query: match.query,
      start: match.start,
      end: match.end,
      beforeText: match.beforeText,
      afterText: match.afterText,
      rect: element.getBoundingClientRect(),
    });
  };

  const handleTextChange = (value: string, element: HTMLTextAreaElement) => {
    if (block.type === 'image') {
      onChange({ imageUrl: value });
      return;
    }

    onChange({ content: value });
    syncSlashMenu(value, element);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) {
      return;
    }

    if (isSlashMenuActive) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        onSlashMenuMove(1);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        onSlashMenuMove(-1);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        onSelectSlashMenu();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseSlashMenu();
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey && block.type !== 'code') {
      event.preventDefault();
      onInsertParagraphBelow();
      return;
    }

    if (event.key === 'Backspace' && currentValue.length === 0 && block.type !== 'code') {
      event.preventDefault();
      onRemoveIfEmpty();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (readOnly || block.type !== 'paragraph') {
      return;
    }

    const pastedText = event.clipboardData.getData('text/plain');

    if (!pastedText.includes('\n')) {
      return;
    }

    event.preventDefault();
    onSplitPaste(pastedText);
  };

  const renderPrefix = () => {
    switch (block.type) {
      case 'bullet':
        return <span className="mt-2 text-lg leading-none text-slate-400">•</span>;
      case 'numbered':
        return <span className="mt-1.5 text-sm font-medium text-slate-400">{index + 1}.</span>;
      case 'todo':
        return (
          <input
            type="checkbox"
            checked={block.checked || false}
            onChange={(event) => onChange({ checked: event.target.checked })}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
            disabled={readOnly}
          />
        );
      default:
        return null;
    }
  };

  const renderContent = () => {
    if (block.type === 'divider') {
      return <div className="my-2 border-t border-slate-200" />;
    }

    return (
      <textarea
        ref={textRef}
        rows={1}
        value={currentValue}
        onChange={(event) => handleTextChange(event.target.value, event.target)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={() => {
          setIsFocused(true);
          onFocus();
          syncSlashMenu(currentValue, eventTargetOrFallback(textRef.current));
        }}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={typeStyles[block.type]}
        readOnly={readOnly}
        spellCheck={block.type !== 'code'}
      />
    );
  };

  return (
    <motion.div
      layout
      onDragOver={(event) => onDragOver(event, block.id)}
      onDrop={(event) => onDrop(event, block.id)}
      className={cn(
        'group relative flex items-start gap-3 rounded-[24px] px-3 py-3 transition-all duration-200',
        readOnly ? 'hover:bg-transparent' : isFocused ? 'bg-white shadow-[0_20px_40px_-38px_rgba(15,23,42,0.65)] ring-1 ring-slate-200' : 'hover:bg-slate-50/90',
        isDragging && 'opacity-45',
        dragPosition === 'above' && 'before:absolute before:left-3 before:right-3 before:top-0 before:h-0.5 before:rounded-full before:bg-slate-900',
        dragPosition === 'below' && 'after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-slate-900'
      )}
    >
      {!readOnly && (
        <div className="flex items-center gap-1 pt-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <motion.button
            variants={buttonHoverVariants}
            initial={false}
            whileHover="hover"
            whileTap="tap"
            onClick={onTypeChange}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-200/80 hover:text-slate-700"
            title="Change block type"
            type="button"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.button>

          <button
            className="hidden h-8 w-8 cursor-grab items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-slate-200/80 hover:text-slate-700 lg:flex"
            title="Drag block"
            type="button"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', block.id);
              onDragStart(block.id);
            }}
            onDragEnd={onDragEnd}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="flex min-h-[32px] w-5 shrink-0 items-start justify-center pt-1 text-slate-400">
          {renderPrefix()}
        </div>
        <div className="flex-1 py-1">{renderContent()}</div>
      </div>

      {!readOnly && (
        <div className="mt-1 flex items-center gap-1 opacity-0 transition-all duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <motion.button
            variants={buttonHoverVariants}
            initial={false}
            whileHover="hover"
            whileTap="tap"
            onClick={onAddAbove}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-700"
            title="Add block above"
            type="button"
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>

          <motion.button
            variants={buttonHoverVariants}
            initial={false}
            whileHover="hover"
            whileTap="tap"
            onClick={onAddBelow}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-700"
            title="Add block below"
            type="button"
          >
            <Plus className="h-4 w-4" />
          </motion.button>

          <motion.button
            variants={buttonHoverVariants}
            initial={false}
            whileHover="hover"
            whileTap="tap"
            onClick={onDuplicate}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-700"
            title="Duplicate block"
            type="button"
          >
            <Copy className="h-4 w-4" />
          </motion.button>

          <motion.button
            variants={buttonHoverVariants}
            initial={false}
            whileHover="hover"
            whileTap="tap"
            onClick={onDelete}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
            title="Delete block"
            type="button"
          >
            <Trash2 className="h-4 w-4" />
          </motion.button>

          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300 xl:inline">
            {block.type === 'code' ? 'Multi-line' : 'Enter = new block'}
          </span>
        </div>
      )}
    </motion.div>
  );
}

function eventTargetOrFallback(element: HTMLTextAreaElement | null) {
  if (!element) {
    return {
      getBoundingClientRect: () => new DOMRect(),
    } as HTMLTextAreaElement;
  }

  return element;
}
