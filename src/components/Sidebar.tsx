import { ReactNode, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUp,
  ChevronRight,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { usePagesStore } from '../store/pages';
import { PageTree } from '../types';
import {
  buttonHoverVariants,
  microInteractionTransition,
  sidebarItemVariants,
  sidebarVariants,
  staggerListVariants,
} from '../lib/animations';
import { Skeleton } from './Skeleton';
import { cn } from '../lib/cn';

interface SidebarProps {
  onSelectPage: (pageId: string) => void;
  onCreatePage: () => void;
  onCreateAiPage: () => void;
  onDeletePage: (pageId: string) => void;
  onMovePageToRoot: (pageId: string) => void;
  selectedPageId: string | null;
  onShowTrash: () => void;
  onShowSettings: () => void;
  loading?: boolean;
  creatingPageId?: string | null;
}

export function Sidebar({
  onSelectPage,
  onCreatePage,
  onCreateAiPage,
  onDeletePage,
  onMovePageToRoot,
  selectedPageId,
  onShowTrash,
  onShowSettings,
  loading = false,
  creatingPageId,
}: SidebarProps) {
  const isOpen = true;
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const {
    pages,
    filteredPages,
    searchQuery,
    setSearchQuery,
    expandedPages,
    toggleExpandPage,
  } = usePagesStore();
  const { user, signOut } = useAuthStore();

  const visiblePages = searchQuery ? filteredPages : pages;
  const starredPages = useMemo(
    () => visiblePages.filter((page) => page.is_starred),
    [visiblePages]
  );

  const handleCreatePage = () => {
    onCreatePage();
    setIsMobileOpen(false);
  };

  const handleCreateAiPage = () => {
    onCreateAiPage();
    setIsMobileOpen(false);
  };

  const closeMobileAfterSelection = (pageId: string) => {
    onSelectPage(pageId);
    setIsMobileOpen(false);
  };

  const SidebarContent = () => (
    <div className="ui-panel h-full flex flex-col rounded-[30px] border-slate-200/80 bg-white/92">
      <div className="border-b border-slate-200/80 px-4 pb-4 pt-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white shadow-[0_14px_28px_-18px_rgba(15,23,42,0.9)]">
            N
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">WhisprNote</p>
            <p className="text-xs text-slate-500">Workspace</p>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search pages"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/80 pl-10 pr-4 text-sm text-slate-900 shadow-inner shadow-slate-100 transition-all duration-200 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <motion.button
          variants={buttonHoverVariants}
          initial={false}
          whileHover="hover"
          whileTap="tap"
          onClick={handleCreatePage}
          className="mb-5 flex h-11 w-full items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-3 text-sm font-medium text-slate-700 shadow-[0_10px_30px_-22px_rgba(15,23,42,0.9)] transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <span className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Plus className="h-4 w-4" />
            </span>
            New page
          </span>
          <Sparkles className="h-4 w-4 text-slate-400" />
        </motion.button>

        <motion.button
          variants={buttonHoverVariants}
          initial={false}
          whileHover="hover"
          whileTap="tap"
          onClick={handleCreateAiPage}
          className="mb-5 flex h-11 w-full items-center justify-between rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-900 to-slate-800 px-3 text-sm font-medium text-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.95)] transition-opacity hover:opacity-95"
        >
          <span className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/15 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            AI note
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
            Groq
          </span>
        </motion.button>

        {loading ? (
          <SidebarListSkeleton />
        ) : (
          <>
            {starredPages.length > 0 && (
              <SidebarSection title="Starred">
                <PageList
                  pages={starredPages}
                  selectedPageId={selectedPageId}
                  onSelectPage={closeMobileAfterSelection}
                  expandedPages={expandedPages}
                  onToggleExpand={toggleExpandPage}
                  onDeletePage={onDeletePage}
                  onMovePageToRoot={onMovePageToRoot}
                  creatingPageId={creatingPageId}
                />
              </SidebarSection>
            )}

            <SidebarSection title={searchQuery ? 'Results' : 'Pages'}>
              <PageList
                pages={visiblePages}
                selectedPageId={selectedPageId}
                onSelectPage={closeMobileAfterSelection}
                expandedPages={expandedPages}
                onToggleExpand={toggleExpandPage}
                onDeletePage={onDeletePage}
                onMovePageToRoot={onMovePageToRoot}
                creatingPageId={creatingPageId}
              />
            </SidebarSection>

            {!visiblePages.length && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={microInteractionTransition}
                className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 p-5 text-center"
              >
                <p className="text-sm font-medium text-slate-700">Create your first page</p>
                <p className="mt-1 text-xs text-slate-500">
                  A fresh canvas is ready whenever you are.
                </p>
              </motion.div>
            )}
          </>
        )}
      </div>

      <div className="space-y-2 border-t border-slate-200/80 px-3 py-4">
        <SidebarActionButton icon={Trash2} label="Trash" onClick={onShowTrash} />
        <SidebarActionButton icon={Settings} label="Settings" onClick={onShowSettings} />

        {user && (
          <div className="mt-3 rounded-3xl border border-slate-200/80 bg-slate-50/80 p-3">
            <p className="truncate text-sm font-medium text-slate-800">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <motion.button
              variants={buttonHoverVariants}
              initial={false}
              whileHover="hover"
              whileTap="tap"
              onClick={() => void signOut()}
              className="mt-3 flex h-10 w-full items-center gap-2 rounded-2xl px-3 text-sm text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <motion.div
        initial={false}
        animate={isOpen ? 'open' : 'closed'}
        variants={sidebarVariants}
        className="hidden h-full shrink-0 lg:block"
      >
        <SidebarContent />
      </motion.div>

      <motion.button
        variants={buttonHoverVariants}
        initial={false}
        whileHover="hover"
        whileTap="tap"
        onClick={() => setIsMobileOpen((open) => !open)}
        className="fixed left-4 top-4 z-40 rounded-2xl border border-slate-200/70 bg-white/85 p-2.5 text-slate-700 shadow-[0_14px_30px_-22px_rgba(15,23,42,0.6)] backdrop-blur-xl lg:hidden"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </motion.button>

      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: -320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 260 }}
              className="fixed inset-y-0 left-0 z-40 w-[86vw] max-w-[320px] p-3 lg:hidden"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {title}
      </p>
      {children}
    </div>
  );
}

function SidebarActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Trash2;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      variants={buttonHoverVariants}
      initial={false}
      whileHover="hover"
      whileTap="tap"
      onClick={onClick}
      className="flex h-10 w-full items-center gap-2 rounded-2xl px-3 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
    >
      <Icon className="h-4 w-4" />
      {label}
    </motion.button>
  );
}

interface PageListProps {
  pages: PageTree[];
  selectedPageId: string | null;
  onSelectPage: (id: string) => void;
  expandedPages: Set<string>;
  onToggleExpand: (id: string) => void;
  onDeletePage: (id: string) => void;
  onMovePageToRoot: (id: string) => void;
  creatingPageId?: string | null;
}

function PageList({
  pages,
  selectedPageId,
  onSelectPage,
  expandedPages,
  onToggleExpand,
  onDeletePage,
  onMovePageToRoot,
  creatingPageId,
}: PageListProps) {
  return (
    <motion.div
      variants={staggerListVariants}
      initial="hidden"
      animate="visible"
      className="space-y-1"
    >
      {pages.map((page, index) => {
        const isActive = selectedPageId === page.id;
        const isCreating = creatingPageId === page.id;

        return (
          <motion.div
            key={page.id}
            variants={sidebarItemVariants}
            custom={index}
            layout
            className="space-y-1"
          >
            <div className="group flex items-center gap-1">
              {page.children.length > 0 ? (
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => onToggleExpand(page.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 transition-transform duration-200',
                      expandedPages.has(page.id) && 'rotate-90'
                    )}
                  />
                </motion.button>
              ) : (
                <div className="w-8" />
              )}

              <motion.button
                variants={buttonHoverVariants}
                initial={false}
                whileHover="hover"
                whileTap="tap"
                onClick={() => onSelectPage(page.id)}
                className={cn(
                  'relative flex h-10 flex-1 items-center gap-2.5 overflow-hidden rounded-2xl border px-3 text-left text-sm shadow-[0_10px_20px_-20px_rgba(15,23,42,0.7)] transition-all duration-200',
                  isActive
                    ? 'border-slate-200 bg-white text-slate-950'
                    : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200/80 hover:bg-slate-50/90 hover:text-slate-900'
                )}
              >
                <motion.span
                  layout
                  className={cn(
                    'absolute inset-y-2 left-1.5 w-1 rounded-full bg-slate-900',
                    !isActive && 'opacity-0'
                  )}
                />
                <span className="pl-2 text-base">{page.icon || '📄'}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{page.title}</span>
                {page.is_starred && <Star className="h-3.5 w-3.5 text-amber-400" fill="currentColor" />}
                {isCreating && (
                  <span className="flex h-5 items-center rounded-full bg-slate-100 px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    New
                  </span>
                )}
              </motion.button>

              <motion.button
                variants={buttonHoverVariants}
                initial={false}
                whileHover="hover"
                whileTap="tap"
                onClick={() => onDeletePage(page.id)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 opacity-0 transition-all duration-200 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                title="Delete page"
              >
                <Trash2 className="h-4 w-4" />
              </motion.button>

              {page.parent_id && (
                <motion.button
                  variants={buttonHoverVariants}
                  initial={false}
                  whileHover="hover"
                  whileTap="tap"
                  onClick={() => onMovePageToRoot(page.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 opacity-0 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 group-hover:opacity-100"
                  title="Move page to root"
                >
                  <ArrowUp className="h-4 w-4" />
                </motion.button>
              )}
            </div>

            <AnimatePresence initial={false}>
              {expandedPages.has(page.id) && page.children.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={microInteractionTransition}
                  className="ml-4 overflow-hidden border-l border-slate-200/80 pl-2"
                >
                  <PageList
                    pages={page.children}
                    selectedPageId={selectedPageId}
                    onSelectPage={onSelectPage}
                    expandedPages={expandedPages}
                    onToggleExpand={onToggleExpand}
                    onDeletePage={onDeletePage}
                    onMovePageToRoot={onMovePageToRoot}
                    creatingPageId={creatingPageId}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

function SidebarListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-1.5">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <Skeleton
            className={cn(
              'h-4 rounded-md',
              index % 3 === 0 ? 'w-20' : index % 3 === 1 ? 'w-32' : 'w-24'
            )}
          />
        </div>
      ))}
    </div>
  );
}
