"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { track } from "@vercel/analytics";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { QuizOptionList } from "@/components/calculators/quiz-option-list";
import { QUESTIONS, recommendTrainingStyle } from "@/lib/training-style/recommend-style";

const DEFAULT_ANSWERS: Record<string, string> = {
  goal: "health",
  equipment: "full_gym",
  structure: "consistent",
};

export function TrainingStyleFinder() {
  const [answers, setAnswers] = useState<Record<string, string>>(DEFAULT_ANSWERS);

  const result = useMemo(() => {
    try {
      return recommendTrainingStyle(answers);
    } catch {
      return null;
    }
  }, [answers]);

  const hasTrackedRef = useRef(false);
  useEffect(() => {
    if (hasTrackedRef.current || !result) return;
    const changed = QUESTIONS.some((q) => answers[q.id] !== DEFAULT_ANSWERS[q.id]);
    if (changed) {
      track("find_training_style", { style: result.primary.id });
      hasTrackedRef.current = true;
    }
  }, [answers, result]);

  function handleAnswer(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardContent className="flex flex-col gap-6 pt-6">
          {QUESTIONS.map((question) => (
            <QuizOptionList
              key={question.id}
              question={question.question}
              aria-label={question.question}
              options={question.options}
              value={answers[question.id] ?? ""}
              onChange={(optionId) => handleAnswer(question.id, optionId)}
            />
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        {result ? (
          <motion.div
            key={result.primary.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-6"
          >
            <Card>
              <CardContent className="flex flex-col gap-4 pt-6">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Recommended for you
                  </span>
                  <span className="text-2xl font-semibold tracking-tight text-foreground">
                    {result.primary.name}
                  </span>
                  <span className="text-sm text-muted-foreground">{result.primary.tagline}</span>
                </div>

                <p className="text-sm text-foreground">{result.primary.description}</p>

                <div className="flex flex-col gap-3 border-t border-border pt-4">
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Good for
                    </span>
                    <p className="text-sm text-foreground">{result.primary.goodFor}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      The tradeoff
                    </span>
                    <p className="text-sm text-foreground">{result.primary.tradeoff}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {result.secondary && (
              <Card>
                <CardContent className="flex flex-col gap-2 pt-6">
                  <span className="text-sm font-medium text-muted-foreground">
                    Close second: {result.secondary.name}
                  </span>
                  <p className="text-sm text-foreground">
                    Your answers were nearly split between these two — {result.secondary.tagline.toLowerCase()}{" "}
                    If {result.primary.name.toLowerCase()} doesn&apos;t click after a few weeks, this is
                    worth trying instead.
                  </p>
                </CardContent>
              </Card>
            )}

            <Link
              href="/tools/training-split-finder"
              className={buttonVariants({ size: "lg", className: "w-full" })}
            >
              Now find your weekly split
              <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Answer the questions to see your recommended training style.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
