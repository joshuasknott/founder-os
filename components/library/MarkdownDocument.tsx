import { parseMarkdownBlocks } from "@/lib/markdown";

export function MarkdownDocument({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <article className="space-y-4 text-sm leading-7 text-text-secondary">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const className = block.level === 1
            ? "pt-1 text-2xl font-semibold tracking-tight text-text-primary"
            : block.level === 2
              ? "pt-3 text-lg font-semibold text-text-primary"
              : "pt-2 text-sm font-bold uppercase tracking-wide text-text-primary";
          return <h3 key={index} className={className}>{block.text}</h3>;
        }
        if (block.type === "unordered_list") {
          return <ul key={index} className="list-disc space-y-1 pl-5">{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
        }
        if (block.type === "ordered_list") {
          return <ol key={index} className="list-decimal space-y-1 pl-5">{block.items.map((item) => <li key={item}>{item}</li>)}</ol>;
        }
        if (block.type === "quote") return <blockquote key={index} className="border-l-2 border-black/15 pl-4 italic">{block.text}</blockquote>;
        if (block.type === "code") return <pre key={index} className="overflow-x-auto rounded-lg bg-surface p-3 text-xs leading-5 text-text-primary">{block.text}</pre>;
        if (block.type === "divider") return <hr key={index} className="border-black/[0.08]" />;
        return <p key={index}>{block.text}</p>;
      })}
    </article>
  );
}
