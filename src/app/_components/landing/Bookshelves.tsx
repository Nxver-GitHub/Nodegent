const LEFT_SHELF_1 = [
  { title: "ORG CHEM",  color: "#3B82F6" },
  { title: "PSYCH 1A",  color: "#8B5CF6" },
  { title: "CALC III",  color: "#CD8407" },
  { title: "ECON 1",    color: "#7CC36E" },
];
const LEFT_SHELF_2 = [
  { title: "STAT 7",    color: "#F34D52" },
  { title: "PHYS 5A",   color: "#1D1D1D" },
  { title: "BIO 20C",   color: "#3B82F6" },
  { title: "ANTH 2",    color: "#CD8407" },
];
const LEFT_SHELF_3 = [
  { title: "WRITING",   color: "#8B5CF6" },
  { title: "HIST 1A",   color: "#7CC36E" },
  { title: "MUS APPR",  color: "#F34D52" },
  { title: "ART 10",    color: "#1D1D1D" },
];

const RIGHT_SHELF_1 = [
  { title: "LINEAR A",  color: "#F34D52" },
  { title: "NETWORKS",  color: "#3B82F6" },
  { title: "ALGO",      color: "#CD8407" },
  { title: "OS DESIGN", color: "#7CC36E" },
];
const RIGHT_SHELF_2 = [
  { title: "AI & ML",   color: "#8B5CF6" },
  { title: "DISCRETE",  color: "#1D1D1D" },
  { title: "COMPILER",  color: "#F34D52" },
  { title: "CRYPTO",    color: "#3B82F6" },
];
const RIGHT_SHELF_3 = [
  { title: "DB SYSTEMS",color: "#CD8407" },
  { title: "SW ENGG",   color: "#7CC36E" },
  { title: "HCI",       color: "#8B5CF6" },
  { title: "CAPSTONE",  color: "#1D1D1D" },
];

function ShelfSection({ books }: { books: { title: string; color: string }[] }) {
  return (
    <div className="bookshelf-section">
      {books.map((b) => (
        <div key={b.title} className="shelf-book" style={{ backgroundColor: b.color }}>
          {b.title}
        </div>
      ))}
    </div>
  );
}

export function Bookshelves() {
  return (
    <>
      {/* Left bookshelf — only on very wide screens */}
      <div
        className="bookshelf-panel bookshelf-panel-left hidden 2xl:flex"
        aria-hidden="true"
      >
        <ShelfSection books={LEFT_SHELF_1} />
        <div className="bookshelf-plank" />
        <ShelfSection books={LEFT_SHELF_2} />
        <div className="bookshelf-plank" />
        <ShelfSection books={LEFT_SHELF_3} />
        <div className="bookshelf-plank" />
        <ShelfSection books={LEFT_SHELF_1.slice().reverse()} />
      </div>

      {/* Right bookshelf */}
      <div
        className="bookshelf-panel bookshelf-panel-right hidden 2xl:flex"
        aria-hidden="true"
      >
        <ShelfSection books={RIGHT_SHELF_1} />
        <div className="bookshelf-plank" />
        <ShelfSection books={RIGHT_SHELF_2} />
        <div className="bookshelf-plank" />
        <ShelfSection books={RIGHT_SHELF_3} />
        <div className="bookshelf-plank" />
        <ShelfSection books={RIGHT_SHELF_1.slice().reverse()} />
      </div>
    </>
  );
}
