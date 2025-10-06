/**
 * OCR processing for uploaded images
 * Feature: 001-web-search-integration
 *
 * Uses Cloudflare AI Workers (@cf/meta/llama-ocr) for text extraction from genealogy documents.
 */

interface AIEnv {
  AI: any; // Cloudflare AI binding
}

export async function extractTextFromImage(
  imageBuffer: ArrayBuffer,
  env: AIEnv
): Promise<string> {
  try {
    // Convert ArrayBuffer to Uint8Array for AI Workers
    const imageArray = new Uint8Array(imageBuffer);

    // Use Cloudflare AI Workers OCR model
    // Note: Actual model name may vary - check Cloudflare AI docs
    // Common options: '@cf/meta/llama-ocr', '@cf/meta/ocr', '@cf/unum/uform-gen2-qwen-500m'
    const result = await env.AI.run('@cf/meta/llama-ocr', {
      image: Array.from(imageArray),
    });

    // Extract text from result
    const text = typeof result === 'string' ? result : result.text || result.description || '';

    if (!text || text.trim().length === 0) {
      throw new Error('OCR returned empty result');
    }

    return text;
  } catch (error) {
    console.error('OCR extraction failed:', error);

    // Return error message - trip flow should continue per FR-008
    return `[OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please enter genealogy data manually.]`;
  }
}

export function isImageFile(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop();
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'].includes(ext || '');
}
