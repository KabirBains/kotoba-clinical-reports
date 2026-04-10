import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Regex to match clinician-action placeholders like:
// [Information not provided — clinician to complete...]
// [clinician to complete...]
// [Not provided]
// [Section not yet completed]
const PLACEHOLDER_REGEX = /\[(?:Information not provided|clinician to complete|Not provided|Section not yet completed)[^\]]*\]/gi;

function textToDocxXml(text: string, fontSize: string = "20"): string {
  if (!text || text.trim() === "") {
    return '<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="' + fontSize + '"/><w:b/><w:color w:val="DC2626"/></w:rPr><w:t>[Section not yet completed]</w:t></w:r></w:p>';
  }
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  return paragraphs
    .map((para) => {
      const trimmed = para.trim();
      // Check if this paragraph contains any placeholder patterns
      if (PLACEHOLDER_REGEX.test(trimmed)) {
        // Reset regex lastIndex after test
        PLACEHOLDER_REGEX.lastIndex = 0;
        // Split the paragraph into segments: normal text and placeholder text
        const runs: string[] = [];
        let lastIndex = 0;
        let match;
        while ((match = PLACEHOLDER_REGEX.exec(trimmed)) !== null) {
          // Add normal text before the match
          if (match.index > lastIndex) {
            const normalText = escapeXml(trimmed.substring(lastIndex, match.index));
            runs.push('<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="' + fontSize + '"/><w:color w:val="1F2937"/></w:rPr><w:t xml:space="preserve">' + normalText + '</w:t></w:r>');
          }
          // Add the placeholder in red bold
          const placeholderText = escapeXml(match[0]);
          runs.push('<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="' + fontSize + '"/><w:b/><w:color w:val="DC2626"/></w:rPr><w:t xml:space="preserve">' + placeholderText + '</w:t></w:r>');
          lastIndex = match.index + match[0].length;
        }
        PLACEHOLDER_REGEX.lastIndex = 0;
        // Add any remaining normal text after the last match
        if (lastIndex < trimmed.length) {
          const normalText = escapeXml(trimmed.substring(lastIndex));
          runs.push('<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="' + fontSize + '"/><w:color w:val="1F2937"/></w:rPr><w:t xml:space="preserve">' + normalText + '</w:t></w:r>');
        }
        return '<w:p><w:pPr><w:spacing w:after="160"/></w:pPr>' + runs.join('') + '</w:p>';
      }
      // Normal paragraph — no placeholders
      const escaped = escapeXml(trimmed);
      return '<w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="' + fontSize + '"/><w:color w:val="1F2937"/></w:rPr><w:t xml:space="preserve">' + escaped + '</w:t></w:r></w:p>';
    })
    .join("");
}

function kvRowXml(label: string, value: string): string {
  const borderXml = '<w:top w:val="single" w:sz="4" w:color="D1D5DB"/><w:left w:val="single" w:sz="4" w:color="D1D5DB"/><w:bottom w:val="single" w:sz="4" w:color="D1D5DB"/><w:right w:val="single" w:sz="4" w:color="D1D5DB"/>';
  return '<w:tr><w:tc><w:tcPr><w:tcW w:w="3200" w:type="dxa"/><w:tcBorders>' + borderXml + '</w:tcBorders><w:shd w:val="clear" w:fill="F0F4F8"/><w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/><w:b/><w:color w:val="1F2937"/></w:rPr><w:t>' + escapeXml(label) + '</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="6880" w:type="dxa"/><w:tcBorders>' + borderXml + '</w:tcBorders><w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/><w:color w:val="1F2937"/></w:rPr><w:t xml:space="preserve">' + escapeXml(value) + '</w:t></w:r></w:p></w:tc></w:tr>';
}

function kvTableXml(rows: [string, string][]): string {
  return '<w:tbl><w:tblPr><w:tblW w:w="10080" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="3200"/><w:gridCol w:w="6880"/></w:tblGrid>' + rows.map(([l, v]) => kvRowXml(l, v)).join("") + '</w:tbl>';
}

function headingXml(text: string, level: number = 1): string {
  const size = level === 1 ? "28" : level === 2 ? "24" : "22";
  const color = level === 1 ? "1F4E79" : "1F2937";
  const styleId = "Heading" + level;
  const spaceBefore = level === 1 ? "360" : "280";
  const spaceAfter = level === 1 ? "200" : "160";
  return '<w:p><w:pPr><w:pStyle w:val="' + styleId + '"/><w:spacing w:before="' + spaceBefore + '" w:after="' + spaceAfter + '"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="' + size + '"/><w:b/><w:color w:val="' + color + '"/></w:rPr><w:t>' + escapeXml(text) + '</w:t></w:r></w:p>';
}

