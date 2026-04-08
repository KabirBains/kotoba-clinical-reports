import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "report-documents";
const TEMPLATE_FILE = "OT_FCA_Template_v4.1.docx";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function textToDocxXml(text: string, fontSize: string = "20"): string {
  if (!text || text.trim() === "") {
    return '<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="' + fontSize + '"/><w:i/><w:color w:val="9CA3AF"/></w:rPr><w:t>[Section not yet completed]</w:t></w:r></w:p>';
  }
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  return paragraphs
    .map((para) => {
      const escaped = escapeXml(para.trim());
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

interface ReportInput {
  participant: {
    fullName: string;
    dob: string;
    age: string;
    ndisNumber: string;
    address: string;
    primaryContact: string;
    primaryDiagnosis: string;
    secondaryDiagnoses: string;
  };
  clinician: {
    name: string;
    qualifications: string;
    ahpra: string;
    organisation: string;
    phoneEmail: string;
    dateOfAssessment: string;
    dateOfReport: string;
    otServicesCommenced: string;
  };
  presentAtAssessment: string;
  assessmentSetting: string;
  sections: Record<string, string>;
  assessments?: Array<{
    tool: string;
    date: string;
    score: string;
    classification: string;
    whySelected: string;
  }>;
  recommendations?: Array<{
    support: string;
    category: string;
    currentHours: string;
    recommendedHours: string;
    ratio: string;
    tasks: string;
    linkedSections: string;
  }>;
}

function buildDocumentBody(input: ReportInput): string {
  const s = input.sections;
  const p = input.participant;
  const c = input.clinician;
  const parts: string[] = [];

  parts.push('<w:p><w:pPr><w:spacing w:before="2400"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="40"/><w:b/><w:color w:val="1F4E79"/></w:rPr><w:t>FUNCTIONAL CAPACITY ASSESSMENT</w:t></w:r></w:p>');
  parts.push('<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/><w:color w:val="6B7280"/></w:rPr><w:t>Occupational Therapy Report - National Disability Insurance Scheme</w:t></w:r></w:p>');
  parts.push('<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="600"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/><w:b/><w:color w:val="DC2626"/></w:rPr><w:t>CONFIDENTIAL &amp; PRIVILEGED</w:t></w:r></w:p>');

  parts.push(headingXml("Participant &amp; Report Details"));
  parts.push(headingXml("Participant Details", 2));
  parts.push(kvTableXml([
    ["Full Name", p.fullName], ["Date of Birth", p.dob], ["Age", p.age],
    ["NDIS Number", p.ndisNumber], ["Address", p.address],
    ["Primary Contact / Guardian", p.primaryContact],
    ["Primary Diagnosis", p.primaryDiagnosis],
    ["Secondary Diagnoses", p.secondaryDiagnoses],
  ]));

  parts.push(headingXml("Provider / Clinician Details", 2));
  parts.push(kvTableXml([
    ["Report Author", c.name], ["Qualifications", c.qualifications],
    ["AHPRA Registration No.", c.ahpra], ["Organisation / Practice", c.organisation],
    ["Phone / Email", c.phoneEmail], ["Date of Assessment", c.dateOfAssessment],
    ["Date of Report", c.dateOfReport], ["Report Type", "Functional Capacity Assessment (FCA)"],
    ["OT Services Commenced", c.otServicesCommenced],
  ]));

  parts.push(headingXml("Persons Present at Assessment", 2));
  parts.push(kvTableXml([
    ["Present at assessment", input.presentAtAssessment],
    ["Assessment setting", input.assessmentSetting],
  ]));

  parts.push('<w:p><w:pPr><w:spacing w:before="200"/></w:pPr></w:p>');
  parts.push(kvTableXml([
    ["AI Disclosure", "This report was prepared with the assistance of AI writing technology. All clinical observations, assessments, judgements, and recommendations are those of the assessing Occupational Therapist. The AI was used solely to structure and format clinical content."],
  ]));

  const sectionMap: [string, string, boolean][] = [
    ["1. Reason for Referral", "section1", true],
    ["2. Background Information", "section2", true],
    ["3. Participant Goals", "section3", true],
    ["4. Diagnoses", "section4", false],
    ["5. Allied Health Case History", "section5", true],
    ["6. Methodology", "section6", false],
    ["7. Informal Supports", "section7", true],
    ["8. Home Environment", "section8", false],
    ["9. Social Environment", "section9", true],
    ["10. Typical Week", "section10", false],
    ["11. Risk &amp; Safety Profile", "section11", false],
  ];

  for (const [title, key, needsPageBreak] of sectionMap) {
    if (needsPageBreak) parts.push(pageBreakXml());
    parts.push(headingXml(title));
    parts.push(textToDocxXml(s[key] || ""));
  }

  parts.push(pageBreakXml());
  parts.push(headingXml("12. Functional Capacity - Domain Observations"));
  parts.push(textToDocxXml("Each domain below has been assessed from direct clinical observation. The functional rating scale used throughout is: Independent | Prompting Required | Assistance Required | Fully Dependent."));

  const domains: [string, string][] = [
    ["12.1 Mobility &amp; Upper Limb Function", "section12_1"],
    ["12.2 Transfers", "section12_2"],
    ["12.3 Personal ADLs - Self-Care", "section12_3"],
    ["12.4 Domestic IADLs", "section12_4"],
    ["12.5 Executive IADLs", "section12_5"],
    ["12.6 Cognition", "section12_6"],
    ["12.7 Communication", "section12_7"],
    ["12.8 Social Functioning", "section12_8"],
    ["12.9 Sensory Profile", "section12_9"],
  ];

  for (const [title, key] of domains) {
    parts.push(headingXml(title, 2));
    parts.push(textToDocxXml(s[key] || ""));
  }

  parts.push(pageBreakXml());
  parts.push(headingXml("13. Standardised Assessments"));

  if (input.assessments && input.assessments.length > 0) {
    parts.push(headingXml("13.1 Assessment Summary", 2));
    for (const a of input.assessments) {
      parts.push(kvTableXml([
        ["Assessment Tool", a.tool],
        ["Date Administered", a.date],
        ["Score / Result", a.score],
        ["Classification", a.classification],
        ["Why Selected", a.whySelected],
      ]));
      parts.push('<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>');
    }
  }

  if (s.section13) {
    parts.push(headingXml("13.2 Assessment Interpretations", 2));
    parts.push(textToDocxXml(s.section13));
  }

  parts.push(pageBreakXml());
  parts.push(headingXml("14. Limitations &amp; Barriers to Progress"));
  parts.push(textToDocxXml(s.section14 || ""));

  parts.push(headingXml("15. Functional Impact Summary"));
  parts.push(textToDocxXml(s.section15 || ""));

  parts.push(pageBreakXml());
  parts.push(headingXml("16. Recommendations"));
  parts.push(textToDocxXml("Each recommendation below is linked to functional needs identified in this assessment. All recommendations are considered reasonable and necessary under Section 34 of the National Disability Insurance Scheme Act 2013."));

  if (input.recommendations && input.recommendations.length > 0) {
    parts.push(headingXml("16.1 Recommendations Summary", 2));
    for (const r of input.recommendations) {
      parts.push(kvTableXml([
        ["Support", r.support],
        ["NDIS Category", r.category],
        ["Current Provision", r.currentHours],
        ["Recommended Provision", r.recommendedHours],
        ["Support Ratio", r.ratio],
        ["Tasks Covered", r.tasks],
        ["Linked Report Sections", r.linkedSections],
      ]));
      parts.push('<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>');
    }
  }

  if (s.section16) {
    parts.push(headingXml("16.2 Recommendation Narratives", 2));
    parts.push(textToDocxXml(s.section16));
  }

  parts.push(pageBreakXml());
  parts.push(headingXml("17. Risks of Insufficient Funding"));
  parts.push(textToDocxXml(s.section17 || ""));

  parts.push(headingXml("18. Review &amp; Monitoring Plan"));
  parts.push(textToDocxXml(s.section18 || ""));

  parts.push(pageBreakXml());
  parts.push(headingXml("19. Statement of Reasonable and Necessary Supports"));
  parts.push(textToDocxXml(s.section19 || ""));

  parts.push(headingXml("Clinician Sign-Off"));
  parts.push(kvTableXml([
    ["Report Author", c.name],
    ["Signature", ""],
    ["Date", c.dateOfReport],
    ["AHPRA Registration", c.ahpra],
    ["Organisation", c.organisation],
    ["Contact", c.phoneEmail],
  ]));

  parts.push('<w:p><w:pPr><w:spacing w:before="200"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="16"/><w:i/><w:color w:val="6B7280"/></w:rPr><w:t xml:space="preserve">This report has been prepared in accordance with the NDIS Practice Standards and the Occupational Therapy Australia Code of Ethics. This report was prepared with the assistance of AI writing technology. All clinical observations, assessments, judgements, and recommendations contained herein are those of the assessing Occupational Therapist. The report author has reviewed all content and confirms it reflects their professional clinical judgement and meets NDIS reporting standards.</w:t></w:r></w:p>');

  return parts.join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const input: ReportInput = await req.json();

    if (!input.participant?.fullName) {
      return new Response(
        JSON.stringify({ error: "participant.fullName is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { data: fileData, error: fileError } = await sb.storage.from(BUCKET).download(TEMPLATE_FILE);

    if (fileError || !fileData) {
      return new Response(
        JSON.stringify({
          error: "Could not load template from Storage",
          details: fileError?.message,
          fix: "Upload " + TEMPLATE_FILE + " to the '" + BUCKET + "' bucket",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const zip = await JSZip.loadAsync(await fileData.arrayBuffer());
    const docXml = await zip.file("word/document.xml")?.async("string");

    if (!docXml) {
      return new Response(
        JSON.stringify({ error: "Template .docx has no word/document.xml" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newBody = buildDocumentBody(input);

    const bodyStartTag = "<w:body>";
    const bodyEndTag = "</w:body>";
    const bodyStart = docXml.indexOf(bodyStartTag);
    const bodyEnd = docXml.indexOf(bodyEndTag);

    let newDocXml: string;
    if (bodyStart !== -1 && bodyEnd !== -1) {
      const originalBody = docXml.substring(bodyStart + bodyStartTag.length, bodyEnd);
      const sectPrMatch = originalBody.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
      const sectPr = sectPrMatch ? sectPrMatch[0] : "";

      newDocXml =
        docXml.substring(0, bodyStart + bodyStartTag.length) +
        newBody +
        sectPr +
        docXml.substring(bodyEnd);
    } else {
      newDocXml = docXml.replace(/<w:body>[\s\S]*<\/w:body>/, "<w:body>" + newBody + "</w:body>");
    }

    zip.file("word/document.xml", newDocXml);
    const docxBytes: Uint8Array = await zip.generateAsync({ type: "uint8array" });

    let binary = "";
    for (let i = 0; i < docxBytes.length; i++) {
      binary += String.fromCharCode(docxBytes[i]);
    }
    const base64 = btoa(binary);

    const fileName = "FCA_" + input.participant.fullName.replace(/\s+/g, "_") + "_" + (input.clinician.dateOfReport || new Date().toISOString().slice(0, 10)) + ".docx";

    return new Response(
      JSON.stringify({ success: true, file: base64, fileName: fileName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
