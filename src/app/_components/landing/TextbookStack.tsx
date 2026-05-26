const BOOKS = [
  { title: "CALC III", color: "#3B82F6", rotate: -2 },
  { title: "ALGORITHMS", color: "#CD8407", rotate: 1 },
  { title: "LINEAR ALGEBRA", color: "#F34D52", rotate: -1 },
  { title: "AI · NODEGENT", color: "#1D1D1D", rotate: 2 },
];

/**
 * Decorative stack of colored textbook spines. Used as a layered desk
 * decoration alongside the MacBook in the hero. The bottom spine carries
 * a quiet “Nodegent” easter egg label.
 */
export function TextbookStack({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none flex flex-col gap-1.5 ${className}`}
      aria-hidden="true"
    >
      {BOOKS.map((b) => (
        <div
          key={b.title}
          className="textbook-spine"
          style={{
            backgroundColor: b.color,
            transform: `rotate(${b.rotate}deg)`,
          }}
        >
          {b.title}
        </div>
      ))}
    </div>
  );
}
