import { useEffect, useMemo, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { Block } from '../types';
import { buttonHoverVariants, modalVariants } from '../lib/animations';
import { cn } from '../lib/cn';
import { filterBlockTypeOptions } from '../lib/blockTypes';

interface BlockTypeMenuProps {
  onSelect: (type: Block['type']) => void;
  onSelectHighlighted: () => void;
  onClose: () => void;
  onSearchQueryChange: (query: string) => void;
  onHighlightedIndexChange: (index: number) => void;
  x: number;
  y: number;
  searchQuery: string;
  highlightedIndex: number;
  showSearchInput?: boolean;
  autoFocusSearch?: boolean;
}

export function BlockTypeMenu({
  onSelect,
  onSelectHighlighted,
  onClose,
  onSearchQueryChange,
  onHighlightedIndexChange,
  x,
  y,
  searchQuery,
  highlightedIndex,
  showSearchInput = true,
  autoFocusSearch = true,
}: BlockTypeMenuProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const filteredOptions = useMemo(
    () => filterBlockTypeOptions(searchQuery),
    [searchQuery]
  );

  useEffect(() => {
    if (!showSearchInput || !autoFocusSearch) {
      return;
    }

    inputRef.current?.focus();
  }, [autoFocusSearch, showSearchInput]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!filteredOptions.length) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onHighlightedIndexChange((highlightedIndex + 1) % filteredOptions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onHighlightedIndexChange(
        (highlightedIndex - 1 + filteredOptions.length) % filteredOptions.length
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      onSelectHighlighted();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={modalVariants}
      onClick={(event) => event.stopPropagation()}
      style={{ position: 'fixed', left: x, top: y }}
      className="z-50 w-[320px] rounded-3xl border border-slate-200/90 bg-white/95 p-2 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl"
    >
      {showSearchInput && (
        <div className="mb-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/90 px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search block types"
            className="h-11 w-full border-0 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      )}

      <div className="grid max-h-96 grid-cols-1 gap-1 overflow-y-auto">
        {filteredOptions.length ? (
          filteredOptions.map(({ type, label, icon: Icon, description }, index) => (
            <motion.button
              key={type}
              variants={buttonHoverVariants}
              initial={false}
              whileHover="hover"
              whileTap="tap"
              onMouseEnter={() => onHighlightedIndexChange(index)}
              onClick={() => {
                onSelect(type);
                onClose();
              }}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors',
                index === highlightedIndex
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl',
                  index === highlightedIndex
                    ? 'bg-white/15 text-white'
                    : 'bg-slate-100 text-slate-500'
                )}
              >
                <Icon className="h-4 w-4" />
              </span>

              <span className="min-w-0">
                <span className="block font-medium">{label}</span>
                <span
                  className={cn(
                    'block truncate text-xs',
                    index === highlightedIndex ? 'text-slate-300' : 'text-slate-400'
                  )}
                >
                  {description}
                </span>
              </span>
            </motion.button>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-center">
            <p className="text-sm font-medium text-slate-700">No matching block types</p>
            <p className="mt-1 text-xs text-slate-500">Try a different keyword.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
