import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Globe2, Lock, Share2, Sparkles, X } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Editor } from '../components/Editor';
import { EditorSkeleton } from '../components/Skeleton';
import { SettingsPanel } from '../components/SettingsPanel';
import {
  buttonHoverVariants,
  enterEaseTransition,
  exitEaseTransition,
  pageVariants,
} from '../lib/animations';
import { aiService } from '../services/ai';
import { pagesService } from '../services/pages';
import { useAuthStore } from '../store/auth';
import { usePagesStore } from '../store/pages';
import { Block, Page, PageShare } from '../types';

const PAGE_REQUEST_TIMEOUT_MS = 10000;
const AI_PROMPT_TEMPLATES = [
  `Act as a senior full-stack engineer and career mentor. Create a complete roadmap from absolute beginner to job-ready full-stack developer. 
Include:
- Weekly milestones (at least 16–24 weeks)
- Tech stack progression (HTML, CSS, JavaScript, React, Node.js, databases, deployment)
- Daily/weekly learning tasks
- Hands-on project ideas at each stage (with increasing complexity)
- Interview preparation (DSA, system design basics)
- Real-world portfolio strategy
- Free and paid learning resources
- Common mistakes to avoid
Output in a structured, easy-to-follow format.`,

  `Act as a startup founder and product manager. Create a detailed Product Requirements Document (PRD) for an AI-powered note-taking app.
Include:
- Product vision and mission
- Target users and personas
- Core features (AI summarization, tagging, search, collaboration)
- User stories and use cases
- Technical architecture overview
- MVP vs future roadmap
- Success metrics (KPIs)
- Monetization strategy
- Launch checklist and go-to-market plan
Output in a professional PRD format.`,

  `Act as an expert study coach. Create an 8-week high-performance exam preparation plan.
Include:
- Weekly goals and subject breakdown
- Daily study schedule (time-blocked)
- Active recall and spaced repetition strategy
- Revision cycles and mock test plan
- Weak area improvement strategy
- Productivity techniques (Pomodoro, deep work)
- Burnout prevention and rest planning
- अंतिम 7 दिनों का revision strategy (high intensity)
Output as a clear, actionable schedule.`,

  `Act as a professional meeting facilitator. Create a complete meeting notes and execution template.
Include:
- Meeting objective and agenda
- Key discussion points
- Decisions made
- Action items (with owners and deadlines)
- Risks and blockers
- Follow-up plan
- Summary for stakeholders
- Optional: AI-generated insights or suggestions
Format it so it can be directly used in tools like Notion or docs.`
];

