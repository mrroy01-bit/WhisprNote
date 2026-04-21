export interface User {
  id: string;
  email: string;
  name: string;
  avatar_color: string;
  theme: 'light' | 'dark';
  created_at: string;
  updated_at: string;
}

export interface Block {
  id: string;
  type: 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'bullet' | 'numbered' | 'todo' | 'code' | 'quote' | 'divider' | 'image';
  content: string;
  children?: Block[];
  checked?: boolean;
  language?: string;
  imageUrl?: string;
}

export interface Page {
  id: string;
  user_id: string;
  title: string;
  content: Block[];
  parent_id: string | null;
  icon: string;
  color: string;
  cover_image_url: string | null;
  is_public: boolean;
  is_starred: boolean;
  is_deleted: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  children?: Page[];
}

export interface PageShare {
  id: string;
  page_id: string;
  shared_email: string;
  permission: 'view' | 'edit';
  created_at: string;
}

export interface PageTree extends Page {
  children: PageTree[];
}

export interface SearchResult {
  id: string;
  title: string;
  parent_id: string | null;
  type: 'page' | 'block';
  snippet: string;
}

export type Theme = 'light' | 'dark';
