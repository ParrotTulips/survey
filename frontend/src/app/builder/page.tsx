"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://192.168.120.237:8000";

const STORAGE_KEY = "survey:draft";
const RECENT_KEY = "survey:recent";
const SEED_KEY = "survey:seed";
const AUTH_TOKEN_KEY = "auth:token";
const MAX_RECENT = 5;

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

type SeedState = {
  goal: string;
  audience: string;
  tone: string;
  language: string;
  questionCount: string;
};

type RecentItem = {
  id: string;
  title: string;
  createdAt: string;
  questionnaire: Questionnaire;
};

const typeLabel: Record<QuestionType, string> = {
  single_choice: "单选",
  multiple_choice: "多选",
  rating: "评分",
  short_text: "简答",
};

const toneOptions = [
  { value: "neutral", label: "中性" },
  { value: "friendly", label: "友好" },
  { value: "formal", label: "正式" },
];

const languageOptions = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
];

const countOptions = ["5", "8", "10", "12", "15"];

function persistDraft(next: Questionnaire | null) {
  if (typeof window === "undefined") return;
  if (!next) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

function loadSeed(): Partial<SeedState> {
  if (typeof window === "undefined") return {};
  const raw = window.sessionStorage.getItem(SEED_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<SeedState>;
  } catch {
    return {};
  }
}

function persistSeed(seed: SeedState) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SEED_KEY, JSON.stringify(seed));
}

function loadRecent(): RecentItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(RECENT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as RecentItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item?.questionnaire?.questions?.length);
  } catch {
    return [];
  }
}

function persistRecent(items: RecentItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(items));
}

function buildRecentItem(questionnaire: Questionnaire): RecentItem {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    title: questionnaire.title || "未命名问卷",
    createdAt: new Date().toISOString(),
    questionnaire,
  };
}