type SharePermission = 'view' | 'edit';

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    return (await Promise.race([promise, timeoutPromise])) as T;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function WorkspacePage() {
  const { user } = useAuthStore();
  const {
    pages,
    selectedPageId,
    setPages,
    addPage,
    updatePageInTree,
    removePageFromTree,
    setSelectedPage,
    setLoading,
    loading,
    buildTree,
  } = usePagesStore();
  const [currentPage, setCurrentPage] = useState<Page | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editorLoading, setEditorLoading] = useState(false);
  const [canEditCurrentPage, setCanEditCurrentPage] = useState(false);
  const [creatingPageId, setCreatingPageId] = useState<string | null>(null);
  const [showAiComposer, setShowAiComposer] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showShareComposer, setShowShareComposer] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<SharePermission>('view');
  const [shareEntries, setShareEntries] = useState<PageShare[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const titleSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (pages.length > 0 && reloadKey === 0) {
      if (!selectedPageId) {
        setSelectedPage(pages[0].id);
      }
      setLoading(false);
      return;
    }

    const loadPages = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const allPages = await withTimeout(
          pagesService.getPages(user.id, user.email),
          PAGE_REQUEST_TIMEOUT_MS,
          'Loading pages timed out. Please check your connection and Supabase setup.'
        );
        const tree = buildTree(allPages);
        setPages(tree);

        if (allPages.length > 0) {
          const nextSelectedPageId =
            selectedPageId && allPages.some((page) => page.id === selectedPageId)
              ? selectedPageId
              : allPages[0].id;

          setSelectedPage(nextSelectedPageId);
        } else {
          setSelectedPage(null);
          setCurrentPage(null);
        }
      } catch (error) {
        console.error('Failed to load pages:', error);
        setLoadError(
          error instanceof Error ? error.message : 'Failed to load pages. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    void loadPages();
  }, [
    buildTree,
    pages,
    reloadKey,
    selectedPageId,
    setLoading,
    setPages,
    setSelectedPage,
    user,
  ]);

  useEffect(() => {
    return () => {
      if (titleSaveTimeoutRef.current) {
        clearTimeout(titleSaveTimeoutRef.current);
      }
      if (contentSaveTimeoutRef.current) {
        clearTimeout(contentSaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedPageId) {
      setCurrentPage(null);
      setEditorLoading(false);
      setCanEditCurrentPage(false);
      return;
    }

    if (selectedPageId.startsWith('temp-')) {
      setCanEditCurrentPage(true);
      return;
    }

    let cancelled = false;
    setEditorLoading(true);

    const loadPage = async () => {
      try {
        const page = await withTimeout(
          pagesService.getPage(selectedPageId),
          PAGE_REQUEST_TIMEOUT_MS,
          'Loading page content timed out. Please retry.'
        );

        if (!cancelled) {
          setCurrentPage(page);

          if (!page || !user) {
            setCanEditCurrentPage(false);
            return;
          }

          if (page.user_id === user.id) {
            setCanEditCurrentPage(true);
            return;
          }

          if (page.is_public) {
            setCanEditCurrentPage(false);
            return;
          }

          const permission = await pagesService.getSharePermission(page.id, user.email);
          setCanEditCurrentPage(permission === 'edit');
        }
      } catch (error) {
        console.error('Failed to load page:', error);
        if (!cancelled) {
          setCanEditCurrentPage(false);
        }
      } finally {
        if (!cancelled) {
          setEditorLoading(false);
        }
      }
    };

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [selectedPageId, user]);

  const handleCreatePage = async () => {
    if (!user) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticPage: Page = {
      id: tempId,
      user_id: user.id,
      title: 'Untitled',
      content: [] as Block[],
      parent_id: null,
      icon: '📄',
      color: 'bg-slate-100',
      cover_image_url: null,
      is_public: false,
      is_starred: false,
      is_deleted: false,
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setCreatingPageId(tempId);
    addPage(optimisticPage);
    setSelectedPage(tempId);
    setCurrentPage(optimisticPage);
    setCanEditCurrentPage(true);
    setEditorLoading(false);

    try {
      const createdPage = await pagesService.createPage(user.id, optimisticPage.parent_id);
      updatePageInTree(tempId, createdPage);
      setSelectedPage(createdPage.id);
      setCurrentPage(createdPage);
      setCanEditCurrentPage(true);
      setCreatingPageId(createdPage.id);
      window.setTimeout(() => setCreatingPageId(null), 900);
    } catch (error) {
      removePageFromTree(tempId);
      setSelectedPage(null);
      setCurrentPage(null);
      setCreatingPageId(null);
      console.error('Failed to create page:', error);
    }
  };

  const handleTitleChange = (title: string) => {
    if (!currentPage || !canEditCurrentPage) return;

    const updated = { ...currentPage, title };
    setCurrentPage(updated);
    updatePageInTree(currentPage.id, { title });

    if (titleSaveTimeoutRef.current) {
      clearTimeout(titleSaveTimeoutRef.current);
    }

    if (currentPage.id.startsWith('temp-')) {
      return;
    }

    titleSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await pagesService.updatePage(currentPage.id, { title });
      } catch (error) {
        console.error('Failed to update title:', error);
      }
    }, 350);
  };

  const handleContentChange = (content: Block[]) => {
    if (!currentPage || !canEditCurrentPage) return;

    const updated = { ...currentPage, content };
    setCurrentPage(updated);

    if (contentSaveTimeoutRef.current) {
      clearTimeout(contentSaveTimeoutRef.current);
    }

    if (currentPage.id.startsWith('temp-')) {
      return;
    }

    contentSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await pagesService.updatePage(currentPage.id, { content });
      } catch (error) {
        console.error('Failed to update content:', error);
      }
    }, 700);
  };

  const handleDeletePage = async (pageId: string) => {
    const removedIds = collectSubtreeIds(pages, pageId);
    const shouldUpdateSelection = selectedPageId ? removedIds.has(selectedPageId) : false;
    const nextPageId = shouldUpdateSelection
      ? getFirstRemainingPageId(pages, removedIds)
      : selectedPageId;

    try {
      if (!pageId.startsWith('temp-')) {
        await pagesService.deletePage(pageId);
      }

      removePageFromTree(pageId);

      if (shouldUpdateSelection) {
        setSelectedPage(nextPageId);

        if (!nextPageId) {
          setCurrentPage(null);
          setCanEditCurrentPage(false);
        }
      }
    } catch (error) {
      console.error('Failed to delete page:', error);
    }
  };

  const handleMovePageToRoot = async (pageId: string) => {
    if (!user || pageId.startsWith('temp-')) {
      return;
    }

    try {
      await pagesService.updatePage(pageId, { parent_id: null });

      const allPages = await withTimeout(
        pagesService.getPages(user.id, user.email),
        PAGE_REQUEST_TIMEOUT_MS,
        'Refreshing pages timed out. Please try again.'
      );

      setPages(buildTree(allPages));
      setSelectedPage(pageId);
    } catch (error) {
      console.error('Failed to move page to root:', error);
    }
  };

  const openAiComposer = () => {
    setAiPrompt('');
    setAiError(null);
    setShowAiComposer(true);
  };

  const handleCreateAiNote = async () => {
    if (!user) {
      return;
    }

    const prompt = aiPrompt.trim();
    if (!prompt) {
      setAiError('Please enter a prompt to generate a note.');
      return;
    }

    setAiGenerating(true);
    setAiError(null);

    try {
      const generated = await withTimeout(
        aiService.generateNoteFromPrompt(prompt),
        40000,
        'AI note generation timed out. Please try a shorter prompt.'
      );

      const parentId = null;

      const createdPage = await pagesService.createPage(user.id, parentId, {
        title: generated.title,
        content: generated.blocks,
        icon: '✨',
        color: 'bg-amber-100',
      });

      addPage(createdPage);
      setSelectedPage(createdPage.id);
      setCurrentPage(createdPage);
      setCanEditCurrentPage(true);
      setCreatingPageId(createdPage.id);
      window.setTimeout(() => setCreatingPageId(null), 900);
      setShowAiComposer(false);
      setAiPrompt('');
    } catch (error) {
      console.error('Failed to create AI note:', error);
      setAiError(
        error instanceof Error
          ? error.message
          : 'Failed to create AI note. Please try again.'
      );
    } finally {
      setAiGenerating(false);
    }
  };

  const isCurrentPageOwner = Boolean(
    user && currentPage && currentPage.user_id === user.id
  );

  const loadShareEntries = async (pageId: string) => {
    setShareLoading(true);
    setShareError(null);

    try {
      const shares = await pagesService.getPageShares(pageId);
      setShareEntries(shares);
    } catch (error) {
      setShareError(
        error instanceof Error ? error.message : 'Failed to load shared users.'
      );
    } finally {
      setShareLoading(false);
    }
  };

  const openShareComposer = async () => {
    if (!currentPage || !isCurrentPageOwner || currentPage.id.startsWith('temp-')) {
      return;
    }

    setShareEmail('');
    setSharePermission('view');
    setShareError(null);
    setShowShareComposer(true);
    await loadShareEntries(currentPage.id);
  };

  const handleTogglePageVisibility = async () => {
    if (!currentPage || !isCurrentPageOwner || currentPage.id.startsWith('temp-')) {
      return;
    }

    const nextVisibility = !currentPage.is_public;
    setCurrentPage({ ...currentPage, is_public: nextVisibility });
    updatePageInTree(currentPage.id, { is_public: nextVisibility });

    try {
      await pagesService.togglePagePublic(currentPage.id, nextVisibility);
    } catch (error) {
      setCurrentPage({ ...currentPage, is_public: !nextVisibility });
      updatePageInTree(currentPage.id, { is_public: !nextVisibility });
      console.error('Failed to update visibility:', error);
    }
  };

  const handleSharePage = async () => {
    if (!currentPage || !isCurrentPageOwner || currentPage.id.startsWith('temp-')) {
      return;
    }

    const normalizedEmail = shareEmail.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setShareError('Please enter a valid email address.');
      return;
    }

    setShareSubmitting(true);
    setShareError(null);

    try {
      await pagesService.sharePage(currentPage.id, normalizedEmail, sharePermission);
      setShareEmail('');
      await loadShareEntries(currentPage.id);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Failed to share page.');
    } finally {
      setShareSubmitting(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    if (!currentPage || !isCurrentPageOwner || currentPage.id.startsWith('temp-')) {
      return;
    }

    try {
      await pagesService.removePageShare(shareId);
      await loadShareEntries(currentPage.id);
    } catch (error) {
      setShareError(
        error instanceof Error ? error.message : 'Failed to remove shared access.'
      );
    }
  };

  if (loadError) {
    return (
      <div className="flex h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.92),_rgba(241,245,249,0.96)_36%,_rgba(226,232,240,0.72)_100%)] p-3 md:p-4">
        <Sidebar
          onSelectPage={() => {}}
          onCreatePage={() => {}}
          onCreateAiPage={() => {}}
          onDeletePage={() => {}}
          onMovePageToRoot={() => {}}
          selectedPageId={null}
          onShowTrash={() => {}}
          onShowSettings={() => {}}
          loading
        />
        <div className="ui-panel ml-0 flex flex-1 items-center justify-center overflow-hidden rounded-[30px] p-6 lg:ml-4">
          <div className="max-w-xl text-center">
            <h1 className="text-3xl font-semibold text-slate-900">Could not load workspace</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">{loadError}</p>
            <motion.button
              variants={buttonHoverVariants}
              initial={false}
              whileHover="hover"
              whileTap="tap"
              onClick={() => setReloadKey((prev) => prev + 1)}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-medium text-white shadow-[0_24px_40px_-24px_rgba(15,23,42,0.9)]"
            >
              Retry
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.92),_rgba(241,245,249,0.96)_36%,_rgba(226,232,240,0.72)_100%)] p-3 md:p-4">
      <Sidebar
        onSelectPage={setSelectedPage}
        onCreatePage={handleCreatePage}
        onCreateAiPage={openAiComposer}
        onDeletePage={handleDeletePage}
        onMovePageToRoot={handleMovePageToRoot}
        selectedPageId={selectedPageId}
        onShowTrash={() => {}}
        onShowSettings={() => setShowSettings(true)}
        loading={loading}
        creatingPageId={creatingPageId}
      />

      <div className="ml-0 flex flex-1 overflow-hidden rounded-[30px] border border-slate-200/70 bg-white/58 shadow-[0_28px_60px_-40px_rgba(15,23,42,0.4)] backdrop-blur-xl lg:ml-4">
        <div className="relative flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            {editorLoading ? (
              <motion.div
                key="editor-skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={enterEaseTransition}
                className="absolute inset-0"
              >
                <EditorSkeleton />
              </motion.div>
            ) : currentPage ? (
              <motion.div
                key={currentPage.id}
                initial="enter"
                animate="center"
                exit="exit"
                variants={pageVariants}
                className="min-h-full"
              >
                {isCurrentPageOwner ? (
                  <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/82 px-4 py-3 backdrop-blur-xl md:px-8">
                    <div className="ml-auto flex w-full max-w-4xl items-center justify-end gap-2">
                      <button
                        onClick={() => void handleTogglePageVisibility()}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        {currentPage.is_public ? (
                          <>
                            <Globe2 className="h-3.5 w-3.5" />
                            Public
                          </>
                        ) : (
                          <>
                            <Lock className="h-3.5 w-3.5" />
                            Private
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => void openShareComposer()}
                        className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-900 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_16px_32px_-20px_rgba(15,23,42,0.85)]"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Share
                      </button>
                    </div>
                  </div>
                ) : !canEditCurrentPage ? (
                  <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/82 px-4 py-3 backdrop-blur-xl md:px-8">
                    <div className="ml-auto flex w-full max-w-4xl items-center justify-end gap-2">
                      <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        <Lock className="h-3.5 w-3.5" />
                        Read only
                      </span>
                    </div>
                  </div>
                ) : null}

                <Editor
                  page={currentPage}
                  canEdit={canEditCurrentPage}
                  onTitleChange={handleTitleChange}
                  onContentChange={handleContentChange}
                />
              </motion.div>
            ) : (
              <motion.div
                key="empty-state"
                initial="enter"
                animate="center"
                exit="exit"
                variants={pageVariants}
                className="flex h-full items-center justify-center p-6"
              >
                <div className="max-w-lg text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-white via-slate-100 to-slate-200 shadow-[0_20px_45px_-25px_rgba(15,23,42,0.45)]">
                    <Sparkles className="h-9 w-9 text-slate-700" />
                  </div>
                  <h1 className="mt-6 text-3xl font-semibold text-slate-900">
                    Create your first page
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Keep ideas lightweight, structured, and ready to grow. Start with a blank
                    page and let the editor do the rest.
                  </p>
                  <motion.button
                    variants={buttonHoverVariants}
                    initial={false}
                    whileHover="hover"
                    whileTap="tap"
                    onClick={handleCreatePage}
                    className="mt-8 inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-medium text-white shadow-[0_24px_40px_-24px_rgba(15,23,42,0.9)]"
                  >
                    Create page
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showShareComposer && currentPage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={exitEaseTransition}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
            onClick={() => {
              if (!shareSubmitting) {
                setShowShareComposer(false);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={enterEaseTransition}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-xl rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_30px_70px_-38px_rgba(15,23,42,0.75)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.13em] text-slate-600">
                    <Share2 className="h-3.5 w-3.5" />
                    Share Note
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-900">
                    Share this note
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Add user email to share this note. Public notes are visible to all signed-in users.
                  </p>
                </div>

                <button
                  onClick={() => setShowShareComposer(false)}
                  className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  disabled={shareSubmitting}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 flex flex-col gap-3 md:flex-row">
                <input
                  type="email"
                  value={shareEmail}
                  onChange={(event) => setShareEmail(event.target.value)}
                  placeholder="teammate@email.com"
                  className="h-11 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
                  disabled={shareSubmitting}
                />

                <select
                  value={sharePermission}
                  onChange={(event) => setSharePermission(event.target.value as SharePermission)}
                  className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
                  disabled={shareSubmitting}
                >
                  <option value="view">Can view</option>
                  <option value="edit">Can edit</option>
                </select>

                <button
                  onClick={() => void handleSharePage()}
                  className="h-11 rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white shadow-[0_16px_30px_-18px_rgba(15,23,42,0.82)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={shareSubmitting}
                >
                  {shareSubmitting ? 'Sharing...' : 'Add'}
                </button>
              </div>

              {shareError && (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {shareError}
                </p>
              )}

              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Shared users
                </p>

                {shareLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Loading shared users...
                  </div>
                ) : shareEntries.length > 0 ? (
                  <div className="space-y-2">
                    {shareEntries.map((share) => (
                      <div
                        key={share.id}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {share.shared_email}
                          </p>
                          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                            {share.permission === 'edit' ? 'Can edit' : 'Can view'}
                          </p>
                        </div>

                        <button
                          onClick={() => void handleRemoveShare(share.id)}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    No shared users yet.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {showAiComposer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={exitEaseTransition}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
            onClick={() => {
              if (!aiGenerating) {
                setShowAiComposer(false);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={enterEaseTransition}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-2xl rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_30px_70px_-38px_rgba(15,23,42,0.75)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.13em] text-slate-600">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Note
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-900">
                    Generate a full note from a prompt
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Describe what you want and the note will be created in your workspace.
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (!aiGenerating) {
                      setShowAiComposer(false);
                    }
                  }}
                  className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  disabled={aiGenerating}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5">
                <textarea
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  placeholder="Example: Create a product requirements note for a mobile habit tracker app with goals, metrics, roadmap, and launch checklist."
                  className="h-44 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 transition-colors placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
                  disabled={aiGenerating}
                />
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Quick prompts
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {AI_PROMPT_TEMPLATES.map((template) => (
                    <button
                      key={template}
                      onClick={() => setAiPrompt(template)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
                      disabled={aiGenerating}
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Tip: Output is optimized for detailed notes with section emojis, checklists, and
                clear phases.
              </p>

              {aiError && (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {aiError}
                </p>
              )}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    if (!aiGenerating) {
                      setShowAiComposer(false);
                    }
                  }}
                  className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  disabled={aiGenerating}
                >
                  Cancel
                </button>

                <motion.button
                  variants={buttonHoverVariants}
                  initial={false}
                  whileHover={!aiGenerating ? 'hover' : undefined}
                  whileTap={!aiGenerating ? 'tap' : undefined}
                  onClick={() => void handleCreateAiNote()}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-medium text-white shadow-[0_20px_35px_-20px_rgba(15,23,42,0.85)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={aiGenerating}
                >
                  <Sparkles className="h-4 w-4" />
                  {aiGenerating ? 'Generating...' : 'Generate note'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={exitEaseTransition}
          >
            <SettingsPanel onClose={() => setShowSettings(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function collectSubtreeIds(pages: Page[], targetId: string) {
  const target = findPageTreeNode(pages, targetId);
  const ids = new Set<string>();

  if (!target) {
    ids.add(targetId);
    return ids;
  }

  const stack: Page[] = [target];
  while (stack.length) {
    const node = stack.pop()!;
    ids.add(node.id);

    if (node.children?.length) {
      stack.push(...node.children);
    }
  }

  return ids;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getFirstRemainingPageId(pages: Page[], removedIds: Set<string>) {
  const orderedIds = flattenPageTreeIds(pages);
  return orderedIds.find((id) => !removedIds.has(id)) ?? null;
}

function flattenPageTreeIds(pages: Page[]) {
  const ids: string[] = [];
  const stack = [...pages].reverse();

  while (stack.length) {
    const node = stack.pop()!;
    ids.push(node.id);

    if (node.children?.length) {
      for (let i = node.children.length - 1; i >= 0; i -= 1) {
        stack.push(node.children[i]);
      }
    }
  }

  return ids;
}

function findPageTreeNode(pages: Page[], targetId: string): Page | null {
  const stack = [...pages];

  while (stack.length) {
    const node = stack.pop()!;
    if (node.id === targetId) {
      return node;
    }

    if (node.children?.length) {
      stack.push(...node.children);
    }
  }

  return null;
}
