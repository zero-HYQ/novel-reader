"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ReaderClient from "./ReaderClient";

const LS_NOVEL = "nr_current_novel";

type NovelOption = { key: string; name: string; file: string };

const NOVELS: NovelOption[] = [
  { key: "novel", name: "重返狼群 1", file: "/novel.txt" },
  { key: "novel2", name: "重返狼群 2", file: "/novel2.txt" },
];

export default function ReaderPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlNovel = sp.get("novel");

  const [novelKey, setNovelKey] = useState<string>("novel");
  const novel = useMemo(
    () => NOVELS.find((n) => n.key === novelKey) || NOVELS[0],
    [novelKey]
  );

  // 初始化：URL 优先，否则 localStorage 记忆
  useEffect(() => {
    if (urlNovel) {
      setNovelKey(urlNovel);
      localStorage.setItem(LS_NOVEL, urlNovel);
      return;
    }

    const last = localStorage.getItem(LS_NOVEL);
    if (last) {
      setNovelKey(last);
      const params = new URLSearchParams(sp.toString());
      params.set("novel", last);
      router.replace(`${pathname}?${params.toString()}`);
    } else {
      // 没有记忆，就把默认 novel 写入 URL，方便离线/刷新
      const params = new URLSearchParams(sp.toString());
      params.set("novel", "novel");
      router.replace(`${pathname}?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlNovel]);

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  // 加载小说（在线：网络；离线：SW 缓存）
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setContent("");

    fetch(novel.file, { cache: "force-cache" })
      .then((r) => r.text())
      .then((txt) => {
        if (!alive) return;
        setContent(txt || "");
      })
      .catch(() => {
        if (!alive) return;
        setContent("（离线/读取失败：请确认 public 下存在对应 txt 文件）");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [novel.file]);

  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <div className="container">
        <ReaderClient
          chapterId="full"
          content={loading ? "加载中..." : content}
          novelKey={novel.key}
          novelOptions={NOVELS.map(({ key, name }) => ({ key, name }))}
        />
      </div>
    </Suspense>
  );
}
