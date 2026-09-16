import { useEffect, useRef, useState } from "react";

export function useScrollToBottom<T extends HTMLElement>(
  dependencies: any[],
  isStreaming: boolean
) {
  const containerRef = useRef<T>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Check if we are at bottom
  const checkScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // 50px threshold
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(atBottom);
  };

  // Scroll to bottom manually
  const scrollToBottom = () => {
    if (!containerRef.current) return;
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth"
    });
    setIsAtBottom(true);
  };

  // Auto scroll if we were at bottom and new content arrives (like streaming)
  useEffect(() => {
    if (isAtBottom && containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: isStreaming ? "auto" : "smooth"
      });
    }
  }, [...dependencies, isStreaming, isAtBottom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    el.addEventListener("scroll", checkScroll, { passive: true });
    return () => el.removeEventListener("scroll", checkScroll);
  }, []);

  return { containerRef, isAtBottom, scrollToBottom };
}
