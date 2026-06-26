#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { parseDocument } from './utils/parser.js';
import { detectPii, redactPii } from './utils/pii.js';
import { chunkText, estimateTokens } from './utils/chunking.js';
import { scanSensitivity } from './utils/sensitivity.js';

const server = new Server(
  { name: 'document-processor', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

const TOOLS = [
  {
    name: 'parse_document',
    description: 'Parse document and extract text. Supports PDF, DOCX, XLSX, CSV, TXT',
    inputSchema: {
      type: 'object',
      properties: {
        mimeType: { type: 'string', description: 'MIME type of document' },
        fileBase64: { type: 'string', description: 'Base64-encoded file content' },
      },
      required: ['mimeType', 'fileBase64'],
    },
  },
  {
    name: 'redact_pii',
    description: 'Detect and redact PII (emails, SSNs, credit cards, phone numbers)',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to scan and redact' },
        patternTypes: {
          type: 'array',
          items: { type: 'string', enum: ['email', 'ssn', 'credit_card', 'phone_number'] },
          description: 'Types of PII to redact',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'chunk_text',
    description: 'Split text into overlapping chunks for RAG',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to chunk' },
        chunkSize: { type: 'number', description: 'Size per chunk (default: 1000)' },
        overlapSize: { type: 'number', description: 'Overlap size (default: 100)' },
      },
      required: ['text'],
    },
  },
  {
    name: 'scan_sensitivity',
    description: 'Classify document sensitivity level',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to analyze' },
      },
      required: ['text'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error('[tools/list] Returning', TOOLS.length, 'tools');
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const toolArgs = (args || {}) as Record<string, unknown>;

  console.error(`[tools/call] Calling tool: ${name}`);

  try {
    if (name === 'parse_document') {
      const mimeType = toolArgs.mimeType as string;
      const fileBase64 = toolArgs.fileBase64 as string;
      if (!mimeType || !fileBase64) throw new Error('mimeType and fileBase64 required');
      const buffer = Buffer.from(fileBase64, 'base64');
      const result = await parseDocument(buffer, mimeType);
      console.error('[tools/call] parse_document completed');
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'redact_pii') {
      const text = toolArgs.text as string;
      if (!text) throw new Error('text required');
      const violations = detectPii(text);
      const redacted = redactPii(text, toolArgs.patternTypes as string[] | undefined);
      console.error(`[tools/call] redact_pii found ${violations.length} violations`);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                original_length: text.length,
                redacted_length: redacted.length,
                violations_found: violations.length,
                violations: violations.slice(0, 10),
                redacted_text: redacted,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (name === 'chunk_text') {
      const text = toolArgs.text as string;
      if (!text) throw new Error('text required');
      const chunkSize = (toolArgs.chunkSize as number) || 1000;
      const overlapSize = (toolArgs.overlapSize as number) || 100;
      const chunks = chunkText(text, chunkSize, overlapSize);
      const estimatedTokens = estimateTokens(text);
      console.error(`[tools/call] chunk_text created ${chunks.length} chunks`);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                total_chunks: chunks.length,
                estimated_tokens: estimatedTokens,
                text_length: text.length,
                chunks: chunks.map((c) => ({
                  chunkIdx: c.chunkIdx,
                  text: c.text.substring(0, 200) + (c.text.length > 200 ? '...' : ''),
                  length: c.text.length,
                  tokens: estimateTokens(c.text),
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (name === 'scan_sensitivity') {
      const text = toolArgs.text as string;
      if (!text) throw new Error('text required');
      const result = scanSensitivity(text);
      console.error(`[tools/call] scan_sensitivity: ${result.level}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[tools/call] Error:', errorMsg);
    return {
      content: [{ type: 'text', text: `Error: ${errorMsg}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  console.error('[document-processor] Connecting...');
  await server.connect(transport);
  console.error('[document-processor] MCP Server ready on stdio');
  console.error('[document-processor] Available tools:', TOOLS.map((t) => t.name).join(', '));
}

main().catch((err) => {
  console.error('[document-processor] Fatal error:', err);
  process.exit(1);
});
