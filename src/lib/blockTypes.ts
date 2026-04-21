import {
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Type,
} from 'lucide-react';
import { Block } from '../types';

export const BLOCK_TYPE_OPTIONS = [
  { type: 'paragraph' as const, label: 'Paragraph', icon: Type, description: 'Plain text block' },
  { type: 'heading1' as const, label: 'Heading 1', icon: Heading1, description: 'Large section heading' },
  { type: 'heading2' as const, label: 'Heading 2', icon: Heading2, description: 'Medium section heading' },
  { type: 'heading3' as const, label: 'Heading 3', icon: Heading3, description: 'Small section heading' },
  { type: 'bullet' as const, label: 'Bullet List', icon: List, description: 'Simple unordered list' },
  { type: 'numbered' as const, label: 'Numbered List', icon: ListOrdered, description: 'Ordered list of steps' },
  { type: 'todo' as const, label: 'Todo', icon: CheckSquare, description: 'Checklist item' },
  { type: 'code' as const, label: 'Code', icon: Code2, description: 'Code snippet with monospaced styling' },
  { type: 'quote' as const, label: 'Quote', icon: Quote, description: 'Highlighted quote or callout' },
  { type: 'divider' as const, label: 'Divider', icon: Minus, description: 'Horizontal separator line' },
  { type: 'image' as const, label: 'Image', icon: ImageIcon, description: 'Image URL block' },
];

export function filterBlockTypeOptions(query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return BLOCK_TYPE_OPTIONS;
  }

  return BLOCK_TYPE_OPTIONS.filter(({ label, description, type }) =>
    [label, description, type].some((value) => value.toLowerCase().includes(normalizedQuery))
  );
}

export function isBlockType(value: string): value is Block['type'] {
  return BLOCK_TYPE_OPTIONS.some((option) => option.type === value);
}
