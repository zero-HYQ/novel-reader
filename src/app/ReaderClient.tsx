"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const LS_THEME = "nr_theme";
const LS_FONT = "nr_font";
const LS_POS_PREFIX = "nr_pos_";

type Block =
  | { type: "heading"; id: string; title: string }
  | { type: "p"; text: string };

const CHAPTER_LINE_RE = /^第\s*(\d{1,4})\s*章\s*(.*)$/;

function splitToLinesOrChunks(raw: string): string[] {
  const text = (raw || "").trim();
  if (!text) return [];

  if (text.includes("\n")) {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  const parts: string[] = [];
  let buf = "";
  const minLen = 35;
  const maxLen = 120;
  const chars = [...text];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1] ?? "";
    buf += ch;

    const isEndPunc =
      ch === "。" ||
      ch === "！" ||
      ch === "？" ||
      ch === "；" ||
      (ch === "…" && next === "…");

    if (ch === "…" && next === "…") {
      buf += next;
      i++;
    }

    if ((isEndPunc && buf.length >= minLen) || buf.length >= maxLen) {
      parts.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) parts.push(buf.trim());

  return parts;
}

function formatBlocks(raw: string): Block[] {
  const text = (raw || "").trim();
  if (!text) return [];

  const hasBlankLine = /\n\s*\n/.test(text);
  if (hasBlankLine) {
    const paras = text
      .split(/\n\s*\n+/)
      .map((p) => p.replace(/\n+/g, " ").trim())
      .filter(Boolean);

    return paras.map((p) => {
      const m = p.match(CHAPTER_LINE_RE);
      if (m) {
        const num = m[1].padStart(2, "0");
        const name = (m[2] || "").trim();
        const title = name ? `第${num}章 ${name}` : `第${num}章`;
        return { type: "heading", id: num, title } as const;
      }
      return { type: "p", text: p } as const;
    });
  }

  const lines = splitToLinesOrChunks(text);
  const blocks: Block[] = [];

  for (const line of lines) {
    const m = line.match(CHAPTER_LINE_RE);
    if (m) {
      const num = m[1].padStart(2, "0");
      const name = (m[2] || "").trim();
      const title = name ? `第${num}章 ${name}` : `第${num}章`;
      blocks.push({ type: "heading", id: num, title });
    } else {
      blocks.push({ type: "p", text: line });
    }
  }

  // 合并连续 p，避免太碎
  const merged: Block[] = [];
  for (const b of blocks) {
    const last = merged[merged.length - 1];
    if (b.type === "p" && last?.type === "p") {
      last.text = `${last.text} ${b.text}`.trim();
    } else {
      merged.push(b.type === "p" ? { ...b } : b);
    }
  }
  return merged;
}

export default function ReaderClient({
  chapterId,
  content,
}: {
  chapterId: string;
  content: string;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [fontSize, setFontSize] = useState<number>(18);

  const posKey = `${LS_POS_PREFIX}${chapterId}`;
  const restoredRef = useRef(false);

  // 初始化设置
  useEffect(() => {
    const t = (localStorage.getItem(LS_THEME) as "light" | "dark") || "light";
    const f = Number(localStorage.getItem(LS_FONT) || "18");
    setTheme(t);
    setFontSize(Number.isFinite(f) ? Math.min(26, Math.max(14, f)) : 18);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(LS_THEME, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(LS_FONT, String(fontSize));
  }, [fontSize]);

  const blocks = useMemo(() => formatBlocks(content), [content]);

  // ✅ 恢复阅读位置：更可靠（多试几帧）
  useEffect(() => {
    restoredRef.current = false;

    const saved = Number(localStorage.getItem(posKey) || "0");
    if (!Number.isFinite(saved) || saved <= 0) return;

    let tries = 0;
    const tryRestore = () => {
      // 页面渲染/字体变化可能影响高度，尝试多几次
      window.scrollTo(0, saved);
      tries++;
      if (tries < 6) {
        requestAnimationFrame(tryRestore);
      } else {
        restoredRef.current = true;
      }
    };

    requestAnimationFrame(tryRestore);
  }, [posKey, fontSize, blocks.length]);

  // ✅ 实时记录滚动位置（节流）
  useEffect(() => {
    let ticking = false;

    const saveNow = () => {
      localStorage.setItem(posKey, String(window.scrollY));
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        saveNow();
        ticking = false;
      });
    };

    // ✅ 离开/切后台时也保存一次，避免丢最后位置
    const onPageHide = () => saveNow();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") saveNow();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [posKey]);

  return (
    <>
      <div
        className="card"
        style={{
          zIndex: 20,
          padding: 10,
          margin: "10px 0 14px",
          borderRadius: 16,
          backdropFilter: "blur(10px)",
          background: "rgba(255,255,255,.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              className="btnGhost"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? "🌙 夜间" : "☀️ 日间"}
            </button>

            <div
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <button
                className="btnGhost"
                onClick={() => setFontSize((v) => Math.max(14, v - 1))}
              >
                A-
              </button>

              <span
                style={{
                  minWidth: 52,
                  textAlign: "center",
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  color: "var(--muted)",
                  fontSize: 12,
                }}
              >
                {fontSize}px
              </span>

              <button
                className="btnGhost"
                onClick={() => setFontSize((v) => Math.min(26, v + 1))}
              >
                A+
              </button>
            </div>
          </div>

          <button
            className="btnGhost"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            ⬆️ 顶部
          </button>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: 22,
          borderRadius: 18,
          maxWidth: 860,
          margin: "0 auto",
        }}
      >
        {blocks.map((b, idx) => {
          if (b.type === "heading") {
            return (
              <h2
                key={`h-${b.id}-${idx}`}
                style={{
                  margin: idx === 0 ? "0 0 14px" : "24px 0 14px",
                  fontSize: Math.round(fontSize * 1.25),
                  lineHeight: 1.3,
                  letterSpacing: "0.3px",
                  paddingBottom: 10,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {b.title}
              </h2>
            );
          }

          return (
            <p
              key={`p-${idx}`}
              style={{
                margin: idx === blocks.length - 1 ? 0 : "0 0 16px",
                textIndent: "2em",
                fontSize,
                lineHeight: 2.0,
                whiteSpace: "normal",
                wordBreak: "break-word",
                textAlign: "justify",
                letterSpacing: "0.2px",
                color: "var(--text)",
              }}
            >
              {b.text}
            </p>
          );
        })}
      </div>
    </>
  );
}
