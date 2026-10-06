import { searchWeb } from "../../lib/search";
import { processSources } from "../../lib/source-quality";

const OLLAMA_URL = "http://127.0.0.1:11434/api/generate";
const MODEL = "qwen3:4b";

/* -----------------------------
   Ollama Helper
----------------------------- */

async function askOllama(prompt, numPredict) {
  const response = await fetch(OLLAMA_URL, {
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
        num_predict: numPredict,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      errorText || "Ollama request failed"
    );
  }

  const data = await response.json();

  if (!data.response) {
    console.error("Empty Ollama response:", data);
    throw new Error("Ollama returned an empty response");
  }

  const rawResponse = data.response.trim();

  try {
    return JSON.parse(rawResponse);
  } catch (error) {
    console.error(
      "Invalid Ollama JSON:",
      rawResponse
    );

    // Try extracting JSON object if extra text was returned
    const start = rawResponse.indexOf("{");
    const end = rawResponse.lastIndexOf("}");

    if (start !== -1 && end !== -1 && end > start) {
      const possibleJson = rawResponse.slice(
        start,
        end + 1
      );

      try {
        return JSON.parse(possibleJson);
      } catch {
        // Continue to final error
      }
    }

    throw new Error(
      "Invalid Ollama JSON response"
    );
  }
}

/* -----------------------------
   Claim Extraction
----------------------------- */

