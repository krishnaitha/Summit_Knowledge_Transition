import 'server-only';

let featureExtractorPromise: Promise<(input: string) => Promise<number[]>> | null = null;

async function loadFeatureExtractor() {
  const [{ pipeline }, { env }] = await Promise.all([
    import('@xenova/transformers'),
    import('@xenova/transformers'),
  ]);

  env.allowLocalModels = false;
  // Vercel's filesystem is read-only; /tmp is the only writable directory
  env.cacheDir = '/tmp/.cache/transformers';

  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

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
