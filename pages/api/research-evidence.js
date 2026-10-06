import { searchWeb } from "../../lib/search";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        error: "Research question is required",
      });
    }

    // --------------------------------------------------
    // 1. Search web
    // --------------------------------------------------

    const sources = await searchWeb(question.trim());

    if (!sources.length) {
      return res.status(404).json({
        error: "No sources found",
      });
    }

    const selectedSources = sources.slice(0, 3);

    // --------------------------------------------------
    // 2. Build compact source context
    // --------------------------------------------------

    const sourceContext = selectedSources
      .map((source) => {
        return `
SOURCE [${source.id}]
Title: ${source.title}

Content:
${source.content.slice(0, 700)}
`;
      })
      .join("\n-----------------\n");

    // --------------------------------------------------
    // 3. Extract claims
    // --------------------------------------------------

    const extractionPrompt = `
Extract up to 2 factual claims from the sources below.

Question:
${question}

Sources:
${sourceContext}

Rules:
- Use ONLY the provided sources.
- Do not use outside knowledge.
- Do not invent facts.
- Maximum 2 claims.
- Keep each claim under 15 words.
- Keep each evidence under 20 words.
- Return ONLY valid JSON.

Required JSON:
{
  "claims": [
    {
      "claim": "short factual claim",
      "evidence": "short supporting evidence from source",
      "sourceId": 1
    }
  ]
}
`;

    const extractionResponse = await fetch(
      "http://127.0.0.1:11434/api/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen3:4b",
          prompt: extractionPrompt,
          stream: false,
          format: "json",
          think: false,
          options: {
            num_predict: 120,
          },
        }),
      }
    );

    if (!extractionResponse.ok) {
      const errorText = await extractionResponse.text();

      return res.status(500).json({
        error: "Evidence extraction failed",
        details: errorText,
      });
    }

    const extractionData = await extractionResponse.json();

    console.log(
      "Ollama extraction response:",
      extractionData.response
    );

    let extracted;

    try {
      extracted = JSON.parse(extractionData.response);
    } catch (error) {
      console.error(
        "Invalid extraction JSON:",
        extractionData.response
      );

      return res.status(500).json({
        error: "Invalid extraction JSON",
        rawResponse: extractionData.response,
      });
    }

    const claims = Array.isArray(extracted.claims)
      ? extracted.claims
      : [];

    // --------------------------------------------------
    // 4. If no claims
    // --------------------------------------------------

    if (!claims.length) {
      return res.status(200).json({
        question,
        claims: [],
        sources: selectedSources,
      });
    }

    // --------------------------------------------------
    // 5. Prepare verification context
    // --------------------------------------------------

    const verificationContext = claims
      .map((item, index) => {
        const source = selectedSources.find(
          (source) => source.id === item.sourceId
        );

        return `
CLAIM ${index + 1}
Claim: ${item.claim}
Evidence: ${item.evidence}

Source content:
${source?.content?.slice(0, 700) || "Source not found"}
`;
      })
      .join("\n-----------------\n");

    // --------------------------------------------------
    // 6. Verify all claims in ONE Ollama call
    // --------------------------------------------------

    const verificationPrompt = `
Verify whether each claim is directly supported by its source content.

Research question:
${question}

Claims:
${verificationContext}

Allowed status:
- supported
- partially_supported
- unsupported

Rules:
- Use ONLY the provided source content.
- Do not use outside knowledge.
- Do not invent information.
- Keep the reason short.
- Return ONLY valid JSON.

Required JSON:
{
  "verifications": [
    {
      "claimNumber": 1,
      "status": "supported",
      "reason": "short explanation"
    }
  ]
}
`;

    const verificationResponse = await fetch(
      "http://127.0.0.1:11434/api/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen3:4b",
          prompt: verificationPrompt,
          stream: false,
          format: "json",
          think: false,
          options: {
            num_predict: 150,
          },
        }),
      }
    );

    if (!verificationResponse.ok) {
      const errorText = await verificationResponse.text();

      return res.status(500).json({
        error: "Evidence verification failed",
        details: errorText,
      });
    }

    const verificationData = await verificationResponse.json();

    console.log(
      "Ollama verification response:",
      verificationData.response
    );

    let verification;

    try {
      verification = JSON.parse(verificationData.response);
    } catch (error) {
      console.error(
        "Invalid verification JSON:",
        verificationData.response
      );

      return res.status(500).json({
        error: "Invalid verification JSON",
        rawResponse: verificationData.response,
      });
    }

    // --------------------------------------------------
    // 7. Combine claims + verification
    // --------------------------------------------------

    const verifiedClaims = claims.map((claim, index) => {
      const result = (verification.verifications || []).find(
        (item) => item.claimNumber === index + 1
      );

      return {
        ...claim,
        verification: {
          status: result?.status || "unsupported",
          reason: result?.reason || "No verification result",
        },
      };
    });

    // --------------------------------------------------
    // 8. Final response
    // --------------------------------------------------

    return res.status(200).json({
      question,
      claims: verifiedClaims,
      sources: selectedSources,
    });
  } catch (error) {
    console.error("Research evidence error:", error);

    return res.status(500).json({
      error: "Research evidence pipeline failed",
      details: error.message,
    });
  }
}