function pageBreakXml(): string {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

interface CollateralInterview {
  intervieweeName: string;
  intervieweeRole: string;
  method: string;
  date: string;
  templateId: string;
}

interface ReportInput {
  participant: { fullName: string; dob: string; age: string; ndisNumber: string; address: string; primaryContact: string; primaryDiagnosis: string; secondaryDiagnoses: string; };
  clinician: { name: string; qualifications: string; ahpra: string; organisation: string; phoneEmail: string; dateOfAssessment: string; dateOfReport: string; otServicesCommenced: string; };
  presentAtAssessment: string;
  assessmentSetting: string;
  sections: Record<string, string>;
  collateral_interviews?: CollateralInterview[];
  assessments?: Array<{ tool: string; date: string; score: string; classification: string; whySelected: string; }>;
  recommendations?: Array<{ support: string; category: string; currentHours: string; recommendedHours: string; ratio: string; tasks: string; linkedSections: string; }>;
}

function buildDocumentBody(input: ReportInput): string {
  const s = input.sections;
  const p = input.participant;
  const c = input.clinician;
  const parts: string[] = [];

  // Title page
  parts.push('<w:p><w:pPr><w:spacing w:before="2400"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="40"/><w:b/><w:color w:val="1F4E79"/></w:rPr><w:t>FUNCTIONAL CAPACITY ASSESSMENT</w:t></w:r></w:p>');
  parts.push('<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/><w:color w:val="6B7280"/></w:rPr><w:t>Occupational Therapy Report - National Disability Insurance Scheme</w:t></w:r></w:p>');
  parts.push('<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="600"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/><w:b/><w:color w:val="DC2626"/></w:rPr><w:t>CONFIDENTIAL &amp; PRIVILEGED</w:t></w:r></w:p>');

  // Front matter
  parts.push(headingXml("Participant &amp; Report Details"));
  parts.push(headingXml("Participant Details", 2));
  parts.push(kvTableXml([["Full Name", p.fullName],["Date of Birth", p.dob],["Age", p.age],["NDIS Number", p.ndisNumber],["Address", p.address],["Primary Contact / Guardian", p.primaryContact],["Primary Diagnosis", p.primaryDiagnosis],["Secondary Diagnoses", p.secondaryDiagnoses]]));
  parts.push(headingXml("Provider / Clinician Details", 2));
  parts.push(kvTableXml([["Report Author", c.name],["Qualifications", c.qualifications],["AHPRA Registration No.", c.ahpra],["Organisation / Practice", c.organisation],["Phone / Email", c.phoneEmail],["Date of Assessment", c.dateOfAssessment],["Date of Report", c.dateOfReport],["Report Type", "Functional Capacity Assessment (FCA)"],["OT Services Commenced", c.otServicesCommenced]]));
  parts.push(headingXml("Persons Present at Assessment", 2));
  parts.push(kvTableXml([["Present at assessment", input.presentAtAssessment],["Assessment setting", input.assessmentSetting]]));
  parts.push('<w:p><w:pPr><w:spacing w:before="200"/></w:pPr></w:p>');
  parts.push(kvTableXml([["AI Disclosure", "This report was prepared with the assistance of AI writing technology. All clinical observations, assessments, judgements, and recommendations are those of the assessing Occupational Therapist. The AI was used solely to structure and format clinical content."],["Clinical Disclaimer", "This report reflects the clinical opinion of the assessing clinician based on the information provided at the time of assessment and is written to the author\u2019s best knowledge. The assessing clinician reserves the right to review this report and its findings if additional information is provided."]]));

  // v5.1 Section structure
  const earlyMap: [string, string, boolean][] = [
    ["1. Reason for Referral", "section1", true],
    ["2. Background Information", "section2", true],
    ["3. Participant Goals", "section3", true],
    ["4. Diagnoses", "section4", false],
    ["5. Allied Health Case History", "section5", true],
  ];
  for (const [title, key, needsPageBreak] of earlyMap) {
    if (needsPageBreak) parts.push(pageBreakXml());
    parts.push(headingXml(title));
    parts.push(textToDocxXml(s[key] || ""));
  }

  // S6: Collateral Information
  parts.push(pageBreakXml());
  parts.push(headingXml("6. Collateral Information"));
  if (input.collateral_interviews && input.collateral_interviews.length > 0) {
    parts.push(headingXml("6.1 Collateral Sources Summary", 2));
    for (const ci of input.collateral_interviews) {
      parts.push(kvTableXml([
        ["Informant", ci.intervieweeName || "[Not provided]"],
        ["Role / Relationship", ci.intervieweeRole || "[Not specified]"],
        ["Method", ci.method || "[Not specified]"],
        ["Date", ci.date || "[Not specified]"],
      ]));
      parts.push('<w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>');
    }
    parts.push(headingXml("6.2 Collateral Interview Summaries", 2));
    parts.push(textToDocxXml(s["section6"] || s["section6_collateral"] || ""));
  } else {
    parts.push(textToDocxXml(s["section6"] || s["section6_collateral"] || "No collateral interviews were conducted for this assessment."));
  }

  // S7-S11
  const midMap: [string, string, boolean][] = [
    ["7. Methodology", "section7", true],
    ["8. Informal Supports", "section8", true],
    ["9. Home Environment", "section9", false],
    ["10. Social Environment", "section10", true],
    ["11. Typical Week", "section11", false],
  ];
  for (const [title, key, needsPageBreak] of midMap) {
    if (needsPageBreak) parts.push(pageBreakXml());
    parts.push(headingXml(title));
    parts.push(textToDocxXml(s[key] || ""));
  }

  // S12: Risk & Safety Profile
  parts.push(pageBreakXml());
  parts.push(headingXml("12. Risk &amp; Safety Profile"));
  const riskSubs: [string, string][] = [
    ["12.1 Health Risks", "section12_1_risk"],
    ["12.2 Behavioural Risks", "section12_2_risk"],
    ["12.3 Mental Health Risk", "section12_3_risk"],
    ["12.4 Behaviours of Concern", "section12_4_boc"],
    ["12.5 Supervision Requirements", "section12_5_supervision"],
  ];
  if (s["section12"] && !s["section12_1_risk"]) {
    parts.push(textToDocxXml(s["section12"]));
  } else {
    for (const [title, key] of riskSubs) {
      parts.push(headingXml(title, 2));
      parts.push(textToDocxXml(s[key] || ""));
    }
  }

  // S13: Functional Capacity - Domain Observations
  parts.push(pageBreakXml());
  parts.push(headingXml("13. Functional Capacity - Domain Observations"));
  parts.push(textToDocxXml("Each domain below has been assessed from direct clinical observation. Evidence sources are cited per domain."));
  const domains: [string, string][] = [
    ["13.1 Mobility &amp; Upper Limb Function", "section13_1"],
    ["13.2 Transfers", "section13_2"],
    ["13.3 Personal ADLs - Self-Care", "section13_3"],
    ["13.4 Domestic IADLs", "section13_4"],
    ["13.5 Executive IADLs", "section13_5"],
    ["13.6 Cognition", "section13_6"],
    ["13.7 Communication", "section13_7"],
    ["13.8 Social Functioning", "section13_8"],
    ["13.9 Sensory Profile", "section13_9"],
  ];
  for (const [title, key] of domains) {
    parts.push(headingXml(title, 2));
    const oldKey = key.replace("section13_", "section12_");
    parts.push(textToDocxXml(s[key] || s[oldKey] || ""));
  }

  // S14: Standardised Assessments
  parts.push(pageBreakXml());
  parts.push(headingXml("14. Standardised Assessments"));
  if (input.assessments && input.assessments.length > 0) {
    parts.push(headingXml("14.1 Assessment Summary", 2));
    for (const a of input.assessments) {
      parts.push(kvTableXml([["Assessment Tool", a.tool],["Date Administered", a.date],["Score / Result", a.score],["Classification", a.classification],["Why Selected", a.whySelected]]));
      parts.push('<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>');
    }
  }
  if (s.section14 || s.section13) {
    parts.push(headingXml("14.2 Assessment Interpretations", 2));
    parts.push(textToDocxXml(s.section14 || s.section13 || ""));
  }

  // S15: Limitations & Barriers
  parts.push(pageBreakXml());
  parts.push(headingXml("15. Limitations &amp; Barriers to Progress"));
  parts.push(textToDocxXml(s.section15 || s.section14 || ""));

  // S16: Functional Impact Summary
  parts.push(headingXml("16. Functional Impact Summary"));
  parts.push(textToDocxXml(s.section16 || s.section15 || ""));

  // S17: Recommendations
  parts.push(pageBreakXml());
  parts.push(headingXml("17. Recommendations"));
  parts.push(textToDocxXml("Each recommendation below is linked to functional needs identified in this assessment. All recommendations are considered reasonable and necessary under Section 34 of the National Disability Insurance Scheme Act 2013."));
  if (input.recommendations && input.recommendations.length > 0) {
    parts.push(headingXml("17.1 Recommendations Summary", 2));
    for (const r of input.recommendations) {
      parts.push(kvTableXml([["Support", r.support],["NDIS Category", r.category],["Current Provision", r.currentHours],["Recommended Provision", r.recommendedHours],["Support Ratio", r.ratio],["Tasks Covered", r.tasks],["Linked Report Sections", r.linkedSections]]));
      parts.push('<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>');
    }
  }
  if (s.section17 || s.section16) {
    parts.push(headingXml("17.2 Recommendation Narratives", 2));
    parts.push(textToDocxXml(s.section17 || s.section16 || ""));
  }

  // S18: Risks of Insufficient Funding
  parts.push(pageBreakXml());
  parts.push(headingXml("18. Risks of Insufficient Funding"));
  parts.push(textToDocxXml(s.section18 || s.section17 || ""));

  // S19: Review & Monitoring Plan
  parts.push(headingXml("19. Review &amp; Monitoring Plan"));
  parts.push(textToDocxXml(s.section19 || s.section18 || ""));

  // S20: Statement of Reasonable and Necessary Supports
  parts.push(pageBreakXml());
  parts.push(headingXml("20. Statement of Reasonable and Necessary Supports"));
  parts.push(textToDocxXml(s.section20 || s.section19 || ""));

  // Sign-off
  parts.push(headingXml("Clinician Sign-Off"));
  parts.push(kvTableXml([["Report Author", c.name],["Signature", ""],["Date", c.dateOfReport],["AHPRA Registration", c.ahpra],["Organisation", c.organisation],["Contact", c.phoneEmail]]));
  parts.push('<w:p><w:pPr><w:spacing w:before="200"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="16"/><w:i/><w:color w:val="6B7280"/></w:rPr><w:t xml:space="preserve">This report has been prepared in accordance with the NDIS Practice Standards and the Occupational Therapy Australia Code of Ethics.</w:t></w:r></w:p>');

  return parts.join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") { return new Response("ok", { headers: corsHeaders }); }
  try {
    const input: ReportInput = await req.json();
    if (!input.participant?.fullName) { return new Response(JSON.stringify({ error: "participant.fullName is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
    const sb = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { data: fileData, error: fileError } = await sb.storage.from(BUCKET).download(TEMPLATE_FILE);
    if (fileError || !fileData) { return new Response(JSON.stringify({ error: "Could not load template", details: fileError?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
    const zip = await JSZip.loadAsync(await fileData.arrayBuffer());
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (!docXml) { return new Response(JSON.stringify({ error: "No word/document.xml" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
    const newBody = buildDocumentBody(input);
    const bodyStartTag = "<w:body>"; const bodyEndTag = "</w:body>";
    const bodyStart = docXml.indexOf(bodyStartTag); const bodyEnd = docXml.indexOf(bodyEndTag);
    let newDocXml: string;
    if (bodyStart !== -1 && bodyEnd !== -1) {
      const originalBody = docXml.substring(bodyStart + bodyStartTag.length, bodyEnd);
      const sectPrMatch = originalBody.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
      const sectPr = sectPrMatch ? sectPrMatch[0] : "";
      newDocXml = docXml.substring(0, bodyStart + bodyStartTag.length) + newBody + sectPr + docXml.substring(bodyEnd);
    } else { newDocXml = docXml.replace(/<w:body>[\s\S]*<\/w:body>/, "<w:body>" + newBody + "</w:body>"); }
    zip.file("word/document.xml", newDocXml);
    const docxBytes: Uint8Array = await zip.generateAsync({ type: "uint8array" });
    let binary = ""; for (let i = 0; i < docxBytes.length; i++) { binary += String.fromCharCode(docxBytes[i]); }
    const base64 = btoa(binary);
    const fileName = "FCA_" + input.participant.fullName.replace(/\s+/g, "_") + "_" + (input.clinician.dateOfReport || new Date().toISOString().slice(0, 10)) + ".docx";
    return new Response(JSON.stringify({ success: true, file: base64, fileName: fileName }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
});
