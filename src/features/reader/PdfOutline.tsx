import { useEffect, useState } from 'react';
import type { LoadedDocument } from './pdfjs';
import { IconButton } from '@components/primitives';

export interface PdfOutlineProps {
  document: LoadedDocument;
  onNavigate: (page: number) => void;
  onClose: () => void;
  showHeader?: boolean;
}

export interface PdfOutlineItem {
  title: string;
  dest?: unknown;
  items?: PdfOutlineItem[];
}

export function PdfOutline({
  document,
  onNavigate,
  onClose,
  showHeader = true,
}: PdfOutlineProps) {
  const [outline, setOutline] = useState<PdfOutlineItem[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    document.getOutline().then(
      (result) => {
        if (active) {
          setOutline(result as PdfOutlineItem[] | null);
          setStatus('ready');
        }
      },
      () => {
        // Outline extraction is optional document metadata. Failure
        // is handled here rather than leaking an unhandled rejection
        // or pretending the PDF genuinely contains no outline.
        if (active) setStatus('error');
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, document]);

  const header = showHeader ? (
    <div className="cn-outline__header">
      <h2 className="cn-outline__title">Contents</h2>
      <IconButton icon="×" label="Close contents" onClick={onClose} size="sm" />
    </div>
  ) : null;

  if (status === 'loading') {
    return (
      <div className="cn-outline" data-embedded={!showHeader}>
        {header}
        <div className="cn-outline__body">
          <p className="cn-outline__hint">Loading outline…</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="cn-outline" data-embedded={!showHeader}>
        {header}
        <div className="cn-outline__body">
          <p className="cn-outline__hint" role="status">Outline unavailable.</p>
          <button
            type="button"
            className="cn-outline__retry"
            onClick={() => {
              setStatus('loading');
              setAttempt((current) => current + 1);
            }}
          >
            Retry outline
          </button>
        </div>
      </div>
    );
  }

  if (!outline || outline.length === 0) {
    return (
      <div className="cn-outline" data-embedded={!showHeader}>
        {header}
        <div className="cn-outline__body">
          <p className="cn-outline__hint">This document has no outline.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cn-outline" data-embedded={!showHeader}>
      {header}
      <div className="cn-outline__body">
        <OutlineList items={outline} document={document} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function OutlineList({
  items,
  document,
  onNavigate,
}: {
  items: PdfOutlineItem[];
  document: LoadedDocument;
  onNavigate: (page: number) => void;
}) {
  return (
    <ul className="cn-outline__list">
      {items.map((item, index) => (
        <OutlineItem
          key={index}
          item={item}
          document={document}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );
}

function OutlineItem({
  item,
  document,
  onNavigate,
}: {
  item: PdfOutlineItem;
  document: LoadedDocument;
  onNavigate: (page: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = item.items && item.items.length > 0;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (item.dest) {
      try {
        const pageIndex = await document.getPageIndex(item.dest);
        onNavigate(pageIndex);
      } catch (err) {
        console.warn('Failed to resolve outline destination', err);
      }
    } else if (hasChildren) {
      setExpanded(!expanded);
    }
  };

  return (
    <li className="cn-outline__item">
      <div className="cn-outline__row">
        {hasChildren ? (
          <button
            type="button"
            className="cn-outline__toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="cn-outline__spacer" />
        )}
        <a
          href="#"
          className="cn-outline__link"
          onClick={handleClick}
          title={item.title}
        >
          {item.title}
        </a>
      </div>
      {hasChildren && expanded && (
        <OutlineList
          items={item.items || []}
          document={document}
          onNavigate={onNavigate}
        />
      )}
    </li>
  );
}
