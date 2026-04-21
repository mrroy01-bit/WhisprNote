import { Block } from '../types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
const AI_REQUEST_TIMEOUT_MS = 30000;

const ALLOWED_BLOCK_TYPES: Block['type'][] = [
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bullet',
  'numbered',
  'todo',
  'code',
  'quote',
  'divider',
  'image',
];

interface AINoteResponse {
  title?: unknown;
  blocks?: Array<{
    type?: unknown;
    content?: unknown;
    checked?: unknown;
    language?: unknown;
    imageUrl?: unknown;
  }>;
}

export interface GeneratedNote {
  title: string;
  blocks: Block[];
}

export const aiService = {
  async generateNoteFromPrompt(prompt: string): Promise<GeneratedNote> {
    const apiKey = (import.meta.env.VITE_GROQ_API_KEY as string | undefined)?.trim();

    if (!apiKey) {
      throw new Error('Missing VITE_GROQ_API_KEY in environment variables.');
    }

    const model =
      (import.meta.env.VITE_GROQ_MODEL as string | undefined)?.trim() || DEFAULT_GROQ_MODEL;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.45,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are an expert note writer. Return strict JSON with this schema: {"title": string, "blocks": Array<{"type": string, "content": string, "checked"?: boolean, "language"?: string, "imageUrl"?: string}>}. Use only block types: paragraph, heading1, heading2, heading3, bullet, numbered, todo, code, quote, divider, image. Create practical, detailed notes with a real study/professional style. Always include: 1 heading1 title, 3-6 heading2 sections, numbered steps, bullet insights, a todo checklist, and a short code block when relevant. Use clear section emojis in headings and important points. Target 18-32 blocks. Keep each block concise and useful.',
            },
            {
              role: 'user',
              content: `Create a full detailed note for this prompt: ${prompt}`,
            },
          ],
        }),
        signal: controller.signal,
      });

      const payload = await response.json();

      if (!response.ok) {
        const message =
          payload?.error?.message ||
          `Groq request failed with status ${response.status}`;
        throw new Error(message);
      }

      const content = payload?.choices?.[0]?.message?.content;

      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('Groq returned an empty response.');
      }

      const parsed = parseJsonFromModelResponse(content) as AINoteResponse;
      const blocks = normalizeBlocks(parsed.blocks);

      if (!blocks.length) {
        throw new Error('Groq response did not include usable note blocks.');
      }

      return {
        title: normalizeTitle(parsed.title, prompt),
        blocks,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Groq request timed out. Please try again.');
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },
};

function normalizeTitle(title: unknown, prompt: string) {
  if (typeof title === 'string' && title.trim()) {
    return title.trim().slice(0, 120);
  }

  return prompt.trim().slice(0, 120) || 'AI Note';
}

function normalizeBlocks(blocks: AINoteResponse['blocks']): Block[] {
  if (!Array.isArray(blocks)) {
    return [];
  }

  return blocks
    .map((block) => {
      const type =
        typeof block?.type === 'string' &&
        ALLOWED_BLOCK_TYPES.includes(block.type as Block['type'])
          ? (block.type as Block['type'])
          : 'paragraph';

      const normalizedContent =
        typeof block?.content === 'string' ? ensureEmojiHeading(type, block.content.trim()) : '';

      if (!normalizedContent && type !== 'divider' && type !== 'image') {
        return null;
      }

      return {
        id: createBlockId(),
        type,
        content: type === 'image' ? '' : normalizedContent,
        checked: type === 'todo' ? Boolean(block?.checked) : undefined,
        language:
          type === 'code' && typeof block?.language === 'string'
            ? block.language
            : undefined,
        imageUrl:
          type === 'image' && typeof block?.imageUrl === 'string'
            ? block.imageUrl
            : undefined,
      } as Block;
    })
    .filter((block): block is Block => Boolean(block));
}

function parseJsonFromModelResponse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Could not parse Groq response as JSON.');
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      throw new Error('Groq returned invalid JSON format.');
    }
  }
}

function createBlockId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

function ensureEmojiHeading(type: Block['type'], content: string) {
  if (!content) {
    return content;
  }

  if (type !== 'heading1' && type !== 'heading2' && type !== 'heading3') {
    return content;
  }

  if (/\p{Extended_Pictographic}/u.test(content)) {
    return content;
  }

  if (type === 'heading1') {
    return `🧭 ${content}`;
  }

  if (type === 'heading2') {
    return `📌 ${content}`;
  }

  return `✨ ${content}`;
}
