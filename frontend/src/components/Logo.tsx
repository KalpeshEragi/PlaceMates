/* PlaceMates wordmark: two overlapping circles, powder blue and sunset peach. */
export default function Logo({ light = false, large = false }: { light?: boolean; large?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 font-display font-semibold ${large ? "text-[1.4rem]" : "text-lg"} ${light ? "text-white" : "text-ink"}`}>
      <span className={`relative ${large ? "h-8 w-11" : "h-6 w-8"}`} aria-hidden="true">
        <span className={`absolute left-0 top-0 rounded-full bg-powder-deep/80 ${large ? "h-8 w-8" : "h-6 w-6"}`} />
        <span className={`absolute right-0 top-0 rounded-full bg-peach/90 mix-blend-multiply ${large ? "h-8 w-8" : "h-6 w-6"}`} />
      </span>
      PlaceMates
    </span>
  );
}
