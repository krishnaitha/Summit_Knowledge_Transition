import 'server-only';

import { appEnv } from '@/lib/env';

let featureExtractorPromise: Promise<(input: string) => Promise<number[]>> | null = null;

const EMBEDDING_DIMENSIONS = 384;

export interface EmbeddingModelSpec {
  modelId: string;
  modelRevision: string | null;
  dimensions: number;
}

export function getCurrentEmbeddingModelSpec(): EmbeddingModelSpec {
  const modelId = appEnv.embeddingModelId.trim();
  const revision = appEnv.embeddingModelRevision.trim();

  return {
    modelId,
    modelRevision: revision.length > 0 ? revision : null,
    dimensions: EMBEDDING_DIMENSIONS,
  };
}

async function loadFeatureExtractor() {
  const [{ pipeline }, { env }] = await Promise.all([
    import('@xenova/transformers'),
    import('@xenova/transformers'),
  ]);

  env.allowLocalModels = false;
  // Vercel's filesystem is read-only; /tmp is the only writable directory
  env.cacheDir = '/tmp/.cache/transformers';

  const embeddingSpec = getCurrentEmbeddingModelSpec();
  const pipelineOptions: { revision?: string } = {};

  if (embeddingSpec.modelRevision) {
    pipelineOptions.revision = embeddingSpec.modelRevision;
  }

  const extractor = await pipeline('feature-extraction', embeddingSpec.modelId, pipelineOptions);

  return async (input: string) => {
    const output = await extractor(input, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  };
}

export async function embedText(input: string) {
  if (!featureExtractorPromise) {
    featureExtractorPromise = loadFeatureExtractor();
  }

  const extractor = await featureExtractorPromise;
  return extractor(input);
}
