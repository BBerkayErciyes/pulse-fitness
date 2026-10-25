import type { DailyAccess } from "@/lib/admin/analytics";

const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions) =>
  // Noon UTC keeps the calendar day stable in any formatter timezone.
  new Intl.DateTimeFormat("tr-TR", { ...opts, timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

/**
 * Single-series bar chart of granted gate entries per day. Plain HTML so it
 * renders on the server; hover/focus tooltips are CSS-only. Denied scans and
 * unique members ride along in the tooltip and the table view.
 */
export function AccessChart({ days }: { days: DailyAccess[] }) {
  const max = Math.max(...days.map((d) => d.granted), 0);
  // Round the scale up to a friendly number so the top gridline is readable.
  const step = max <= 5 ? 1 : max <= 20 ? 5 : max <= 100 ? 10 : 50;
  const scaleMax = Math.max(step, Math.ceil(max / step) * step);
  const peak = max > 0 ? days.findLastIndex((d) => d.granted === max) : -1;

  return (
    <figure className="space-y-3">
      <div className="relative">
        {/* Recessive grid: top value and baseline only. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-44 pl-8">
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-border" />
          <div className="absolute inset-x-0 bottom-0 border-t border-border" />
        </div>
        <div aria-hidden className="absolute top-0 left-0 flex h-44 flex-col justify-between text-[11px] text-muted-foreground tabular-nums">
          <span className="-translate-y-1/2">{scaleMax}</span>
          <span className="translate-y-1/2">0</span>
        </div>

        <ol className="relative ml-8 flex h-44 items-end gap-2 sm:gap-4" aria-label="Günlük girişler">
          {days.map((d, i) => {
            const pct = (d.granted / scaleMax) * 100;
            // Keep edge tooltips inside the card (it clips overflow).
            const align =
              i < 2 ? "left-0" : i >= days.length - 2 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <li
                key={d.day}
                tabIndex={0}
                aria-label={`${dayLabel(d.day, { weekday: "long", day: "numeric", month: "long" })}: ${d.granted} giriş, ${d.uniqueMembers} tekil üye, ${d.denied} reddedilen`}
                // Full-height column = hit target larger than the bar itself.
                className="group relative flex h-full flex-1 items-end justify-center rounded-md outline-none hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {i === peak && (
                  <span
                    aria-hidden
                    className="absolute left-1/2 -translate-x-1/2 text-xs font-medium tabular-nums"
                    style={{ bottom: `calc(${pct}% + 4px)` }}
                  >
                    {d.granted}
                  </span>
                )}
                <span
                  aria-hidden
                  className="w-full max-w-10 rounded-t-[4px] bg-chart-1"
                  style={{ height: d.granted > 0 ? `max(${pct}%, 2px)` : "0" }}
                />
                <span
                  aria-hidden
                  className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max rounded-lg ${align} bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10 group-hover:block group-focus-visible:block`}
                >
                  <span className="block font-medium">{dayLabel(d.day, { weekday: "long", day: "numeric", month: "long" })}</span>
                  <span className="mt-1 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-chart-1" />
                    <span className="tabular-nums">{d.granted}</span> giriş
                  </span>
                  <span className="block text-muted-foreground tabular-nums">
                    {d.uniqueMembers} tekil üye · {d.denied} reddedilen
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        <ol aria-hidden className="mt-2 ml-8 flex gap-2 text-center text-[11px] text-muted-foreground sm:gap-4">
          {days.map((d) => (
            <li key={d.day} className="flex-1">
              {dayLabel(d.day, { weekday: "short" })}
              <span className="block tabular-nums">{dayLabel(d.day, { day: "numeric", month: "short" })}</span>
            </li>
          ))}
        </ol>
      </div>

      <details className="group/table text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Tablo olarak göster</summary>
        <table className="mt-2 w-full text-left text-xs">
          <caption className="sr-only">Son {days.length} günün turnike geçişleri</caption>
          <thead className="border-b text-muted-foreground">
            <tr>
              <th scope="col" className="py-1.5 pr-4 font-medium">Gün</th>
              <th scope="col" className="py-1.5 pr-4 text-right font-medium">Giriş</th>
              <th scope="col" className="py-1.5 pr-4 text-right font-medium">Tekil üye</th>
              <th scope="col" className="py-1.5 text-right font-medium">Reddedilen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border tabular-nums">
            {days.map((d) => (
              <tr key={d.day}>
                <th scope="row" className="py-1.5 pr-4 font-normal">
                  {dayLabel(d.day, { weekday: "short", day: "numeric", month: "short" })}
                </th>
                <td className="py-1.5 pr-4 text-right">{d.granted}</td>
                <td className="py-1.5 pr-4 text-right">{d.uniqueMembers}</td>
                <td className="py-1.5 text-right">{d.denied}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
