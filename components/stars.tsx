export function Stars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`Ocjena ${rating} od 5`} className="tracking-wide whitespace-nowrap text-amber-500">
      {"★★★★★".slice(0, rating)}
      <span className="text-stone-300">{"★★★★★".slice(rating)}</span>
    </span>
  );
}
