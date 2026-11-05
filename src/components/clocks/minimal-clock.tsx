import { ClockDigits } from "../ui";
import type { ClockProps } from "./clock";
import { thinDigits } from "./fonts";
import { clockText } from "@/lib/clock-styles";

export function MinimalClock({ remainingSec, overtime }: ClockProps) {
  return (
    <p className={`clock-minimal ${thinDigits.className}`}>
      <ClockDigits value={clockText(remainingSec, overtime)} />
    </p>
  );
}
