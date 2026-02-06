"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const AUTH_TOKEN_KEY = "auth:token";

export default function Home() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      router.replace("/builder");
    }
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, password }),
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "登录失败");
      }
      const data = await res.json();
      if (typeof window !== "undefined") {
        window.localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
      }
      router.replace("/builder");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,theme(colors.stone.100),transparent_45%),linear-gradient(to_bottom,theme(colors.stone.50),theme(colors.white))]">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>登录</CardTitle>
            <CardDescription>使用邮箱和密码登录。</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="nickname">昵称</Label>
                <Input
                  id="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "登录中..." : "登录"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/register")}
              >
                注册新账号
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
