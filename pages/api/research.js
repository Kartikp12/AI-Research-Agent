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

    // ==================================================
    // 1. RESEARCH PLANNER
    // ==================================================

    const planningPrompt = `
You are a research planning system.

User research question:
${question}

Break this question into 2 to 5 focused research sub-questions.

Rules:
- Cover the important aspects of the original question.
- Each sub-question should investigate a different aspect.
- Keep questions concise.
- Do not answer the questions.
- Return ONLY valid JSON.

Required format:
{
  "subQuestions": [
    "question 1",
    "question 2",
    "question 3"
  ]
}
`;

    const planningResponse = await fetch(
      "http://127.0.0.1:11434/api/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen3:4b",
          prompt: planningPrompt,
          stream: false,
          format: "json",
          think: false,
          options: {
            num_predict: 120,
          },
        }),
      }
    );

    if (!planningResponse.ok) {
      const errorText = await planningResponse.text();

      return res.status(500).json({
        error: "Research planning failed",
        details: errorText,
      });
    }

    const planningData = await planningResponse.json();

    let plan;

    try {
      plan = JSON.parse(planningData.response);
    } catch (error) {
      return res.status(500).json({
        error: "Invalid planner JSON",
        rawResponse: planningData.response,
      });
    }

    const subQuestions = Array.isArray(plan.subQuestions)
      ? plan.subQuestions
      : [];

    if (!subQuestions.length) {
      return res.status(500).json({
        error: "Planner returned no sub-questions",
      });
    }

    // ==================================================
    // 2. WEB RESEARCH
    // ==================================================

    const researchResults = [];

    for (const subQuestion of subQuestions) {
      if (!subQuestion || !subQuestion.trim()) {
        continue;
      }

      console.log(`Searching: ${subQuestion}`);

      const sources = await searchWeb(subQuestion.trim());

      researchResults.push({
        subQuestion,
        sources,
      });
    }

    // ==================================================
    // 3. CLAIM EXTRACTION + VERIFICATION
    // ==================================================

    const findings = [];

    for (const researchItem of researchResults) {
      const subQuestion = researchItem.subQuestion;

      const sources = Array.isArray(researchItem.sources)
        ? researchItem.sources
        : [];

      if (!subQuestion || !sources.length) {
        continue;
      }

      // ------------------------------------------------
      // Build compact source context
      // ------------------------------------------------

      const sourceContext = sources
        .slice(0, 3)
        .map((source) => {
          return `
SOURCE [${source.id}]
Title: ${source.title}

Content:
${source.content?.slice(0, 700) || ""}
`;
        })
        .join("\n-----------------\n");

      // ------------------------------------------------
      // Extract claims
      // ------------------------------------------------

      const extractionPrompt = `
You are an evidence extraction system.

Research sub-question:
${subQuestion}

Sources:
${sourceContext}

Extract up to 2 important factual claims that directly help answer the research sub-question.

Rules:
- Use ONLY the provided sources.
- Do not use outside knowledge.
- Do not invent facts.
- Maximum 2 claims.
- Keep each claim under 12 words.
- Keep each evidence under 18 words.
- sourceId must identify the source supporting the claim.
- Return ONLY valid JSON.
- Keep the JSON response very short.

Required JSON:
{
  "claims": [
    {
      "claim": "short factual claim",
      "evidence": "short supporting evidence",
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
              num_predict: 160,
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
        "Extraction response:",
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

      // ------------------------------------------------
      // Verify claims
      // ------------------------------------------------

      const verifiedClaims = [];

      for (const claimItem of claims) {
        const source = sources.find(
          (item) => item.id === claimItem.sourceId
        );

        if (!source) {
          verifiedClaims.push({
            ...claimItem,
            verification: {
              status: "unsupported",
              reason: "Referenced source was not found",
            },
          });

          continue;
        }

        const verificationPrompt = `
You are an evidence verification system.

Research sub-question:
${subQuestion}

Claim:
${claimItem.claim}

Evidence:
${claimItem.evidence}

Source content:
${source.content?.slice(0, 700) || ""}

Determine whether the source content directly supports the claim.

Allowed status values:
- supported
- partially_supported
- unsupported

Rules:
- Use ONLY the provided source content.
- Do not use outside knowledge.
- Do not invent information.
- Keep the reason under 15 words.
- Return ONLY valid JSON.

Required JSON:
{
  "status": "supported",
  "reason": "short explanation"
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
                num_predict: 100,
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

        const verificationData =
          await verificationResponse.json();

        console.log(
          "Verification response:",
          verificationData.response
        );

        let verification;

        try {
          verification = JSON.parse(
            verificationData.response
          );
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

        verifiedClaims.push({
          ...claimItem,
          source: {
            title: source.title,
            url: source.url,
          },
          verification: {
            status: verification.status || "unsupported",
            reason:
              verification.reason ||
              "No verification reason provided",
          },
        });
      }

      findings.push({
        subQuestion,
        claims: verifiedClaims,
      });
    }

    // ==================================================
    // 4. FINAL RESPONSE
    // ==================================================

    return res.status(200).json({
      question,
      subQuestions,
      researchResults,
      findings,
    });
  } catch (error) {
    console.error("Research API error:", error);

    return res.status(500).json({
      error: "Research pipeline failed",
      details: error.message,
    });
  }
}