import { buildApiUrl, getApiHeaders, API_ROUTES } from '../apiConfig';
import RNFS from 'react-native-fs';

export interface PresignUploadRequest {
  fileName: string;
  contentType: string;
  mediaType?: 'image' | 'video' | 'document';
  userId?: string | number;
}

export interface PresignUploadResponse {
  status: 'success' | 'error';
  msg: string;
  data: {
    uploadUrl: string;
    fileUrl: string;
    s3Key: string;
    expiresIn: number;
  } | null;
}

export const getPresignedUploadUrl = async (
  payload: PresignUploadRequest
): Promise<PresignUploadResponse['data']> => {
  const presignRoute =
    (API_ROUTES as any)?.v2?.media?.presignUpload || '/v2/media/presign-upload';
  const url = buildApiUrl(presignRoute);
  const response = await fetch(url, {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify(payload),
  });

  const result: PresignUploadResponse = await response.json();
  if (!response.ok || result.status !== 'success' || !result.data) {
    throw new Error(result.msg || 'Failed to generate upload URL');
  }
  return result.data;
};

export const uploadFileToPresignedUrl = async (
  uploadUrl: string,
  fileUri: string,
  contentType: string
): Promise<void> => {
  const resolvedContentType = contentType || 'application/octet-stream';
  const getBlobSize = (value: any): number => {
    if (!value) return 0;
    if (typeof value.size === 'number') return value.size;
    return 0;
  };

  const getReadablePathForRnfs = async (uri: string): Promise<string> => {
    const normalized = String(uri || '');
    if (!normalized) throw new Error('Empty file URI');

    if (normalized.startsWith('content://')) {
      const statInfo = await RNFS.stat(normalized);
      const candidate = statInfo.originalFilepath || '';
      if (!candidate) {
        throw new Error('Unable to resolve content URI to readable file path');
      }
      return candidate;
    }

    if (normalized.startsWith('file://')) {
      return normalized.replace(/^file:\/\//, '');
    }

    return normalized;
  };

  const readBlobViaXhr = (uri: string) =>
    new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onerror = () => reject(new Error('Failed to read selected file (XHR)'));
      xhr.ontimeout = () => reject(new Error('Timed out while reading selected file'));
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status === 200 || xhr.status === 0) {
            resolve(xhr.response);
          } else {
            reject(new Error(`Failed to read selected file (status ${xhr.status})`));
          }
        }
      };
      xhr.responseType = 'blob';
      xhr.timeout = 45000;
      xhr.open('GET', uri, true);
      xhr.send();
    });

  const uploadViaXhrPut = (url: string, body: Blob) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.timeout = 90000;
      xhr.setRequestHeader('Content-Type', resolvedContentType);
      xhr.onerror = () => reject(new Error('S3 PUT failed (XHR network error)'));
      xhr.ontimeout = () => reject(new Error('S3 PUT failed (XHR timeout)'));
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`S3 PUT failed (XHR status ${xhr.status})`));
          }
        }
      };
      xhr.send(body as any);
    });

  const uploadViaRnfs = async (url: string, uri: string) => {
    let readablePath: string;
    try {
      readablePath = await getReadablePathForRnfs(uri);
    } catch (_err) {
      const tmpPath = `${RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath}/market-upload-${Date.now()}`;
      await RNFS.copyFile(uri, tmpPath);
      readablePath = tmpPath;
    }
    const uploadResult = await RNFS.uploadFiles({
      toUrl: url,
      method: 'PUT',
      headers: {
        'Content-Type': resolvedContentType,
      },
      files: [
        {
          name: 'file',
          filename: readablePath.split('/').pop() || 'upload.bin',
          filepath: readablePath,
          filetype: resolvedContentType,
        },
      ],
      binaryStreamOnly: true,
    }).promise;

    if (uploadResult.statusCode < 200 || uploadResult.statusCode >= 300) {
      throw new Error(`S3 PUT failed (RNFS status ${uploadResult.statusCode})`);
    }
  };

  let blob: Blob | null = null;
  try {
    const localFileResponse = await fetch(fileUri);
    if (!localFileResponse.ok) {
      throw new Error(`read failed with status ${localFileResponse.status}`);
    }
    blob = await localFileResponse.blob();
    if (getBlobSize(blob) <= 0) {
      throw new Error('Selected file resolved to empty data');
    }
  } catch (_readErr) {
    try {
      // Common on Android content:// URIs where fetch(uri) throws "Network request failed".
      blob = await readBlobViaXhr(fileUri);
      if (getBlobSize(blob) <= 0) {
        throw new Error('XHR read returned empty data');
      }
    } catch (_xhrErr) {
      blob = null;
    }
  }

  let fetchStatusErr: Error = new Error('S3 upload failed (fetch path not attempted)');
  if (blob && getBlobSize(blob) > 0) {
    try {
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': resolvedContentType,
        },
        body: blob as any,
      });

      if (uploadResponse.ok) {
        return;
      }
      fetchStatusErr = new Error(`S3 upload failed with status ${uploadResponse.status}`);
    } catch (fetchErr: any) {
      fetchStatusErr = new Error(`S3 upload failed (fetch): ${fetchErr?.message || 'network error'}`);
    }
  } else {
    fetchStatusErr = new Error('S3 upload failed (no readable blob from URI)');
  }

  try {
    await uploadViaRnfs(uploadUrl, fileUri);
    return;
  } catch (rnfsErr: any) {
    try {
      if (!blob || getBlobSize(blob) <= 0) {
        throw new Error('No blob available for XHR PUT fallback');
      }
      await uploadViaXhrPut(uploadUrl, blob);
      return;
    } catch (xhrErr: any) {
      const msg = `S3 upload failed. fetch=${fetchStatusErr.message}; rnfs=${rnfsErr?.message || 'unknown'}; xhr=${xhrErr?.message || 'unknown'}`;
      throw new Error(msg);
    }
  }
};
