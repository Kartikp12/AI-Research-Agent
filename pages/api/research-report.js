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
            num_predict: 800,
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

    console.error(
      "Invalid Ollama JSON:",
      rawResponse
    );

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

    /*
      Step 1:
      Run complete research pipeline
    */

    const researchResponse =
      await fetch(
        `${
          process.env.NEXT_PUBLIC_BASE_URL ||
          "http://localhost:3000"
        }/api/research`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question:
              question.trim(),
          }),
        }
      );

    const researchData =
      await researchResponse.json();

    if (!researchResponse.ok) {
      throw new Error(
        researchData?.details ||
          researchData?.error ||
          "Research pipeline failed"
      );
    }

    if (
      !Array.isArray(
        researchData.findings
      ) ||
      researchData.findings.length === 0
    ) {
      throw new Error(
        "No research findings were generated"
      );
    }

    /*
      Step 2:
      Build compact report context
    */

    const findingsContext =
      researchData.findings
        .map(
          (finding, index) => `
RESEARCH AREA ${index + 1}

Sub-question:
${finding.subQuestion}

Sufficiency:
${
  finding.sufficiency?.sufficient
    ? "Sufficient"
    : "Insufficient"
}

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

Verification:
${item.verification?.status || "unknown"}

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

    /*
      Step 3:
      Generate final report
    */

    const reportPrompt = `
You are a research report generator.

Original research question:
${question.trim()}

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
      await askOllama(
        reportPrompt
      );

    /*
      Step 4:
      Collect unique sources
    */

    const sourceMap =
      new Map();

    for (
      const finding of researchData.findings
    ) {
      for (
        const claim of finding.claims || []
      ) {
        const source =
          claim.source;

        if (
          source?.url &&
          !sourceMap.has(source.url)
        ) {
          sourceMap.set(
            source.url,
            {
              title:
                source.title ||
                "Unknown source",
              url: source.url,
              domain:
                source.domain || "",
              sourceQuality:
                source.sourceQuality ||
                "medium",
            }
          );
        }
      }
    }

    return res.status(200).json({
      question:
        researchData.question,

      subQuestions:
        researchData.subQuestions,

      findings:
        researchData.findings,

      report,

      sources:
        Array.from(
          sourceMap.values()
        ),
    });
  } catch (error) {
    console.error(
      "Research report API error:",
      error
    );

    return res.status(500).json({
      error:
        "Research report generation failed",

      details:
        error.message,
    });
  }
}