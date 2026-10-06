import { searchWeb } from "../../lib/search";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { subQuestions } = req.body;

    if (!Array.isArray(subQuestions) || !subQuestions.length) {
      return res.status(400).json({
        error: "Sub-questions are required",
      });
    }

    const researchResults = [];

    for (const question of subQuestions) {
      if (!question || !question.trim()) {
        continue;
      }

      console.log(`Searching: ${question}`);

      const sources = await searchWeb(question.trim());

      researchResults.push({
        subQuestion: question,
        sources,
      });
    }

    return res.status(200).json({
      researchResults,
    });
  } catch (error) {
    console.error("Research search error:", error);

    return res.status(500).json({
      error: "Research search failed",
      details: error.message,
    });
  }
}