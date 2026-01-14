import fs from "fs";
import path from "path";
import ReaderClient from "./ReaderClient";

function normalizeText(raw: string) {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

export default function HomePage() {
  // ✅ 改这里：chapters/novel.txt
  const filePath = path.join(process.cwd(), "chapters", "novel.txt");

  if (!fs.existsSync(filePath)) {
    return (
      <main className="container">
        <h1 className="h1">小说阅读器</h1>
        <div className="card" style={{ padding: 16 }}>
          <p>
            未找到 <code>chapters/novel.txt</code>
          </p>
          <p>请确认文件路径：项目根目录下的 <code>chapters/novel.txt</code></p>
        </div>
      </main>
    );
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const text = normalizeText(raw);

  // 约定：第一行是书名（没有就兜底）
  const [firstLine, ...rest] = text.split("\n");
  const title = (firstLine || "").trim() || "未命名小说";
  const content = rest.join("\n").trim();

  return (
    <main className="container">
      <header style={{ marginBottom: 12 }}>
        <h1 className="h1">{title}</h1>
      </header>

      {/* 固定 id，用于保存滚动/字号/主题 */}
      <ReaderClient chapterId="novel" content={content} />
    </main>
  );
}
