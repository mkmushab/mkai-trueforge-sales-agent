/**
 * IM Media Instruction Builder
 * 
 *   IM  
 *   AI   IM  Telegram Discord 
 *   AI  / / 
 * 
 *   AI  
 */

import type { IMSettings } from './types';

/**
 * Build the IM media sending instruction for system prompt.
 * Returns the instruction text, or empty string if not applicable.
 */
export function buildIMMediaInstruction(_imSettings: IMSettings): string {
  // Always include the media instruction for IM sessions.
  // The actual sending is handled by each gateway's replyFn (parseMediaMarkers → sendMedia).
  // This instruction tells the AI how to format its response to trigger media sending.

  return `<im_media_capabilities>
## IM  

  IM  

###  

  Markdown  

- ** **: \`![ ](/absolute/path/to/image.png)\`
- ** **: \`[ ](/absolute/path/to/audio.mp3)\`
- ** **: \`[ ](/absolute/path/to/video.mp4)\`
- ** **: \`[ ](/absolute/path/to/document.pdf)\`

 
- \`/Users/xxx/output/chart.png\`
- \`/tmp/result.xlsx\`

###  

-  : jpg, jpeg, png, gif, webp, bmp
-  : mp3, wav, aac, m4a, ogg, amr
-  : mp4, mov, avi, mkv, webm
-  : pdf, doc/docx, xls/xlsx, ppt/pptx, zip, txt, json, csv, md  

###  

1. ** **  \`/Users/...\` \`/tmp/...\`  
2.  
3.  
4.  
</im_media_capabilities>`;
}