async function extractClaims(
  subQuestion,
  sources
) {
  const sourceContext = sources
    .slice(0, 3)
    .map(
      (source) => `
SOURCE [${source.id}]
Title: ${source.title}
Domain: ${source.domain || ""}
Quality: ${source.sourceQuality || "medium"}

Content:
${source.content?.slice(0, 700) || ""}
`
    )
    .join("\n-----------------\n");

  const prompt = `
You are an evidence extraction system.

Research sub-question:
${subQuestion}

Sources:
${sourceContext}

Extract up to 2 important factual claims that directly help answer the question.

Rules:
- Use ONLY the provided sources.
- Do not use outside knowledge.
- Do not invent facts.
- Maximum 2 claims.
- Claim under 12 words.
- Evidence under 18 words.
- sourceId must match the source ID.
- Return ONLY valid JSON.

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

  const result = await askOllama(
    prompt,
    150
  );

  return Array.isArray(result.claims)
    ? result.claims
    : [];
}

/* -----------------------------
   Claim Verification
----------------------------- */

async function verifyClaim(
  subQuestion,
  claimItem,
  sources
) {
  const sourceContext = sources
    .slice(0, 5)
    .map(
      (source) => `
SOURCE ${source.id}
Title: ${source.title}
Domain: ${source.domain || ""}
Quality: ${source.sourceQuality || "medium"}

Content:
${source.content?.slice(0, 500) || ""}
`
    )
    .join("\n-----------------\n");

  const prompt = `
You are a multi-source evidence verification system.

Research sub-question:
${subQuestion}

Claim:
${claimItem.claim}

Evidence:
${claimItem.evidence}

Sources:
${sourceContext}

Evaluate the claim against the provided sources.

Rules:
- Use ONLY provided sources.
- Do not use outside knowledge.
- Missing information is NOT contradiction.
- Count supporting sources.
- Count contradicting sources.
- Keep reason under 20 words.
- Return ONLY valid JSON.

Allowed statuses:
- strongly_supported
- supported
- partially_supported
- conflicting
- insufficient_evidence

Required JSON:
{
  "status": "supported",
  "supportingSources": 1,
  "contradictingSources": 0,
  "reason": "short explanation"
}
`;

  return await askOllama(
    prompt,
    110
  );
}

/* -----------------------------
   Lightweight Sufficiency
   No Ollama call
----------------------------- */

function evaluateSufficiency(
  verifiedClaims
) {
  if (!verifiedClaims.length) {
    return {
      sufficient: false,
      reason:
        "No verified claims were found.",
    };
  }

  const hasConflict =
    verifiedClaims.some(
      (item) =>
        item.verification.status ===
        "conflicting"
    );

  if (hasConflict) {
    return {
      sufficient: false,
      reason:
        "Conflicting evidence was detected.",
    };
  }

  const hasWeakEvidence =
    verifiedClaims.some(
      (item) =>
        item.verification.status ===
          "insufficient_evidence" ||
        item.verification.status ===
          "partially_supported"
    );

  if (hasWeakEvidence) {
    return {
      sufficient: false,
      reason:
        "Some claims are not sufficiently supported.",
    };
  }

  const strongClaims =
    verifiedClaims.filter(
      (item) =>
        item.verification.status ===
        "strongly_supported"
    );

  const supportedClaims =
    verifiedClaims.filter(
      (item) =>
        item.verification.status ===
        "supported"
    );

  // One strongly supported claim is enough
  if (strongClaims.length >= 1) {
    return {
      sufficient: true,
      reason:
        "At least one claim has strong supporting evidence.",
    };
  }

  // Two supported claims are enough
  if (supportedClaims.length >= 2) {
    return {
      sufficient: true,
      reason:
        "Multiple claims have supporting evidence.",
    };
  }

  // One supported claim
  if (supportedClaims.length === 1) {
    const quality =
      supportedClaims[0]?.source
        ?.sourceQuality;

    if (quality === "high") {
      return {
        sufficient: true,
        reason:
          "The claim is supported by a high-quality source.",
      };
    }

    return {
      sufficient: false,
      reason:
        "Only one claim is supported by a non-high-quality source.",
    };
  }

  return {
    sufficient: false,
    reason:
      "Not enough reliable evidence.",
  };
}

/* -----------------------------
   Re-index Sources
----------------------------- */

function reindexSources(
  sources
) {
  return sources.map(
    (source, index) => ({
      ...source,
      id: index + 1,
    })
  );
}

/* -----------------------------
   Research One Sub-question
----------------------------- */

async function researchSubQuestion(
  subQuestion,
  initialSources
) {
  let sources = reindexSources(
    processSources(initialSources)
  );

  let claims =
    await extractClaims(
      subQuestion,
      sources
    );

  let verifiedClaims = [];

  for (const claimItem of claims) {
    const verification =
      await verifyClaim(
        subQuestion,
        claimItem,
        sources
      );

    const source =
      sources.find(
        (item) =>
          item.id ===
          Number(
            claimItem.sourceId
          )
      );

    verifiedClaims.push({
      ...claimItem,

      source: source
        ? {
            title: source.title,
            url: source.url,
            domain: source.domain,
            sourceQuality:
              source.sourceQuality,
          }
        : null,

      verification: {
        status:
          verification.status ||
          "insufficient_evidence",

        supportingSources:
          Number(
            verification.supportingSources
          ) || 0,

        contradictingSources:
          Number(
            verification.contradictingSources
          ) || 0,

        reason:
          verification.reason ||
          "No verification reason provided",
      },
    });
  }

  let sufficiency =
    evaluateSufficiency(
      verifiedClaims
    );

  let followUpSearchUsed =
    false;

  let followUpQuery = "";

  /* -----------------------------
     One Optional Follow-up Search
  ----------------------------- */

  if (!sufficiency.sufficient) {
    const followUpPrompt = `
Generate ONE focused web search query for this research question.

Question:
${subQuestion}

Current evidence:
${verifiedClaims
  .map(
    (item) =>
      `Claim: ${item.claim}
Status: ${item.verification.status}`
  )
  .join("\n")}

Rules:
- Find stronger or missing evidence.
- Do not answer the question.
- Keep query short.
- Return ONLY JSON.

Required JSON:
{
  "query": "search query"
}
`;

    const followUpResult =
      await askOllama(
        followUpPrompt,
        50
      );

    followUpQuery =
      typeof followUpResult.query ===
      "string"
        ? followUpResult.query.trim()
        : "";

    if (followUpQuery) {
      console.log(
        `Follow-up search: ${followUpQuery}`
      );

      const followUpSources =
        await searchWeb(
          followUpQuery
        );

      const processed =
        processSources(
          followUpSources
        );

      const existingUrls =
        new Set(
          sources.map(
            (source) => source.url
          )
        );

      const newSources =
        processed.filter(
          (source) =>
            source.url &&
            !existingUrls.has(
              source.url
            )
        );

      if (newSources.length > 0) {
        sources =
          reindexSources([
            ...sources,
            ...newSources,
          ].slice(0, 5));

        followUpSearchUsed =
          true;

        // Re-run extraction
        claims =
          await extractClaims(
            subQuestion,
            sources
          );

        verifiedClaims = [];

        // Re-run verification
        for (const claimItem of claims) {
          const verification =
            await verifyClaim(
              subQuestion,
              claimItem,
              sources
            );

          const source =
            sources.find(
              (item) =>
                item.id ===
                Number(
                  claimItem.sourceId
                )
            );

          verifiedClaims.push({
            ...claimItem,

            source: source
              ? {
                  title: source.title,
                  url: source.url,
                  domain: source.domain,
                  sourceQuality:
                    source.sourceQuality,
                }
              : null,

            verification: {
              status:
                verification.status ||
                "insufficient_evidence",

              supportingSources:
                Number(
                  verification.supportingSources
                ) || 0,

              contradictingSources:
                Number(
                  verification.contradictingSources
                ) || 0,

              reason:
                verification.reason ||
                "No verification reason provided",
            },
          });
        }

        sufficiency =
          evaluateSufficiency(
            verifiedClaims
          );
      }
    }
  }

  return {
    subQuestion,
    sources,
    claims: verifiedClaims,

    sufficiency: {
      sufficient:
        Boolean(
          sufficiency.sufficient
        ),

      reason:
        sufficiency.reason,

      followUpSearchUsed,

      followUpQuery:
        followUpSearchUsed
          ? followUpQuery
          : "",
    },
  };
}

/* -----------------------------
   Main Research API
----------------------------- */

export default async function handler(
  req,
  res
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error:
        "Method not allowed",
    });
  }

  try {
    const { question } =
      req.body;

    if (
      !question ||
      !question.trim()
    ) {
      return res.status(400).json({
        error:
          "Research question is required",
      });
    }

    /* -----------------------------
       Planner
    ----------------------------- */

    const planningPrompt = `
You are a research planning system.

User research question:
${question}

Break this question into 2 to 5 focused research sub-questions.

Rules:
- Cover important aspects.
- Each sub-question investigates a different aspect.
- Keep questions concise.
- Do not answer.
- Return ONLY valid JSON.

Required JSON:
{
  "subQuestions": [
    "question 1",
    "question 2",
    "question 3"
  ]
}
`;

    const plan =
      await askOllama(
        planningPrompt,
        120
      );

    const subQuestions =
      Array.isArray(
        plan.subQuestions
      )
        ? plan.subQuestions
        : [];

    if (
      !subQuestions.length
    ) {
      return res.status(500).json({
        error:
          "Planner returned no sub-questions",
      });
    }

    /* -----------------------------
       Search
    ----------------------------- */

    const researchResults =
      [];

    for (
      const subQuestion of subQuestions
    ) {
      if (
        !subQuestion?.trim()
      ) {
        continue;
      }

      console.log(
        `Searching: ${subQuestion}`
      );

      const rawSources =
        await searchWeb(
          subQuestion
        );

      const sources =
        reindexSources(
          processSources(
            rawSources
          )
        );

      researchResults.push({
        subQuestion,
        sources,
      });
    }

    /* -----------------------------
       Evidence Analysis
    ----------------------------- */

    const findings = [];

    for (
      const researchItem of researchResults
    ) {
      if (
        !researchItem.subQuestion ||
        !researchItem.sources?.length
      ) {
        continue;
      }

      console.log(
        `Analyzing: ${researchItem.subQuestion}`
      );

      const result =
        await researchSubQuestion(
          researchItem.subQuestion,
          researchItem.sources
        );

      findings.push(result);
    }

    return res.status(200).json({
      question,
      subQuestions,
      researchResults,
      findings,
    });
  } catch (error) {
    console.error(
      "Research API error:",
      error
    );

    return res.status(500).json({
      error:
        "Research pipeline failed",
      details:
        error.message,
    });
  }
}