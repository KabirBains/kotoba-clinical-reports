import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Style guide cache (1 hour TTL) ─────────────────────────
let cachedStyleGuide: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getStyleGuide(): Promise<string | null> {
  const now = Date.now();
  if (cachedStyleGuide && (now - cacheTimestamp) < CACHE_TTL_MS) {
    console.log("REFINE: Using cached style guide");
    return cachedStyleGuide;
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.storage
      .from("report-documents")
      .download("FCA_Clinical_Writing_Style_Guide.docx");

    if (error || !data) {
      console.error("REFINE: Failed to download style guide:", error);
      return null;
    }

    // Extract text from docx (ZIP containing XML)
    const arrayBuffer = await data.arrayBuffer();
    const text = await extractTextFromDocx(new Uint8Array(arrayBuffer));
    
    cachedStyleGuide = text;
    cacheTimestamp = now;
    console.log(`REFINE: Style guide loaded and cached (${text.length} chars)`);
    return text;
  } catch (err) {
    console.error("REFINE: Error loading style guide:", err);
    return null;
  }
}

// ── Simple DOCX text extraction (no external deps) ─────────
async function extractTextFromDocx(docxBytes: Uint8Array): Promise<string> {
  // A .docx is a ZIP file; we need word/document.xml
  // Use the DecompressionStream API available in Deno
  
  // Find the ZIP entries manually
  const zip = await readZipEntries(docxBytes);
  const documentXml = zip["word/document.xml"];
  
  if (!documentXml) {
    console.error("REFINE: No word/document.xml found in docx");
    return "";
  }

  // Strip XML tags and decode entities
  let text = new TextDecoder().decode(documentXml);
  
  // Extract text from <w:t> tags
  const matches = text.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
  if (!matches) return "";

  const paragraphs: string[] = [];
  let currentParagraph = "";

  // Also track paragraph boundaries
  const fullXml = text;
  const tokens = fullXml.split(/(<\/?w:[^>]+>)/);
  let inText = false;
  
  for (const token of tokens) {
    if (token === "</w:p>" || token.startsWith("<w:p ") || token === "<w:p>") {
      if (token === "</w:p>" && currentParagraph.trim()) {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = "";
      }
    } else if (token.startsWith("<w:t")) {
      inText = true;
    } else if (token === "</w:t>") {
      inText = false;
    } else if (inText && !token.startsWith("<")) {
      currentParagraph += token;
    }
  }
  if (currentParagraph.trim()) {
    paragraphs.push(currentParagraph.trim());
  }

  return paragraphs.join("\n\n");
}

// ── Minimal ZIP reader ──────────────────────────────────────
async function readZipEntries(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  const entries: Record<string, Uint8Array> = {};
  
  // Find End of Central Directory
  let eocdOffset = -1;
  for (let i = data.length - 22; i >= 0; i--) {
    if (data[i] === 0x50 && data[i+1] === 0x4B && data[i+2] === 0x05 && data[i+3] === 0x06) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error("Not a valid ZIP file");

  const cdOffset = data[eocdOffset + 16] | (data[eocdOffset + 17] << 8) | 
                   (data[eocdOffset + 18] << 16) | (data[eocdOffset + 19] << 24);
  const cdCount = data[eocdOffset + 10] | (data[eocdOffset + 11] << 8);

  let pos = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (data[pos] !== 0x50 || data[pos+1] !== 0x4B || data[pos+2] !== 0x01 || data[pos+3] !== 0x02) break;
    
    const compressionMethod = data[pos + 10] | (data[pos + 11] << 8);
    const compressedSize = data[pos + 20] | (data[pos + 21] << 8) | (data[pos + 22] << 16) | (data[pos + 23] << 24);
    const fileNameLen = data[pos + 28] | (data[pos + 29] << 8);
    const extraLen = data[pos + 30] | (data[pos + 31] << 8);
    const commentLen = data[pos + 32] | (data[pos + 33] << 8);
    const localHeaderOffset = data[pos + 42] | (data[pos + 43] << 8) | (data[pos + 44] << 16) | (data[pos + 45] << 24);
    
    const fileName = new TextDecoder().decode(data.slice(pos + 46, pos + 46 + fileNameLen));
    
    // Only extract word/document.xml
    if (fileName === "word/document.xml") {
      // Read local file header
      const lh = localHeaderOffset;
      const lhFileNameLen = data[lh + 26] | (data[lh + 27] << 8);
      const lhExtraLen = data[lh + 28] | (data[lh + 29] << 8);
      const dataStart = lh + 30 + lhFileNameLen + lhExtraLen;
      
      const compressedData = data.slice(dataStart, dataStart + compressedSize);
      
      if (compressionMethod === 0) {
        // Stored (no compression)
        entries[fileName] = compressedData;
      } else if (compressionMethod === 8) {
        // Deflate
        const ds = new DecompressionStream("raw");
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();
        
        writer.write(compressedData);
        writer.close();
        
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
        const result = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }
        entries[fileName] = result;
      }
    }
    
    pos += 46 + fileNameLen + extraLen + commentLen;
  }
  
  return entries;
}

