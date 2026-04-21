import { create } from 'zustand';
import { Page, PageTree } from '../types';

interface PagesState {
  pages: PageTree[];
  selectedPageId: string | null;
  expandedPages: Set<string>;
  searchQuery: string;
  filteredPages: PageTree[];
  showDeletedOnly: boolean;
  loading: boolean;
  saving: boolean;

  setPages: (pages: PageTree[]) => void;
  setSelectedPage: (id: string | null) => void;
  toggleExpandPage: (id: string) => void;
  setSearchQuery: (query: string) => void;
  filterPages: () => void;
  setShowDeletedOnly: (show: boolean) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  addPage: (page: Page) => void;
  updatePageInTree: (pageId: string, updates: PageTreeUpdates) => void;
  removePageFromTree: (pageId: string) => void;
  getPageById: (id: string) => Page | null;
  buildTree: (pages: Page[]) => PageTree[];
}

export const usePagesStore = create<PagesState>((set, get) => ({
  pages: [],
  selectedPageId: null,
  expandedPages: new Set(),
  searchQuery: '',
  filteredPages: [],
  showDeletedOnly: false,
  loading: true,
  saving: false,

  setPages: (pages) => {
    set((state) => ({
      pages,
      filteredPages: deriveFilteredPages(pages, state.searchQuery, state.showDeletedOnly),
    }));
  },

  setSelectedPage: (id) => {
    set({ selectedPageId: id });
  },

  toggleExpandPage: (id) => {
    set((state) => {
      const newExpanded = new Set(state.expandedPages);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return { expandedPages: newExpanded };
    });
  },

  setSearchQuery: (query) => {
    set((state) => ({
      searchQuery: query,
      filteredPages: deriveFilteredPages(state.pages, query, state.showDeletedOnly),
    }));
  },

  filterPages: () => {
    const { pages, searchQuery, showDeletedOnly } = get();
    set({ filteredPages: deriveFilteredPages(pages, searchQuery, showDeletedOnly) });
  },

  setShowDeletedOnly: (show) => {
    set((state) => ({
      showDeletedOnly: show,
      filteredPages: deriveFilteredPages(state.pages, state.searchQuery, show),
    }));
  },

  setLoading: (loading) => {
    set({ loading });
  },

  setSaving: (saving) => {
    set({ saving });
  },

  addPage: (page) => {
    set((state) => {
      const tree = state.buildTree([...state.pages.flatMap(flattenTree), page]);
      return {
        pages: tree,
        filteredPages: deriveFilteredPages(tree, state.searchQuery, state.showDeletedOnly),
      };
    });
  },

  updatePageInTree: (pageId, updates) => {
    set((state) => {
      const updated = updatePageRecursive(state.pages, pageId, updates);
      return {
        pages: updated,
        filteredPages: deriveFilteredPages(
          updated,
          state.searchQuery,
          state.showDeletedOnly
        ),
      };
    });
  },

  removePageFromTree: (pageId) => {
    set((state) => {
      const filtered = removePageRecursive(state.pages, pageId);
      return {
        pages: filtered,
        filteredPages: deriveFilteredPages(
          filtered,
          state.searchQuery,
          state.showDeletedOnly
        ),
      };
    });
  },

  getPageById: (id) => {
    const { pages } = get();
    return findPageInTree(pages, id);
  },

  buildTree: (pages) => {
    const pageMap = new Map(pages.map((p) => [p.id, { ...p, children: [] as PageTree[] }]));
    const roots: PageTree[] = [];

    pages.forEach((page) => {
      const node = pageMap.get(page.id)!;
      if (page.parent_id && pageMap.has(page.parent_id)) {
        const parent = pageMap.get(page.parent_id)!;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    roots.sort((a, b) => a.position - b.position);
    return roots;
  },
}));

function deriveFilteredPages(
  pages: PageTree[],
  searchQuery: string,
  showDeletedOnly: boolean
) {
  if (!searchQuery && !showDeletedOnly) {
    return pages;
  }

  return filterPageTree(pages, searchQuery, showDeletedOnly);
}

function filterPageTree(
  pages: PageTree[],
  query: string,
  showDeletedOnly: boolean
): PageTree[] {
  return pages
    .filter((page) => {
      const matchesQuery =
        !query ||
        page.title.toLowerCase().includes(query.toLowerCase()) ||
        page.content.some((block) =>
          block.content.toLowerCase().includes(query.toLowerCase())
        );
      const matchesDeleted = !showDeletedOnly || page.is_deleted;
      return matchesQuery && matchesDeleted;
    })
    .map((page) => ({
      ...page,
      children: filterPageTree(page.children || [], query, showDeletedOnly),
    }));
}

function updatePageRecursive(
  pages: PageTree[],
  pageId: string,
  updates: PageTreeUpdates
): PageTree[] {
  return pages.map((page) => {
    if (page.id === pageId) {
      return { ...page, ...updates };
    }
    if (page.children) {
      return {
        ...page,
        children: updatePageRecursive(page.children, pageId, updates),
      };
    }
    return page;
  });
}

type PageTreeUpdates = Omit<Partial<Page>, 'children'>;

function removePageRecursive(pages: PageTree[], pageId: string): PageTree[] {
  return pages
    .filter((page) => page.id !== pageId)
    .map((page) => ({
      ...page,
      children: page.children
        ? removePageRecursive(page.children, pageId)
        : [],
    }));
}

function findPageInTree(pages: PageTree[], id: string): Page | null {
  for (const page of pages) {
    if (page.id === id) {
      const { children: _children, ...pageWithoutChildren } = page;
      void _children;
      return pageWithoutChildren;
    }
    if (page.children) {
      const found = findPageInTree(page.children, id);
      if (found) return found;
    }
  }
  return null;
}

function flattenTree(page: PageTree): Page[] {
  const { children, ...pageWithoutChildren } = page;
  const result: Page[] = [pageWithoutChildren];

  children.forEach((child) => {
    result.push(...flattenTree(child));
  });

  return result;
}
