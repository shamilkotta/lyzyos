export function docKey(projectId: string, docId: string, name: string): string {
  const safe = name.replace(/[^\w.\-()+ ]/g, "_").slice(0, 120);
  return `projects/${projectId}/docs/${docId}/${safe}`;
}

export async function putObject(
  bucket: R2Bucket,
  key: string,
  body: ArrayBuffer | ArrayBufferView | string,
  mime?: string,
): Promise<void> {
  await bucket.put(key, body, mime ? { httpMetadata: { contentType: mime } } : undefined);
}

export async function getObjectText(bucket: R2Bucket, key: string): Promise<string> {
  const obj = await bucket.get(key);
  if (!obj) return "";
  return obj.text();
}

export async function getObject(bucket: R2Bucket, key: string): Promise<R2ObjectBody | null> {
  return bucket.get(key);
}
