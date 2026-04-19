"use client";

import { memo } from "react";
import DOMPurify from "isomorphic-dompurify";

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "article",
    "section",
    "div",
    "p",
    "br",
    "hr",
    "span",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "dl",
    "dt",
    "dd",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "del",
    "ins",
    "mark",
    "small",
    "sub",
    "sup",
    "abbr",
    "cite",
    "q",
    "a",
    "img",
    "figure",
    "figcaption",
    "picture",
    "source",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "caption",
    "pre",
    "code",
    "kbd",
    "samp",
    "var",
    "blockquote",
    "details",
    "summary",
    "time",
  ],
  ALLOWED_ATTR: [
    "href",
    "src",
    "alt",
    "title",
    "width",
    "height",
    "class",
    "id",
    "datetime",
    "loading",
    "decoding",
    "srcset",
    "sizes",
    "colspan",
    "rowspan",
    "scope",
    "data-lang",
    "data-language",
    "target",
    "rel",
  ],
  ALLOW_DATA_ATTR: false,
};

interface ArticleContentProps {
  htmlContent: string;
  className?: string;
}

// Memoized to prevent re-renders from destroying DOM selections and
// injected highlight <mark> elements when parent state changes.
export const ArticleContent = memo(function ArticleContent({
  htmlContent,
  className,
}: ArticleContentProps) {
  const clean = DOMPurify.sanitize(htmlContent, PURIFY_CONFIG);

  return (
    <div
      className={`article-content prose prose-neutral dark:prose-invert max-w-none
        prose-headings:font-bold prose-headings:tracking-tight
        prose-headings:text-[inherit]
        prose-p:text-[inherit]
        prose-li:text-[inherit]
        prose-strong:text-[inherit]
        prose-a:text-primary prose-a:underline prose-a:underline-offset-2
        prose-img:rounded-lg prose-img:mx-auto
        prose-blockquote:border-l-primary/50 prose-blockquote:not-italic prose-blockquote:text-[inherit]/70
        prose-pre:bg-muted prose-pre:text-foreground
        prose-code:before:content-none prose-code:after:content-none
        ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
});
