import Link from "next/link";
import { listChapterIds, readChapter } from "../../../../lib/chapters";
import ReaderClient from "./ReaderClient";

export const dynamicParams = false;
export const revalidate = false;

export function generateStaticParams() {
  return listChapterIds().map((id) => ({ id }));
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  // ✅ 兼容 params 可能是 Promise 的情况
  const { id } = await Promise.resolve(params);

  const ids = listChapterIds();
  const idx = ids.indexOf(id);
  const prev = idx > 0 ? ids[idx - 1] : null;
  const next = idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null;

  const chapter = readChapter(id);

  return (
    <main className="container">
      <p>
        <Link href="/">← 返回目录</Link>
      </p>

      <h1>{chapter.title}</h1>

      <ReaderClient chapterId={chapter.id} content={chapter.content} />

      <nav className="nav">
        <div>
          {prev ? <Link href={`/chapter/${prev}`}>← 上一章</Link> : <span />}
        </div>
        <div>
          {next ? <Link href={`/chapter/${next}`}>下一章 →</Link> : <span />}
        </div>
      </nav>
    </main>
  );
}
