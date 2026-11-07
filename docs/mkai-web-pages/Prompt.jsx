import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from 'react-helmet-async';

const GEMINI_API_KEY = "YOUR_API_KEY_PLACEHOLDER";
const GEMINI_MODEL   = "gemini-3.0-flash";

function extractJSON(text) {
  if (!text) throw new Error("Empty response from AI");
  let clean = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();
  const start = clean.indexOf("{");
  const end   = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");
  let jsonStr = clean.slice(start, end + 1);
  jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, " ");
  jsonStr = jsonStr
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
  try {
    return JSON.parse(jsonStr);
  } catch (e1) {
    try {
      let fixed = jsonStr
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')
        .replace(/:\s*'([^']*)'/g, ': "$1"');
      return JSON.parse(fixed);
    } catch (e2) {
      try {
        let truncated = jsonStr;
        const openBraces  = (truncated.match(/{/g) || []).length;
        const closeBraces = (truncated.match(/}/g) || []).length;
        const openBracks  = (truncated.match(/\[/g) || []).length;
        const closeBracks = (truncated.match(/\]/g) || []).length;
        for (let i = 0; i < openBracks - closeBracks; i++) truncated += "]";
        for (let i = 0; i < openBraces - closeBraces; i++) truncated += "}";
        return JSON.parse(truncated);
      } catch (e3) {
        throw new Error("JSON parse failed: " + e1.message);
      }
    }
  }
}

// ── General Compute API (replaces old Groq setup) ──
const GC_API_KEY = "YOUR_API_KEY_PLACEHOLDER";
const GC_BASE_URL = "https://api.generalcompute.com/v1/chat/completions";
const GC_MODEL = "gpt-oss-120b";