export default function Home() {
  const router = useRouter();
  const [goal, setGoal] = useState("提升新产品体验调研");
  const [audience, setAudience] = useState("近期试用过产品的用户");
  const [tone, setTone] = useState("neutral");
  const [language, setLanguage] = useState("zh");
  const [questionCount, setQuestionCount] = useState("8");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Questionnaire | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = getAuthToken();
    if (!token) {
      router.replace("/");
      return;
    }
    setAuthToken(token);
    setIsAuthed(true);
    setRecent(loadRecent());
    const navEntry = window.performance
      ?.getEntriesByType?.("navigation")
      ?.at(0) as PerformanceNavigationTiming | undefined;
    const isReload = navEntry?.type === "reload";
    if (isReload) {
      window.localStorage.removeItem(STORAGE_KEY);
      window.sessionStorage.removeItem(SEED_KEY);
      setResult(null);
      setLastSavedAt(null);
      return;
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Questionnaire;
        setResult(parsed);
        setLastSavedAt(new Date().toLocaleTimeString());
      } catch {
        // Ignore invalid cache.
      }
    }

    const seed = loadSeed();
    if (seed.goal) setGoal(seed.goal);
    if (seed.audience) setAudience(seed.audience);
    if (seed.tone) setTone(seed.tone);
    if (seed.language) setLanguage(seed.language);
    if (seed.questionCount) setQuestionCount(seed.questionCount);
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    persistSeed({ goal, audience, tone, language, questionCount });
  }, [goal, audience, tone, language, questionCount]);

  const summary = useMemo(() => {
    if (!result) return "暂无问卷";
    return `${result.questions.length} 题 · ${result.title}`;
  }, [result]);

  const addRecent = (questionnaire: Questionnaire) => {
    setRecent((prev) => {
      const item = buildRecentItem(questionnaire);
      const next = [
        item,
        ...prev.filter((entry) => entry.title !== item.title),
      ].slice(0, MAX_RECENT);
      persistRecent(next);
      return next;
    });
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          goal,
          audience,
          tone,
          language,
          question_count: Number(questionCount),
        }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "生成失败");
      }

      const data = (await res.json()) as Questionnaire;
      setResult(data);
      persistDraft(data);
      addRecent(data);
      setLastSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setIsLoading(false);
    }
  };

  const updateResult = (next: Questionnaire) => {
    setResult(next);
    persistDraft(next);
    setLastSavedAt(new Date().toLocaleTimeString());
  };

  const handleLoadRecent = (item: RecentItem) => {
    updateResult(item.questionnaire);
  };

  const updateQuestion = (id: string, patch: Partial<Question>) => {
    if (!result) return;
    updateResult({
      ...result,
      questions: result.questions.map((q) =>
        q.id === id ? { ...q, ...patch } : q,
      ),
    });
  };

  const updateOption = (id: string, idx: number, value: string) => {
    if (!result) return;
    updateResult({
      ...result,
      questions: result.questions.map((q) => {
        if (q.id !== id) return q;
        const options = q.options ? [...q.options] : [];
        options[idx] = value;
        return { ...q, options };
      }),
    });
  };

  const handlePreview = () => {
    if (!result) return;
    window.open("/survey", "_blank", "noopener,noreferrer");
  };

  const handleLogout = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken(null);
    setIsAuthed(false);
    router.replace("/");
  };

  const buildQuestion = (type: QuestionType): Question => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const base = {
      id,
      type,
      text: "自定义问题",
      required: false,
    } as Question;

    if (type === "single_choice") {
      base.options = ["选项A", "选项B", "选项C"];
    } else if (type === "multiple_choice") {
      base.options = ["选项A", "选项B", "选项C"];
    } else if (type === "rating") {
      base.options = ["1", "2", "3", "4", "5"];
    }

    return base;
  };

  const normalizeOptions = (
    type: QuestionType,
    current?: string[]
  ): string[] | undefined => {
    if (type === "short_text") return undefined;
    if (current && current.length > 0) return current;
    if (type === "rating") return ["1", "2", "3", "4", "5"];
    return ["选项A", "选项B", "选项C"];
  };

  const insertQuestion = (
    index: number,
    position: "above" | "below",
    baseType: QuestionType
  ) => {
    if (!result) return;
    const next = [...result.questions];
    const insertIndex = position === "above" ? index : index + 1;
    next.splice(insertIndex, 0, buildQuestion(baseType));
    updateResult({ ...result, questions: next });
  };

  const handleTypeChange = (id: string, nextType: QuestionType) => {
    if (!result) return;
    updateResult({
      ...result,
      questions: result.questions.map((q) =>
        q.id === id
          ? {
              ...q,
              type: nextType,
              options: normalizeOptions(nextType, q.options),
            }
          : q
      ),
    });
  };

  if (!isAuthed) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,theme(colors.stone.100),transparent_45%),linear-gradient(to_bottom,theme(colors.stone.50),theme(colors.white))]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <Badge className="w-fit" variant="secondary">
                AI Survey Builder
              </Badge>
              <div className="flex items-center gap-2">
                {authToken ? (
                  <>
                    <span className="text-xs text-muted-foreground">
                      已登录
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleLogout}
                    >
                      退出
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => router.push("/")}
                    >
                      登录
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => router.push("/register")}
                    >
                      注册
                    </Button>
                  </>
                )}
              </div>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              让问卷从一句话开始
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground md:text-base">
              输入调研目标与人群，立即生成可编辑的问卷草案。你可以直接修改标题、
              引导语与每一道题，并随时预览完整问卷。
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="rounded-full border border-border px-3 py-1">
                草案：{summary}
              </span>
              {lastSavedAt ? (
                <span className="rounded-full border border-border px-3 py-1">
                  已保存 {lastSavedAt}
                </span>
              ) : null}
            </div>

            <Card className="border-dashed bg-white/70 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">最近生成</CardTitle>
                <CardDescription className="text-xs">
                  本地缓存最近 5 份问卷。
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {recent.length ? (
                  recent.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-white/80 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {item.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString()} ·{" "}
                          {item.questionnaire.questions.length} 题
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleLoadRecent(item)}
                      >
                        载入
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    暂无最近生成记录。
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>需求输入</CardTitle>
              <CardDescription>建议先从 8-10 题开始。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="goal">调研目标</Label>
                <Input
                  id="goal"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder="例如：了解用户对新功能的接受度"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="audience">目标人群</Label>
                <Input
                  id="audience"
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                  placeholder="例如：一线城市 25-35 岁用户"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label>题目数量</Label>
                  <Select
                    value={questionCount}
                    onValueChange={setQuestionCount}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择数量" />
                    </SelectTrigger>
                    <SelectContent>
                      {countOptions.map((count) => (
                        <SelectItem key={count} value={count}>
                          {count} 题
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>语气</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger>
                      <SelectValue placeholder="语气" />
                    </SelectTrigger>
                    <SelectContent>
                      {toneOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>语言</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="语言" />
                    </SelectTrigger>
                    <SelectContent>
                      {languageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleGenerate} disabled={isLoading}>
                {isLoading ? "生成中..." : "生成问卷"}
              </Button>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
            </CardContent>
          </Card>
        </header>

        <Separator />

        <section className="grid gap-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">编辑问卷</h2>
              <p className="text-sm text-muted-foreground">
                生成问卷后可以直接修改题目内容。
              </p>
            </div>
            <Button
              onClick={handlePreview}
              disabled={!result}
              variant="secondary"
            >
              预览问卷
            </Button>
          </div>

          {result ? (
            <Card>
              <CardContent className="grid gap-6 pt-6">
                <div className="grid gap-2">
                  <Label>问卷标题</Label>
                  <Input
                    value={result.title}
                    onChange={(event) =>
                      updateResult({ ...result, title: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>引导语</Label>
                  <Textarea
                    rows={3}
                    value={result.intro}
                    onChange={(event) =>
                      updateResult({ ...result, intro: event.target.value })
                    }
                  />
                </div>

                <div className="grid gap-4">
                  {result.questions.map((question, index) => (
                    <div
                      key={question.id}
                      className="group relative rounded-xl border border-border bg-card p-4 shadow-sm"
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="absolute -left-4 top-4 h-8 w-8 rounded-full opacity-0 shadow-sm transition group-hover:opacity-100"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                      <DropdownMenuContent
                          align="start"
                          side="left"
                          sideOffset={8}
                        >
                          <DropdownMenuItem
                            onClick={() =>
                              insertQuestion(index, "above", question.type)
                            }
                          >
                            在上方新增
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              insertQuestion(index, "below", question.type)
                            }
                          >
                            在下方新增
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">
                          Q{index + 1}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              checked={Boolean(question.required)}
                              onCheckedChange={(checked) =>
                                updateQuestion(question.id, {
                                  required: Boolean(checked),
                                })
                              }
                            />
                            必填
                          </Label>
                          <Select
                            value={question.type}
                            onValueChange={(value) =>
                              handleTypeChange(
                                question.id,
                                value as QuestionType
                              )
                            }
                          >
                            <SelectTrigger className="h-8 w-[120px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(
                                [
                                  "single_choice",
                                  "multiple_choice",
                                  "rating",
                                  "short_text",
                                ] as QuestionType[]
                              ).map((type) => (
                                <SelectItem key={type} value={type}>
                                  {typeLabel[type]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Input
                        className="mt-3"
                        value={question.text}
                        onChange={(event) =>
                          updateQuestion(question.id, {
                            text: event.target.value,
                          })
                        }
                      />
                      {question.options && question.options.length > 0 ? (
                        <div className="mt-3 grid gap-2">
                          {question.options.map((option, idx) => (
                            <Input
                              key={`${question.id}-${idx}`}
                              value={option}
                              onChange={(event) =>
                                updateOption(
                                  question.id,
                                  idx,
                                  event.target.value,
                                )
                              }
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">
              生成问卷后可在这里编辑。
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
