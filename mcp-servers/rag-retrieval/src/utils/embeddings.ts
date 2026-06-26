let pipeline: ((text: string, options?: Record<string, unknown>) => Promise<{ data: Float32Array }>) | null = null;
const MODEL_ID = process.env.EMBEDDING_MODEL_ID ?? 'Xenova/all-MiniLM-L6-v2';

async function getPipeline() {
  if (pipeline) return pipeline;
  console.error(`[embeddings] Loading model: ${MODEL_ID}`);
  const { pipeline: createPipeline } = await import('@xenova/transformers');
  pipeline = (await createPipeline('feature-extraction', MODEL_ID, { quantized: true })) as unknown as (text: string, options?: Record<string, unknown>) => Promise<{ data: Float32Array }>;
  console.error(`[embeddings] Model loaded: ${MODEL_ID}`);
  return pipeline;
}

export async function embedText(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const output = await pipe(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