// ── System prompt for Claude ────────────────────────────────
function buildSystemPrompt(styleGuide: string | null): string {
  const styleContext = styleGuide
    ? `\n\nSTYLE GUIDE (extracted from accepted NDIS FCA reports — match this voice):\n---\n${styleGuide.slice(0, 12000)}\n---`
    : "";

  return `You are a clinical writing quality editor for Australian NDIS Functional Capacity Assessment reports.

YOUR TASK:
Rewrite the provided report section text to improve clinical writing quality while preserving ALL clinical content exactly.

ABSOLUTE RULES — NEVER VIOLATE:
- Preserve ALL clinical facts, scores, dates, names, and placeholders EXACTLY as given.
- Preserve ALL [bracketed placeholders] exactly as written.
- Do NOT add, remove, or change any clinical information.
- Do NOT change any assessment scores, numerical values, or dates.
- Do NOT change the participant's name or any other proper nouns.
- Only change the EXPRESSION — word choice, sentence structure, voice — for stronger clinical writing.

WRITING IMPROVEMENTS TO APPLY:
- Use active verbs: 'requires', 'cannot', 'is unable to', 'needs' instead of passive constructions like 'demonstrates', 'experiences difficulty', 'was observed to'.
- Vary sentence length — include at least one short sentence (<12 words) per paragraph for impact.
- Eliminate hedging language: replace 'appears to', 'seems to', 'may potentially' with direct statements where clinically appropriate.
- Tighten wordy phrases: 'due to the fact that' → 'because', 'in order to' → 'to'.
- Ensure observation → functional impact → support need flow in each domain paragraph.
- Maintain professional, measured, objective tone throughout.
- No bullet points — continuous prose paragraphs only.
- No markdown formatting. Plain text only.

OUTPUT:
Return ONLY the rewritten section text. No preamble, no commentary, no explanations.${styleContext}`;
}

// ── Main handler ────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    if (!CLAUDE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "CLAUDE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { generated_text, section_name, participant_name, participant_first_name } = body;

    if (!generated_text || typeof generated_text !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "generated_text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load style guide (cached)
    const styleGuide = await getStyleGuide();
    if (!styleGuide) {
      console.warn("REFINE: Style guide not available, proceeding without it");
    }

    const systemPrompt = buildSystemPrompt(styleGuide);

    const userPrompt = `Section: ${section_name || "unknown"}
${participant_name ? `Participant name: ${participant_name}` : ""}
${participant_first_name ? `Participant first name: ${participant_first_name}` : ""}

TEXT TO REFINE:
${generated_text}`;

    // Call Claude
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const originalWordCount = generated_text.split(/\s+/).filter(Boolean).length;

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("REFINE: Claude API error:", claudeRes.status, errText);
      // Fallback: return original text
      return new Response(
        JSON.stringify({
          success: true,
          refined_text: generated_text,
          original_text: generated_text,
          word_count_original: originalWordCount,
          word_count_refined: originalWordCount,
          warnings: ["Refinement unavailable — original text returned"],
          fallback: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await claudeRes.json();
    const refinedText = data.content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();

    const refinedWordCount = refinedText.split(/\s+/).filter(Boolean).length;
    const warnings: string[] = [];

    // Length validation
    const ratio = refinedWordCount / originalWordCount;
    if (ratio < 0.6) {
      warnings.push(`Refined text is significantly shorter than original (${refinedWordCount} vs ${originalWordCount} words — ${Math.round(ratio * 100)}%)`);
    }
    if (ratio > 1.5) {
      warnings.push(`Refined text is significantly longer than original (${refinedWordCount} vs ${originalWordCount} words — ${Math.round(ratio * 100)}%)`);
    }

    // Name check
    if (participant_name && !refinedText.includes(participant_name) && generated_text.includes(participant_name)) {
      warnings.push(`Participant name "${participant_name}" may have been altered during refinement`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        refined_text: refinedText,
        original_text: generated_text,
        word_count_original: originalWordCount,
        word_count_refined: refinedWordCount,
        warnings,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    console.error("REFINE: Unhandled error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
