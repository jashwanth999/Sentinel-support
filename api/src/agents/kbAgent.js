import { searchKnowledgeBase } from '../db/queries.js';

export async function runKbAgent ({ query }) {
  if (!query) return { tool: 'kb', ok: true, output: { results: [] } };
  const rows = await searchKnowledgeBase(query, 3);
  return {
    tool: 'kb',
    ok: true,
    output: {
      results: rows.map(row => ({
        docId: row.id,
        title: row.title,
        anchor: row.anchor,
        excerpt: row.content_text.slice(0, 280)
      }))
    }
  };
}

export default { runKbAgent };
