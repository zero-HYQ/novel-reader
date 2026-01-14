import fs from "fs";
import path from "path";

const CHAPTER_DIR = path.join(process.cwd(), "chapters");

export type Chapter = {
  id: string;
  title: string;
  content: string;
};

function normalizeText(raw: string) {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

export function listChapterIds(): string[] {
  if (!fs.existsSync(CHAPTER_DIR)) return [];
  return fs
    .readdirSync(CHAPTER_DIR)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => f.replace(/\.txt$/, ""))
    .sort((a, b) => a.localeCompare(b, "en"));
}

export function readChapter(id: string): Chapter {
  const filePath = path.join(CHAPTER_DIR, `${id}.txt`);
  const raw = fs.readFileSync(filePath, "utf-8");
  const text = normalizeText(raw).trim();

  const [firstLine, ...rest] = text.split("\n");
  const title = (firstLine || "").trim() || `第 ${id} 章`;
  const content = rest.join("\n").trim();

  return { id, title, content };
}
