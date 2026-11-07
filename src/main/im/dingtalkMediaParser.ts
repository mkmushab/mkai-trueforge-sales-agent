/**
 * DingTalk Media Marker Parser
 *  
 */
import type { MediaMarker } from './types';

//  
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'amr', 'm4a', 'aac'];
const VIDEO_EXTENSIONS = ['mp4', 'mov'];
//  / 
const FILE_EXTENSIONS = [
  'txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'zip', 'rar', '7z', 'tar', 'gz',
  'json', 'xml', 'csv', 'md', 'html', 'htm',
  'js', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'sh',
];

//  
// Markdown  : ![alt](path) -  
//  : file:///  ,  ,   ~/.lobsterai  
const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(((?:file:\/\/\/|\/(?:tmp|var|private|Users|home|root)|~\/|[A-Za-z]:)[^)]+)\)/g;

// Markdown  : [text](path) -  
//  
const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(((?:file:\/\/\/|\/(?:tmp|var|private|Users|home|root)|~\/|[A-Za-z]:)[^)]+)\)/g;

//  : /path/to/image.png
const BARE_IMAGE_PATH_RE = /(?:^|\s)((?:\/(?:tmp|var|private|Users|home|root)\/[^\s`'",)]+|~\/[^\s`'",)]+|[A-Za-z]:[\\/][^\s`'",)]+)\.(?:png|jpg|jpeg|gif|bmp|webp))(?:\s|$|[,.])/gi;

//  : /path/to/audio.mp3   /path/to/video.mp4
const BARE_MEDIA_PATH_RE = /(?:^|\s)((?:\/(?:tmp|var|private|Users|home|root)\/[^\s`'",)]+|~\/[^\s`'",)]+|[A-Za-z]:[\\/][^\s`'",)]+)\.(?:mp3|wav|ogg|amr|m4a|aac|mp4|mov))(?:\s|$|[,.])/gi;

//  : /path/to/file.txt, /path/to/file.pdf  
const BARE_FILE_PATH_RE = /(?:^|\s)((?:\/(?:tmp|var|private|Users|home|root)\/[^\s`'",)]+|~\/[^\s`'",)]+|[A-Za-z]:[\\/][^\s`'",)]+)\.(?:txt|pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|tar|gz|json|xml|csv|md|html|htm|js|ts|py|java|c|cpp|h|cs|go|rs|rb|php|sh))(?:\s|$|[,.])/gi;

//  : [DINGTALK_VIDEO]{"path":"..."}[/DINGTALK_VIDEO]
const VIDEO_MARKER_RE = /\[DINGTALK_VIDEO\](\{[\s\S]*?\})\[\/DINGTALK_VIDEO\]/g;

//  : [DINGTALK_AUDIO]{"path":"..."}[/DINGTALK_AUDIO]
const AUDIO_MARKER_RE = /\[DINGTALK_AUDIO\](\{[\s\S]*?\})\[\/DINGTALK_AUDIO\]/g;

//  : [DINGTALK_FILE]{"path":"...","name":"..."}[/DINGTALK_FILE]
const FILE_MARKER_RE = /\[DINGTALK_FILE\](\{[\s\S]*?\})\[\/DINGTALK_FILE\]/g;

/**
 *  
 */
function getMediaTypeByExtension(filePath: string): 'image' | 'audio' | 'video' | 'file' | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (FILE_EXTENSIONS.includes(ext)) return 'file';
  return null;
}

/**
 *   file://  
 */
function cleanPath(rawPath: string): string {
  let path = rawPath.replace(/\\ /g, ' ');
  if (path.startsWith('file:///')) {
    path = decodeURIComponent(path.replace('file://', ''));
  }
  return path;
}

/**
 *  
 */
export function parseMediaMarkers(text: string): MediaMarker[] {
  const markers: MediaMarker[] = [];
  const processedPaths = new Set<string>();

  console.log(`[DingTalk MediaParser]  ,  : ${text.length}`);

  // 1.   Markdown   ![alt](path)
  for (const match of text.matchAll(MARKDOWN_IMAGE_RE)) {
    const [fullMatch, altText, rawPath] = match;
    const path = cleanPath(rawPath);
    //   alt  
    const name = altText?.trim() || undefined;
    console.log(`[DingTalk MediaParser]   Markdown  :`, JSON.stringify({ rawPath, cleanedPath: path, name, fullMatch }));
    if (!processedPaths.has(path)) {
      processedPaths.add(path);
      markers.push({
        type: 'image',
        path,
        name,
        originalMarker: fullMatch,
      });
    }
  }

  // 2.   Markdown   [text](path)  
  for (const match of text.matchAll(MARKDOWN_LINK_RE)) {
    const [fullMatch, linkText, rawPath] = match;
    const path = cleanPath(rawPath);
    const mediaType = getMediaTypeByExtension(path);
    //  
    const name = linkText?.trim() || undefined;
    console.log(`[DingTalk MediaParser]   Markdown  :`, JSON.stringify({ rawPath, cleanedPath: path, mediaType, name, fullMatch }));
    if (mediaType && !processedPaths.has(path)) {
      processedPaths.add(path);
      markers.push({
        type: mediaType,
        path,
        name,
        originalMarker: fullMatch,
      });
    }
  }

  // 3.  
  for (const match of text.matchAll(BARE_IMAGE_PATH_RE)) {
    const [fullMatch, rawPath] = match;
    const path = cleanPath(rawPath.trim());
    console.log(`[DingTalk MediaParser]  :`, JSON.stringify({ rawPath, cleanedPath: path, fullMatch: fullMatch.trim() }));
    if (!processedPaths.has(path)) {
      processedPaths.add(path);
      markers.push({
        type: 'image',
        path,
        originalMarker: fullMatch.trim(),
      });
    }
  }

  // 4.  
  for (const match of text.matchAll(BARE_MEDIA_PATH_RE)) {
    const [fullMatch, rawPath] = match;
    const path = cleanPath(rawPath.trim());
    const mediaType = getMediaTypeByExtension(path);
    console.log(`[DingTalk MediaParser]  :`, JSON.stringify({ rawPath, cleanedPath: path, mediaType, fullMatch: fullMatch.trim() }));
    if (mediaType && !processedPaths.has(path)) {
      processedPaths.add(path);
      markers.push({
        type: mediaType,
        path,
        originalMarker: fullMatch.trim(),
      });
    }
  }

  // 5.   (txt, pdf, doc, etc.)
  for (const match of text.matchAll(BARE_FILE_PATH_RE)) {
    const [fullMatch, rawPath] = match;
    const path = cleanPath(rawPath.trim());
    console.log(`[DingTalk MediaParser]  :`, JSON.stringify({ rawPath, cleanedPath: path, fullMatch: fullMatch.trim() }));
    if (!processedPaths.has(path)) {
      processedPaths.add(path);
      markers.push({
        type: 'file',
        path,
        originalMarker: fullMatch.trim(),
      });
    }
  }

  // 6.   [DINGTALK_VIDEO]
  for (const match of text.matchAll(VIDEO_MARKER_RE)) {
    try {
      const info = JSON.parse(match[1]);
      console.log(`[DingTalk MediaParser]  :`, JSON.stringify({ info, fullMatch: match[0] }));
      if (info.path && !processedPaths.has(info.path)) {
        processedPaths.add(info.path);
        markers.push({
          type: 'video',
          path: info.path,
          name: info.title || info.name,
          originalMarker: match[0],
        });
      }
    } catch (e) {
      console.warn(`[DingTalk MediaParser]  :`, match[0], e);
    }
  }

  // 7.   [DINGTALK_AUDIO]
  for (const match of text.matchAll(AUDIO_MARKER_RE)) {
    try {
      const info = JSON.parse(match[1]);
      console.log(`[DingTalk MediaParser]  :`, JSON.stringify({ info, fullMatch: match[0] }));
      if (info.path && !processedPaths.has(info.path)) {
        processedPaths.add(info.path);
        markers.push({
          type: 'audio',
          path: info.path,
          originalMarker: match[0],
        });
      }
    } catch (e) {
      console.warn(`[DingTalk MediaParser]  :`, match[0], e);
    }
  }

  // 8.   [DINGTALK_FILE]
  for (const match of text.matchAll(FILE_MARKER_RE)) {
    try {
      const info = JSON.parse(match[1]);
      console.log(`[DingTalk MediaParser]  :`, JSON.stringify({ info, fullMatch: match[0] }));
      if (info.path && !processedPaths.has(info.path)) {
        processedPaths.add(info.path);
        markers.push({
          type: 'file',
          path: info.path,
          name: info.name || info.fileName,
          originalMarker: match[0],
        });
      }
    } catch (e) {
      console.warn(`[DingTalk MediaParser]  :`, match[0], e);
    }
  }

  console.log(`[DingTalk MediaParser]  ,   ${markers.length}  :`, JSON.stringify(markers, null, 2));

  return markers;
}

/**
 *  
 */
export function stripMediaMarkers(text: string, markers: MediaMarker[]): string {
  let result = text;
  for (const marker of markers) {
    result = result.replace(marker.originalMarker, '');
  }
  //  
  return result.replace(/\n{3,}/g, '\n\n').trim();
}
