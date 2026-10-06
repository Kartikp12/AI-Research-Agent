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
    // 1. Create research plan
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 2. Search each sub-question
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 3. Return complete research plan + sources
    // --------------------------------------------------

    return res.status(200).json({
      question,
      subQuestions,
      researchResults,
    });
  } catch (error) {
    console.error("Research run error:", error);

    return res.status(500).json({
      error: "Research run failed",
      details: error.message,
    });
  }
}