#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { embedText } from './utils/embeddings.js';
import { searchChunks, getProjectEmbeddingModel } from './utils/retrieval.js';
import { buildContext, rerankChunks } from './utils/context.js';

const server = new Server(
  { name: 'rag-retrieval', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

const TOOLS = [
  {
    name: 'embed_text',
    description: 'Generate a vector embedding for a text query using the local transformer model',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Text to embed' } },
      required: ['text'],
    },
  },
  {
    name: 'search_chunks',
    description: 'Semantic similarity search against project document chunks in the database',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        projectId: { type: 'string', description: 'Project UUID to search within' },
        topK: { type: 'number', description: 'Number of results to return (default: 5)' },
        minSimilarity: { type: 'number', description: 'Minimum similarity threshold 0-1 (default: 0.3)' },
      },
      required: ['query', 'projectId'],
    },
  },
  {
    name: 'rerank_results',
    description: 'Rerank retrieved chunks by combining similarity score with keyword relevance',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Original query for keyword boosting' },
        chunks: { type: 'array', description: 'Array of chunks from search_chunks to rerank', items: { type: 'object' } },
      },
      required: ['query', 'chunks'],
    },
  },
  {
    name: 'build_context',
    description: 'Format retrieved chunks into an LLM-ready context string with source citations',
    inputSchema: {
      type: 'object',
      properties: {
        chunks: { type: 'array', description: 'Array of chunks to include in context', items: { type: 'object' } },
        maxTokens: { type: 'number', description: 'Max tokens for context (default: 3000)' },
      },
      required: ['chunks'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const toolArgs = (args || {}) as Record<string, unknown>;
  console.error(`[rag-retrieval] Calling tool: ${name}`);

  try {
    if (name === 'embed_text') {
      const text = toolArgs.text as string;
      if (!text) throw new Error('text is required');
      const embedding = await embedText(text);
      console.error(`[rag-retrieval] Embedded text: ${embedding.length} dimensions`);
      return { content: [{ type: 'text', text: JSON.stringify({ dimensions: embedding.length, embedding }) }] };
    }

    if (name === 'search_chunks') {
      const query = toolArgs.query as string;
      const projectId = toolArgs.projectId as string;
      const topK = (toolArgs.topK as number) || 5;
      const minSimilarity = (toolArgs.minSimilarity as number) || 0.3;
      if (!query || !projectId) throw new Error('query and projectId are required');
      const modelInfo = await getProjectEmbeddingModel(projectId);
      console.error(`[rag-retrieval] Project embedding model: ${modelInfo?.modelId ?? 'none'}`);
      const queryEmbedding = await embedText(query);
      const chunks = await searchChunks(queryEmbedding, projectId, topK, minSimilarity);
      console.error(`[rag-retrieval] Found ${chunks.length} chunks for query: "${query.substring(0, 50)}"`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query, projectId, total_found: chunks.length,
            model_used: modelInfo?.modelId ?? 'Xenova/all-MiniLM-L6-v2',
            chunks: chunks.map((c) => ({ id: c.id, document_id: c.document_id, document_name: c.document_name, content: c.content, chunk_index: c.chunk_index, similarity: Math.round(c.similarity * 1000) / 1000 })),
          }),
        }],
      };
    }

    if (name === 'rerank_results') {
      const query = toolArgs.query as string;
      const chunks = toolArgs.chunks as Parameters<typeof rerankChunks>[0];
      if (!query || !chunks) throw new Error('query and chunks are required');
      const reranked = rerankChunks(chunks, query);
      console.error(`[rag-retrieval] Reranked ${reranked.length} chunks`);
      return { content: [{ type: 'text', text: JSON.stringify({ reranked_chunks: reranked }) }] };
    }

    if (name === 'build_context') {
      const chunks = toolArgs.chunks as Parameters<typeof buildContext>[0];
      const maxTokens = (toolArgs.maxTokens as number) || 3000;
      if (!chunks || !Array.isArray(chunks)) throw new Error('chunks array is required');
      const result = buildContext(chunks, maxTokens);
      console.error(`[rag-retrieval] Built context: ${result.chunks_used} chunks, ~${result.total_tokens} tokens`);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[rag-retrieval] Error in ${name}:`, errorMsg);
    return { content: [{ type: 'text', text: `Error: ${errorMsg}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  console.error('[rag-retrieval] Connecting...');
  await server.connect(transport);
  console.error('[rag-retrieval] RAG Retrieval MCP Server ready on stdio');
  console.error('[rag-retrieval] Tools: embed_text, search_chunks, rerank_results, build_context');
}

main().catch((err) => { console.error('[rag-retrieval] Fatal error:', err); process.exit(1); });
