"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const STORAGE_KEY = "survey:draft";
const AUTH_TOKEN_KEY = "auth:token";

type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "rating"
  | "short_text";

type Question = {
  id: string;
  type: QuestionType;
  text: string;
  required?: boolean;
  options?: string[];
};

type Questionnaire = {
  title: string;
  intro: string;
  questions: Question[];
};

export default function SurveyPage() {
  const router = useRouter();
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [missingRequired, setMissingRequired] = useState<string[]>([]);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      router.replace("/");
      return;
    }
    setIsAuthed(true);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Questionnaire;
      setQuestionnaire(parsed);
    } catch {
      setQuestionnaire(null);
    }
  }, [router]);

  const questionCount = useMemo(
    () => questionnaire?.questions.length ?? 0,
    [questionnaire]
  );

  const updateAnswer = (id: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const toggleMulti = (id: string, option: string) => {
    setAnswers((prev) => {
      const current = prev[id];
      const list = Array.isArray(current) ? [...current] : [];
      const next = list.includes(option)
        ? list.filter((item) => item !== option)
        : [...list, option];
      return { ...prev, [id]: next };
    });
  };

  const handleSubmit = () => {
    if (!questionnaire) return;
    const missing: string[] = [];
    questionnaire.questions.forEach((question) => {
      if (!question.required) return;
      const answer = answers[question.id];
      if (question.type === "short_text") {
        if (typeof answer !== "string" || answer.trim().length === 0) {
          missing.push(question.id);
        }
        return;
      }
      if (question.type === "multiple_choice") {
        if (!Array.isArray(answer) || answer.length === 0) {
          missing.push(question.id);
        }
        return;
      }
      if (typeof answer !== "string" || answer.length === 0) {
        missing.push(question.id);
      }
    });

    if (missing.length > 0) {
      setMissingRequired(missing);
      setSubmitted(false);
      return;
    }

    setMissingRequired([]);
    setSubmitted(true);
  };

  if (!isAuthed) {
    return null;
  }

  if (!questionnaire) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,theme(colors.stone.100),transparent_45%),linear-gradient(to_bottom,theme(colors.stone.50),theme(colors.white))]">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
          <Card>
            <CardHeader>
              <CardTitle>还没有问卷</CardTitle>
              <CardDescription>
                请先生成问卷草案，然后再进入填写页面。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/")}>返回生成</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,theme(colors.stone.100),transparent_45%),linear-gradient(to_bottom,theme(colors.stone.50),theme(colors.white))]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-3">
          <Badge className="w-fit" variant="secondary">
            Survey Preview
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight">
            {questionnaire.title}
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            {questionnaire.intro}
          </p>
          <div className="text-xs text-muted-foreground">
            共 {questionCount} 题
          </div>
        </header>

        <Card>
          <CardContent className="grid gap-6 pt-6">
            {questionnaire.questions.map((question, index) => (
              <div
                key={question.id}
                className={`grid gap-3 rounded-lg border px-4 py-4 ${
                  missingRequired.includes(question.id)
                    ? "border-destructive"
                    : "border-transparent"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>
                    {index + 1}. {question.text}
                  </span>
                  {question.required ? (
                    <span className="text-xs text-destructive">必填</span>
                  ) : null}
                </div>

                {question.type === "short_text" ? (
                  <Textarea
                    rows={3}
                    value={(answers[question.id] as string) ?? ""}
                    onChange={(event) =>
                      updateAnswer(question.id, event.target.value)
                    }
                  />
                ) : null}

                {question.type === "single_choice" ? (
                  <RadioGroup
                    value={(answers[question.id] as string) ?? ""}
                    onValueChange={(value) => updateAnswer(question.id, value)}
                    className="grid gap-2"
                  >
                    {(question.options ?? []).map((option) => (
                      <Label
                        key={option}
                        className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
                      >
                        <RadioGroupItem value={option} />
                        {option}
                      </Label>
                    ))}
                  </RadioGroup>
                ) : null}

                {question.type === "multiple_choice" ? (
                  <div className="grid gap-2">
                    {(question.options ?? []).map((option) => (
                      <Label
                        key={option}
                        className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
                      >
                        <Checkbox
                          checked={
                            Array.isArray(answers[question.id])
                              ? (answers[question.id] as string[]).includes(option)
                              : false
                          }
                          onCheckedChange={() => toggleMulti(question.id, option)}
                        />
                        {option}
                      </Label>
                    ))}
                  </div>
                ) : null}

                {question.type === "rating" ? (
                  <RadioGroup
                    value={(answers[question.id] as string) ?? ""}
                    onValueChange={(value) => updateAnswer(question.id, value)}
                    className="grid gap-2"
                  >
                    {(question.options ?? ["1", "2", "3", "4", "5"]).map(
                      (option) => (
                        <Label
                          key={option}
                          className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
                        >
                          <RadioGroupItem value={option} />
                          {option}
                        </Label>
                      )
                    )}
                  </RadioGroup>
                ) : null}
              </div>
            ))}

            <Separator />
            <div className="flex flex-col gap-3">
              {missingRequired.length > 0 ? (
                <p className="text-sm text-destructive">
                  还有 {missingRequired.length} 道必填题未完成。
                </p>
              ) : null}
              <Button onClick={handleSubmit}>提交</Button>
            </div>
          </CardContent>
        </Card>

        {submitted ? (
          <Card>
            <CardHeader>
              <CardTitle>提交结果（本地预览）</CardTitle>
              <CardDescription>
                当前版本仅展示本地填写结果，未保存到服务器。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">
                {JSON.stringify(answers, null, 2)}
              </pre>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
