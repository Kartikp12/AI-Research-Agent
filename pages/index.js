import { useState } from "react";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [progressStep, setProgressStep] = useState(0);

  const progressSteps = [
    {
      title: "Planning research",
      description: "Breaking your question into focused research tasks",
    },
    {
      title: "Searching the web",
      description: "Finding relevant and reliable sources",
    },
    {
      title: "Analyzing evidence",
      description: "Extracting useful claims from the sources",
    },
    {
      title: "Verifying sources",
      description: "Cross-checking evidence across multiple sources",
    },
    {
      title: "Building final report",
      description: "Organizing the findings into a structured report",
    },
  ];

  const handleResearch = async () => {
    if (!question.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setError("");
    setProgressStep(0);

    // Approximate progress updates while the backend is working.
    const progressTimers = [
      setTimeout(() => setProgressStep(1), 5000),
      setTimeout(() => setProgressStep(2), 20000),
      setTimeout(() => setProgressStep(3), 40000),
      setTimeout(() => setProgressStep(4), 65000),
    ];

    try {
      const response = await fetch("/api/research-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.details ||
            data?.error ||
            "Research failed"
        );
      }

      setResult(data);
      setProgressStep(5);
    } catch (error) {
      console.error("Research error:", error);
      setError(error.message || "Something went wrong.");
    } finally {
      progressTimers.forEach((timer) => clearTimeout(timer));
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
        <section className="flex flex-1 flex-col items-center justify-center py-16">
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
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Example: What are the limitations and risks of AI agents in production?"
                rows={5}
                disabled={loading}
                className="w-full resize-none bg-transparent px-3 py-2 text-base leading-7 text-white outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-70"
              />

              <div className="mt-2 flex items-center justify-between border-t border-zinc-800 pt-3">

                <span className="px-3 text-xs text-zinc-600">
                  {loading
                    ? progressSteps[progressStep]?.title
                    : "Ask a detailed research question"}
                </span>

                <button
                  onClick={handleResearch}
                  disabled={!question.trim() || loading}
                  className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "Researching..." : "Start Research"}
                </button>
              </div>
            </div>

            {/* Progress */}
            {loading && (
              <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">

                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {progressSteps[progressStep]?.title}
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {progressSteps[progressStep]?.description}
                    </p>
                  </div>

                  <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
                </div>

                <div className="space-y-3">
                  {progressSteps.map((step, index) => {
                    const completed = index < progressStep;
                    const active = index === progressStep;

                    return (
                      <div
                        key={step.title}
                        className="flex items-center gap-3"
                      >
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                            completed
                              ? "border-zinc-500 bg-zinc-800 text-white"
                              : active
                              ? "border-white bg-white text-black"
                              : "border-zinc-800 bg-zinc-900 text-zinc-600"
                          }`}
                        >
                          {completed ? "✓" : index + 1}
                        </div>

                        <div className="flex-1">
                          <p
                            className={`text-xs ${
                              active || completed
                                ? "text-zinc-200"
                                : "text-zinc-600"
                            }`}
                          >
                            {step.title}
                          </p>
                        </div>

                        {active && (
                          <span className="text-[10px] text-zinc-500">
                            In progress
                          </span>
                        )}

                        {completed && (
                          <span className="text-[10px] text-zinc-600">
                            Done
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-6 rounded-2xl border border-red-900/50 bg-red-950/20 p-4">
                <p className="text-sm font-medium text-red-400">
                  Research failed
                </p>

                <p className="mt-1 text-xs leading-5 text-red-300/70">
                  {error}
                </p>
              </div>
            )}

            {/* Example Questions */}
            {!loading && !result && (
              <div className="mt-6">
                <p className="mb-3 text-center text-xs uppercase tracking-wider text-zinc-600">
                  Try asking
                </p>

                <div className="flex flex-wrap justify-center gap-2">
                  {exampleQuestions.map((example) => (
                    <button
                      key={example}
                      onClick={() => setQuestion(example)}
                      className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs text-zinc-400 transition hover:border-zinc-700 hover:text-white"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Research Report */}
            {result?.report && (
              <div className="mt-12 space-y-8">

                {/* Report Header */}
                <div className="border-b border-zinc-800 pb-8">
                  <div className="mb-3 text-xs uppercase tracking-wider text-zinc-600">
                    Research Report
                  </div>

                  <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                    {result.report.title}
                  </h2>

                  <p className="mt-4 text-sm leading-7 text-zinc-400">
                    Research question:{" "}
                    <span className="text-zinc-300">
                      {result.question}
                    </span>
                  </p>
                </div>

                {/* Executive Summary */}
                {result.report.executiveSummary && (
                  <section>
                    <h3 className="text-lg font-semibold">
                      Executive Summary
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-zinc-400">
                      {result.report.executiveSummary}
                    </p>
                  </section>
                )}

                {/* Key Findings */}
                {result.report.keyFindings?.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold">
                      Key Findings
                    </h3>

                    <div className="mt-4 space-y-3">
                      {result.report.keyFindings.map(
                        (finding, index) => (
                          <div
                            key={index}
                            className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                          >
                            <div className="flex gap-3">
                              <span className="text-xs text-zinc-600">
                                0{index + 1}
                              </span>

                              <p className="text-sm leading-6 text-zinc-300">
                                {finding}
                              </p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </section>
                )}

                {/* Detailed Analysis */}
                {result.report.detailedAnalysis?.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold">
                      Detailed Analysis
                    </h3>

                    <div className="mt-4 space-y-6">
                      {result.report.detailedAnalysis.map(
                        (item, index) => (
                          <div key={index}>
                            <h4 className="text-sm font-medium text-zinc-200">
                              {item.topic}
                            </h4>

                            <p className="mt-2 text-sm leading-7 text-zinc-400">
                              {item.analysis}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </section>
                )}

                {/* Limitations */}
                {result.report.limitations?.length > 0 && (
                  <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
                    <h3 className="text-lg font-semibold">
                      Limitations
                    </h3>

                    <ul className="mt-4 space-y-3">
                      {result.report.limitations.map(
                        (limitation, index) => (
                          <li
                            key={index}
                            className="flex gap-3 text-sm leading-6 text-zinc-400"
                          >
                            <span className="text-zinc-600">
                              •
                            </span>

                            <span>{limitation}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </section>
                )}

                {/* Conclusion */}
                {result.report.conclusion && (
                  <section>
                    <h3 className="text-lg font-semibold">
                      Conclusion
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-zinc-400">
                      {result.report.conclusion}
                    </p>
                  </section>
                )}

                {/* Sources */}
                {result.sources?.length > 0 && (
                  <section>
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold">
                        Sources
                      </h3>

                      <p className="mt-1 text-xs text-zinc-600">
                        Sources retrieved and analyzed by the research agent
                      </p>
                    </div>

                    <div className="space-y-3">
                      {result.sources.map((source, index) => (
                        <a
                          key={source.url || index}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-xl border border-zinc-800 bg-zinc-950 p-4 transition hover:border-zinc-700"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium text-zinc-200">
                                {source.title || "Untitled Source"}
                              </p>

                              <p className="mt-1 text-xs text-zinc-600">
                                {source.domain || source.url}
                              </p>
                            </div>

                            {source.sourceQuality && (
                              <span className="shrink-0 rounded-full border border-zinc-800 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-500">
                                {source.sourceQuality}
                              </span>
                            )}
                          </div>
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                {/* New Research */}
                <div className="border-t border-zinc-800 pt-8 text-center">
                  <button
                    onClick={() => {
                      setResult(null);
                      setQuestion("");
                      setError("");
                      setProgressStep(0);
                    }}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-white"
                  >
                    Start New Research
                  </button>
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