/**
 * Early-release ("beta") labelling. The app is shipped but still under active
 * testing, so it says so plainly in three places: a small pill beside the brand
 * (BetaPill), a one-line strip under the top bar on every screen (BetaStrip), and
 * a fuller explanation card on the import on-ramp (BetaNotice). The gold (tuscan)
 * is the app's existing caution colour. Copy lives in appMeta.ts.
 */
import { BeakerIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Card } from "./ui";
import {
  BETA_BODY_1,
  BETA_BODY_2_PREFIX,
  BETA_HEADING,
  BETA_LABEL,
  BETA_STRIP_BODY,
  CONTACT_EMAIL,
} from "../appMeta";

/** Small gold pill shown next to the brand in the top bar. */
export function BetaPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-tuscan-dark bg-tuscan px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-graphite">
      <BeakerIcon className="h-3.5 w-3.5" />
      {BETA_LABEL}
    </span>
  );
}

/** One-line gold strip under the top bar — present on every screen. */
export function BetaStrip() {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-tuscan-dark bg-tuscan/20 px-6 py-1.5 text-xs text-graphite/80">
      <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-tuscan-dark" />
      <span>
        <strong className="font-semibold text-graphite">Early release</strong> — {BETA_STRIP_BODY}{" "}
        <a className="font-medium text-coral-text underline" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
      </span>
    </div>
  );
}

/** Fuller explanation card for the import on-ramp. */
export function BetaNotice() {
  return (
    <Card className="border-tuscan/60 bg-tuscan/10">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-graphite">
        <BeakerIcon className="h-5 w-5 text-tuscan-dark" />
        {BETA_HEADING}
      </h2>
      <p className="mt-2 text-sm text-graphite/80">{BETA_BODY_1}</p>
      <p className="mt-3 text-sm text-graphite/80">
        {BETA_BODY_2_PREFIX}{" "}
        <a className="text-coral-text underline" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </Card>
  );
}
