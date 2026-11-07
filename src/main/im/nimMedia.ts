/**
 * NIM Media Utilities
 *  
 * 
 *   openclaw-nim/src/media.ts   LobsterAI Gateway  
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { app } from 'electron';
import type { IMMediaAttachment, IMMediaType } from './types';

// ====================   ====================

/**  30MB  openclaw-nim   */
const MAX_FILE_SIZE = 30 * 1024 * 1024;

/**   */
const INBOUND_DIR = 'nim-inbound';

// ====================   ====================

/**
 *   NIM  
 */
export function getNimMediaDir(): string {
  const userDataPath = app.getPath('userData');
  const mediaDir = path.join(userDataPath, INBOUND_DIR);

  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }

  return mediaDir;
}

// ====================   ====================

/**
 *  
 */
function generateFileName(prefix: string, extension: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}_${prefix}_${random}${extension}`;
}

/**
 *   NIM   SDK  
 *   openclaw-nim/src/media.ts   inferMessageType  
 */
export function inferMediaType(filePath: string): 'image' | 'audio' | 'video' | 'file' {
  const ext = path.extname(filePath).toLowerCase();

  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const audioExts = ['.mp3', '.wav', '.aac', '.m4a', '.ogg', '.amr'];
  const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv'];

  if (imageExts.includes(ext)) return 'image';
  if (audioExts.includes(ext)) return 'audio';
  if (videoExts.includes(ext)) return 'video';
  return 'file';
}

/**
 *   MIME   IMMediaAttachment.mimeType 
 */
export function inferMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  const mimeMap: Record<string, string> = {
    //  
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    //  
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.aac': 'audio/aac',
    '.m4a': 'audio/mp4',
    '.ogg': 'audio/ogg',
    '.amr': 'audio/amr',
    //  
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.flv': 'video/x-flv',
    //  
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
  };

  return mimeMap[ext] || 'application/octet-stream';
}

/**
 *   inferMediaType   IMMediaType
 */
function toIMMediaType(mediaType: 'image' | 'audio' | 'video' | 'file'): IMMediaType {
  if (mediaType === 'file') return 'document';
  return mediaType;
}

/**
 *  
 *   openclaw-nim/src/media.ts   inferMediaPlaceholder  
 */
export function inferMediaPlaceholder(messageType: string): string {
  switch (messageType) {
    case 'image':
      return '[ ]';
    case 'audio':
      return '[ ]';
    case 'video':
      return '[ ]';
    case 'file':
      return '[ ]';
    default:
      return '[ ]';
  }
}

// ====================   ====================

/**
 *  
 *   openclaw-nim/src/media.ts   downloadFile  
 */
function downloadFile(url: string, destPath: string, maxBytes: number = MAX_FILE_SIZE): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    let downloadedBytes = 0;

    protocol.get(url, (response) => {
      //  
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          try { fs.unlinkSync(destPath); } catch { /* ignore */ }
          downloadFile(redirectUrl, destPath, maxBytes).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch { /* ignore */ }
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }

      response.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        if (downloadedBytes > maxBytes) {
          response.destroy();
          file.close();
          try { fs.unlinkSync(destPath); } catch { /* ignore */ }
          reject(new Error(`File too large (>${(maxBytes / 1024 / 1024).toFixed(0)}MB)`));
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        file.close();
        try { fs.unlinkSync(destPath); } catch { /* ignore */ }
        reject(err);
      });
    }).on('error', (err) => {
      file.close();
      try { fs.unlinkSync(destPath); } catch { /* ignore */ }
      reject(err);
    });
  });
}

/**
 *   NIM   IMMediaAttachment
 * 
 * @param url NOS   URL
 * @param attachment V2   attachment  
 * @param mediaType   (image/audio/video/file)
 * @param log  
 */
export async function downloadNimMedia(
  url: string,
  attachment: {
    name?: string;
    size?: number;
    width?: number;
    height?: number;
    duration?: number;
  },
  mediaType: 'image' | 'audio' | 'video' | 'file',
  log: (...args: any[]) => void = console.log,
): Promise<IMMediaAttachment | null> {
  if (!url) {
    return null;
  }

  try {
    //   URL  
    const urlPath = url.split('?')[0];
    const ext = path.extname(urlPath) || '.bin';
    const fileName = attachment.name || `nim_${Date.now()}${ext}`;
    const localFileName = generateFileName('nim', ext);

    const mediaDir = getNimMediaDir();
    const localPath = path.join(mediaDir, localFileName);

    log(`[NIM Media] Downloading: ${url.substring(0, 80)}...`);

    //  
    await downloadFile(url, localPath, MAX_FILE_SIZE);

    //  
    const stats = fs.statSync(localPath);
    const mimeType = inferMimeType(localPath);

    log(`[NIM Media] Downloaded: ${localFileName} (${(stats.size / 1024).toFixed(1)} KB)`);

    return {
      type: toIMMediaType(mediaType),
      localPath,
      mimeType,
      fileName,
      fileSize: stats.size,
      width: attachment.width,
      height: attachment.height,
      duration: attachment.duration,
    };
  } catch (error: any) {
    log(`[NIM Media] Download failed: ${error.message}`);
    return null;
  }
}

// ====================   ====================

/**
 *   NIM SDK  
 * 
 * @param messageService V2NIMMessageService  
 * @param messageCreator V2NIMMessageCreator  
 * @param conversationId   ID
 * @param filePath  
 * @param log  
 */
export async function sendNimMediaMessage(
  messageService: any,
  messageCreator: any,
  conversationId: string,
  filePath: string,
  log: (...args: any[]) => void = console.log,
): Promise<void> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  /**  100MB */
  const MAX_SEND_FILE_SIZE = 100 * 1024 * 1024;
  const fileSize = fs.statSync(filePath).size;
  if (fileSize > MAX_SEND_FILE_SIZE) {
    throw new Error(
      ` : ${(fileSize / 1024 / 1024).toFixed(1)}MB  100MB  `,
    );
  }

  const mediaType = inferMediaType(filePath);
  const baseName = path.basename(filePath);
  let message: any;

  switch (mediaType) {
    case 'image':
      // createImageMessage(filePath, name, sceneName, width, height)
      message = messageCreator.createImageMessage(filePath, baseName, '', 0, 0);
      break;

    case 'audio':
      // createAudioMessage(filePath, name, sceneName, duration)
      message = messageCreator.createAudioMessage?.(filePath, baseName, '', 0);
      break;

    case 'video':
      // createVideoMessage(filePath, name, sceneName, duration, width, height)
      //   1920x1080  openclaw-nim/src/outbound.ts  
      message = messageCreator.createVideoMessage?.(filePath, baseName, '', 0, 1920, 1080);
      break;

    case 'file':
    default:
      // createFileMessage(filePath, name, sceneName)
      message = messageCreator.createFileMessage(filePath, baseName, '');
      break;
  }

  if (!message) {
    throw new Error(`Failed to create ${mediaType} message for: ${baseName}`);
  }

  log(`[NIM Media] Sending ${mediaType}: ${baseName} to ${conversationId}`);
  const result = await messageService.sendMessage(message, conversationId, {}, () => {});
  log(`[NIM Media] Send result:`, result);
}

// ====================   ====================

/**
 *   NIM  
 * @param maxAgeDays   7  
 */
export function cleanupOldNimMediaFiles(maxAgeDays: number = 7): void {
  const mediaDir = getNimMediaDir();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  try {
    if (!fs.existsSync(mediaDir)) {
      return;
    }

    const files = fs.readdirSync(mediaDir);
    let cleanedCount = 0;

    for (const file of files) {
      const filePath = path.join(mediaDir, file);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      } catch (err: any) {
        console.warn(`[NIM Media] Failed to check/delete file ${file}: ${err.message}`);
      }
    }

    if (cleanedCount > 0) {
      console.log(`[NIM Media] Cleaned up ${cleanedCount} old files`);
    }
  } catch (error: any) {
    console.warn(`[NIM Media] Cleanup error: ${error.message}`);
  }
}
