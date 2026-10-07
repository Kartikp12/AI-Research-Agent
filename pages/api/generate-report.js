const OLLAMA_URL =
  "http://127.0.0.1:11434/api/generate";

const MODEL = "qwen3:4b";

async function askOllama(prompt) {
  const response = await fetch(
    OLLAMA_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        format: "json",
        think: false,
        options: {
          num_predict: 500,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      errorText ||
        "Ollama request failed"
    );
  }

  const data =
    await response.json();

  if (!data.response) {
    throw new Error(
      "Ollama returned an empty response"
    );
  }

  const rawResponse =
    data.response.trim();

  try {
    return JSON.parse(rawResponse);
  } catch {
    console.error(
      "Invalid Ollama JSON:",
      rawResponse
    );

    const start =
      rawResponse.indexOf("{");

    const end =
      rawResponse.lastIndexOf("}");

    if (
      start !== -1 &&
      end !== -1 &&
      end > start
    ) {
      try {
        return JSON.parse(
          rawResponse.slice(
            start,
            end + 1
          )
        );
      } catch {
        // Continue to error
      }
    }

    throw new Error(
      "Invalid Ollama JSON response"
    );
  }
}

export default async function handler(
  req,
  res
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const {
      question,
      findings,
    } = req.body;

    if (
      !question ||
      !question.trim()
    ) {
      return res.status(400).json({
        error:
          "Research question is required",
      });
    }

    if (
      !Array.isArray(findings) ||
      findings.length === 0
    ) {
      return res.status(400).json({
        error:
          "Research findings are required",
      });
    }

    const findingsContext =
      findings
        .map(
          (finding, index) => `
RESEARCH AREA ${index + 1}

Sub-question:
${finding.subQuestion}

Sufficiency:
${finding.sufficiency?.sufficient
  ? "Sufficient"
  : "Insufficient"}

Claims:
${(finding.claims || [])
  .map(
    (item, claimIndex) => `
Claim ${claimIndex + 1}:
${item.claim}

Evidence:
${item.evidence}

Source:
${item.source?.title || "Unknown source"}

URL:
${item.source?.url || ""}

Domain:
${item.source?.domain || ""}

Source quality:
${item.source?.sourceQuality || "medium"}

Verification:
${item.verification?.status || "unknown"}

Supporting sources:
${item.verification?.supportingSources || 0}

Contradicting sources:
${item.verification?.contradictingSources || 0}

Reason:
${item.verification?.reason || ""}
`
  )
  .join("\n")}
`
        )
        .join(
          "\n============================\n"
        );

    const prompt = `
You are a research report generator.

Original research question:
${question}

Verified research findings:
${findingsContext}

Create a concise research report using ONLY the provided findings.

IMPORTANT RULES:
- Do not use outside knowledge.
- Do not invent facts.
- Do not invent sources.
- Do not invent URLs.
- Keep claims faithful to the evidence.
- If evidence is insufficient, clearly mention that.
- Distinguish evidence from interpretation.
- Use the provided source titles and URLs.
- Keep the report concise and useful.
- Return ONLY valid JSON.

Required JSON format:

{
  "title": "research report title",
  "executiveSummary": "short summary",
  "keyFindings": [
    "finding 1",
    "finding 2",
    "finding 3"
  ],
  "detailedAnalysis": [
    {
      "topic": "topic name",
      "analysis": "evidence-based analysis"
    }
  ],
  "limitations": [
    "limitation 1",
    "limitation 2"
  ],
  "conclusion": "short evidence-based conclusion"
}
`;

    const report =
      await askOllama(prompt);

    return res.status(200).json({
      question,
      report,
      sources: findings.flatMap(
        (finding) =>
          (finding.claims || [])
            .filter(
              (item) =>
                item.source?.url
            )
            .map(
              (item) => ({
                title:
                  item.source.title,
                url:
                  item.source.url,
                domain:
                  item.source.domain,
                sourceQuality:
                  item.source
                    .sourceQuality,
              })
            )
      ),
    });
  } catch (error) {
    console.error(
      "Report generation error:",
      error
    );

    return res.status(500).json({
      error:
        "Report generation failed",
      details:
        error.message,
    });
  }
}