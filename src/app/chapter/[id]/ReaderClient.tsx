"use client";

import { useEffect, useMemo, useState } from "react";

const LS_THEME = "nr_theme"; // light | dark
const LS_FONT = "nr_font"; // number
const LS_POS_PREFIX = "nr_pos_"; // 每章滚动位置

function formatParagraphs(raw: string) {
  const text = (raw || "").trim();
  if (!text) return [];

  // 1) 有空行：按空行分段（推荐）
  const hasBlankLine = /\n\s*\n/.test(text);
  if (hasBlankLine) {
    return text
      .split(/\n\s*\n+/)
      .map((p) => p.replace(/\n+/g, " ").trim())
      .filter(Boolean);
  }

  // 2) 有换行但没空行：按每行分段
  const hasLineBreak = text.includes("\n");
  if (hasLineBreak) {
    return text
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  // 3) 一行到底：按中文句末标点分段 + 控制段落长度（保守，不会太碎）
  const parts: string[] = [];
  let buf = "";
  const minLen = 35; // 太短不切
  const maxLen = 120; // 太长强制切

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
      (ch === "…" && next === "…"); // “……”

    // 吃掉第二个 …
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

export default function ReaderClient({
  chapterId,
  content,
}: {
  chapterId: string;
  content: string;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [fontSize, setFontSize] = useState<number>(18);

  // 初始化：读 localStorage
  useEffect(() => {
    const t = (localStorage.getItem(LS_THEME) as "light" | "dark") || "light";
    const f = Number(localStorage.getItem(LS_FONT) || "18");
    setTheme(t);
    setFontSize(Number.isFinite(f) ? Math.min(26, Math.max(14, f)) : 18);
  }, []);

  // 应用主题到 html
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(LS_THEME, theme);
  }, [theme]);

  // 保存字号
  useEffect(() => {
    localStorage.setItem(LS_FONT, String(fontSize));
  }, [fontSize]);

  // 恢复滚动位置
  useEffect(() => {
    const key = `${LS_POS_PREFIX}${chapterId}`;
    const saved = Number(localStorage.getItem(key) || "0");
    if (Number.isFinite(saved) && saved > 0) {
      requestAnimationFrame(() => window.scrollTo(0, saved));
    }
  }, [chapterId]);

  // 记录滚动位置（节流）
  useEffect(() => {
    const key = `${LS_POS_PREFIX}${chapterId}`;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        localStorage.setItem(key, String(window.scrollY));
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [chapterId]);

  // ✅ 关键：把正文转成段落数组
  const paragraphs = useMemo(() => formatParagraphs(content), [content]);

  return (
    <>
      <div
        className="toolbar"
        style={{ margin: "10px 0 14px", display: "flex", gap: 10 }}
      >
        <button
          className="btnGhost"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? "🌙 夜间" : "☀️ 日间"}
        </button>

        <button
          className="btnGhost"
          onClick={() => setFontSize((v) => Math.max(14, v - 1))}
        >
          A-
        </button>

        <span style={{ alignSelf: "center" }}>{fontSize}px</span>

        <button
          className="btnGhost"
          onClick={() => setFontSize((v) => Math.min(26, v + 1))}
        >
          A+
        </button>
      </div>

      {/* ✅ 用 <p> 渲染段落：首行缩进 + 段间距 */}
      <div className="card" style={{ padding: 18 }}>
        {paragraphs.map((p, idx) => (
          <p
            key={idx}
            style={{
              margin: idx === paragraphs.length - 1 ? 0 : "0 0 14px",
              textIndent: "2em",
              fontSize,
              lineHeight: 1.95,
              whiteSpace: "normal",
            }}
          >
            {p}
          </p>
        ))}
      </div>
    </>
  );
}