async function callGroq(messages, max_tokens = 3000) {
  const res = await fetch(GC_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GC_API_KEY}`,
    },
    body: JSON.stringify({
      model: GC_MODEL,
      max_tokens,
      temperature: 0.5,
      messages,
    }),
  });
  if (!res.ok) throw new Error("General Compute API error: " + res.status);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  return extractJSON(text);
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function callGeminiVision(parts, max_tokens = 16000) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { maxOutputTokens: max_tokens, temperature: 0.3 },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || res.status;
    if (res.status === 400) throw new Error("Bad request — check image format or size.");
    if (res.status === 403) throw new Error("Invalid API key. Get free key at aistudio.google.com");
    if (res.status === 429) throw new Error("Rate limit hit. Wait a moment and try again.");
    throw new Error("Vision API error: " + msg);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) throw new Error("Empty response. Try again.");
  return extractJSON(text);
}

async function callExtractor(base64Image, mediaType) {
  const base64Data = base64Image.split(",")[1];
  const prompt = `You are a world-class AI image prompt engineer. Your job is NOT to describe this image — your job is to create prompts that will RECREATE this image as closely as possible on any AI image generation platform.

Analyze the image deeply and generate ready-to-use prompts that will produce an image looking exactly like this one.

Return ONLY a valid JSON object (no markdown, no backticks, no extra text):
{
  "universal_prompt": "One single ultra-detailed universal prompt (200+ words) that precisely recreates this image. Include: exact subject, pose, expression, clothing, art style, lighting, colors, mood, background, camera angle, depth of field, post-processing, quality modifiers. This prompt alone should work on any platform.",
  "prompts": {
    "chatgpt": {
      "platform": "ChatGPT (DALL-E 3)",
      "prompt": "Ready-to-paste DALL-E 3 prompt that recreates this exact image",
      "negative_prompt": "Things to exclude for best results",
      "tips": "DALL-E 3 tips for this specific image style",
      "quality_boosters": ["booster1", "booster2", "booster3"]
    },
    "midjourney": {
      "platform": "Midjourney v6.1",
      "prompt": "Ready-to-paste Midjourney prompt with parameters like --ar 16:9 --v 6.1 --style raw that recreates this image",
      "negative_prompt": "--no unwanted elements",
      "tips": "Midjourney tips for this specific image",
      "quality_boosters": ["booster1", "booster2", "booster3"]
    },
    "stable_diffusion": {
      "platform": "Stable Diffusion (SDXL)",
      "prompt": "Ready-to-paste SD prompt with quality tags that recreates this image",
      "negative_prompt": "Comprehensive SD negative prompt",
      "tips": "CFG scale, sampler, steps recommendations for this style",
      "quality_boosters": ["booster1", "booster2", "booster3"]
    },
    "flux": {
      "platform": "Flux (Black Forest Labs)",
      "prompt": "Ready-to-paste Flux natural language prompt that recreates this image",
      "negative_prompt": "Elements to avoid",
      "tips": "Flux-specific tips for this style",
      "quality_boosters": ["booster1", "booster2", "booster3"]
    },
    "gemini": {
      "platform": "Google Gemini Imagen",
      "prompt": "Ready-to-paste Gemini Imagen prompt that recreates this image",
      "negative_prompt": "Elements to avoid",
      "tips": "Gemini Imagen tips",
      "quality_boosters": ["booster1", "booster2", "booster3"]
    },
    "adobe": {
      "platform": "Adobe Firefly",
      "prompt": "Ready-to-paste Adobe Firefly prompt that recreates this image",
      "negative_prompt": "Elements to avoid",
      "tips": "Firefly-specific tips",
      "quality_boosters": ["booster1", "booster2", "booster3"]
    },
    "general": {
      "platform": "Universal (Any Platform)",
      "prompt": "Universal prompt usable on any AI image platform to recreate this image",
      "negative_prompt": "General negative prompt",
      "tips": "Universal tips for best results",
      "quality_boosters": ["booster1", "booster2", "booster3"]
    }
  },
  "style_keywords": ["kw1", "kw2", "kw3", "kw4", "kw5", "kw6"],
  "lighting_tags": ["light1", "light2", "light3"],
  "color_tags": ["color1", "color2", "color3"],
  "overall_score": 90,
  "best_platform": "Platform name best suited to recreate this",
  "recreation_tips": "Key things to get right when recreating this image"
}`;
  return callGeminiVision([
    { inline_data: { mime_type: mediaType, data: base64Data } },
    { text: prompt }
  ], 16000);
}

async function callStyleTransfer(refBase64, refType, subjBase64, subjType) {
  const refData  = refBase64.split(",")[1];
  const subjData = subjBase64.split(",")[1];

  const prompt = `You are a world-class AI image prompt engineer. You specialize in STYLE TRANSFER — taking a person's photo and recreating them inside the visual world of a reference image.

You have TWO images:
═══════════════════════════════════════════════════════════════
IMAGE 1 = STYLE REFERENCE
Analyze this image ONLY for its VISUAL TECHNIQUE and WORLD:
- What is the core photographic/artistic technique? (e.g. double exposure, composite, matte painting, photo manipulation)
- Background scenery: what landscape/environment/location?
- Atmosphere: mist, fog, clouds, sky, weather, time of day
- Color grade and palette: warm/cool tones, desaturation, contrast
- Lighting: soft diffused, rim light, natural, golden hour, overcast
- Texture overlays: transparent body, landscape blending through silhouette
- Typography/text style if present (font, placement, style)
- Overall mood and cinematic feel
DO NOT describe the person in this image at all.

IMAGE 2 = USER'S SUBJECT PHOTO
Look at this image ONLY to understand:
- Is the subject a person, object, or character?
- Approximate pose/orientation (standing, profile, facing left/right)
- Do NOT describe their appearance, face, or clothing
The prompts must reference this photo as "the attached photo" or "the uploaded subject image" - never describe the person directly.
═══════════════════════════════════════════════════════════════

YOUR MISSION: Write prompts that instruct any AI platform to:
1. Take the person/subject from the user's uploaded photo (Image 2)
2. Place them into the exact visual world extracted from Image 1
3. Apply every style element: technique, atmosphere, color, lighting, textures
4. The end result should look like the person FROM the uploaded photo IS the subject in that style world — same pose, same silhouette shape, but styled in the reference world

CRITICAL RULES FOR ALL PROMPTS:
- NEVER hardcode physical descriptions of the person (no "young woman with long hair" etc.)
- ALWAYS reference the user's photo as the source of the subject: use phrases like "the person in the attached photo", "use the uploaded image as the subject", "take the figure from the provided reference photo"
- The prompts must be detailed enough that pasting them + uploading Image 2 to any AI tool produces a result that looks like the reference style applied to the user's person
- Include exact technique name so AI knows what effect to create

Return ONLY a valid JSON object (no markdown, no backticks, no extra text):
{
  "detected_technique": "Name of the core visual technique (e.g. Double Exposure Portrait, Composite Photo Manipulation, etc.)",
  "style_world_summary": "2-3 sentence description of the extracted visual world and atmosphere — NO mention of person",
  "universal_transfer_prompt": "A powerful 300+ word prompt. Start with: 'Using the person from the attached photo as the subject, create a [TECHNIQUE NAME] effect.' Then describe the complete visual world extracted from the reference in full detail: exact background scenery, atmospheric elements, color grading, lighting setup, texture of transparency/blending, mood, any text/typography styling. End with specific instructions like: 'The subject silhouette from the uploaded photo must be preserved — only their visual appearance should be transformed into this style world. The landscape/environment should be visible through and around the subject exactly as in the reference style.' Make this work on ANY platform.",
  "transfer_prompts": {
    "chatgpt": {
      "platform": "ChatGPT (DALL-E 3)",
      "prompt": "Start with: 'I am uploading a photo of a person. Create a [TECHNIQUE] effect using this exact person as the subject.' Then describe the full reference style world in detail. End with: 'Maintain the exact silhouette and pose of the person from my uploaded photo. Do not change their identity — only apply this visual style to them.'",
      "negative_prompt": "Different person, changed identity, wrong pose, stock photo person, generic model, wrong color grade, missing atmospheric effects",
      "tips": "Upload Image 2 (your subject photo) directly in ChatGPT, then paste this prompt. DALL-E 3 respects uploaded images for style application. Be explicit that you want YOUR person from the photo.",
      "workflow": "1. Open ChatGPT (GPT-4o). 2. Click the image/attachment icon. 3. Upload your subject photo (Image 2). 4. Paste this prompt. 5. If result changes your person, add: 'Keep the exact same person from my photo, just apply the artistic style.'"
    },
    "midjourney": {
      "platform": "Midjourney v6.1",
      "prompt": "Full description of the reference style world in Midjourney format. Include --cref [YOUR-SUBJECT-PHOTO-URL] to use your photo as character reference. Format: '[Complete style world description matching the reference] --cref [your-photo-url] --cw 100 --ar [detected aspect ratio] --v 6.1 --style raw'. The --cref flag tells Midjourney to use YOUR person from the uploaded photo.",
      "negative_prompt": "--no different person, wrong background, missing atmospheric effects, wrong color grade, low quality",
      "tips": "The --cref parameter is KEY — it locks in your person from the photo. Use --cw 100 for maximum character adherence. Add --sref [reference-image-url] if you can get the reference image URL.",
      "workflow": "1. Upload your subject photo to Discord and copy its URL. 2. Type /imagine in Midjourney. 3. Paste the full prompt. 4. Replace [your-photo-url] with your actual Discord image URL. 5. Run. The --cref ensures YOUR person appears."
    },
    "stable_diffusion": {
      "platform": "Stable Diffusion (SDXL + IP-Adapter Face)",
      "prompt": "Full style world prompt describing only the reference visual technique and environment. Focus entirely on: technique name, background scenery, atmospheric effects, color grade, lighting, transparency/blend effects, mood tags. Do NOT describe the person — IP-Adapter handles that from your photo.",
      "negative_prompt": "different person, bad anatomy, blurry, low quality, wrong style, missing atmosphere, flat lighting, no transparency effect, deformed, ugly, duplicate",
      "tips": "Use IP-Adapter Face ID with your subject photo. Set IP-Adapter weight to 0.7-0.85. Use ControlNet OpenPose to lock the pose from your subject photo. CFG Scale: 7, Steps: 35-50, Sampler: DPM++ 2M Karras.",
      "workflow": "1. In ComfyUI/A1111, load SDXL base model. 2. Add IP-Adapter FaceID node → load your subject photo here. 3. Add ControlNet OpenPose → load your subject photo here too (extracts pose). 4. Paste this prompt in positive prompt. 5. Add negative prompt. 6. Set IP-Adapter weight 0.75, ControlNet 0.8. 7. Generate."
    },
    "flux": {
      "platform": "Flux Dev/Redux (Black Forest Labs)",
      "prompt": "Natural language prompt. Start: 'Apply this exact visual style to the person shown in my uploaded reference photo.' Describe the full reference style world: technique, scenery, atmosphere, color, lighting, transparency effect. End: 'The subject must be the exact person from my uploaded photo — maintain their identity completely. Only the artistic style, background world, and visual treatment should change to match this description.'",
      "negative_prompt": "Changed identity, different person, wrong atmosphere, missing transparency effect, flat image, no depth",
      "tips": "Use Flux Redux for best results — it's specifically designed for style transfer with uploaded images. Set image influence to 0.65-0.75 to balance style vs. identity preservation.",
      "workflow": "1. Open Flux Redux (fal.ai, Replicate, or local). 2. Upload your subject photo as the 'image' input. 3. Paste this prompt. 4. Set image_strength to 0.7. 5. Generate. Flux Redux applies the style description to your uploaded person."
    },
    "gemini": {
      "platform": "Google Gemini (Imagen 3)",
      "prompt": "Start with: 'Transform the person in the attached image using this artistic technique.' Describe the complete reference visual world in detail. End with: 'The output must feature the same person from my attached photo — do not change their face or identity. Apply all the described visual effects, background, atmosphere, and color treatment to recreate this style with my person as the subject.'",
      "negative_prompt": "Different face, changed identity, generic person, missing scenic background, wrong color grade",
      "tips": "In Gemini, upload your subject photo first, then type the prompt. Gemini Imagen 3 has strong identity preservation. Be explicit about 'the person in THIS photo' to ensure it uses your uploaded image.",
      "workflow": "1. Open gemini.google.com. 2. Click the image upload icon. 3. Upload your subject photo. 4. Type/paste this prompt in the text box. 5. Gemini will apply the style to YOUR person from the photo."
    },
    "adobe": {
      "platform": "Adobe Firefly / Photoshop Generative AI",
      "prompt": "Describe the reference style world for Firefly. Start: 'Generate a [TECHNIQUE] effect featuring the person from the reference photo.' Full style description follows. End: 'Use the uploaded reference photo as the subject. Preserve the person's identity and apply this complete visual world as the artistic treatment.'",
      "negative_prompt": "Wrong person, different face, missing atmospheric effects, incorrect color grade, flat composition",
      "tips": "In Firefly: use 'Generative Match' and upload reference image for style. Use 'Content Reference' for your subject photo. In Photoshop: use Generative Fill with your subject layer selected.",
      "workflow": "1. Go to firefly.adobe.com. 2. Choose 'Generate Image'. 3. Under 'Style Reference' upload the reference image. 4. Under 'Content/Subject Reference' upload your subject photo. 5. Paste this prompt. 6. Generate."
    },
    "general": {
      "platform": "Universal — Any Platform Supporting Image-to-Image",
      "prompt": "Universal prompt. State the technique clearly first. Describe the full reference visual world in maximum detail — every atmospheric element, color grade, lighting setup, background scenery, transparency/blending effect. Then: 'Apply this exact visual style to the person from the attached/uploaded photo. Do not alter the subject's identity — only transform their visual treatment to match this style world. The final image should look like the person from my photo exists inside this described visual world with all these effects applied.'",
      "negative_prompt": "Changed person identity, wrong style, missing atmospheric elements, incorrect color treatment, flat image without depth",
      "tips": "Key principle: always upload your subject photo + describe the style world. Most img2img tools work this way. Set 'style strength' or 'denoising strength' between 0.55-0.75 to preserve identity while applying style.",
      "workflow": "1. Find your platform's image-to-image or style transfer feature. 2. Upload your subject photo as the INPUT image. 3. Paste this prompt as the style/text description. 4. Set style strength 60-70%. 5. Generate. The lower the strength, more identity preserved; higher = more style applied."
    }
  },
  "style_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6"],
  "lighting_tags": ["lighting1", "lighting2", "lighting3"],
  "color_grade_tags": ["grade1", "grade2", "grade3"],
  "atmosphere_tags": ["atmos1", "atmos2", "atmos3"],
  "quality_boosters": ["booster1", "booster2", "booster3", "booster4"],
  "best_platform": "Platform name + one line reason why it's best for THIS specific style transfer",
  "key_tip": "The single most important thing to get right for this specific style transfer to work perfectly — be very specific to the detected technique",
  "identity_preservation_tip": "Specific advice for keeping the uploaded person's face/identity while applying this style"
}`;

  return callGeminiVision([
    { text: "IMAGE 1 — STYLE REFERENCE (analyze ONLY the visual technique, world, atmosphere, color, lighting — do NOT describe the person):" },
    { inline_data: { mime_type: refType, data: refData } },
    { text: "IMAGE 2 — USER'S SUBJECT PHOTO (note only pose/orientation — do NOT describe the person's appearance; prompts must reference them as 'the person from the attached/uploaded photo'):" },
    { inline_data: { mime_type: subjType, data: subjData } },
    { text: prompt }
  ], 16000);
}

const ALL_TOOLS = [
  { id:"magic_formula",    icon:"✨", name:"Magic Formula",          desc:"Create the perfect prompt for any AI model",              isNew:false },
  { id:"improve",          icon:"⬆️", name:"Improve Prompt",         desc:"Make your existing prompt much better",                   isNew:false },
  { id:"score",            icon:"📊", name:"Score Prompt",            desc:"Rate your prompt out of 100 with analysis",               isNew:false },
  { id:"debug",            icon:"🐛", name:"Debug Prompt",            desc:"Find and fix what is wrong with your prompt",             isNew:false },
  { id:"batch",            icon:"⚡", name:"Batch Generate",          desc:"Generate 5 different prompt variations at once",          isNew:false },
  { id:"secret_formula",  icon:"🔐", name:"Secret Formula",          desc:"Reveal the hidden secrets of any AI model",               isNew:false },
  { id:"translator",      icon:"🌐", name:"Prompt Translator",       desc:"Translate your prompt into any language",                 isNew:true  },
  { id:"shortener",       icon:"✂️", name:"Prompt Shortener",        desc:"Make long prompts short without losing meaning",          isNew:true  },
  { id:"template_library",icon:"📋", name:"Template Library",        desc:"50+ ready-made prompt templates for any task",            isNew:true  },
  { id:"explainer",       icon:"🔍", name:"Prompt Explainer",        desc:"Understand what any prompt actually does",                isNew:true  },
  { id:"chain_builder",   icon:"🔗", name:"Chain Prompt Builder",    desc:"Build multi-step connected prompt chains",                isNew:true  },
  { id:"image_wizard",    icon:"🎨", name:"Image Prompt Wizard",     desc:"Ultra-detailed prompts for Midjourney and DALL-E",        isNew:true  },
  { id:"role_generator",  icon:"🎭", name:"Role Prompt Generator",   desc:"Create powerful Act as an expert prompts",                isNew:true  },
  { id:"ab_tester",       icon:"🆚", name:"A/B Prompt Tester",      desc:"Compare 2 prompts and find which one wins",               isNew:true  },
  { id:"prompt_extractor",icon:"📸", name:"Prompt Extractor",        desc:"Upload any image and get ready-to-use AI prompts for 7 platforms", isNew:false },
  { id:"style_transfer",  icon:"🔄", name:"Style Transfer Prompt",   desc:"Upload reference style + your photo and get prompts to recreate your photo in that style world", isNew:false },
];

const AI_PLATFORMS  = ["ChatGPT","Claude","Gemini","Midjourney","Llama","Stable Diffusion","DALL-E 3","Grok"];
const COMPLEXITIES  = ["Beginner","Intermediate","Expert"];
const TONES2        = ["Neutral","Professional","Friendly","Urgent","Creative","Academic","Casual"];
const LANGUAGES     = ["Hindi","Urdu","Arabic","French","Spanish","German","Japanese","Portuguese","Russian","Chinese","Bengali","Turkish"];
const TEMPLATES     = [
  {icon:"💼",name:"Resume / CV",       topic:"write a professional resume for a software engineer"},
  {icon:"📧",name:"Cold Email",        topic:"write a cold outreach email to a potential client"},
  {icon:"📱",name:"Instagram Post",    topic:"write a viral Instagram caption for a product launch"},
  {icon:"🎬",name:"YouTube Script",    topic:"write a YouTube video script intro"},
  {icon:"💡",name:"Business Idea",     topic:"validate and expand a startup business idea"},
  {icon:"📝",name:"Blog Post",         topic:"write a complete SEO-optimized blog post"},
  {icon:"💻",name:"Code Review",       topic:"review and improve my code quality"},
  {icon:"📊",name:"Data Analysis",     topic:"analyze data and provide insights"},
  {icon:"🎓",name:"Study Notes",       topic:"create concise study notes for an exam"},
  {icon:"📣",name:"Ad Copy",           topic:"write a high-converting Facebook ad"},
  {icon:"🛒",name:"Product Desc",      topic:"write a compelling product description for ecommerce"},
  {icon:"📖",name:"Story Writing",     topic:"write a compelling short story with a twist"},
];
const EXPERT_ROLES  = ["Software Engineer","Marketing Expert","Data Scientist","Business Analyst","UX Designer","Financial Advisor","Medical Professional","Legal Expert","Teacher/Educator","Content Creator","Project Manager","Sales Expert","SEO Specialist","Psychologist","Startup Founder"];
const IMAGE_STYLES  = ["Photorealistic","Digital Art","Oil Painting","Watercolor","Anime/Manga","Cinematic","Minimalist","Fantasy","Cyberpunk","Vintage/Retro","Sketch/Line Art","3D Render"];
const IMAGE_MOODS   = ["Epic","Calm","Dark","Vibrant","Mysterious","Dramatic","Dreamy","Gritty"];

const EXTRACTOR_PLATFORMS = [
  {key:"universal",        icon:"⭐",name:"Universal",      color:"#0FA968"},
  {key:"chatgpt",          icon:"🤖",name:"ChatGPT",        color:"#0FA968"},
  {key:"midjourney",       icon:"🎨",name:"Midjourney",     color:"#1596D6"},
  {key:"stable_diffusion", icon:"🖼️",name:"Stable Diff",   color:"#F2A93B"},
  {key:"flux",             icon:"⚡",name:"Flux",           color:"#0C8457"},
  {key:"gemini",           icon:"💎",name:"Gemini",         color:"#1596D6"},
  {key:"adobe",            icon:"🔥",name:"Firefly",        color:"#DC2626"},
  {key:"general",          icon:"🌐",name:"General",        color:"#0E77AC"},
];

const ST_PLATFORMS = [
  {key:"universal",        icon:"⭐",name:"Universal",      color:"#0FA968"},
  {key:"chatgpt",          icon:"🤖",name:"ChatGPT",        color:"#0FA968"},
  {key:"midjourney",       icon:"🎨",name:"Midjourney",     color:"#1596D6"},
  {key:"stable_diffusion", icon:"🖼️",name:"Stable Diff",   color:"#F2A93B"},
  {key:"flux",             icon:"⚡",name:"Flux",           color:"#0C8457"},
  {key:"gemini",           icon:"💎",name:"Gemini",         color:"#1596D6"},
  {key:"adobe",            icon:"🔥",name:"Firefly",        color:"#DC2626"},
  {key:"general",          icon:"🌐",name:"General",        color:"#0E77AC"},
];

export default function PromptEngineer() {
  const navigate = useNavigate();

  // ── MK AI palette — same single theme as Home.jsx (emerald / mint / sky-blue / saffron, on white) ──
  const T = {
    bg:         "#f6faf7",
    s1:         "#fffefb",
    s2:         "#eef8f2",
    purple:     "#0FA968",
    purple2:    "#0C8457",
    green:      "#0FA968",
    red:        "#DC2626",
    amber:      "#D97706",
    blue:       "#1596D6",
    cyan:       "#1596D6",
    text:       "#122420",
    muted:      "#78716C",
    muted2:     "#5c6b64",
    border:     "rgba(18,54,42,.10)",
    border2:    "rgba(18,54,42,.08)",
    cardHover:  "#eef8f2",
    navBg:      "rgba(246,250,247,.92)",
    navBorder:  "rgba(18,54,42,.10)",
    inputBg:    "rgba(18,54,42,.03)",
    promptBg:   "rgba(15,169,104,.06)",
    promptBorder:"rgba(15,169,104,.22)",
    promptText: "#0C8457",
    tagBg:      "rgba(15,169,104,.1)",
    tagBorder:  "rgba(15,169,104,.22)",
    accentGrad: "linear-gradient(135deg,#0FA968,#1596D6)",
    gridLine:   "rgba(18,54,42,.03)",
    badgeBg:    "rgba(15,169,104,.1)",
    badgeBorder:"rgba(15,169,104,.22)",
    badgeColor: "#0C8457",
    glassBg:    "linear-gradient(135deg, rgba(255,255,255,.62), rgba(255,255,255,.22))",
    glassBorder:"rgba(255,255,255,.68)",
    glassShadow:"0 10px 34px rgba(15,90,70,.14), inset 0 1px 0 rgba(255,255,255,.55)",
  };

  // ── CSS — uses T tokens (single fixed theme, matches Home.jsx look) ──
  const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:${T.bg};font-family:'Inter',ui-sans-serif,system-ui,sans-serif;color:${T.text};min-height:100vh}
body{background:radial-gradient(circle at 15% 10%, rgba(15,169,104,.10), transparent 26rem), ${T.bg};}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
.wrap{min-height:100vh;background:transparent}
.grid-bg{position:fixed;inset:0;pointer-events:none;z-index:0;background-image:linear-gradient(${T.gridLine} 1px,transparent 1px),linear-gradient(90deg,${T.gridLine} 1px,transparent 1px);background-size:60px 60px;}
.header{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:14px 32px;background:${T.navBg};backdrop-filter:blur(24px);border-bottom:1px solid ${T.navBorder}}
.logo{display:flex;align-items:center;gap:10px}
.logo-icon{width:36px;height:36px;border-radius:10px;background:${T.accentGrad};display:flex;align-items:center;justify-content:center;font-size:18px}
.logo-name{font-size:16px;font-weight:800;background:${T.accentGrad};-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo-tag{font-size:9px;font-weight:700;letter-spacing:1.5px;color:${T.purple2};background:${T.badgeBg};padding:2px 8px;border-radius:20px;border:1px solid ${T.badgeBorder}}
.main{max-width:1000px;margin:0 auto;padding:36px 20px 80px;position:relative;z-index:1}
.hero{text-align:center;padding:60px 20px 40px;animation:fadeUp .6s ease}
.hero-badge{display:inline-flex;align-items:center;gap:6px;background:${T.badgeBg};border:1px solid ${T.badgeBorder};border-radius:20px;padding:6px 16px;font-size:12px;font-weight:700;color:${T.badgeColor};letter-spacing:.5px;margin-bottom:20px}
.hero-title{font-size:clamp(32px,5vw,54px);font-weight:750;letter-spacing:-.03em;line-height:1.1;margin-bottom:12px;color:${T.text}}
.hero-title span{background:${T.accentGrad};-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero-sub{font-size:15px;color:${T.muted2};max-width:500px;margin:0 auto;line-height:1.7}
.tools-section{margin-top:40px}
.tools-label{font-size:11px;font-weight:700;letter-spacing:1.5px;color:${T.muted};text-transform:uppercase;margin-bottom:16px;padding-left:4px}
.tools-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}
.tool-card{background:${T.glassBg};backdrop-filter:blur(16px) saturate(150%);-webkit-backdrop-filter:blur(16px) saturate(150%);border:1px solid ${T.glassBorder};box-shadow:${T.glassShadow};border-radius:20px;padding:22px 20px;cursor:pointer;transition:transform .28s cubic-bezier(.22,1,.36,1),box-shadow .28s;position:relative;overflow:hidden;text-align:left}
.tool-card:hover{transform:translateY(-6px) scale(1.015);box-shadow:0 18px 42px rgba(15,90,70,.2), inset 0 1px 0 rgba(255,255,255,.7)}
.tool-card.new-badge::after{content:'NEW';position:absolute;top:10px;right:10px;background:linear-gradient(135deg,${T.green},${T.blue});color:#fff;font-size:8px;font-weight:800;padding:2px 7px;border-radius:10px;letter-spacing:.5px}
.tool-icon{width:44px;height:44px;border-radius:13px;background:rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:13px;box-shadow:inset 0 1px 0 rgba(255,255,255,.8)}
.tool-name{font-size:15px;font-weight:700;color:${T.text};margin-bottom:5px}
.tool-desc{font-size:12px;color:${T.muted2};line-height:1.5}
.tool-open{font-size:11px;font-weight:700;color:${T.purple2};margin-top:12px;display:flex;align-items:center;gap:4px}
.card{background:${T.s1};border:1px solid ${T.border2};border-radius:24px;padding:32px;margin-bottom:20px;animation:fadeUp .4s ease;box-shadow:0 10px 30px rgba(15,90,70,.06)}
.card-title{font-size:22px;font-weight:750;letter-spacing:-.01em;margin-bottom:6px;color:${T.text}}
.card-sub{font-size:13px;color:${T.muted2};margin-bottom:28px;line-height:1.5}
.label{display:block;font-size:11px;font-weight:700;color:${T.muted2};letter-spacing:.8px;text-transform:uppercase;margin:20px 0 8px}
.input,.textarea{width:100%;background:${T.inputBg};border:1px solid ${T.border2};border-radius:12px;padding:12px 16px;color:${T.text};font-size:14px;font-family:'Inter',sans-serif;outline:none;transition:all .2s}
.input:focus,.textarea:focus{border-color:${T.purple};background:${T.badgeBg};box-shadow:0 0 0 3px rgba(15,169,104,.16)}
.textarea{resize:vertical;min-height:140px;line-height:1.7}
.opts{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.opt{padding:8px 15px;border-radius:100px;cursor:pointer;font-size:13px;font-weight:600;font-family:'Inter',sans-serif;transition:all .2s;border:1px solid ${T.border2};background:${T.inputBg};color:${T.muted2}}
.opt:hover{border-color:${T.purple};color:${T.purple2}}
.opt.sel{background:${T.accentGrad};border-color:transparent;color:#fff;font-weight:700}
.opt.sel-green{background:linear-gradient(135deg,${T.green},${T.purple2});border-color:transparent;color:#fff;font-weight:700}
.opt.sel-amber{background:linear-gradient(135deg,${T.amber},#F2A93B);border-color:transparent;color:#fff;font-weight:700}
.btn-row{display:flex;gap:12px;margin-top:28px;flex-wrap:wrap}
.btn{padding:14px 24px;border-radius:100px;cursor:pointer;font-size:15px;font-weight:650;font-family:'Inter',sans-serif;transition:all .25s;border:none;display:flex;align-items:center;gap:8px;justify-content:center}
.btn-purple{background:${T.accentGrad};color:#fff;flex:1;box-shadow:0 12px 24px rgba(15,150,120,.22)}
.btn-purple:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 16px 30px rgba(15,150,120,.3)}
.btn-purple:disabled{opacity:.4;cursor:not-allowed}
.btn-outline{background:${T.inputBg};border:1px solid ${T.border2}!important;color:${T.text}}
.btn-outline:hover{background:${T.tagBg}}
.btn-copy{background:${T.tagBg};border:1px solid ${T.tagBorder}!important;color:${T.purple2};padding:8px 16px;font-size:13px;border-radius:100px}
.btn-green{background:rgba(15,169,104,.1);border:1px solid rgba(15,169,104,.3)!important;color:${T.purple2};padding:8px 16px;font-size:13px;border-radius:100px}
.spinner{width:20px;height:20px;border:3px solid ${T.badgeBg};border-top-color:${T.purple};border-radius:50%;animation:spin 1s linear infinite;flex-shrink:0}
.load-box{display:flex;align-items:center;gap:14px;background:${T.badgeBg};border:1px solid ${T.badgeBorder};border-radius:14px;padding:18px;margin-top:16px}
.load-text{font-size:14px;font-weight:600;color:${T.purple2}}
.load-sub{font-size:12px;color:${T.muted};margin-top:3px}
.section{background:${T.s1};border:1px solid ${T.border2};border-radius:20px;padding:24px;margin-bottom:16px;animation:fadeUp .4s ease;box-shadow:0 10px 30px rgba(15,90,70,.06)}
.sec-title{font-size:16px;font-weight:750;margin-bottom:16px;display:flex;align-items:center;gap:8px;color:${T.text}}
.tabs{display:flex;gap:6px;overflow-x:auto;margin-bottom:18px;padding-bottom:4px;scrollbar-width:none}
.tab{padding:9px 16px;border-radius:100px;cursor:pointer;font-size:12px;font-weight:700;font-family:'Inter',sans-serif;white-space:nowrap;transition:all .2s;border:none;outline:none}
.tab.active{background:${T.accentGrad};color:#fff}
.tab.inactive{background:${T.inputBg};color:${T.muted2};border:1px solid ${T.border2}}
.tab.inactive:hover{border-color:${T.purple};color:${T.purple2}}
.prompt-box{background:${T.promptBg};border:1px solid ${T.promptBorder};border-radius:14px;padding:20px;margin-bottom:16px;font-family:'Inter',monospace;font-size:13px;color:${T.promptText};line-height:1.8;white-space:pre-wrap;position:relative}
.prompt-label{position:absolute;top:-10px;left:16px;font-size:10px;font-weight:700;background:${T.s1};padding:0 8px;color:${T.purple2};letter-spacing:.5px;text-transform:uppercase}
.score-ring{display:flex;align-items:center;justify-content:center;flex-direction:column;width:90px;height:90px;border-radius:50%;border:4px solid;flex-shrink:0}
.score-num{font-size:28px;font-weight:900;font-family:'Inter',sans-serif;line-height:1}
.score-label{font-size:9px;color:${T.muted};margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
.score-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.score-item{background:${T.inputBg};border:1px solid ${T.border2};border-radius:12px;padding:12px;text-align:center}
.score-item-num{font-size:22px;font-weight:800;font-family:'Inter',sans-serif}
.score-item-label{font-size:10px;color:${T.muted};margin-top:4px;text-transform:uppercase;letter-spacing:.4px}
.tip-item{background:${T.promptBg};border:1px solid ${T.promptBorder};border-radius:12px;padding:12px 14px;font-size:13px;color:${T.muted2};line-height:1.6;margin-bottom:8px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.chip{display:inline-flex;align-items:center;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;margin:3px}
.chip-purple{background:${T.tagBg};border:1px solid ${T.tagBorder};color:${T.purple2}}
.chip-green{background:rgba(15,169,104,.1);border:1px solid rgba(15,169,104,.2);color:${T.purple2}}
.chip-red{background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.2);color:#B91C1C}
.chip-amber{background:rgba(217,119,6,.1);border:1px solid rgba(217,119,6,.2);color:#B45309}
.chip-cyan{background:rgba(21,150,214,.1);border:1px solid rgba(21,150,214,.2);color:#0E77AC}
.chain-step{background:${T.s2};border:1px solid ${T.border2};border-radius:14px;padding:16px;margin-bottom:12px;position:relative}
.chain-num{position:absolute;top:-10px;left:14px;background:${T.accentGrad};color:#fff;font-size:11px;font-weight:800;padding:2px 10px;border-radius:10px}
.chain-arrow{text-align:center;color:${T.purple2};font-size:20px;margin:4px 0}
.template-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:8px}
.template-card{background:${T.inputBg};border:1px solid ${T.border2};border-radius:12px;padding:14px;cursor:pointer;transition:all .2s;text-align:center}
.template-card:hover,.template-card.sel{border-color:${T.purple};background:${T.tagBg}}
.template-card.sel{background:${T.badgeBg}}
.template-icon{font-size:24px;margin-bottom:8px}
.template-name{font-size:12px;font-weight:700;color:${T.text}}
.ab-compare{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:600px){.ab-compare,.two-col{grid-template-columns:1fr}}
.ab-box{border-radius:14px;padding:16px;position:relative}
.ab-box-a{background:${T.tagBg};border:2px solid ${T.tagBorder}}
.ab-box-b{background:rgba(21,150,214,.08);border:2px solid rgba(21,150,214,.3)}
.ab-winner{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,${T.amber},#F2A93B);color:#fff;font-size:10px;font-weight:800;padding:3px 12px;border-radius:10px;white-space:nowrap}
.toast{position:fixed;bottom:24px;right:24px;z-index:9999;background:${T.accentGrad};color:#fff;padding:12px 22px;border-radius:100px;font-weight:600;font-size:13px;animation:fadeUp .3s ease;box-shadow:0 8px 25px rgba(15,150,120,.3)}
.info-box{background:rgba(21,150,214,.07);border:1px solid rgba(21,150,214,.2);border-radius:12px;padding:14px 16px;font-size:13px;color:#0E77AC;margin-bottom:16px;line-height:1.6}
.err-box{background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.25);border-radius:12px;padding:14px 16px;font-size:13px;color:#B91C1C;margin-bottom:16px;line-height:1.6}
.upload-zone{border:2px dashed ${T.tagBorder};border-radius:18px;padding:40px 20px;text-align:center;cursor:pointer;transition:all .3s;background:${T.tagBg}}
.upload-zone:hover,.upload-zone.drag-over{border-color:${T.purple};background:${T.badgeBg};transform:scale(1.01)}
.upload-icon{font-size:48px;margin-bottom:12px;display:block}
.upload-title{font-size:16px;font-weight:750;color:${T.text};margin-bottom:6px}
.upload-sub{font-size:13px;color:${T.muted2}}
.upload-formats{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap}
.upload-format-tag{background:${T.tagBg};border:1px solid ${T.tagBorder};border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;color:${T.purple2}}
.img-preview-wrap{position:relative;border-radius:16px;overflow:hidden;border:2px solid ${T.tagBorder};margin-top:16px}
.img-preview{width:100%;max-height:320px;object-fit:contain;background:rgba(18,54,42,.06);display:block}
.img-preview-overlay{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(18,54,42,.9));padding:16px;display:flex;align-items:center;justify-content:space-between}
.img-preview-name{font-size:13px;font-weight:600;color:#fff}
.img-preview-size{font-size:11px;color:rgba(255,255,255,.8)}
.platform-nav{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px;padding:16px;background:${T.badgeBg};border:1px solid ${T.badgeBorder};border-radius:14px}
.st-upload-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
@media(max-width:600px){.st-upload-row{grid-template-columns:1fr}}
.st-panel{border:1px solid ${T.border2};border-radius:16px;overflow:hidden;background:${T.s2}}
.st-panel-hdr{padding:10px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid ${T.border2}}
.st-panel-dot{width:8px;height:8px;border-radius:50%}
.st-panel-label{font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase}
.st-panel-sub{font-size:10px;color:${T.muted};margin-left:auto}
.st-drop{padding:28px 16px;text-align:center;cursor:pointer;transition:all .25s;min-height:180px;display:flex;align-items:center;justify-content:center;flex-direction:column}
.st-drop:hover,.st-drop.drag{background:${T.tagBg}}
.st-drop-icon{font-size:36px;margin-bottom:10px}
.st-drop-title{font-size:13px;font-weight:700;margin-bottom:4px;color:${T.text}}
.st-drop-sub{font-size:11px;color:${T.muted}}
.st-preview{position:relative}
.st-preview img{width:100%;height:200px;object-fit:cover;display:block}
.st-preview-bar{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(18,54,42,.95));padding:8px 12px;display:flex;justify-content:space-between;align-items:flex-end}
.st-preview-name{font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;color:#fff}
.st-change{background:rgba(255,255,255,.9);border:1px solid ${T.border2};border-radius:6px;color:${T.text};font-size:10px;font-weight:700;padding:3px 9px;cursor:pointer;font-family:'Inter',sans-serif}
.st-mini-pair{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px}
.st-mini{border-radius:10px;overflow:hidden;border:1px solid ${T.border2}}
.st-mini img{width:100%;height:100px;object-fit:cover;display:block}
.st-mini-lbl{font-size:9px;font-weight:700;padding:5px 8px;text-transform:uppercase;letter-spacing:.8px}
.st-plat-switch{display:flex;flex-wrap:wrap;gap:6px;margin-top:16px}
.st-plat-pill{border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s;border:1px solid}
.workflow-box{background:rgba(21,150,214,.06);border:1px solid rgba(21,150,214,.18);border-radius:12px;padding:14px 16px;font-size:13px;color:#0E77AC;line-height:1.8;margin-top:8px}
.st-neg-box{background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);border-radius:12px;padding:12px;margin-bottom:10px;font-family:'Inter',monospace;font-size:12px;color:#B91C1C;line-height:1.7}
.st-tip-box{background:rgba(15,169,104,.06);border:1px solid rgba(15,169,104,.2);border-radius:12px;padding:12px 14px;font-size:13px;color:${T.purple2};line-height:1.7}
.universal-box{background:linear-gradient(135deg,${T.badgeBg},rgba(21,150,214,.05));border:2px solid ${T.badgeBorder};border-radius:16px;padding:20px;margin-bottom:20px;font-family:'Inter',monospace;font-size:13px;color:${T.promptText};line-height:1.8;white-space:pre-wrap;position:relative}
.universal-label{position:absolute;top:-12px;left:16px;font-size:10px;font-weight:800;background:${T.s1};padding:2px 12px;color:${T.purple2};letter-spacing:1px;text-transform:uppercase;border:1px solid ${T.badgeBorder};border-radius:10px}
.how-to-box{background:rgba(217,119,6,.06);border:1px solid rgba(217,119,6,.2);border-radius:14px;padding:16px;margin-bottom:20px}
.how-to-title{font-size:11px;font-weight:800;color:${T.amber};text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px}
.how-to-step{display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;font-size:13px;color:${T.muted2};line-height:1.5}
.how-to-num{width:22px;height:22px;border-radius:50%;background:rgba(217,119,6,.15);border:1px solid rgba(217,119,6,.4);color:${T.amber};font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
`;

  const [view,         setView]        = useState("landing");
  const [mode,         setMode]        = useState(null);
  const [userInput,    setUserInput]   = useState("");
  const [platform,     setPlatform]    = useState("ChatGPT");
  const [complexity,   setComplexity]  = useState("Intermediate");
  const [tone,         setTone]        = useState("Neutral");
  const [aiName,       setAiName]      = useState("ChatGPT");
  const [taskType,     setTaskType]    = useState("");
  const [targetLang,   setTargetLang]  = useState("Hindi");
  const [targetLength, setTargetLength]= useState("50%");
  const [selectedTmpl, setSelectedTmpl]= useState(null);
  const [imgSubject,   setImgSubject]  = useState("");
  const [imgStyle,     setImgStyle]    = useState("Photorealistic");
  const [imgMood,      setImgMood]     = useState("Epic");
  const [selectedRole, setSelectedRole]= useState("Software Engineer");
  const [roleTask,     setRoleTask]    = useState("");
  const [promptA,      setPromptA]     = useState("");
  const [promptB,      setPromptB]     = useState("");
  const [chainGoal,    setChainGoal]   = useState("");
  const [chainSteps,   setChainSteps]  = useState("3");
  const [loading,      setLoading]     = useState(false);
  const [status,       setStatus]      = useState("");
  const [result,       setResult]      = useState(null);
  const [activeTab,    setActiveTab]   = useState("v1");
  const [toast,        setToast]       = useState("");
  const [errorMsg,     setErrorMsg]    = useState("");

  const [extractorFile,    setExtractorFile]    = useState(null);
  const [extractorPreview, setExtractorPreview] = useState(null);
  const [isDragOver,       setIsDragOver]       = useState(false);
  const fileInputRef = useRef(null);

  const [stRefFile,  setStRefFile]  = useState(null);
  const [stRefPrev,  setStRefPrev]  = useState(null);
  const [stSubjFile, setStSubjFile] = useState(null);
  const [stSubjPrev, setStSubjPrev] = useState(null);
  const [stDragRef,  setStDragRef]  = useState(false);
  const [stDragSubj, setStDragSubj] = useState(false);
  const stRefInput  = useRef(null);
  const stSubjInput = useRef(null);

  const showToast  = (msg) => { setToast(msg); setTimeout(()=>setToast(""),2500); };
  const copyText   = (text)=> { navigator.clipboard.writeText(text); showToast("📋 Copied!"); };
  const scoreColor = (s)   => s>=80?"#0FA968":s>=60?"#D97706":"#DC2626";

  const openTool = (toolId) => {
    setMode(toolId); setResult(null); setUserInput(""); setErrorMsg("");
    setExtractorFile(null); setExtractorPreview(null);
    setStRefFile(null); setStRefPrev(null);
    setStSubjFile(null); setStSubjPrev(null);
    setActiveTab(
      toolId==="magic_formula"?"v1":
      toolId==="prompt_extractor"?"universal":
      toolId==="style_transfer"?"universal":"result"
    );
    setView("tool");
  };

  const handleExtractorFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("Please upload an image file!"); return; }
    if (file.size > 15*1024*1024) { showToast("Image too large! Max 15MB"); return; }
    setExtractorFile(file);
    setExtractorPreview(URL.createObjectURL(file));
    setResult(null); setErrorMsg("");
  };

  const handleStFile = (file, type) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("Image files only!"); return; }
    if (file.size > 15*1024*1024) { showToast("Max 15MB per image"); return; }
    const url = URL.createObjectURL(file);
    if (type==="ref")  { setStRefFile(file);  setStRefPrev(url);  }
    if (type==="subj") { setStSubjFile(file); setStSubjPrev(url); }
    setResult(null); setErrorMsg("");
  };

  const buildPrompt = () => {
    switch(mode) {
      case "magic_formula": return `You are the world's best prompt engineer. Create a PERFECT prompt using the Advanced Magic Formula.\nUser Request: ${userInput}\nPlatform: ${platform} | Complexity: ${complexity} | Tone: ${tone}\nReturn ONLY valid JSON with no markdown or backticks:\n{"intent_detected":"What user wants to achieve","prompt_v1":{"version":"Version 1 Full Magic Formula","persona":"Act as expert role","objective":"Your task is to clear objective","context":"background context","format":"Format as specific format","constraints":"important rules","output_type":"what the output should be","full_prompt":"Complete combined optimized prompt"},"prompt_v2":{"version":"Version 2 Alternative Approach","full_prompt":"Alternative complete prompt with different angle"},"prompt_v3":{"version":"Version 3 Expert Level","full_prompt":"Advanced expert level prompt"},"negative_prompt":"DO NOT include these things in response","anti_hallucination":"Rule to prevent hallucinations","score":92,"score_breakdown":{"clarity":90,"specificity":95,"context":88,"format":94},"improvements":["improvement 1","improvement 2"],"power_words":["word1","word2","word3"],"avoid_words":["avoid1","avoid2"],"tips":["platform tip for ${platform}","general best practice tip"]}`;
      case "improve": return `Improve this prompt professionally. Platform: ${platform}. Original: ${userInput}\nReturn ONLY valid JSON: {"original":"${userInput}","improved_prompt":"Much better improved version","changes_made":["change 1 with reason","change 2","change 3"],"why_better":"Detailed explanation","score_before":55,"score_after":88,"key_improvements":["improvement 1","improvement 2"],"still_needs":["What could still be improved"]}`;
      case "score": return `Score this prompt as an expert. Platform: ${platform}. Prompt: ${userInput}\nReturn ONLY valid JSON: {"overall_score":72,"grade":"B+","breakdown":{"clarity":75,"specificity":70,"context":68,"format":80,"constraints":65},"strengths":["s1","s2","s3"],"weaknesses":["w1","w2","w3"],"quick_fixes":["fix1","fix2"],"improved_version":"Better version","verdict":"Overall assessment"}`;
      case "debug": return `Debug this broken prompt. Platform: ${platform}. Prompt: ${userInput}\nReturn ONLY valid JSON: {"problems_found":["p1","p2","p3"],"root_cause":"Main reason","fixed_prompt":"Completely fixed version","explanation":"Why it was failing","before_after":[{"before":"bad phrase","after":"fixed phrase","reason":"why"}],"prevention_tips":["t1","t2"],"test_suggestion":"How to test the fix"}`;
      case "batch": return `Generate 5 different prompt variations for this request. Platform: ${platform}. Complexity: ${complexity}. Request: ${userInput}\nReturn ONLY valid JSON: {"topic":"${userInput}","variations":[{"number":1,"approach":"Direct and Simple","prompt":"full prompt","best_for":"when to use"},{"number":2,"approach":"Detailed and Structured","prompt":"full prompt","best_for":"when to use"},{"number":3,"approach":"Creative and Open-ended","prompt":"full prompt","best_for":"when to use"},{"number":4,"approach":"Expert Technical","prompt":"full prompt","best_for":"when to use"},{"number":5,"approach":"Chain of Thought","prompt":"full prompt","best_for":"when to use"}],"recommendation":"Which variation to use first and why"}`;
      case "secret_formula": return `Reveal the secret prompt formula for ${aiName} for ${taskType||userInput} tasks.\nReturn ONLY valid JSON: {"ai_name":"${aiName}","task":"${taskType||userInput}","secret_formula":"Step-by-step secret formula revealed","key_elements":["element 1","element 2","element 3","element 4"],"power_words":["w1","w2","w3","w4","w5"],"avoid_words":["a1","a2","a3"],"structure":"How to structure the prompt","example_prompt":"Complete example using this formula","pro_tips":["pt1","pt2","pt3"],"common_mistakes":["m1","m2","m3"],"advanced_technique":"One advanced technique specific to this AI"}`;
      case "translator": return `Translate this AI prompt into ${targetLang} language while keeping full technical meaning and effectiveness. Original: ${userInput}\nReturn ONLY valid JSON: {"original_prompt":"${userInput}","target_language":"${targetLang}","translated_prompt":"Fully translated prompt in ${targetLang}","romanized_version":"Romanized version if applicable else empty string","key_terms_translated":[{"english":"term1","translated":"translation1","note":"context"}],"cultural_adaptations":["Any cultural adaptations made"],"effectiveness_maintained":"Explanation","usage_tips":["tip1","tip2"]}`;
      case "shortener": return `Shorten this prompt to ${targetLength} of its original length while preserving 100% of the meaning. Original: ${userInput}\nReturn ONLY valid JSON: {"original_prompt":"${userInput}","original_word_count":50,"shortened_prompt":"Ultra-compressed version","shortened_word_count":25,"reduction_percentage":"50%","removed_elements":["element removed","reason"],"preserved_elements":["critical element kept","reason"],"ultra_short_version":"Absolute minimum version","effectiveness_score":88,"tips":["When to use full vs short"]}`;
      case "template_library": return `Generate an optimized prompt template for: ${selectedTmpl?.topic||userInput}. Platform: ${platform}. Complexity: ${complexity}. Tone: ${tone}\nReturn ONLY valid JSON: {"template_name":"${selectedTmpl?.name||userInput}","category":"${selectedTmpl?.name||"Custom"}","main_prompt":"Complete ready-to-use prompt template","variables_to_fill":[{"variable":"[VAR]","description":"What to replace","example":"Example"}],"example_filled":"Template with example filled in","variations":["Variation 1","Variation 2"],"best_platforms":["Platform 1","Platform 2"],"pro_tips":["tip1","tip2"],"common_mistakes":["mistake1"],"effectiveness_score":91}`;
      case "explainer": return `Explain this AI prompt in simple language. Prompt: ${userInput}\nReturn ONLY valid JSON: {"prompt_analyzed":"${userInput}","simple_explanation":"What this does in plain language","components":[{"part":"Text from prompt","type":"Persona or Task or Context or Format or Constraint","purpose":"Why it exists","effect":"Effect on AI"}],"intent":"What user wants to achieve","expected_output":"What this prompt will generate","strengths":["strength1"],"hidden_tricks":["advanced technique found"],"what_ai_thinks":"How AI reads this","improvement_suggestions":["suggestion1"],"difficulty_level":"Intermediate","effectiveness_score":78}`;
      case "chain_builder": return `Build a ${chainSteps}-step chain prompt sequence for: ${chainGoal||userInput}. Platform: ${platform}\nReturn ONLY valid JSON: {"goal":"${chainGoal||userInput}","total_steps":${chainSteps},"chain_title":"Title for this chain","overview":"How this chain works","steps":[{"step":1,"title":"Step title","prompt":"Complete prompt","input_needed":"What to provide","output_produced":"What this generates","feeds_into":"How output feeds next step"}],"how_to_use":"Instructions","expected_final_output":"Final result","time_estimate":"How long","pro_tips":["tip1"],"use_cases":["use case"]}`;
      case "image_wizard": return `Create ultra-detailed image prompt for: Subject: ${imgSubject||userInput}. Style: ${imgStyle}. Mood: ${imgMood}. Platform: ${platform}\nReturn ONLY valid JSON: {"subject":"${imgSubject||userInput}","style":"${imgStyle}","mood":"${imgMood}","main_prompt":"Complete ultra-detailed image prompt","negative_prompt":"Things to exclude","technical_params":{"resolution":"8K","aspect_ratio":"16:9","steps":"50","cfg_scale":"7.5"},"style_keywords":["kw1","kw2","kw3","kw4","kw5"],"lighting":"Lighting description","camera_angle":"Camera perspective","color_palette":"Color palette","variations":[{"name":"Variation 1","prompt":"Alt prompt"},{"name":"Variation 2","prompt":"Alt prompt"}],"platform_tips":"Tips for ${platform}","pro_tricks":["trick1","trick2"]}`;
      case "role_generator": return `Create a powerful Act as a ${selectedRole} prompt. Task: ${roleTask||userInput}. Platform: ${platform}. Complexity: ${complexity}\nReturn ONLY valid JSON: {"role":"${selectedRole}","task":"${roleTask||userInput}","role_prompt":"Complete Act-as prompt","role_attributes":["attribute1","attribute2","attribute3"],"knowledge_areas":["area1","area2","area3"],"communication_style":"How this role communicates","example_response_start":"First 2-3 sentences","constraints":["constraint1"],"power_phrases":["phrase1","phrase2"],"variations":[{"variant":"Junior ${selectedRole}","prompt":"Junior prompt"},{"variant":"Senior ${selectedRole}","prompt":"Senior prompt"}],"best_use_cases":["use case 1","use case 2"],"effectiveness_score":92}`;
      case "ab_tester": return `Compare these two prompts and determine which is better. Platform: ${platform}. Prompt A: ${promptA}. Prompt B: ${promptB}\nReturn ONLY valid JSON: {"prompt_a_score":72,"prompt_b_score":85,"winner":"A or B","winner_reason":"Why this wins","comparison":{"clarity":{"a":70,"b":88,"winner":"B","reason":"Why"},"specificity":{"a":75,"b":82,"winner":"B","reason":"Why"},"context":{"a":68,"b":90,"winner":"B","reason":"Why"},"format":{"a":80,"b":78,"winner":"A","reason":"Why"},"effectiveness":{"a":65,"b":88,"winner":"B","reason":"Why"}},"prompt_a_strengths":["s1"],"prompt_a_weaknesses":["w1"],"prompt_b_strengths":["s1"],"prompt_b_weaknesses":["w1"],"hybrid_prompt":"Best of both combined","recommendation":"Final recommendation"}`;
      default: return userInput;
    }
  };

  const generateExtractor = async () => {
    if (!extractorFile) return;
    setLoading(true); setResult(null); setErrorMsg("");
    setStatus("Analyzing image and generating recreation prompts...");
    try {
      const base64 = await fileToBase64(extractorFile);
      setStatus("Creating ready-to-use prompts for all platforms...");
      const data = await callExtractor(base64, extractorFile.type);
      setResult(data); setActiveTab("universal"); setStatus("");
      showToast("Prompts Ready!");
    } catch (e) {
      setErrorMsg("Error: " + (e.message || "Unknown error. Check API key."));
      setStatus("");
    }
    setLoading(false);
  };

  const generateStyleTransfer = async () => {
    if (!stRefFile || !stSubjFile) return;
    setLoading(true); setResult(null); setErrorMsg("");
    setStatus("Analyzing style from reference image...");
    try {
      const [r64, s64] = await Promise.all([fileToBase64(stRefFile), fileToBase64(stSubjFile)]);
      setStatus("Building style transfer prompts for all 7 platforms...");
      const data = await callStyleTransfer(r64, stRefFile.type, s64, stSubjFile.type);
      setResult(data); setActiveTab("universal"); setStatus("");
      showToast("Style Transfer Prompts Ready!");
    } catch (e) {
      setErrorMsg("Error: " + (e.message || "Unknown error. Check API key."));
      setStatus("");
    }
    setLoading(false);
  };

  const generate = async () => {
    if (mode==="prompt_extractor") { generateExtractor(); return; }
    if (mode==="style_transfer")   { generateStyleTransfer(); return; }
    const hasInput = mode==="ab_tester"?(promptA.trim()&&promptB.trim())
                   :mode==="image_wizard"?(imgSubject.trim()||userInput.trim())
                   :mode==="chain_builder"?(chainGoal.trim()||userInput.trim())
                   :mode==="template_library"?(selectedTmpl||userInput.trim())
                   :userInput.trim();
    if (!hasInput) return;
    setLoading(true); setResult(null); setErrorMsg("");
    setStatus("AI is processing your request...");
    try {
      const data = await callGroq([
        {role:"system",content:"You are the world's best prompt engineer. Return ONLY valid JSON — no markdown, no backticks, no extra text outside the JSON object."},
        {role:"user",content:buildPrompt()}
      ]);
      setResult(data);
      setActiveTab(mode==="magic_formula"?"v1":"result");
      setStatus(""); showToast("Result ready!");
    } catch (e) {
      setErrorMsg("Error: " + (e.message||"Please try again."));
      setStatus("");
    }
    setLoading(false);
  };

  const currentTool = ALL_TOOLS.find(t=>t.id===mode);

  const tabsMap = {
    magic_formula:    [{id:"v1",label:"V1 Magic"},{id:"v2",label:"V2 Alt"},{id:"v3",label:"V3 Expert"},{id:"analysis",label:"Analysis"},{id:"tips",label:"Tips"}],
    improve:          [{id:"result",label:"Improved"}],
    score:            [{id:"result",label:"Score"}],
    debug:            [{id:"result",label:"Debug"}],
    batch:            [{id:"result",label:"Batch"}],
    secret_formula:   [{id:"result",label:"Secret"}],
    translator:       [{id:"result",label:"Translated"}],
    shortener:        [{id:"result",label:"Shortened"}],
    template_library: [{id:"result",label:"Template"}],
    explainer:        [{id:"result",label:"Explained"}],
    chain_builder:    [{id:"result",label:"Chain"}],
    image_wizard:     [{id:"result",label:"Image Prompt"}],
    role_generator:   [{id:"result",label:"Role Prompt"}],
    ab_tester:        [{id:"result",label:"Comparison"}],
    prompt_extractor: EXTRACTOR_PLATFORMS.map(p=>({id:p.key,label:`${p.icon} ${p.name}`})),
    style_transfer:   ST_PLATFORMS.map(p=>({id:p.key,label:`${p.icon} ${p.name}`})),
  };

  // ── EXTRACTOR INPUT ──
  const renderExtractorInput = () => (
    <div className="card">
      <div className="card-title">📸 Prompt Extractor</div>
      <div className="card-sub">Upload any image and get ready-to-use prompts that recreate it on 7 AI platforms. Paste the prompt directly and get the same image.</div>
      {!extractorPreview ? (
        <div className={`upload-zone ${isDragOver?"drag-over":""}`}
          onDragOver={e=>{e.preventDefault();setIsDragOver(true)}}
          onDragLeave={()=>setIsDragOver(false)}
          onDrop={e=>{e.preventDefault();setIsDragOver(false);handleExtractorFile(e.dataTransfer.files[0])}}
          onClick={()=>fileInputRef.current?.click()}>
          <input ref={fileInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleExtractorFile(e.target.files[0])}/>
          <span className="upload-icon">📸</span>
          <div className="upload-title">Drop your image here or click to upload</div>
          <div className="upload-sub">Any AI-generated image, artwork, photo — Max 15MB</div>
          <div className="upload-formats">{["JPG","PNG","WEBP","GIF","HEIC"].map(f=><span key={f} className="upload-format-tag">{f}</span>)}</div>
        </div>
      ) : (
        <div>
          <div className="img-preview-wrap">
            <img src={extractorPreview} alt="Preview" className="img-preview"/>
            <div className="img-preview-overlay">
              <div>
                <div className="img-preview-name">{extractorFile?.name}</div>
                <div className="img-preview-size">{(extractorFile?.size/1024).toFixed(0)} KB</div>
              </div>
              <button className="btn btn-outline" style={{padding:"6px 14px",fontSize:12}} onClick={()=>{setExtractorFile(null);setExtractorPreview(null);setResult(null);}}>Change Image</button>
            </div>
          </div>
        </div>
      )}
      {errorMsg && <div className="err-box" style={{marginTop:12}}>{errorMsg}</div>}
      {loading && (
        <div className="load-box">
          <div className="spinner"/>
          <div><div className="load-text">{status}</div><div className="load-sub">Generating recreation prompts for all platforms — 15 to 30 seconds</div></div>
        </div>
      )}
      <div className="btn-row">
        <button className="btn btn-outline" onClick={()=>{setView("landing");setResult(null);setExtractorFile(null);setExtractorPreview(null);}}>Back</button>
        <button className="btn btn-purple" disabled={loading||!extractorFile} onClick={generate}>
          {loading?<><div className="spinner"/>Generating Prompts...</>:"🔍 Extract Prompts (7 Platforms)"}
        </button>
      </div>
    </div>
  );

  // ── EXTRACTOR RESULTS ──
  const renderExtractorResults = () => {
    const prompts = result?.prompts || {};
    const isUniversal = activeTab === "universal";
    const platformData = !isUniversal ? prompts[activeTab] : null;
    return (
      <div style={{animation:"fadeUp .5s ease"}}>
        <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
          <button className="btn btn-outline" style={{padding:"8px 14px",fontSize:13}} onClick={()=>setResult(null)}>Try Again</button>
          <button className="btn btn-outline" style={{padding:"8px 14px",fontSize:13}} onClick={()=>{setView("landing");setResult(null);}}>All Tools</button>
          {extractorPreview&&<img src={extractorPreview} alt="Analyzed" style={{width:48,height:48,borderRadius:8,objectFit:"cover",border:`2px solid ${T.purple}`,marginLeft:"auto"}}/>}
          {result.best_platform&&<div style={{background:"rgba(15,169,104,.1)",border:"1px solid rgba(15,169,104,.3)",borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,color:T.purple2}}>Best: {result.best_platform}</div>}
        </div>
        <div className="tabs">{(tabsMap.prompt_extractor||[]).map(t=>(<button key={t.id} className={`tab ${activeTab===t.id?"active":"inactive"}`} onClick={()=>setActiveTab(t.id)}>{t.label}</button>))}</div>
        {isUniversal && (
          <div className="section">
            <div className="sec-title">⭐ Universal Prompt — Works on Any Platform</div>
            <div style={{fontSize:13,color:T.muted2,marginBottom:16,lineHeight:1.6}}>This single prompt will recreate your image on any AI platform. Copy it and paste directly into ChatGPT, Midjourney, Stable Diffusion, Flux, or any other tool.</div>
            <div className="universal-box"><div className="universal-label">COPY AND USE ANYWHERE</div>{result.universal_prompt}</div>
            <button className="btn btn-copy" onClick={()=>copyText(result.universal_prompt)}>📋 Copy Universal Prompt</button>
            {result.recreation_tips && (<div style={{marginTop:16,background:"rgba(21,150,214,.06)",border:"1px solid rgba(21,150,214,.18)",borderRadius:10,padding:"12px 16px"}}><div style={{fontSize:11,fontWeight:700,color:"#0E77AC",textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>Key Tips</div><div style={{fontSize:13,color:T.muted2,lineHeight:1.7}}>{result.recreation_tips}</div></div>)}
            {result.style_keywords?.length>0&&<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:T.purple2,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Style Keywords</div><div>{result.style_keywords.map((w,i)=><span key={i} className="chip chip-purple" onClick={()=>copyText(w)}>{w}</span>)}</div></div>}
            {result.lighting_tags?.length>0&&<div style={{marginTop:12}}><div style={{fontSize:11,fontWeight:700,color:T.amber,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Lighting</div><div>{result.lighting_tags.map((w,i)=><span key={i} className="chip chip-amber" onClick={()=>copyText(w)}>{w}</span>)}</div></div>}
            {result.color_tags?.length>0&&<div style={{marginTop:12}}><div style={{fontSize:11,fontWeight:700,color:T.cyan,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Colors</div><div>{result.color_tags.map((w,i)=><span key={i} className="chip chip-cyan" onClick={()=>copyText(w)}>{w}</span>)}</div></div>}
            <div className="platform-nav">
              <div style={{fontSize:12,fontWeight:700,color:T.purple2,marginBottom:8,width:"100%"}}>Platform-Specific Prompts:</div>
              {EXTRACTOR_PLATFORMS.filter(p=>p.key!=="universal").map(p=>(<button key={p.key} onClick={()=>setActiveTab(p.key)} style={{background:`${p.color}15`,border:`1px solid ${p.color}40`,borderRadius:100,padding:"7px 14px",fontSize:12,fontWeight:700,color:p.color,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{p.icon} {p.name}</button>))}
            </div>
          </div>
        )}
        {!isUniversal && (
          <div className="section">
            {platformData ? (
              <>
                {(()=>{const pInfo=EXTRACTOR_PLATFORMS.find(p=>p.key===activeTab);return(<div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,padding:"14px 16px",background:`${pInfo?.color||T.purple}12`,border:`1px solid ${pInfo?.color||T.purple}30`,borderRadius:12}}><span style={{fontSize:32}}>{pInfo?.icon}</span><div style={{flex:1}}><div style={{fontSize:17,fontWeight:750,color:pInfo?.color}}>{platformData.platform}</div><div style={{fontSize:12,color:T.muted2}}>Platform-optimized prompt — paste directly to recreate the image</div></div></div>);})()}
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:11,fontWeight:700,color:T.purple2,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Prompt</div>
                  <div className="prompt-box"><div className="prompt-label">COPY AND PASTE</div>{platformData.prompt}</div>
                  <button className="btn btn-copy" onClick={()=>copyText(platformData.prompt)}>📋 Copy Prompt</button>
                </div>
                {platformData.negative_prompt&&(<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:T.red,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Negative Prompt</div><div style={{background:"rgba(220,38,38,.06)",border:"1px solid rgba(220,38,38,.2)",borderRadius:10,padding:14,fontFamily:"'Inter',monospace",fontSize:12,color:"#B91C1C",lineHeight:1.7}}>{platformData.negative_prompt}</div><button className="btn btn-copy" style={{marginTop:8}} onClick={()=>copyText(platformData.negative_prompt)}>📋 Copy Negative</button></div>)}
                {platformData.quality_boosters?.length>0&&(<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:T.green,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Quality Boosters</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{platformData.quality_boosters.map((b,i)=><span key={i} className="chip chip-green" onClick={()=>copyText(b)}>{b}</span>)}</div></div>)}
                {platformData.tips&&(<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:T.amber,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Tips</div><div style={{background:"rgba(217,119,6,.06)",border:"1px solid rgba(217,119,6,.2)",borderRadius:10,padding:"12px 14px",fontSize:13,color:"#B45309",lineHeight:1.7}}>{platformData.tips}</div></div>)}
                <div style={{marginTop:20,display:"flex",gap:8,flexWrap:"wrap"}}>{EXTRACTOR_PLATFORMS.filter(p=>p.key!==activeTab).map(p=>(<button key={p.key} onClick={()=>setActiveTab(p.key)} style={{background:`${p.color}10`,border:`1px solid ${p.color}30`,borderRadius:100,padding:"6px 12px",fontSize:11,fontWeight:700,color:p.color,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{p.icon} {p.name}</button>))}</div>
              </>
            ) : (
              <div style={{textAlign:"center",padding:"40px 20px",color:T.muted2}}><div style={{fontSize:32,marginBottom:12}}>⚠️</div><div>No data for this platform. Try re-extracting.</div><button className="btn btn-outline" style={{marginTop:16}} onClick={()=>setResult(null)}>Try Again</button></div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── STYLE TRANSFER INPUT ──
  const renderStyleTransferInput = () => (
    <div className="card">
      <div className="card-title">🔄 Style Transfer Prompt</div>
      <div className="card-sub">Upload a reference image for the style you want, then upload your subject photo. Get prompts for 7 AI platforms that will recreate your photo in that style world.</div>
      <div className="how-to-box">
        <div className="how-to-title">How Style Transfer Works</div>
        <div className="how-to-step"><div className="how-to-num">1</div><div>Upload a <strong style={{color:T.amber}}>Reference Image</strong> — this is the visual style world you want (can be any AI image, artwork, film still, etc.)</div></div>
        <div className="how-to-step"><div className="how-to-num">2</div><div>Upload your <strong style={{color:T.cyan}}>Subject Photo</strong> — this is the person or object you want placed into that style world</div></div>
        <div className="how-to-step"><div className="how-to-num">3</div><div>Get prompts for 7 platforms. Each prompt describes the style world and tells the AI to apply it to your uploaded photo — your subject's identity is preserved</div></div>
      </div>
      <div className="st-upload-row">
        <div className="st-panel">
          <div className="st-panel-hdr"><div className="st-panel-dot" style={{background:T.amber}}/><span className="st-panel-label" style={{color:T.amber}}>Style Reference</span><span className="st-panel-sub">The world you want</span></div>
          {!stRefPrev ? (
            <div className={`st-drop ${stDragRef?"drag":""}`} onDragOver={e=>{e.preventDefault();setStDragRef(true)}} onDragLeave={()=>setStDragRef(false)} onDrop={e=>{e.preventDefault();setStDragRef(false);handleStFile(e.dataTransfer.files[0],"ref")}} onClick={()=>stRefInput.current?.click()}>
              <input ref={stRefInput} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleStFile(e.target.files[0],"ref")}/>
              <div className="st-drop-icon">🎨</div><div className="st-drop-title">Upload reference image</div><div className="st-drop-sub">Artwork, film still, AI image, photo</div>
            </div>
          ) : (
            <div className="st-preview"><img src={stRefPrev} alt="Reference"/><div className="st-preview-bar"><div><div className="st-preview-name" style={{color:T.amber}}>{stRefFile?.name}</div><div style={{fontSize:10,color:"rgba(255,255,255,.8)"}}>{(stRefFile?.size/1024).toFixed(0)} KB</div></div><button className="st-change" onClick={()=>{setStRefFile(null);setStRefPrev(null)}}>Change</button></div></div>
          )}
        </div>
        <div className="st-panel">
          <div className="st-panel-hdr"><div className="st-panel-dot" style={{background:T.cyan}}/><span className="st-panel-label" style={{color:T.cyan}}>Your Subject</span><span className="st-panel-sub">Person or object to transfer</span></div>
          {!stSubjPrev ? (
            <div className={`st-drop ${stDragSubj?"drag":""}`} onDragOver={e=>{e.preventDefault();setStDragSubj(true)}} onDragLeave={()=>setStDragSubj(false)} onDrop={e=>{e.preventDefault();setStDragSubj(false);handleStFile(e.dataTransfer.files[0],"subj")}} onClick={()=>stSubjInput.current?.click()}>
              <input ref={stSubjInput} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleStFile(e.target.files[0],"subj")}/>
              <div className="st-drop-icon">🧑‍🎤</div><div className="st-drop-title">Upload your subject photo</div><div className="st-drop-sub">Portrait, product, character, object</div>
            </div>
          ) : (
            <div className="st-preview"><img src={stSubjPrev} alt="Subject"/><div className="st-preview-bar"><div><div className="st-preview-name" style={{color:T.cyan}}>{stSubjFile?.name}</div><div style={{fontSize:10,color:"rgba(255,255,255,.8)"}}>{(stSubjFile?.size/1024).toFixed(0)} KB</div></div><button className="st-change" onClick={()=>{setStSubjFile(null);setStSubjPrev(null)}}>Change</button></div></div>
          )}
        </div>
      </div>
      {stRefPrev && stSubjPrev && (<div style={{marginBottom:16,background:"rgba(15,169,104,.06)",border:"1px solid rgba(15,169,104,.2)",borderRadius:12,padding:"12px 16px",fontSize:13,color:T.purple2,fontWeight:600}}>Both images ready — will extract style from Image 1 and generate prompts to apply it to Image 2 across 7 platforms</div>)}
      {errorMsg && <div className="err-box">{errorMsg}</div>}
      {loading && (<div className="load-box"><div className="spinner"/><div><div className="load-text">{status}</div><div className="load-sub">Extracting style world and building transfer prompts — 20 to 40 seconds</div></div></div>)}
      <div className="btn-row">
        <button className="btn btn-outline" onClick={()=>{setView("landing");setResult(null);setStRefFile(null);setStRefPrev(null);setStSubjFile(null);setStSubjPrev(null);}}>Back</button>
        <button className="btn btn-purple" disabled={loading||!stRefFile||!stSubjFile} onClick={generate}>
          {loading?<><div className="spinner"/>Generating Prompts...</>:"🔄 Generate Style Transfer (7 Platforms)"}
        </button>
      </div>
    </div>
  );

  // ── STYLE TRANSFER RESULTS ──
  const renderStyleTransferResults = () => {
    const transferPrompts = result?.transfer_prompts || {};
    const isUniversal = activeTab === "universal";
    const platformData = !isUniversal ? transferPrompts[activeTab] : null;

    return (
      <div style={{animation:"fadeUp .5s ease"}}>
        <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
          <button className="btn btn-outline" style={{padding:"8px 14px",fontSize:13}} onClick={()=>setResult(null)}>🔄 Try Again</button>
          <button className="btn btn-outline" style={{padding:"8px 14px",fontSize:13}} onClick={()=>{setView("landing");setResult(null);}}>All Tools</button>
          {result?.best_platform && (<div style={{background:"rgba(15,169,104,.1)",border:"1px solid rgba(15,169,104,.3)",borderRadius:10,padding:"6px 14px",fontSize:12,fontWeight:700,color:T.purple2,marginLeft:"auto"}}>⭐ Best: {result.best_platform}</div>)}
        </div>

        {result?.detected_technique && (
          <div style={{background:T.badgeBg,border:`1px solid ${T.badgeBorder}`,borderRadius:12,padding:"12px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:24}}>🎨</span>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:T.purple2,textTransform:"uppercase",letterSpacing:".8px",marginBottom:3}}>Detected Technique</div>
              <div style={{fontSize:15,fontWeight:750,color:T.text}}>{result.detected_technique}</div>
            </div>
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          <div style={{borderRadius:10,overflow:"hidden",border:`2px solid ${T.amber}66`}}>
            {stRefPrev && <img src={stRefPrev} alt="Reference" style={{width:"100%",height:110,objectFit:"cover",display:"block"}}/>}
            <div style={{fontSize:10,fontWeight:800,padding:"6px 10px",color:T.amber,background:"rgba(217,119,6,.08)",textTransform:"uppercase",letterSpacing:".8px"}}>🎨 Style Extracted From This</div>
          </div>
          <div style={{borderRadius:10,overflow:"hidden",border:`2px solid ${T.cyan}66`}}>
            {stSubjPrev && <img src={stSubjPrev} alt="Your Subject" style={{width:"100%",height:110,objectFit:"cover",display:"block"}}/>}
            <div style={{fontSize:10,fontWeight:800,padding:"6px 10px",color:T.cyan,background:"rgba(21,150,214,.08)",textTransform:"uppercase",letterSpacing:".8px"}}>🧑‍🎤 Your Person — Will Be Placed In That World</div>
          </div>
        </div>

        <div style={{background:"rgba(15,169,104,.06)",border:"1px solid rgba(15,169,104,.2)",borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13,color:T.purple2,lineHeight:1.7}}>
          <strong style={{color:T.purple2}}>How to use:</strong> Upload YOUR subject photo (Image 2) to the AI platform, then paste the prompt. The AI will recreate YOUR person inside the style world from Image 1. Your person's identity is preserved — only the visual treatment changes.
        </div>

        <div className="tabs">
          {(tabsMap.style_transfer||[]).map(t=>(<button key={t.id} className={`tab ${activeTab===t.id?"active":"inactive"}`} onClick={()=>setActiveTab(t.id)}>{t.label}</button>))}
        </div>

        {isUniversal && (
          <div className="section">
            <div className="sec-title">⭐ Universal Style Transfer Prompt</div>
            <div style={{fontSize:13,color:T.muted2,marginBottom:16,lineHeight:1.6}}>Works on any AI platform that supports image upload. Upload your subject photo first, then paste this prompt.</div>
            <div className="universal-box">
              <div className="universal-label">UPLOAD YOUR PHOTO FIRST → THEN PASTE THIS</div>
              {result.universal_transfer_prompt}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
              <button className="btn btn-copy" onClick={()=>copyText(result.universal_transfer_prompt)}>📋 Copy Universal Prompt</button>
            </div>

            {result.key_tip && (
              <div style={{marginBottom:12,background:"rgba(217,119,6,.06)",border:"1px solid rgba(217,119,6,.2)",borderRadius:10,padding:"12px 16px"}}>
                <div style={{fontSize:11,fontWeight:700,color:T.amber,textTransform:"uppercase",letterSpacing:".5px",marginBottom:5}}>🔑 Key Tip for This Style</div>
                <div style={{fontSize:13,color:"#B45309",lineHeight:1.7}}>{result.key_tip}</div>
              </div>
            )}

            {result.identity_preservation_tip && (
              <div style={{marginBottom:16,background:"rgba(21,150,214,.06)",border:"1px solid rgba(21,150,214,.2)",borderRadius:10,padding:"12px 16px"}}>
                <div style={{fontSize:11,fontWeight:700,color:T.cyan,textTransform:"uppercase",letterSpacing:".5px",marginBottom:5}}>👤 Preserve Your Person's Identity</div>
                <div style={{fontSize:13,color:"#0E77AC",lineHeight:1.7}}>{result.identity_preservation_tip}</div>
              </div>
            )}

            {result.style_keywords?.length>0&&<div style={{marginTop:14}}><div style={{fontSize:11,fontWeight:700,color:T.purple2,textTransform:"uppercase",letterSpacing:".5px",marginBottom:7}}>Style Keywords (click to copy)</div><div>{result.style_keywords.map((w,i)=><span key={i} className="chip chip-purple" onClick={()=>copyText(w)}>{w}</span>)}</div></div>}
            {result.atmosphere_tags?.length>0&&<div style={{marginTop:12}}><div style={{fontSize:11,fontWeight:700,color:T.cyan,textTransform:"uppercase",letterSpacing:".5px",marginBottom:7}}>Atmosphere Tags</div><div>{result.atmosphere_tags.map((w,i)=><span key={i} className="chip chip-cyan" onClick={()=>copyText(w)}>{w}</span>)}</div></div>}
            {result.lighting_tags?.length>0&&<div style={{marginTop:12}}><div style={{fontSize:11,fontWeight:700,color:T.amber,textTransform:"uppercase",letterSpacing:".5px",marginBottom:7}}>Lighting</div><div>{result.lighting_tags.map((w,i)=><span key={i} className="chip chip-amber" onClick={()=>copyText(w)}>{w}</span>)}</div></div>}
            {result.color_grade_tags?.length>0&&<div style={{marginTop:12}}><div style={{fontSize:11,fontWeight:700,color:T.green,textTransform:"uppercase",letterSpacing:".5px",marginBottom:7}}>Color Grade</div><div>{result.color_grade_tags.map((w,i)=><span key={i} className="chip chip-green" onClick={()=>copyText(w)}>{w}</span>)}</div></div>}
            {result.quality_boosters?.length>0&&<div style={{marginTop:12}}><div style={{fontSize:11,fontWeight:700,color:T.blue,textTransform:"uppercase",letterSpacing:".5px",marginBottom:7}}>Quality Boosters</div><div>{result.quality_boosters.map((w,i)=><span key={i} style={{background:"rgba(21,150,214,.1)",border:"1px solid rgba(21,150,214,.25)",color:"#0E77AC"}} className="chip" onClick={()=>copyText(w)}>{w}</span>)}</div></div>}

            <div style={{marginTop:20,padding:"14px 16px",background:T.badgeBg,border:`1px solid ${T.badgeBorder}`,borderRadius:12}}>
              <div style={{fontSize:12,fontWeight:700,color:T.purple2,marginBottom:10}}>Platform-Specific Prompts with Step-by-Step Workflows:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {ST_PLATFORMS.filter(p=>p.key!=="universal").map(p=>(<button key={p.key} onClick={()=>setActiveTab(p.key)} style={{background:`${p.color}15`,border:`1px solid ${p.color}40`,borderRadius:100,padding:"7px 14px",fontSize:12,fontWeight:700,color:p.color,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{p.icon} {p.name}</button>))}
              </div>
            </div>
          </div>
        )}

        {!isUniversal && (
          <div className="section">
            {platformData ? (
              <>
                {(()=>{ const pInfo = ST_PLATFORMS.find(p=>p.key===activeTab); return (
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:12,marginBottom:20,background:`${pInfo?.color}12`,border:`1px solid ${pInfo?.color}35`}}>
                    <span style={{fontSize:36}}>{pInfo?.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:17,fontWeight:750,color:pInfo?.color}}>{platformData.platform}</div>
                      <div style={{fontSize:12,color:T.muted2,marginTop:2}}>Upload your subject photo to this platform, then paste the prompt below</div>
                    </div>
                  </div>
                );})()}

                {platformData.workflow && (
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:11,fontWeight:700,color:T.cyan,textTransform:"uppercase",letterSpacing:".8px",marginBottom:8}}>📋 Step-by-Step Workflow</div>
                    <div style={{background:"rgba(21,150,214,.06)",border:"1px solid rgba(21,150,214,.2)",borderRadius:10,padding:"14px 16px",fontSize:13,color:"#0E77AC",lineHeight:2,whiteSpace:"pre-line"}}>{platformData.workflow}</div>
                  </div>
                )}

                <div style={{marginBottom:4}}>
                  <div style={{fontSize:11,fontWeight:700,color:T.purple2,textTransform:"uppercase",letterSpacing:".8px",marginBottom:8}}>📝 Style Transfer Prompt</div>
                  <div style={{fontSize:12,color:T.muted,marginBottom:8}}>⚠️ Upload your subject photo to the platform FIRST, then paste this prompt</div>
                  <div className="prompt-box"><div className="prompt-label">PASTE AFTER UPLOADING YOUR PHOTO</div>{platformData.prompt}</div>
                  <button className="btn btn-copy" onClick={()=>copyText(platformData.prompt)}>📋 Copy Prompt</button>
                </div>

                {platformData.negative_prompt && (
                  <div style={{marginTop:16}}>
                    <div style={{fontSize:11,fontWeight:700,color:T.red,textTransform:"uppercase",letterSpacing:".8px",marginBottom:8}}>🚫 Negative Prompt</div>
                    <div style={{background:"rgba(220,38,38,.06)",border:"1px solid rgba(220,38,38,.2)",borderRadius:10,padding:"12px 14px",fontFamily:"'Inter',monospace",fontSize:12,color:"#B91C1C",lineHeight:1.7}}>{platformData.negative_prompt}</div>
                    <button className="btn btn-copy" style={{marginTop:8}} onClick={()=>copyText(platformData.negative_prompt)}>📋 Copy Negative</button>
                  </div>
                )}

                {platformData.tips && (
                  <div style={{marginTop:16}}>
                    <div style={{fontSize:11,fontWeight:700,color:T.amber,textTransform:"uppercase",letterSpacing:".8px",marginBottom:8}}>💡 Pro Tips</div>
                    <div style={{background:"rgba(217,119,6,.06)",border:"1px solid rgba(217,119,6,.2)",borderRadius:10,padding:"12px 14px",fontSize:13,color:"#B45309",lineHeight:1.7}}>{platformData.tips}</div>
                  </div>
                )}

                <div style={{marginTop:20}}>
                  <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".8px",marginBottom:10}}>Switch Platform:</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {ST_PLATFORMS.filter(p=>p.key!==activeTab).map(p=>(<button key={p.key} onClick={()=>setActiveTab(p.key)} style={{background:`${p.color}10`,border:`1px solid ${p.color}30`,borderRadius:100,padding:"6px 12px",fontSize:11,fontWeight:700,color:p.color,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{p.icon} {p.name}</button>))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{textAlign:"center",padding:"40px 20px",color:T.muted2}}>
                <div style={{fontSize:32,marginBottom:12}}>⚠️</div>
                <div style={{fontSize:14}}>No data for this platform. Try regenerating.</div>
                <button className="btn btn-outline" style={{marginTop:16}} onClick={()=>setResult(null)}>Try Again</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── REGULAR INPUT ──
  const renderInput = () => {
    if (mode==="prompt_extractor") return renderExtractorInput();
    if (mode==="style_transfer")   return renderStyleTransferInput();
    return (
      <div className="card">
        <div className="card-title">{currentTool?.icon} {currentTool?.name}</div>
        <div className="card-sub">{currentTool?.desc}</div>
        {!["translator","shortener","explainer"].includes(mode)&&(<><label className="label">AI Platform</label><div className="opts">{AI_PLATFORMS.map(p=><button key={p} className={`opt ${platform===p?"sel":""}`} onClick={()=>setPlatform(p)}>{p}</button>)}</div></>)}
        {mode==="magic_formula"&&<div className="two-col" style={{marginTop:8}}><div><label className="label">Complexity</label><div className="opts">{COMPLEXITIES.map(c=><button key={c} className={`opt ${complexity===c?"sel-green":""}`} onClick={()=>setComplexity(c)}>{c}</button>)}</div></div><div><label className="label">Tone</label><div className="opts">{TONES2.map(t=><button key={t} className={`opt ${tone===t?"sel-amber":""}`} onClick={()=>setTone(t)}>{t}</button>)}</div></div></div>}
        {mode==="secret_formula"&&<><label className="label">Which AI?</label><div className="opts">{AI_PLATFORMS.map(p=><button key={p} className={`opt ${aiName===p?"sel-amber":""}`} onClick={()=>setAiName(p)}>{p}</button>)}</div><label className="label">Task Type</label><input className="input" placeholder="e.g. writing, coding, image generation..." value={taskType} onChange={e=>setTaskType(e.target.value)}/></>}
        {mode==="translator"&&<><label className="label">Translate To</label><div className="opts">{LANGUAGES.map(l=><button key={l} className={`opt ${targetLang===l?"sel":""}`} onClick={()=>setTargetLang(l)}>{l}</button>)}</div></>}
        {mode==="shortener"&&<><label className="label">Target Length</label><div className="opts">{["30%","50%","70%","1 sentence","2 sentences"].map(l=><button key={l} className={`opt ${targetLength===l?"sel-green":""}`} onClick={()=>setTargetLength(l)}>{l}</button>)}</div></>}
        {mode==="template_library"&&<><label className="label">Choose a Template</label><div className="template-grid">{TEMPLATES.map(t=><div key={t.name} className={`template-card ${selectedTmpl?.name===t.name?"sel":""}`} onClick={()=>{setSelectedTmpl(t);setUserInput(t.topic);}}><div className="template-icon">{t.icon}</div><div className="template-name">{t.name}</div></div>)}</div><div className="two-col" style={{marginTop:12}}><div><label className="label">Complexity</label><div className="opts">{COMPLEXITIES.map(c=><button key={c} className={`opt ${complexity===c?"sel-green":""}`} onClick={()=>setComplexity(c)}>{c}</button>)}</div></div><div><label className="label">Tone</label><div className="opts">{TONES2.slice(0,4).map(t=><button key={t} className={`opt ${tone===t?"sel-amber":""}`} onClick={()=>setTone(t)}>{t}</button>)}</div></div></div></>}
        {mode==="chain_builder"&&<><label className="label">Number of Steps</label><div className="opts">{["2","3","4","5","6"].map(s=><button key={s} className={`opt ${chainSteps===s?"sel":""}`} onClick={()=>setChainSteps(s)}>{s} Steps</button>)}</div><label className="label">Your Goal</label><input className="input" placeholder="e.g. Write a complete blog post from scratch..." value={chainGoal} onChange={e=>setChainGoal(e.target.value)}/></>}
        {mode==="image_wizard"&&<><label className="label">Image Subject / Scene</label><input className="input" placeholder="e.g. A futuristic city at night with neon lights..." value={imgSubject} onChange={e=>setImgSubject(e.target.value)}/><div className="two-col"><div><label className="label">Art Style</label><div className="opts">{IMAGE_STYLES.map(s=><button key={s} className={`opt ${imgStyle===s?"sel":""}`} onClick={()=>setImgStyle(s)}>{s}</button>)}</div></div><div><label className="label">Mood</label><div className="opts">{IMAGE_MOODS.map(m=><button key={m} className={`opt ${imgMood===m?"sel-amber":""}`} onClick={()=>setImgMood(m)}>{m}</button>)}</div></div></div></>}
        {mode==="role_generator"&&<><label className="label">Select Expert Role</label><div className="opts">{EXPERT_ROLES.map(r=><button key={r} className={`opt ${selectedRole===r?"sel":""}`} onClick={()=>setSelectedRole(r)} style={{fontSize:12}}>{r}</button>)}</div><label className="label">Specific Task</label><input className="input" placeholder="e.g. Help me optimize my React app performance..." value={roleTask} onChange={e=>setRoleTask(e.target.value)}/><div><label className="label">Complexity</label><div className="opts">{COMPLEXITIES.map(c=><button key={c} className={`opt ${complexity===c?"sel-green":""}`} onClick={()=>setComplexity(c)}>{c}</button>)}</div></div></>}
        {mode==="ab_tester"&&<><div className="info-box">Paste two prompts — AI will tell you which one is better and why</div><label className="label">Prompt A</label><textarea className="textarea" placeholder="Paste your first prompt here..." value={promptA} onChange={e=>setPromptA(e.target.value)} style={{minHeight:100}}/><label className="label">Prompt B</label><textarea className="textarea" placeholder="Paste your second prompt here..." value={promptB} onChange={e=>setPromptB(e.target.value)} style={{minHeight:100}}/></>}
        {mode==="batch"&&<div><label className="label">Complexity</label><div className="opts">{COMPLEXITIES.map(c=><button key={c} className={`opt ${complexity===c?"sel-green":""}`} onClick={()=>setComplexity(c)}>{c}</button>)}</div></div>}
        {mode!=="ab_tester"&&<><label className="label">{mode==="magic_formula"?"Describe your task or idea":mode==="improve"?"Paste your existing prompt":mode==="score"?"Paste the prompt to score":mode==="debug"?"Paste the broken prompt":mode==="batch"?"Enter a topic or idea":mode==="secret_formula"?"Enter task type":mode==="translator"?"Paste your prompt to translate":mode==="shortener"?"Paste the long prompt":mode==="template_library"?"Custom topic or use template above":mode==="explainer"?"Paste the prompt to explain":mode==="chain_builder"?"Describe what you want to accomplish":mode==="image_wizard"?"Extra details (optional)":mode==="role_generator"?"Additional context":"Your input"}</label><textarea className="textarea" placeholder={mode==="magic_formula"?"e.g. Write a viral LinkedIn post about my AI startup...":mode==="improve"?"Paste your existing prompt here...":mode==="score"?"Paste the prompt you want scored...":mode==="debug"?"Paste the prompt that is not working...":mode==="batch"?"e.g. Instagram caption for product launch...":mode==="secret_formula"?"e.g. coding, writing, image generation...":mode==="translator"?"Paste your prompt here...":mode==="shortener"?"Paste the long prompt here...":mode==="template_library"?"Custom topic if not using template above...":mode==="explainer"?"Paste any prompt here to understand it...":mode==="chain_builder"?"e.g. Research a topic and write a full article...":mode==="image_wizard"?"Any extra details for the image...":mode==="role_generator"?"Any specific requirements or context...":"Enter your input..."} value={userInput} onChange={e=>setUserInput(e.target.value)}/></>}
        {errorMsg&&<div className="err-box">{errorMsg}</div>}
        {loading&&<div className="load-box"><div className="spinner"/><div><div className="load-text">{status}</div><div className="load-sub">Please wait 10 to 20 seconds...</div></div></div>}
        <div className="btn-row">
          <button className="btn btn-outline" onClick={()=>{setView("landing");setResult(null);}}>Back</button>
          <button className="btn btn-purple"
            disabled={loading||(mode==="ab_tester"?(!promptA.trim()||!promptB.trim()):mode==="template_library"?(!selectedTmpl&&!userInput.trim()):!userInput.trim()&&!imgSubject.trim()&&!chainGoal.trim())}
            onClick={generate}>
            {loading?<><div className="spinner"/>Processing...</>:`Run ${currentTool?.name}`}
          </button>
        </div>
      </div>
    );
  };

  // ── RESULTS ──
  const renderResults = () => {
    if (mode==="prompt_extractor") return renderExtractorResults();
    if (mode==="style_transfer")   return renderStyleTransferResults();
    return (
      <div style={{animation:"fadeUp .5s ease"}}>
        <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
          <button className="btn btn-outline" style={{padding:"8px 14px",fontSize:13}} onClick={()=>setResult(null)}>Try Again</button>
          <button className="btn btn-outline" style={{padding:"8px 14px",fontSize:13}} onClick={()=>{setView("landing");setResult(null);}}>All Tools</button>
        </div>
        <div className="tabs">{(tabsMap[mode]||[]).map(t=>(<button key={t.id} className={`tab ${activeTab===t.id?"active":"inactive"}`} onClick={()=>setActiveTab(t.id)}>{t.label}</button>))}</div>
        {mode==="magic_formula"&&(<>{activeTab==="v1"&&result.prompt_v1&&(<div className="section"><div className="sec-title">{result.prompt_v1.version}</div>{[["Persona",result.prompt_v1.persona],["Objective",result.prompt_v1.objective],["Context",result.prompt_v1.context],["Format",result.prompt_v1.format],["Constraints",result.prompt_v1.constraints],["Output Type",result.prompt_v1.output_type]].map(([lbl,val])=>val&&(<div key={lbl} style={{marginBottom:10}}><div style={{fontSize:11,fontWeight:700,color:T.purple2,textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>{lbl}</div><div style={{fontSize:13,color:T.muted2,background:T.inputBg,padding:"8px 12px",borderRadius:8,border:`1px solid ${T.border2}`}}>{val}</div></div>))}<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:T.cyan,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>FULL COMBINED PROMPT</div><div className="prompt-box"><div className="prompt-label">COPY THIS PROMPT</div>{result.prompt_v1.full_prompt}</div><button className="btn btn-copy" onClick={()=>copyText(result.prompt_v1.full_prompt)}>Copy Full Prompt V1</button></div>{result.negative_prompt&&<div style={{marginTop:16,background:"rgba(220,38,38,.07)",border:"1px solid rgba(220,38,38,.22)",borderRadius:10,padding:"14px 16px"}}><div style={{fontSize:11,fontWeight:700,color:T.red,marginBottom:6,textTransform:"uppercase"}}>Negative Prompt</div><div style={{fontSize:13,color:T.muted2,fontFamily:"'Inter',monospace"}}>{result.negative_prompt}</div></div>}</div>)}{activeTab==="v2"&&result.prompt_v2&&<div className="section"><div className="sec-title">{result.prompt_v2.version}</div><div className="prompt-box"><div className="prompt-label">ALTERNATIVE VERSION</div>{result.prompt_v2.full_prompt}</div><button className="btn btn-copy" onClick={()=>copyText(result.prompt_v2.full_prompt)}>Copy V2</button></div>}{activeTab==="v3"&&result.prompt_v3&&<div className="section"><div className="sec-title">{result.prompt_v3.version}</div><div className="prompt-box"><div className="prompt-label">EXPERT LEVEL</div>{result.prompt_v3.full_prompt}</div><button className="btn btn-copy" onClick={()=>copyText(result.prompt_v3.full_prompt)}>Copy V3</button>{result.anti_hallucination&&<div style={{marginTop:12,background:"rgba(15,169,104,.07)",border:"1px solid rgba(15,169,104,.22)",borderRadius:10,padding:"12px 16px"}}><div style={{fontSize:11,fontWeight:700,color:T.green,textTransform:"uppercase"}}>Anti-Hallucination Rule</div><div style={{fontSize:13,color:T.muted2,marginTop:4}}>{result.anti_hallucination}</div></div>}</div>}{activeTab==="analysis"&&<div className="section"><div className="sec-title">Score Analysis</div><div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap",marginBottom:24}}><div className="score-ring" style={{borderColor:scoreColor(result.score||0),background:scoreColor(result.score||0)+"12"}}><div className="score-num" style={{color:scoreColor(result.score||0)}}>{result.score||0}</div><div className="score-label">Score</div></div><div style={{flex:1}}><div className="score-grid">{Object.entries(result.score_breakdown||{}).map(([key,val])=><div key={key} className="score-item"><div className="score-item-num" style={{color:scoreColor(val)}}>{val}</div><div className="score-item-label">{key}</div></div>)}</div></div></div>{result.improvements?.length>0&&<div><div style={{fontSize:11,fontWeight:700,color:T.purple2,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Improvements</div>{result.improvements.map((imp,i)=><div key={i} className="tip-item">{imp}</div>)}</div>}{result.intent_detected&&<div style={{marginTop:12,background:"rgba(21,150,214,.07)",border:"1px solid rgba(21,150,214,.2)",borderRadius:10,padding:"12px 16px"}}><div style={{fontSize:11,fontWeight:700,color:T.cyan,textTransform:"uppercase"}}>Detected Intent</div><div style={{fontSize:13,color:T.muted2,marginTop:4}}>{result.intent_detected}</div></div>}</div>}{activeTab==="tips"&&<div className="section"><div className="sec-title">Pro Tips and Power Words</div>{result.power_words?.length>0&&<div style={{marginBottom:16}}><div style={{fontSize:11,fontWeight:700,color:T.green,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Power Words</div><div>{result.power_words.map((w,i)=><span key={i} className="chip chip-green" onClick={()=>copyText(w)}>{w}</span>)}</div></div>}{result.avoid_words?.length>0&&<div style={{marginBottom:16}}><div style={{fontSize:11,fontWeight:700,color:T.red,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Avoid These Words</div><div>{result.avoid_words.map((w,i)=><span key={i} className="chip chip-red">{w}</span>)}</div></div>}{result.tips?.length>0&&<div><div style={{fontSize:11,fontWeight:700,color:T.purple2,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Platform Tips for {platform}</div>{result.tips.map((tip,i)=><div key={i} className="tip-item">{tip}</div>)}</div>}</div>}</>)}
        {mode==="improve"&&activeTab==="result"&&<div className="section"><div className="sec-title">Improved Prompt</div><div style={{display:"flex",gap:20,alignItems:"center",marginBottom:20,flexWrap:"wrap"}}>{[["Before",result.score_before],["After",result.score_after]].map(([label,score])=><div key={label} className="score-ring" style={{borderColor:scoreColor(score),background:scoreColor(score)+"12"}}><div className="score-num" style={{color:scoreColor(score)}}>{score}</div><div className="score-label">{label}</div></div>)}<div style={{flex:1,fontSize:13,color:T.muted2,minWidth:180}}>{result.why_better}</div></div><div className="prompt-box"><div className="prompt-label">IMPROVED PROMPT</div>{result.improved_prompt}</div><button className="btn btn-copy" onClick={()=>copyText(result.improved_prompt)}>Copy Improved Prompt</button>{result.changes_made?.length>0&&<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:T.purple2,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Changes Made</div>{result.changes_made.map((c,i)=><div key={i} className="tip-item">{c}</div>)}</div>}</div>}
        {mode==="score"&&activeTab==="result"&&<div className="section"><div className="sec-title">Score: {result.overall_score}/100 — Grade: {result.grade}</div><div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap",marginBottom:20}}><div className="score-ring" style={{borderColor:scoreColor(result.overall_score),background:scoreColor(result.overall_score)+"12"}}><div className="score-num" style={{color:scoreColor(result.overall_score)}}>{result.overall_score}</div><div className="score-label">Score</div></div><div style={{flex:1}}><div className="score-grid">{Object.entries(result.breakdown||{}).map(([key,val])=><div key={key} className="score-item"><div className="score-item-num" style={{color:scoreColor(val)}}>{val}</div><div className="score-item-label">{key}</div></div>)}</div></div></div><div className="two-col"><div><div style={{fontSize:11,fontWeight:700,color:T.green,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Strengths</div>{(result.strengths||[]).map((s,i)=><div key={i} className="tip-item" style={{background:"rgba(15,169,104,.06)",borderColor:"rgba(15,169,104,.2)"}}>{s}</div>)}</div><div><div style={{fontSize:11,fontWeight:700,color:T.red,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Weaknesses</div>{(result.weaknesses||[]).map((w,i)=><div key={i} className="tip-item" style={{background:"rgba(220,38,38,.06)",borderColor:"rgba(220,38,38,.2)"}}>{w}</div>)}</div></div>{result.improved_version&&<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:T.purple2,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Improved Version</div><div className="prompt-box"><div className="prompt-label">BETTER VERSION</div>{result.improved_version}</div><button className="btn btn-copy" onClick={()=>copyText(result.improved_version)}>Copy</button></div>}</div>}
        {mode==="debug"&&activeTab==="result"&&<div className="section"><div className="sec-title">Debug Report</div>{result.root_cause&&<div style={{background:"rgba(220,38,38,.07)",border:"1px solid rgba(220,38,38,.22)",borderRadius:10,padding:"14px 16px",marginBottom:16}}><b style={{color:T.red}}>Root Cause: </b><span style={{color:T.muted2}}>{result.root_cause}</span></div>}{result.problems_found?.length>0&&<div style={{marginBottom:16}}><div style={{fontSize:11,fontWeight:700,color:T.red,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Problems Found</div>{result.problems_found.map((p,i)=><div key={i} className="tip-item" style={{background:"rgba(220,38,38,.06)",borderColor:"rgba(220,38,38,.2)"}}>{p}</div>)}</div>}<div style={{fontSize:11,fontWeight:700,color:T.green,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Fixed Prompt</div><div className="prompt-box"><div className="prompt-label">FIXED</div>{result.fixed_prompt}</div><button className="btn btn-copy" onClick={()=>copyText(result.fixed_prompt)}>Copy Fixed Prompt</button></div>}
        {mode==="batch"&&activeTab==="result"&&<div className="section"><div className="sec-title">5 Prompt Variations</div>{result.recommendation&&<div style={{background:"rgba(217,119,6,.07)",border:"1px solid rgba(217,119,6,.22)",borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13,color:T.muted2}}><b style={{color:T.amber}}>Recommendation: </b>{result.recommendation}</div>}{(result.variations||[]).map((v,i)=><div key={i} style={{marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}><span style={{fontWeight:700,color:T.purple2}}>{v.number}. {v.approach}</span><span style={{fontSize:12,color:T.muted,background:T.inputBg,padding:"3px 10px",borderRadius:10}}>Best for: {v.best_for}</span></div><div className="prompt-box"><div className="prompt-label">VARIATION {v.number}</div>{v.prompt}</div><button className="btn btn-copy" onClick={()=>copyText(v.prompt)}>Copy #{v.number}</button></div>)}</div>}
        {mode==="secret_formula"&&activeTab==="result"&&<div className="section"><div className="sec-title">{result.ai_name} Secret Formula</div>{result.secret_formula&&<div style={{background:T.badgeBg,border:`1px solid ${T.badgeBorder}`,borderRadius:12,padding:20,marginBottom:16,fontSize:14,color:T.promptText,lineHeight:1.8}}>{result.secret_formula}</div>}{result.example_prompt&&<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:T.cyan,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Example Prompt</div><div className="prompt-box"><div className="prompt-label">EXAMPLE</div>{result.example_prompt}</div><button className="btn btn-copy" onClick={()=>copyText(result.example_prompt)}>Copy Example</button></div>}{result.pro_tips?.length>0&&<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:T.amber,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Pro Tips</div>{result.pro_tips.map((tip,i)=><div key={i} className="tip-item">{tip}</div>)}</div>}</div>}
        {mode==="translator"&&activeTab==="result"&&<div className="section"><div className="sec-title">Translated to {result.target_language}</div><div className="prompt-box"><div className="prompt-label">TRANSLATED</div>{result.translated_prompt}</div><button className="btn btn-copy" onClick={()=>copyText(result.translated_prompt)}>Copy Translated</button>{result.romanized_version&&<div style={{marginTop:12}}><div style={{fontSize:11,fontWeight:700,color:T.cyan,textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>Romanized</div><div className="prompt-box" style={{background:"rgba(21,150,214,.06)",borderColor:"rgba(21,150,214,.25)",color:"#0E77AC"}}><div className="prompt-label" style={{color:T.cyan}}>ROMANIZED</div>{result.romanized_version}</div><button className="btn btn-copy" onClick={()=>copyText(result.romanized_version)}>Copy Romanized</button></div>}</div>}
        {mode==="shortener"&&activeTab==="result"&&<div className="section"><div className="sec-title">Shortened — {result.reduction_percentage} reduced</div><div style={{display:"flex",gap:16,marginBottom:20,flexWrap:"wrap"}}>{[["Original",result.original_word_count,T.red],["Shortened",result.shortened_word_count,T.green]].map(([lbl,count,color])=><div key={lbl} style={{background:color+"12",border:`1px solid ${color}40`,borderRadius:12,padding:"12px 20px",textAlign:"center",minWidth:100}}><div style={{fontSize:24,fontWeight:900,color,fontFamily:"'Inter',sans-serif"}}>{count}</div><div style={{fontSize:10,color:T.muted,textTransform:"uppercase",marginTop:2}}>{lbl} Words</div></div>)}</div><div className="prompt-box"><div className="prompt-label">SHORTENED</div>{result.shortened_prompt}</div><button className="btn btn-copy" onClick={()=>copyText(result.shortened_prompt)}>Copy Shortened</button>{result.ultra_short_version&&<div style={{marginTop:12}}><div style={{fontSize:11,fontWeight:700,color:T.red,textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>Ultra-Short Version</div><div className="prompt-box" style={{background:"rgba(220,38,38,.06)",borderColor:"rgba(220,38,38,.25)",color:"#B91C1C"}}><div className="prompt-label" style={{color:T.red}}>MINIMUM</div>{result.ultra_short_version}</div><button className="btn btn-copy" onClick={()=>copyText(result.ultra_short_version)}>Copy Ultra Short</button></div>}</div>}
        {mode==="template_library"&&activeTab==="result"&&<div className="section"><div className="sec-title">{result.template_name} Template</div><div className="prompt-box"><div className="prompt-label">READY TO USE</div>{result.main_prompt}</div><button className="btn btn-copy" onClick={()=>copyText(result.main_prompt)}>Copy Template</button>{result.variables_to_fill?.length>0&&<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:T.amber,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Variables to Fill In</div>{result.variables_to_fill.map((v,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 0",borderBottom:`1px solid ${T.border2}`}}><span className="chip chip-amber">{v.variable}</span><div><div style={{fontSize:13,color:T.muted2}}>{v.description}</div><div style={{fontSize:12,color:T.muted}}>e.g. {v.example}</div></div></div>)}</div>}{result.example_filled&&<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:T.green,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Filled Example</div><div className="prompt-box" style={{background:"rgba(15,169,104,.06)",borderColor:"rgba(15,169,104,.25)",color:T.purple2}}><div className="prompt-label" style={{color:T.green}}>EXAMPLE</div>{result.example_filled}</div></div>}</div>}
        {mode==="explainer"&&activeTab==="result"&&<div className="section"><div className="sec-title">Prompt Analysis</div><div style={{display:"flex",gap:16,alignItems:"center",marginBottom:20,flexWrap:"wrap"}}><div style={{background:T.badgeBg,border:`1px solid ${T.badgeBorder}`,borderRadius:12,padding:"12px 20px",textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,color:T.purple2,fontFamily:"'Inter',sans-serif"}}>{result.effectiveness_score}</div><div style={{fontSize:10,color:T.muted,textTransform:"uppercase"}}>Score</div></div><div style={{background:"rgba(21,150,214,.1)",border:"1px solid rgba(21,150,214,.3)",borderRadius:12,padding:"12px 20px",textAlign:"center"}}><div style={{fontSize:14,fontWeight:750,color:T.cyan}}>{result.difficulty_level}</div><div style={{fontSize:10,color:T.muted,textTransform:"uppercase"}}>Level</div></div></div><div style={{marginBottom:16,background:"rgba(21,150,214,.07)",border:"1px solid rgba(21,150,214,.2)",borderRadius:12,padding:"16px"}}><div style={{fontSize:11,fontWeight:700,color:T.cyan,textTransform:"uppercase",marginBottom:6}}>Simple Explanation</div><div style={{fontSize:14,color:T.muted2,lineHeight:1.7}}>{result.simple_explanation}</div></div>{result.components?.length>0&&<div style={{marginBottom:16}}><div style={{fontSize:11,fontWeight:700,color:T.purple2,textTransform:"uppercase",letterSpacing:".5px",marginBottom:10}}>Components</div>{result.components.map((c,i)=><div key={i} style={{background:T.inputBg,border:`1px solid ${T.border2}`,borderRadius:10,padding:"14px",marginBottom:10}}><div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}><span className="chip chip-purple">{c.type}</span><code style={{fontSize:12,color:T.promptText,background:T.tagBg,padding:"2px 8px",borderRadius:4}}>{c.part}</code></div><div style={{fontSize:13,color:T.muted2}}><b style={{color:T.purple2}}>Purpose:</b> {c.purpose}</div><div style={{fontSize:13,color:T.muted2,marginTop:4}}><b style={{color:"#0E77AC"}}>Effect:</b> {c.effect}</div></div>)}</div>}{result.what_ai_thinks&&<div style={{background:T.badgeBg,border:`1px solid ${T.badgeBorder}`,borderRadius:10,padding:"14px 16px"}}><b style={{color:T.purple2}}>How AI Reads This: </b><span style={{fontSize:13,color:T.muted2}}>{result.what_ai_thinks}</span></div>}</div>}
        {mode==="chain_builder"&&activeTab==="result"&&<div className="section"><div className="sec-title">{result.chain_title}</div><div style={{background:"rgba(21,150,214,.07)",border:"1px solid rgba(21,150,214,.2)",borderRadius:10,padding:"14px 16px",marginBottom:20}}><b style={{color:T.cyan}}>Overview: </b><span style={{fontSize:13,color:T.muted2}}>{result.overview}</span></div>{(result.steps||[]).map((step,i)=><div key={i}><div className="chain-step"><div className="chain-num">STEP {step.step}</div><div style={{fontWeight:700,color:T.purple2,marginBottom:8}}>{step.title}</div><div className="prompt-box" style={{margin:0}}><div className="prompt-label">PROMPT</div>{step.prompt}</div><button className="btn btn-copy" style={{marginTop:8}} onClick={()=>copyText(step.prompt)}>Copy Step {step.step}</button><div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}>{step.input_needed&&<div style={{fontSize:12,color:T.muted}}><b style={{color:T.amber}}>Input:</b> {step.input_needed}</div>}{step.output_produced&&<div style={{fontSize:12,color:T.muted}}><b style={{color:T.green}}>Output:</b> {step.output_produced}</div>}</div></div>{i<(result.steps||[]).length-1&&<div className="chain-arrow">↓</div>}</div>)}{result.expected_final_output&&<div style={{marginTop:16,background:"rgba(15,169,104,.07)",border:"1px solid rgba(15,169,104,.22)",borderRadius:10,padding:"14px 16px"}}><b style={{color:T.green}}>Final Output: </b><span style={{fontSize:13,color:T.muted2}}>{result.expected_final_output}</span></div>}</div>}
        {mode==="image_wizard"&&activeTab==="result"&&<div className="section"><div className="sec-title">Image Prompt</div><div className="prompt-box"><div className="prompt-label">MAIN PROMPT</div>{result.main_prompt}</div><button className="btn btn-copy" onClick={()=>copyText(result.main_prompt)}>Copy Image Prompt</button>{result.negative_prompt&&<div style={{marginTop:12}}><div style={{fontSize:11,fontWeight:700,color:T.red,textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>Negative Prompt</div><div className="prompt-box" style={{background:"rgba(220,38,38,.06)",borderColor:"rgba(220,38,38,.25)",color:"#B91C1C"}}><div className="prompt-label" style={{color:T.red}}>EXCLUDE</div>{result.negative_prompt}</div><button className="btn btn-copy" onClick={()=>copyText(result.negative_prompt)}>Copy Negative</button></div>}{result.style_keywords?.length>0&&<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:T.green,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Style Keywords</div><div>{result.style_keywords.map((w,i)=><span key={i} className="chip chip-purple" onClick={()=>copyText(w)}>{w}</span>)}</div></div>}{result.variations?.length>0&&<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:T.purple2,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Variations</div>{result.variations.map((v,i)=><div key={i} style={{marginBottom:10}}><div style={{fontSize:12,fontWeight:700,color:T.purple2,marginBottom:4}}>{v.name}</div><div className="prompt-box" style={{minHeight:"auto",fontSize:12}}>{v.prompt}</div><button className="btn btn-copy" onClick={()=>copyText(v.prompt)}>Copy Variation {i+1}</button></div>)}</div>}</div>}
        {mode==="role_generator"&&activeTab==="result"&&<div className="section"><div className="sec-title">{result.role} Role Prompt</div><div className="prompt-box"><div className="prompt-label">ROLE PROMPT</div>{result.role_prompt}</div><button className="btn btn-copy" onClick={()=>copyText(result.role_prompt)}>Copy Role Prompt</button>{result.role_attributes?.length>0&&<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:T.purple2,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Role Attributes</div>{result.role_attributes.map((a,i)=><div key={i} className="tip-item">{a}</div>)}</div>}{result.example_response_start&&<div style={{marginTop:12,background:"rgba(21,150,214,.07)",border:"1px solid rgba(21,150,214,.2)",borderRadius:10,padding:"14px 16px"}}><div style={{fontSize:11,fontWeight:700,color:T.cyan,textTransform:"uppercase",marginBottom:6}}>How It Would Start</div><div style={{fontSize:13,color:T.muted2,fontStyle:"italic",lineHeight:1.7}}>"{result.example_response_start}"</div></div>}{result.variations?.length>0&&<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:T.purple2,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Level Variations</div>{result.variations.map((v,i)=><div key={i} style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:T.purple2,marginBottom:6}}>{v.variant}</div><div className="prompt-box" style={{minHeight:"auto"}}>{v.prompt}</div><button className="btn btn-copy" onClick={()=>copyText(v.prompt)}>Copy {v.variant}</button></div>)}</div>}</div>}
        {mode==="ab_tester"&&activeTab==="result"&&<div className="section"><div className="sec-title">Prompt Comparison</div><div className="ab-compare" style={{marginBottom:20}}><div className="ab-box ab-box-a">{result.winner==="A"&&<div className="ab-winner">WINNER</div>}<div style={{fontSize:11,fontWeight:700,color:T.purple2,textTransform:"uppercase",marginBottom:8}}>Prompt A</div><div style={{fontSize:36,fontWeight:900,color:scoreColor(result.prompt_a_score),fontFamily:"'Inter',sans-serif",textAlign:"center"}}>{result.prompt_a_score}</div>{result.prompt_a_strengths?.length>0&&<div style={{marginTop:12}}><div style={{fontSize:10,fontWeight:700,color:T.green,marginBottom:4}}>STRENGTHS</div>{result.prompt_a_strengths.map((s,i)=><div key={i} style={{fontSize:12,color:T.muted2,marginBottom:3}}>• {s}</div>)}</div>}</div><div className="ab-box ab-box-b">{result.winner==="B"&&<div className="ab-winner">WINNER</div>}<div style={{fontSize:11,fontWeight:700,color:T.cyan,textTransform:"uppercase",marginBottom:8}}>Prompt B</div><div style={{fontSize:36,fontWeight:900,color:scoreColor(result.prompt_b_score),fontFamily:"'Inter',sans-serif",textAlign:"center"}}>{result.prompt_b_score}</div>{result.prompt_b_strengths?.length>0&&<div style={{marginTop:12}}><div style={{fontSize:10,fontWeight:700,color:T.green,marginBottom:4}}>STRENGTHS</div>{result.prompt_b_strengths.map((s,i)=><div key={i} style={{fontSize:12,color:T.muted2,marginBottom:3}}>• {s}</div>)}</div>}</div></div>{result.winner_reason&&<div style={{background:"rgba(217,119,6,.07)",border:"1px solid rgba(217,119,6,.22)",borderRadius:10,padding:"14px 16px",marginBottom:12}}><b style={{color:T.amber}}>Winner ({result.winner}): </b><span style={{fontSize:13,color:T.muted2}}>{result.winner_reason}</span></div>}{result.hybrid_prompt&&<div style={{marginTop:16}}><div style={{fontSize:11,fontWeight:700,color:T.green,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Hybrid Prompt (Best of Both)</div><div className="prompt-box" style={{background:"rgba(15,169,104,.06)",borderColor:"rgba(15,169,104,.25)",color:T.purple2}}><div className="prompt-label" style={{color:T.green}}>HYBRID</div>{result.hybrid_prompt}</div><button className="btn btn-green" onClick={()=>copyText(result.hybrid_prompt)}>Copy Hybrid Prompt</button></div>}{result.recommendation&&<div style={{marginTop:12,background:T.badgeBg,border:`1px solid ${T.badgeBorder}`,borderRadius:10,padding:"14px 16px"}}><b style={{color:T.purple2}}>Recommendation: </b><span style={{fontSize:13,color:T.muted2}}>{result.recommendation}</span></div>}</div>}
      </div>
    );
  };

  // ── RENDER ──
  return (
    <>

      <Helmet>
        <title>Prompt Engineer — Master AI Prompt Engineering | MK AI</title>
        <meta name="description" content="Master AI prompt engineering with MK AI's dedicated Prompt Engineer workspace." />
      </Helmet>
      <style>{css}</style>
      <div className="wrap">
        <div className="grid-bg"/>
        <header className="header">
          <div className="logo">
            <div className="logo-icon">🧠</div>
            <span className="logo-name">MK Prompt Engineer</span>
            <span className="logo-tag">MAGIC FORMULA</span>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            {view==="tool"&&(
              <button className="btn btn-outline" style={{padding:"8px 14px",fontSize:13}} onClick={()=>{setView("landing");setResult(null);setExtractorFile(null);setExtractorPreview(null);setStRefFile(null);setStRefPrev(null);setStSubjFile(null);setStSubjPrev(null);}}>
                All Tools
              </button>
            )}
            <button className="btn btn-outline" style={{padding:"8px 14px",fontSize:13}} onClick={()=>navigate("/")}>Home</button>
          </div>
        </header>
        <main className="main">
          {view==="landing"&&(
            <>
              <div className="hero">
                <div className="hero-badge">✨ 16 PROMPT TOOLS IN ONE</div>
                <h1 className="hero-title">World's Best<br/><span>Prompt Engineer</span></h1>
                <p className="hero-sub">Perfect prompts for ChatGPT, Claude, Midjourney and more — in seconds.</p>
              </div>
              <div className="tools-section">
                <div className="tools-label">Choose Your Tool</div>
                <div className="tools-grid">
                  {ALL_TOOLS.map(tool=>(
                    <div key={tool.id} className={`tool-card ${tool.isNew?"new-badge":""}`} onClick={()=>openTool(tool.id)}>
                      <span className="tool-icon">{tool.icon}</span>
                      <div className="tool-name">{tool.name}</div>
                      <div className="tool-desc">{tool.desc}</div>
                      <div className="tool-open">Open →</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{textAlign:"center",marginTop:40,color:T.muted,fontSize:12}}>Powered by MK AI · Vision AI · 100% Free</div>
            </>
          )}
          {view==="tool"&&<>{!result?renderInput():renderResults()}</>}
        </main>
        {toast&&<div className="toast">{toast}</div>}
      </div>
    </>
  );
}