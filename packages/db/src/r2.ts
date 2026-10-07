export function docKey(projectId: string, docId: string, name: string) {
  const safe = name.replace(/[^\w.\-()+ ]/g, "_").slice(0, 120);
  return `projects/${projectId}/docs/${docId}/${safe}`;
}

export async function putObject(
  bucket: R2Bucket,
  key: string,
  body: ArrayBuffer | ArrayBufferView | string,
  mime?: string,
) {
  await bucket.put(key, body, mime ? { httpMetadata: { contentType: mime } } : undefined);
}

export async function getObject(bucket: R2Bucket, key: string) {
  return bucket.get(key);
}
