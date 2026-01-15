"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const LS_THEME = "nr_theme";
const LS_FONT = "nr_font";
const LS_POS_PREFIX = "nr_pos_";
const LS_NOVEL = "nr_current_novel";

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

  // 一行到底：按句末切
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

  // 合并连续段落
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

type NovelOption = { key: string; name: string };

export default function ReaderClient({
  chapterId,
  content,
  novelKey,
  novelOptions = [],
}: {
  chapterId: string;
  content: string;
  novelKey: string;
  novelOptions?: NovelOption[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  const [novelOpen, setNovelOpen] = useState(false);
  const [chapterListOpen, setChapterListOpen] = useState(false);

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [fontSize, setFontSize] = useState<number>(18);

  // 当前章节提示
  const [currentChapter, setCurrentChapter] =
    useState<string>("（未进入章节）");
  const [filter, setFilter] = useState("");
  const [jumpNo, setJumpNo] = useState("");

  const [panelOpen, setPanelOpen] = useState(false);

  const restoredOnceRef = useRef(false);
  const restoringRef = useRef(false);

  // ✅ 位置按“小说 + chapterId”隔离
  const posKey = `${LS_POS_PREFIX}${novelKey}`;

  const blocks = useMemo(() => formatBlocks(content), [content]);

  const headings = useMemo(
    () =>
      blocks.filter(
        (b): b is Extract<Block, { type: "heading" }> => b.type === "heading"
      ),
    [blocks]
  );

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

  // ✅ 恢复阅读位置：useLayoutEffect 更早、更稳；并关闭浏览器自动滚动恢复
  useLayoutEffect(() => {
    // 关掉浏览器/Next 的自动滚动恢复干扰
    try {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {}

    restoredOnceRef.current = false;
    restoringRef.current = true;

    const k1 = posKey; // localStorage key（你现在 posKey = nr_pos_${novelKey}）
    const k2 = `ss_${posKey}`; // sessionStorage 兜底

    const saved =
      Number(sessionStorage.getItem(k2) || "") ||
      Number(localStorage.getItem(k1) || "");

    const target = Number.isFinite(saved) && saved > 0 ? saved : 0;

    let raf = 0;
    let tries = 0;

    const tick = () => {
      // 反复多次，防止 hydration/字体/布局改变把滚动顶回去
      window.scrollTo(0, target);
      tries += 1;

      if (tries < 10) {
        raf = requestAnimationFrame(tick);
      } else {
        restoringRef.current = false;
        restoredOnceRef.current = true;
      }
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [posKey, fontSize, blocks.length]);

  // ✅ 保存阅读位置：恢复完成前不写入，避免把旧位置覆盖成 0
  useEffect(() => {
    const k1 = posKey;
    const k2 = `ss_${posKey}`;

    const saveNow = () => {
      // 恢复没完成时不要保存，否则极容易把旧位置写成 0
      if (!restoredOnceRef.current || restoringRef.current) return;

      const y = Math.max(0, Math.round(window.scrollY || 0));
      localStorage.setItem(k1, String(y));
      sessionStorage.setItem(k2, String(y));
      localStorage.setItem(LS_NOVEL, novelKey);
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        saveNow();
        ticking = false;
      });
    };

    const onPageHide = () => saveNow();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") saveNow();
    };
    const onBeforeUnload = () => saveNow();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [posKey, novelKey]);

  // heading ref
  const headingElsRef = useRef<Record<string, HTMLElement | null>>({});

  // ✅ 当前章节：IntersectionObserver（稳）
  useEffect(() => {
    if (!headings.length) {
      setCurrentChapter("（未检测到章节标题）");
      return;
    }
    setCurrentChapter(headings[0].title);

    const visibleMap = new Map<Element, number>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting)
            visibleMap.set(e.target, e.boundingClientRect.top);
          else visibleMap.delete(e.target);
        }
        if (!visibleMap.size) return;

        let bestEl: Element | null = null;
        let bestTop = Infinity;
        for (const [el, top] of visibleMap.entries()) {
          if (top < bestTop) {
            bestTop = top;
            bestEl = el;
          }
        }
        if (!bestEl) return;
        const el = bestEl as HTMLElement;
        const title = el.dataset.title || el.textContent || "";
        if (title) setCurrentChapter(title.trim());
      },
      {
        root: null,
        rootMargin: "0px 0px -65% 0px",
        threshold: [0, 0.01, 1],
      }
    );

    headings.forEach((h) => {
      const key = `h-${h.id}-${h.title}`;
      const el = headingElsRef.current[key];
      if (el) io.observe(el);
    });

    return () => io.disconnect();
  }, [headings]);

  const scrollToHeading = (h: { id: string; title: string }) => {
    const key = `h-${h.id}-${h.title}`;
    const el = headingElsRef.current[key];
    if (!el) return;
    setChapterListOpen(false);
    const top = el.getBoundingClientRect().top + window.scrollY - 12;
    window.scrollTo({ top, behavior: "smooth" });
  };

  // 上一章 / 下一章
  const currentIndex = useMemo(() => {
    const i = headings.findIndex((h) => h.title === currentChapter);
    return i >= 0 ? i : 0;
  }, [headings, currentChapter]);

  const goPrev = () => {
    if (!headings.length) return;
    scrollToHeading(headings[Math.max(0, currentIndex - 1)]);
  };
  const goNext = () => {
    if (!headings.length) return;
    scrollToHeading(headings[Math.min(headings.length - 1, currentIndex + 1)]);
  };

  const jumpToNo = () => {
    const n = Number(jumpNo);
    if (!Number.isFinite(n) || n <= 0) return;
    const id = String(n).padStart(2, "0");
    const target = headings.find((h) => h.id === id);
    if (target) scrollToHeading(target);
  };

  // ✅ 切换小说：保存当前阅读位置 + 记住当前小说 + 改 query
  const switchNovel = (nextKey: string) => {
    localStorage.setItem(posKey, String(window.scrollY));
    localStorage.setItem(LS_NOVEL, nextKey);

    const params = new URLSearchParams(sp.toString());
    params.set("novel", nextKey);

    router.push(`${pathname}?${params.toString()}`);

    setNovelOpen(false);
    setChapterListOpen(false);
  };

  // 点击外部关闭弹层 + ESC
  const popRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current && !popRef.current.contains(t)) {
        setNovelOpen(false);
        setChapterListOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNovelOpen(false);
        setChapterListOpen(false);
      }
      if (e.key === "j") goNext();
      if (e.key === "k") goPrev();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goNext, goPrev]);

  const filtered = useMemo(() => {
    const q = filter.trim();
    if (!q) return headings;
    return headings.filter((h) => h.title.includes(q));
  }, [headings, filter]);

  return (
    <>
      {/* 工具条 */}
      {/* 顶部：轻量工具条（不密集） */}
      <div
        className="card"
        style={{
          position: "sticky",
          top: 12,
          padding: 10,
          margin: "10px 0 14px",
          borderRadius: 16,
          background: "rgba(0,0,0,0.12)",
          backdropFilter: "blur(10px)",
        }}
      >
        {/* 第一行：最常用，保持极简 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {/* <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 420,
              }}
              title={currentChapter}
            >
              {currentChapter}
            </span>
          </div> */}
          {novelOptions.length > 0 && (
            <div style={{ position: "relative" }}>
              <button
                className="btnGhost"
                onClick={() => setNovelOpen((v) => !v)}
                style={{ fontSize: 12 }}
              >
                📚{" "}
                {novelOptions.find((n) => n.key === novelKey)?.name || novelKey}{" "}
                <span style={{ opacity: 0.75 }}>{novelOpen ? "▲" : "▼"}</span>
              </button>

              {novelOpen && (
                <div
                  className="card"
                  style={{
                    position: "absolute",
                    top: "110%",
                    left: 0,
                    minWidth: 220,
                    padding: 8,
                    borderRadius: 14,
                    zIndex: 30,
                    background: theme === "light" ? "#fff" : "#000",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  {novelOptions.map((n) => {
                    const active = n.key === novelKey;
                    return (
                      <button
                        key={n.key}
                        className="btnGhost"
                        onClick={() => switchNovel(n.key)}
                        style={{
                          width: "100%",
                          justifyContent: "space-between",
                          borderRadius: 12,
                          padding: "10px 10px",
                          background: active
                            ? "rgba(255,255,255,0.10)"
                            : "transparent",
                        }}
                      >
                        <span>{n.name}</span>
                        {active ? (
                          <span style={{ opacity: 0.8 }}>✓</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="btnGhost"
              onClick={goPrev}
              disabled={!headings.length || currentIndex <= 0}
            >
              上一章
            </button>
            <button
              className="btnGhost"
              onClick={goNext}
              disabled={!headings.length || currentIndex >= headings.length - 1}
            >
              下一章
            </button>

            <button
              className="btnGhost"
              onClick={() => setPanelOpen((v) => !v)}
              title="展开设置"
            >
              ⚙️ {panelOpen ? "收起" : "设置"}
            </button>
          </div>
        </div>

        {/* 第二行：展开面板（不看书时才需要） */}
        {panelOpen && (
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid var(--border)",
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
            }}
          >
            {/* 主题 */}
            <button
              className="btnGhost"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? "🌙 夜间" : "☀️ 日间"}
            </button>

            {/* 字号 */}
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
                  minWidth: 58,
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
            {/* 顶部 */}
            <button
              className="btnGhost"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              ⬆️ 顶部
            </button>
          </div>
        )}
      </div>

      {/* 正文 */}
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
            const refKey = `h-${b.id}-${b.title}`;
            return (
              <h2
                key={`h-${b.id}-${idx}`}
                ref={(el) => {
                  headingElsRef.current[refKey] = el;
                  if (el) el.dataset.title = b.title;
                }}
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

      {/* 右下角：当前章节 */}
      <div
        style={{
          position: "fixed",
          right: 14,
          bottom: 14,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "flex-end",
        }}
      >
        <button
          className="btnGhost"
          onClick={() => {
            setChapterListOpen(true);
            setNovelOpen(false);
            setFilter("");
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 14,
            border: "1px solid var(--border)",
            background: "rgba(0,0,0,0.18)",
            backdropFilter: "blur(8px)",
            maxWidth: 320,
            textAlign: "left",
            justifyContent: "flex-start",
          }}
          title="点击打开章节列表"
        >
          <span style={{ fontWeight: 700 }}>{currentChapter}</span>
        </button>
      </div>
    </>
  );
}
