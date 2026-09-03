import { compile as compileMdx } from '@mdx-js/mdx';
import { visit } from 'unist-util-visit';
import { parse as parseYaml } from 'yaml';

import { UNIT_EMBEDS, type UnitEmbed, type UnitEmbedName } from '../schemas/learningUnit.ts';

/** Parses YAML into a plain object, or throws a readable error. */
export function parseYamlObject(text: string, path: string): Record<string, unknown> {
  const value: unknown = parseYaml(text, { prettyErrors: true });
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path}: expected a YAML mapping at the top level`);
  }
  return value as Record<string, unknown>;
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Splits `---` front matter from an MDX body. */
export function splitFrontMatter(text: string): { frontMatter: string; body: string } | null {
  const match = FRONT_MATTER.exec(text);
  if (!match) return null;
  return { frontMatter: match[1] ?? '', body: text.slice(match[0].length) };
}

interface MdNode {
  type: string;
  name?: string | null;
  depth?: number;
  value?: string;
  children?: MdNode[];
  attributes?: { type: string; name?: string; value?: unknown }[];
  position?: { start: { line: number } };
}

function textOf(node: MdNode): string {
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(textOf).join('');
}

export interface ParsedMdx {
  headings: { depth: number; text: string }[];
  embeds: UnitEmbed[];
  depth_sections: string[];
  word_count: number;
}

/**
 * Compiles the MDX body once (syntax check) while collecting headings, embeds and `<Depth>`
 * sections from the syntax tree. Throws with MDX's own message on a syntax error.
 */
export async function parseMdxBody(body: string): Promise<ParsedMdx> {
  const headings: ParsedMdx['headings'] = [];
  const embeds: UnitEmbed[] = [];
  const depthSections: string[] = [];
  let words = 0;

  const collect = () => (tree: MdNode) => {
    visit(tree as never, (node: MdNode) => {
      if (node.type === 'heading' && typeof node.depth === 'number') {
        headings.push({ depth: node.depth, text: textOf(node).trim() });
      } else if (node.type === 'text' && typeof node.value === 'string') {
        words += node.value.split(/\s+/).filter(Boolean).length;
      } else if (
        (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
        typeof node.name === 'string'
      ) {
        const attributes: Record<string, string> = {};
        for (const attribute of node.attributes ?? []) {
          if (attribute.type === 'mdxJsxAttribute' && attribute.name) {
            attributes[attribute.name] =
              typeof attribute.value === 'string'
                ? attribute.value
                : attribute.value == null
                  ? 'true'
                  : '[expression]';
          }
        }
        embeds.push({
          component: node.name as UnitEmbedName,
          attributes,
          line: node.position?.start.line ?? 0,
        });
        if (node.name === 'Depth' && attributes.title) depthSections.push(attributes.title);
      }
    });
  };

  await compileMdx(body, { remarkPlugins: [collect] });
  return { headings, embeds, depth_sections: depthSections, word_count: words };
}

export function isKnownEmbed(name: string): name is UnitEmbedName {
  return (UNIT_EMBEDS as readonly string[]).includes(name);
}
