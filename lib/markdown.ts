export type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "unordered_list"; items: string[] }
  | { type: "ordered_list"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "code"; text: string }
  | { type: "divider" };

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim().startsWith("```")) {
      flushParagraph();
      if (code) {
        blocks.push({ type: "code", text: code.join("\n") });
        code = null;
      } else {
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flushParagraph();
      blocks.push({ type: "divider" });
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushParagraph();
      blocks.push({ type: "quote", text: line.replace(/^>\s?/, "") });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      const items = [line.replace(/^[-*]\s+/, "")];
      while (index + 1 < lines.length && /^[-*]\s+/.test(lines[index + 1])) {
        items.push(lines[++index].replace(/^[-*]\s+/, ""));
      }
      blocks.push({ type: "unordered_list", items });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      const items = [line.replace(/^\d+\.\s+/, "")];
      while (index + 1 < lines.length && /^\d+\.\s+/.test(lines[index + 1])) {
        items.push(lines[++index].replace(/^\d+\.\s+/, ""));
      }
      blocks.push({ type: "ordered_list", items });
      continue;
    }
    paragraph.push(line.trim());
  }

  flushParagraph();
  if (code) blocks.push({ type: "code", text: code.join("\n") });
  return blocks;
}
