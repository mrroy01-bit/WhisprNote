import { supabase } from '../lib/supabase';
import { Page, Block, PageShare } from '../types';

const PAGE_LIST_COLUMNS =
  'id,user_id,title,parent_id,icon,color,cover_image_url,is_public,is_starred,is_deleted,position,created_at,updated_at';

function withEmptyContent(page: Omit<Page, 'content'>): Page {
  return {
    ...page,
    content: [],
  };
}

function dedupePagesById(pages: Page[]): Page[] {
  const pageMap = new Map<string, Page>();

  pages.forEach((page) => {
    pageMap.set(page.id, page);
  });

  return Array.from(pageMap.values());
}

export const pagesService = {
  async getPages(userId: string, userEmail?: string) {
    const { data: ownPages, error: ownPagesError } = await supabase
      .from('pages')
      .select(PAGE_LIST_COLUMNS)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('position', { ascending: true });

    if (ownPagesError) throw ownPagesError;

    let sharedPages: Page[] = [];

    if (userEmail) {
      const normalizedEmail = userEmail.trim().toLowerCase();

      if (normalizedEmail) {
        const { data: shareRows, error: shareRowsError } = await supabase
          .from('page_shares')
          .select('page_id')
          .ilike('shared_email', normalizedEmail);

        if (shareRowsError) {
          throw shareRowsError;
        }

        const sharedPageIds = (shareRows ?? []).map((row) => row.page_id);

        if (sharedPageIds.length > 0) {
          const { data: sharedData, error: sharedPagesError } = await supabase
            .from('pages')
            .select(PAGE_LIST_COLUMNS)
            .in('id', sharedPageIds)
            .eq('is_deleted', false)
            .order('position', { ascending: true });

          if (sharedPagesError) {
            throw sharedPagesError;
          }

          sharedPages = (sharedData ?? []).map((page) => withEmptyContent(page as Omit<Page, 'content'>));
        }
      }
    }

    const ownPageList = (ownPages ?? []).map((page) => withEmptyContent(page as Omit<Page, 'content'>));

    return dedupePagesById([...ownPageList, ...sharedPages]);
  },

  async getPageShares(pageId: string): Promise<PageShare[]> {
    const { data, error } = await supabase
      .from('page_shares')
      .select('id,page_id,shared_email,permission,created_at')
      .eq('page_id', pageId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []) as PageShare[];
  },

  async sharePage(
    pageId: string,
    email: string,
    permission: 'view' | 'edit' = 'view'
  ): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    const { error: cleanupError } = await supabase
      .from('page_shares')
      .delete()
      .eq('page_id', pageId)
      .ilike('shared_email', normalizedEmail);

    if (cleanupError) throw cleanupError;

    const { error } = await supabase.from('page_shares').insert({
      page_id: pageId,
      shared_email: normalizedEmail,
      permission,
    });

    if (error) throw error;
  },

  async removePageShare(shareId: string): Promise<void> {
    const { error } = await supabase.from('page_shares').delete().eq('id', shareId);

    if (error) throw error;
  },

  async togglePagePublic(pageId: string, isPublic: boolean): Promise<Page> {
    const { data, error } = await supabase
      .from('pages')
      .update({
        is_public: isPublic,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pageId)
      .select('*')
      .single();

    if (error) throw error;

    return data as Page;
  },

  async getPage(pageId: string) {
    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .eq('id', pageId)
      .maybeSingle();

    if (error) throw error;
    return data as Page | null;
  },

  async getSharePermission(
    pageId: string,
    userEmail: string
  ): Promise<'view' | 'edit' | null> {
    const normalizedEmail = userEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      return null;
    }

    const { data, error } = await supabase
      .from('page_shares')
      .select('permission')
      .eq('page_id', pageId)
      .ilike('shared_email', normalizedEmail)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return null;
    }

    return data.permission as 'view' | 'edit';
  },

  async createPage(
    userId: string,
    parentId: string | null = null,
    options?: {
      title?: string;
      content?: Block[];
      icon?: string;
      color?: string;
    }
  ): Promise<Page> {
    const { data, error } = await supabase
      .from('pages')
      .insert({
        user_id: userId,
        parent_id: parentId,
        title: options?.title ?? 'Untitled',
        content: options?.content ?? ([] as Block[]),
        icon: options?.icon ?? '📄',
        color: options?.color,
        is_public: false,
        position: 0,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as Page;
  },

  async updatePage(pageId: string, updates: Partial<Page>) {
    const { data, error } = await supabase
      .from('pages')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pageId)
      .select('*')
      .single();

    if (error) throw error;
    return data as Page;
  },

  async deletePage(pageId: string) {
    const { data, error } = await supabase
      .from('pages')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', pageId)
      .select('*')
      .single();

    if (error) throw error;
    return data as Page;
  },

  async restorePage(pageId: string) {
    const { data, error } = await supabase
      .from('pages')
      .update({ is_deleted: false, updated_at: new Date().toISOString() })
      .eq('id', pageId)
      .select('*')
      .single();

    if (error) throw error;
    return data as Page;
  },

  async duplicatePage(pageId: string, userId: string): Promise<Page> {
    const page = await this.getPage(pageId);
    if (!page) throw new Error('Page not found');

    const { data, error } = await supabase
      .from('pages')
      .insert({
        user_id: userId,
        parent_id: page.parent_id,
        title: `${page.title} (Copy)`,
        content: page.content,
        icon: page.icon,
        color: page.color,
        position: page.position + 1,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as Page;
  },

  async searchPages(userId: string, query: string): Promise<Page[]> {
    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .limit(20);

    if (error) throw error;
    return data as Page[];
  },

  async movePageToTrash(pageId: string) {
    return this.deletePage(pageId);
  },

  async getTrashPages(userId: string) {
    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', true)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data as Page[];
  },

  subscribeToPage(pageId: string, callback: (page: Page) => void) {
    return supabase
      .channel(`page:${pageId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pages',
          filter: `id=eq.${pageId}`,
        },
        (payload) => {
          if (payload.new && !Array.isArray(payload.new)) {
            callback(payload.new as Page);
          }
        }
      )
      .subscribe();
  },
};
