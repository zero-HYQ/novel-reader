import Link from "next/link";
import { listChapterIds, readChapter } from "../../lib/chapters";

export default function HomePage() {
  const ids = listChapterIds();
  const chapters = ids.map((id) => {
    const ch = readChapter(id);
    return { id: ch.id, title: ch.title };
  });

  return (
    <main className="container">
      <h1>小说目录</h1>
      <div>
        {chapters.length === 0 ? (
          <p>未找到章节，请在 /chapters 放入 001.txt、002.txt ...</p>
        ) : (
          <ol>
            {chapters.map((c) => (
              <li key={c.id} className="pt-4">
                <Link href={`/chapter/${c.id}`}>{c.title}</Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
