import { useState, useEffect, useRef } from 'react';
import type { LoadedDocument, SearchResult } from './pdfjs';
import { IconButton } from '@components/primitives';

export interface PdfSearchProps {
  document: LoadedDocument;
  onNavigate: (page: number) => void;
  onClose: () => void;
}

export function PdfSearch({ document, onNavigate, onClose }: PdfSearchProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchGenerationRef = useRef(0);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const generation = ++searchGenerationRef.current;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsSearching(true);
    setResults([]);
    setCurrentIndex(-1);
    setError(null);

    const foundPages: SearchResult[] = [];

    try {
      for await (const result of document.searchDocument(query, abortController.signal)) {
        if (generation !== searchGenerationRef.current || abortController.signal.aborted) return;
        foundPages.push(result);
        setResults([...foundPages]);
        if (foundPages.length === 1) {
          setCurrentIndex(0);
          onNavigate(result.pageNumber);
        }
      }
    } catch (err) {
      if (generation === searchGenerationRef.current && !abortController.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (generation === searchGenerationRef.current && !abortController.signal.aborted) {
        setIsSearching(false);
      }
    }
  };

  const nextResult = () => {
    if (results.length === 0) return;
    const next = (currentIndex + 1) % results.length;
    setCurrentIndex(next);
    onNavigate(results[next]!.pageNumber);
  };

  const prevResult = () => {
    if (results.length === 0) return;
    const prev = (currentIndex - 1 + results.length) % results.length;
    setCurrentIndex(prev);
    onNavigate(results[prev]!.pageNumber);
  };

  return (
    <div className="cn-pdf-search">
      <form className="cn-pdf-search__form" onSubmit={handleSearch}>
        <input
          type="text"
          className="cn-pdf-search__input"
          placeholder="Find in document…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <span className="cn-pdf-search__status">
          {isSearching
            ? 'Searching…'
            : error
              ? 'Search unavailable'
              : results.length > 0
                ? `${currentIndex + 1} of ${results.length} pages · ${results[currentIndex]?.matches ?? 0} matches`
                : query
                  ? 'No results'
                  : ''}
        </span>
        {error ? <span role="alert">{error}</span> : null}
        <div className="cn-pdf-search__controls">
          <IconButton icon="↑" label="Previous match" onClick={prevResult} disabled={results.length === 0} size="sm" />
          <IconButton icon="↓" label="Next match" onClick={nextResult} disabled={results.length === 0} size="sm" />
          <IconButton icon="×" label="Close search" onClick={onClose} size="sm" />
        </div>
      </form>
    </div>
  );
}
