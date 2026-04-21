import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { blockVariants, buttonHoverVariants, enterEaseTransition } from '../lib/animations';
import { filterBlockTypeOptions } from '../lib/blockTypes';
import { Block, Page } from '../types';
import { BlockTypeMenu } from './BlockTypeMenu';
import { EditorBlock } from './EditorBlock';

interface EditorProps {
  page: Page;
  canEdit: boolean;
  onTitleChange: (title: string) => void;
  onContentChange: (content: Block[]) => void;
}

type MenuState =
  | {
      kind: 'type';
      blockId: string;
      x: number;
      y: number;
      query: string;
      highlightedIndex: number;
    }
  | {
      kind: 'slash';
      blockId: string;
      x: number;
      y: number;
      query: string;
      highlightedIndex: number;
      start: number;
      end: number;
      beforeText: string;
      afterText: string;
    };

interface FocusRequest {
  blockId: string;
  nonce: number;
}

interface DragTarget {
  blockId: string;
  placement: 'above' | 'below';
}

const MENU_WIDTH = 320;
const MENU_OFFSET_Y = 10;

export function Editor({ page, canEdit, onTitleChange, onContentChange }: EditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(page.content || []);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [titleFocused, setTitleFocused] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const blocksRef = useRef<Block[]>(page.content || []);
  const pageIdRef = useRef(page.id);
  const focusNonceRef = useRef(0);

  useEffect(() => {
    if (page.id === pageIdRef.current && page.content === blocksRef.current) {
      return;
    }

    pageIdRef.current = page.id;
    const nextBlocks = page.content || [];
    blocksRef.current = nextBlocks;
    setBlocks(nextBlocks);
    setMenuState(null);
    setDraggedBlockId(null);
    setDragTarget(null);
    setFocusRequest(null);
  }, [page.content, page.id]);

  const filteredMenuOptions = useMemo(
    () => (menuState ? filterBlockTypeOptions(menuState.query) : []),
    [menuState]
  );

  useEffect(() => {
    if (!menuState) {
      return;
    }

    if (!filteredMenuOptions.length && menuState.highlightedIndex !== 0) {
      setMenuState((current) => (current ? { ...current, highlightedIndex: 0 } : current));
      return;
    }

    if (filteredMenuOptions.length && menuState.highlightedIndex >= filteredMenuOptions.length) {
      setMenuState((current) =>
        current
          ? {
              ...current,
              highlightedIndex: filteredMenuOptions.length - 1,
            }
          : current
      );
    }
  }, [filteredMenuOptions.length, menuState]);

  const requestFocus = (blockId: string | null) => {
    if (!blockId) {
      setFocusRequest(null);
      return;
    }

    focusNonceRef.current += 1;
    setFocusRequest({ blockId, nonce: focusNonceRef.current });
  };

  const commitBlocks = (
    updater: Block[] | ((previousBlocks: Block[]) => Block[]),
    focusBlockId?: string | null
  ) => {
    const nextBlocks =
      typeof updater === 'function'
        ? (updater as (previousBlocks: Block[]) => Block[])(blocksRef.current)
        : updater;

    blocksRef.current = nextBlocks;
    setBlocks(nextBlocks);
    onContentChange(nextBlocks);

    if (focusBlockId !== undefined) {
      requestFocus(focusBlockId);
    }
  };

  const closeMenu = () => {
    setMenuState(null);
  };

  const setMenuQuery = (query: string) => {
    setMenuState((current) =>
      current
        ? {
            ...current,
            query,
            highlightedIndex: 0,
          }
        : current
    );
  };

  const setHighlightedIndex = (index: number) => {
    setMenuState((current) => (current ? { ...current, highlightedIndex: index } : current));
  };

  const openTypeMenu = (event: MouseEvent<HTMLButtonElement>, blockId: string) => {
    if (!canEdit) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const position = clampMenuPosition(rect.left, rect.bottom + MENU_OFFSET_Y);

    setMenuState({
      kind: 'type',
      blockId,
      x: position.x,
      y: position.y,
      query: '',
      highlightedIndex: 0,
    });
  };

  const openSlashMenu = (payload: {
    blockId: string;
    query: string;
    start: number;
    end: number;
    beforeText: string;
    afterText: string;
    rect: DOMRect;
  }) => {
    if (!canEdit) {
      return;
    }

    const position = clampMenuPosition(payload.rect.left, payload.rect.bottom + MENU_OFFSET_Y);

    setMenuState((current) => ({
      kind: 'slash',
      blockId: payload.blockId,
      x: position.x,
      y: position.y,
      query: payload.query,
      highlightedIndex:
        current?.kind === 'slash' &&
        current.blockId === payload.blockId &&
        current.query === payload.query
          ? current.highlightedIndex
          : 0,
      start: payload.start,
      end: payload.end,
      beforeText: payload.beforeText,
      afterText: payload.afterText,
    }));
  };

  const closeSlashMenuForBlock = (blockId: string) => {
    setMenuState((current) => {
      if (!current || current.kind !== 'slash' || current.blockId !== blockId) {
        return current;
      }

      return null;
    });
  };

  const handleAddBlock = (
    type: Block['type'],
    index: number,
    placement: 'above' | 'below' = 'below'
  ) => {
    if (!canEdit) {
      return;
    }

    const newBlock = createEmptyBlock(type);

    commitBlocks((previousBlocks) => {
      const insertAt =
        index < 0 ? 0 : Math.max(0, Math.min(previousBlocks.length, index + (placement === 'below' ? 1 : 0)));

      return [
        ...previousBlocks.slice(0, insertAt),
        newBlock,
        ...previousBlocks.slice(insertAt),
      ];
    }, newBlock.id);
  };

  const handleBlockChange = (blockId: string, updates: Partial<Block>) => {
    commitBlocks((previousBlocks) =>
      previousBlocks.map((block) => (block.id === blockId ? { ...block, ...updates } : block))
    );
  };

  const handleBlockDelete = (blockId: string) => {
    if (!canEdit) {
      return;
    }

    const currentBlocks = blocksRef.current;
    const index = currentBlocks.findIndex((block) => block.id === blockId);

    if (index === -1) {
      return;
    }

    const nextBlocks = currentBlocks.filter((block) => block.id !== blockId);
    const nextFocusBlockId = nextBlocks[index - 1]?.id ?? nextBlocks[index]?.id ?? null;

    commitBlocks(nextBlocks, nextFocusBlockId);

    closeSlashMenuForBlock(blockId);
  };

  const handleDuplicateBlock = (blockId: string) => {
    if (!canEdit) {
      return;
    }

    const duplicatedBlock = cloneBlockWithNewIds(
      blocksRef.current.find((candidate) => candidate.id === blockId) ?? createEmptyBlock('paragraph')
    );

    commitBlocks((previousBlocks) => {
      const index = previousBlocks.findIndex((block) => block.id === blockId);

      if (index === -1) {
        return previousBlocks;
      }

      return [
        ...previousBlocks.slice(0, index + 1),
        duplicatedBlock,
        ...previousBlocks.slice(index + 1),
      ];
    }, duplicatedBlock.id);
  };

  const handleSplitPaste = (blockId: string, text: string) => {
    if (!canEdit) {
      return;
    }

    const lines = text.replace(/\r\n/g, '\n').split('\n');

    if (lines.length <= 1) {
      return;
    }

    const previousBlocks = blocksRef.current;
    const index = previousBlocks.findIndex((block) => block.id === blockId);

    if (index === -1) {
      return;
    }

    const insertedBlocks = lines.slice(1).map((line) =>
      createEmptyBlock('paragraph', {
        content: line,
      })
    );

    const updatedCurrentBlock = {
      ...previousBlocks[index],
      content: lines[0],
    };

    const nextBlocks = [
      ...previousBlocks.slice(0, index),
      updatedCurrentBlock,
      ...insertedBlocks,
      ...previousBlocks.slice(index + 1),
    ];

    commitBlocks(nextBlocks, insertedBlocks[insertedBlocks.length - 1]?.id ?? updatedCurrentBlock.id);
  };

  const handleTypeSelection = (type: Block['type']) => {
    if (!menuState || !canEdit) {
      return;
    }

    if (menuState.kind === 'type') {
      commitBlocks((previousBlocks) =>
        previousBlocks.map((block) =>
          block.id === menuState.blockId ? convertBlockType(block, type) : block
        )
      );
      requestFocus(menuState.blockId);
      closeMenu();
      return;
    }

    const targetBlock = blocksRef.current.find((block) => block.id === menuState.blockId);

    if (!targetBlock) {
      closeMenu();
      return;
    }

    const remainingText = `${menuState.beforeText}`.replace(/\s+$/, '') + menuState.afterText;
    const shouldConvertCurrentBlock = remainingText.trim().length === 0;

    if (shouldConvertCurrentBlock) {
      commitBlocks((previousBlocks) =>
        previousBlocks.map((block) =>
          block.id === menuState.blockId
            ? resetBlockContent(convertBlockType(block, type), type)
            : block
        )
      );
      requestFocus(menuState.blockId);
      closeMenu();
      return;
    }

    const insertedBlock = createEmptyBlock(type);

    commitBlocks((previousBlocks) => {
      const index = previousBlocks.findIndex((block) => block.id === menuState.blockId);

      if (index === -1) {
        return previousBlocks;
      }

      const cleanedCurrentBlock = {
        ...previousBlocks[index],
        content: remainingText,
      };

      return [
        ...previousBlocks.slice(0, index),
        cleanedCurrentBlock,
        insertedBlock,
        ...previousBlocks.slice(index + 1),
      ];
    }, insertedBlock.id);

    closeMenu();
  };

  const handleSelectHighlightedMenuOption = () => {
    if (!filteredMenuOptions.length) {
      return;
    }

    const selectedOption =
      filteredMenuOptions[clampIndex(menuState?.highlightedIndex ?? 0, filteredMenuOptions.length - 1)];

    if (!selectedOption) {
      return;
    }

    handleTypeSelection(selectedOption.type);
  };

  const handleMoveSlashMenu = (direction: 1 | -1) => {
    if (!filteredMenuOptions.length) {
      return;
    }

    setMenuState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        highlightedIndex:
          (current.highlightedIndex + direction + filteredMenuOptions.length) %
          filteredMenuOptions.length,
      };
    });
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, blockId: string) => {
    if (!canEdit || !draggedBlockId) {
      return;
    }

    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY < rect.top + rect.height / 2 ? 'above' : 'below';

    setDragTarget({ blockId, placement });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, blockId: string) => {
    if (!canEdit || !draggedBlockId) {
      return;
    }

    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
    const movedBlocks = moveBlock(blocksRef.current, draggedBlockId, blockId, placement);

    setDraggedBlockId(null);
    setDragTarget(null);

    if (movedBlocks === blocksRef.current) {
      return;
    }

    commitBlocks(movedBlocks, draggedBlockId);
  };

  const isMenuVisible = Boolean(menuState);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl px-4 py-5 md:px-8 md:py-8">
      <div className="w-full rounded-[32px] border border-slate-200/75 bg-white/80 px-5 py-6 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl md:px-10 md:py-9">
        <motion.div
          animate={{
            boxShadow: titleFocused
              ? '0 20px 40px -35px rgba(59,130,246,0.45)'
              : '0 12px 24px -24px rgba(15,23,42,0)',
          }}
          transition={enterEaseTransition}
          className="rounded-[28px] border border-transparent px-2 py-2"
        >
          <input
            type="text"
            value={page.title}
            onChange={(event) => onTitleChange(event.target.value)}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => setTitleFocused(false)}
            className="w-full border-0 bg-transparent text-4xl font-semibold tracking-tight text-slate-950 placeholder:text-slate-300 focus:outline-none md:text-5xl"
            placeholder="Untitled"
            readOnly={!canEdit}
          />
          <p className="mt-2 px-1 text-sm text-slate-400">
            {canEdit
              ? 'A fast, focused writing space that saves as you go.'
              : 'This page is read-only for your account.'}
          </p>
        </motion.div>

        <motion.div
          layout
          className="mt-10 space-y-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={enterEaseTransition}
        >
          <AnimatePresence mode="popLayout">
            {blocks.map((block, index) => (
              <motion.div
                key={block.id}
                layout
                custom={index}
                variants={blockVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -8, scale: 0.985 }}
              >
                <EditorBlock
                  block={block}
                  index={index}
                  readOnly={!canEdit}
                  focusNonce={focusRequest?.blockId === block.id ? focusRequest.nonce : 0}
                  isSlashMenuActive={
                    menuState?.kind === 'slash' && menuState.blockId === block.id
                  }
                  isDragging={draggedBlockId === block.id}
                  dragPosition={dragTarget?.blockId === block.id ? dragTarget.placement : null}
                  onFocus={() => requestFocus(block.id)}
                  onChange={(updates) => handleBlockChange(block.id, updates)}
                  onDelete={() => handleBlockDelete(block.id)}
                  onDuplicate={() => handleDuplicateBlock(block.id)}
                  onTypeChange={(event) => openTypeMenu(event, block.id)}
                  onAddAbove={() => handleAddBlock('paragraph', index, 'above')}
                  onAddBelow={() => handleAddBlock('paragraph', index, 'below')}
                  onInsertParagraphBelow={() => handleAddBlock('paragraph', index, 'below')}
                  onRemoveIfEmpty={() => handleBlockDelete(block.id)}
                  onSplitPaste={(text) => handleSplitPaste(block.id, text)}
                  onRequestSlashMenu={openSlashMenu}
                  onCloseSlashMenu={() => closeSlashMenuForBlock(block.id)}
                  onSlashMenuMove={handleMoveSlashMenu}
                  onSelectSlashMenu={handleSelectHighlightedMenuOption}
                  onDragStart={setDraggedBlockId}
                  onDragEnd={() => {
                    setDraggedBlockId(null);
                    setDragTarget(null);
                  }}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {!blocks.length && canEdit && (
            <motion.button
              variants={buttonHoverVariants}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover="hover"
              whileTap="tap"
              onClick={() => handleAddBlock('paragraph', -1)}
              className="flex min-h-[160px] w-full flex-col items-start justify-center rounded-[28px] border border-dashed border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,250,252,0.92))] px-6 text-left shadow-inner shadow-slate-100 transition-colors hover:border-slate-300 hover:bg-white"
            >
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-[0_18px_30px_-20px_rgba(15,23,42,0.9)]">
                <Plus className="h-5 w-5" />
              </span>
              <p className="text-lg font-medium text-slate-800">Start typing…</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Add your first block and build a clean, flexible document with the speed of a
                native editor.
              </p>
            </motion.button>
          )}

          {!blocks.length && !canEdit && (
            <div className="flex min-h-[160px] w-full flex-col items-start justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/70 px-6 text-left">
              <p className="text-lg font-medium text-slate-700">This page is empty</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                You can view this page, but only editors can add content here.
              </p>
            </div>
          )}

          {canEdit && (
            <motion.button
              variants={buttonHoverVariants}
              initial={false}
              whileHover="hover"
              whileTap="tap"
              onClick={() => handleAddBlock('paragraph', blocks.length - 1)}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-2xl px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              <Plus className="h-4 w-4" />
              Add a block
            </motion.button>
          )}
        </motion.div>

        <AnimatePresence>
          {isMenuVisible && menuState && (
            <BlockTypeMenu
              x={menuState.x}
              y={menuState.y}
              searchQuery={menuState.query}
              highlightedIndex={menuState.highlightedIndex}
              showSearchInput={menuState.kind === 'type'}
              autoFocusSearch={menuState.kind === 'type'}
              onSearchQueryChange={setMenuQuery}
              onHighlightedIndexChange={setHighlightedIndex}
              onSelect={handleTypeSelection}
              onSelectHighlighted={handleSelectHighlightedMenuOption}
              onClose={closeMenu}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function createBlockId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

function createEmptyBlock(type: Block['type'], overrides?: Partial<Block>): Block {
  return {
    id: createBlockId(),
    type,
    content: type === 'divider' || type === 'image' ? '' : overrides?.content ?? '',
    checked: type === 'todo' ? false : undefined,
    language: type === 'code' ? 'javascript' : undefined,
    imageUrl: type === 'image' ? overrides?.imageUrl ?? '' : undefined,
    ...overrides,
  };
}

function cloneBlockWithNewIds(block: Block): Block {
  return {
    ...block,
    id: createBlockId(),
    children: block.children?.map(cloneBlockWithNewIds),
  };
}

function convertBlockType(block: Block, type: Block['type']): Block {
  const nextContent =
    type === 'image'
      ? ''
      : block.type === 'image'
        ? block.imageUrl ?? ''
        : block.content;

  return {
    ...block,
    type,
    content: type === 'divider' ? '' : nextContent,
    checked: type === 'todo' ? block.checked ?? false : undefined,
    language: type === 'code' ? block.language ?? 'javascript' : undefined,
    imageUrl:
      type === 'image'
        ? block.imageUrl ?? (block.type === 'image' ? '' : block.content)
        : undefined,
  };
}

function resetBlockContent(block: Block, type: Block['type']) {
  if (type === 'image') {
    return {
      ...block,
      content: '',
      imageUrl: '',
    };
  }

  if (type === 'divider') {
    return {
      ...block,
      content: '',
    };
  }

  return {
    ...block,
    content: '',
  };
}

function moveBlock(
  blocks: Block[],
  draggedBlockId: string,
  targetBlockId: string,
  placement: 'above' | 'below'
) {
  const fromIndex = blocks.findIndex((block) => block.id === draggedBlockId);
  const toIndex = blocks.findIndex((block) => block.id === targetBlockId);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return blocks;
  }

  const nextBlocks = [...blocks];
  const [movedBlock] = nextBlocks.splice(fromIndex, 1);
  const targetIndexAfterRemoval = nextBlocks.findIndex((block) => block.id === targetBlockId);
  const insertIndex =
    placement === 'above' ? targetIndexAfterRemoval : targetIndexAfterRemoval + 1;

  nextBlocks.splice(insertIndex, 0, movedBlock);
  return nextBlocks;
}

function clampIndex(index: number, maxIndex: number) {
  return Math.max(0, Math.min(index, maxIndex));
}

function clampMenuPosition(x: number, y: number) {
  if (typeof window === 'undefined') {
    return { x, y };
  }

  return {
    x: Math.max(16, Math.min(x, window.innerWidth - MENU_WIDTH - 16)),
    y: Math.max(16, y),
  };
}
