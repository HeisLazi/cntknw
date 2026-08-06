import { describe, expect, it } from 'vitest';
import { SourceViewSchema } from './workspace.schemas';

describe('SourceView annotation tool', () => {
  it('defaults old stored source views to select', () => {
    expect(
      SourceViewSchema.parse({ mode: 'continuous', zoom: 1, scrollOffset: 0 })
        .annotationTool,
    ).toBe('select');
  });

  it('accepts the persisted region tool', () => {
    expect(SourceViewSchema.parse({ annotationTool: 'region' }).annotationTool).toBe(
      'region',
    );
  });
});
