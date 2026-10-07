import { useState } from "react";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResearch = async () => {
    if (!question.trim() || loading) return;

    setLoading(true);

    try {
      const response = await fetch(
        "/api/research-report",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: question.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.details ||
            data?.error ||
            "Research failed"
        );
      }

      console.log(
        "Research result:",
        data
      );
    } catch (error) {
      console.error(
        "Research error:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  const exampleQuestions = [
    "How are AI agents being used in cybersecurity?",
    "What are the risks of autonomous AI agents?",
    "Compare RAG and fine-tuning for enterprise AI.",
  ];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8 md:px-10">

        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              AI Research Agent
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Research anything with web-grounded AI
            </p>
          </div>

          <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400">
            Powered by AI
          </div>
        </header>

        {/* Main */}
        <section className="flex flex-1 flex-col items-center justify-center">
          <div className="w-full max-w-3xl">

            {/* Intro */}
            <div className="mb-8 text-center">
              <div className="mb-5 inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs text-zinc-400">
                Web-Grounded Research
              </div>

              <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
                What do you want to research?
              </h2>

              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-500">
                Ask a research question and let the agent
                search the web, verify evidence, and build
                a structured report.
              </p>
            </div>

            {/* Research Box */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 shadow-2xl">

              <textarea
                value={question}
                onChange={(e) =>
                  setQuestion(e.target.value)
                }
                placeholder="Example: What are the limitations and risks of AI agents in production?"
                rows={5}
                disabled={loading}
                className="w-full resize-none bg-transparent px-3 py-2 text-base leading-7 text-white outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-70"
              />

              <div className="mt-2 flex items-center justify-between border-t border-zinc-800 pt-3">

                <span className="px-3 text-xs text-zinc-600">
                  {loading
                    ? "Researching your question..."
                    : "Ask a detailed research question"}
                </span>

                <button
                  onClick={handleResearch}
                  disabled={
                    !question.trim() ||
                    loading
                  }
                  className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading
                    ? "Researching..."
                    : "Start Research"}
                </button>
              </div>
            </div>

            {/* Example Questions */}
            {!loading && (
              <div className="mt-6">
                <p className="mb-3 text-center text-xs uppercase tracking-wider text-zinc-600">
                  Try asking
                </p>

                <div className="flex flex-wrap justify-center gap-2">
                  {exampleQuestions.map(
                    (example) => (
                      <button
                        key={example}
                        onClick={() =>
                          setQuestion(
                            example
                          )
                        }
                        className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs text-zinc-400 transition hover:border-zinc-700 hover:text-white"
                      >
                        {example}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

          </div>
        </section>

        {/* Footer */}
        <footer className="py-4 text-center text-xs text-zinc-600">
          AI Research Agent · Web search · Evidence verification ·
          Source-grounded reports
        </footer>
      </div>
    </main>
  );
}