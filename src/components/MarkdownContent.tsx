import * as React from 'react';
import Link from 'next/link';

/**
 * Minimal, safe Markdown renderer for the controlled subset our content engine
 * produces: H2/H3, ordered + unordered lists, paragraphs, **bold**, and links.
 *
 * Deliberately dependency-free and HTML-free — text is rendered as React children
 * (auto-escaped), and only `/internal` or `https://` link targets are honoured,
 * so AI-generated copy can never inject markup. Anything outside the subset falls
 * back to plain paragraph text.
 */

/** Parse inline **bold** and [label](href) into React nodes. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Alternating split on **bold** and [label](href).
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(pattern);
  parts.forEach((part, i) => {
    if (!part) return;
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
      return;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const [, label, href] = link;
      const safe = href.startsWith('/') || href.startsWith('https://');
      if (safe) {
        nodes.push(
          <Link key={key} href={href} className="font-medium text-primary hover:underline">
            {label}
          </Link>
        );
        return;
      }
      nodes.push(label); // drop unsafe href, keep the text
      return;
    }
    nodes.push(part);
  });
  return nodes;
}

export function MarkdownContent({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];

  let para: string[] = [];
  let ul: string[] = [];
  let ol: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={`p-${key++}`} className="my-4 leading-relaxed text-muted-foreground">
          {renderInline(para.join(' '), `p${key}`)}
        </p>
      );
      para = [];
    }
  };
  const flushUl = () => {
    if (ul.length) {
      blocks.push(
        <ul key={`ul-${key++}`} className="my-4 list-disc space-y-1.5 pl-5 text-muted-foreground">
          {ul.map((li, i) => (
            <li key={i} className="leading-relaxed">
              {renderInline(li, `ul${key}-${i}`)}
            </li>
          ))}
        </ul>
      );
      ul = [];
    }
  };
  const flushOl = () => {
    if (ol.length) {
      blocks.push(
        <ol key={`ol-${key++}`} className="my-4 list-decimal space-y-1.5 pl-5 text-muted-foreground">
          {ol.map((li, i) => (
            <li key={i} className="leading-relaxed">
              {renderInline(li, `ol${key}-${i}`)}
            </li>
          ))}
        </ol>
      );
      ol = [];
    }
  };
  const flushAll = () => {
    flushPara();
    flushUl();
    flushOl();
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushAll();
      continue;
    }
    if (line.startsWith('### ')) {
      flushAll();
      blocks.push(
        <h3 key={`h3-${key++}`} className="mt-6 mb-2 text-lg font-bold text-foreground">
          {renderInline(line.slice(4), `h3${key}`)}
        </h3>
      );
    } else if (line.startsWith('## ')) {
      flushAll();
      blocks.push(
        <h2 key={`h2-${key++}`} className="mt-8 mb-3 text-2xl font-extrabold tracking-tight text-foreground">
          {renderInline(line.slice(3), `h2${key}`)}
        </h2>
      );
    } else if (/^\d+\.\s/.test(line)) {
      flushPara();
      flushUl();
      ol.push(line.replace(/^\d+\.\s/, ''));
    } else if (line.startsWith('- ')) {
      flushPara();
      flushOl();
      ul.push(line.slice(2));
    } else {
      flushUl();
      flushOl();
      para.push(line);
    }
  }
  flushAll();

  return <div className="article-body">{blocks}</div>;
}
