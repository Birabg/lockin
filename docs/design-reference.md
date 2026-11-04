# Dashboard design reference

Measured from the public preview of nuzz.space/dashboard in headless Chrome, at 1920×1080 and 1440×900, signed out, device pixel ratio 1, no browser zoom. Sizes are CSS pixels and were the same at both window sizes unless a row says otherwise. Only these numbers were taken. No Nuzz images, icons, logos or wording are used in Lockin.

## Font

| Where   | Value                                                   |
| ------- | ------------------------------------------------------- |
| Family  | DM Sans, on body, headings, nav, cards and numbers      |
| Licence | SIL Open Font License, on Google Fonts. Free to use     |
| Base    | 16px / 24px, weight 400                                 |
| Numbers | `font-variant-numeric: tabular-nums` on times and stats |

Because DM Sans is free, Lockin uses the same font through `next/font/google`, not a lookalike.

DM Sans has no `tnum` feature, in Google's files or the full upstream font, so `tabular-nums` changes nothing. Lockin's live clocks use `ClockDigits` in `src/components/ui.tsx` to keep each digit in a fixed slot.

## Type scale

| Element             | Size / line height | Weight   | Letter spacing    | Colour            |
| ------------------- | ------------------ | -------- | ----------------- | ----------------- |
| Nav label, active   | 15.5 / 23.25       | 800      | -0.025em          | foreground        |
| Nav label, inactive | 15.5 / 23.25       | 500      | -0.025em          | foreground at 80% |
| Start focus         | 15.5 / 23.25       | 800      | normal            | on accent         |
| Sidebar user name   | 14.5 / 21.75       | 800      | -0.025em          | foreground        |
| Post author name    | 14.5 / 21.75       | 600      | -0.01em           | foreground        |
| Post @handle        | 11.5 / 17.25       | 400      | normal            | muted             |
| Post time, streak   | 11 / 16            | 400, 700 | normal            | muted, streak     |
| Post body           | 14.5 / 22.475      | 400      | normal            | foreground        |
| Section label       | 10.5 / 15.75       | 700      | 0.16em, uppercase | muted             |
| Tab, active         | 13 / 19.5          | 800      | normal            | foreground        |
| Tab, inactive       | 13 / 19.5          | 600      | normal            | muted             |
| Inset panel label   | 11.5 / 17.25       | 600      | normal            | muted             |
| Inset panel value   | 12 / 18            | 700      | normal, tabular   | foreground        |
| Timeline ticks      | 11.5               | 700      | normal, tabular   | muted at 80%      |
| Goal big number     | 20 / 20            | 800      | -0.5px, tabular   | foreground        |
| Rail streak number  | 18 / 18            | 800      | -0.45px           | foreground        |
| Rail "day streak"   | 12.5 / 18.75       | 700      | normal            | muted             |
| Rail sub line       | 12.5 / 18.75       | 400      | normal            | muted             |
| Rail card title     | 14.5 / 21.75       | 600      | -0.025em          | foreground        |
| Rail row name       | 13.5 / 20.25       | 600      | -0.025em          | foreground        |
| Rail row value      | 12.5 / 18.75       | 700      | normal, tabular   | muted             |
| Banner button       | 12.5               | 600      | normal            | on accent         |

## Page layout

| Measure                 | 1920  | 1440 |
| ----------------------- | ----- | ---- |
| Sidebar left edge       | 76.8  | 57.6 |
| Sidebar width           | 220   | 220  |
| Gap, sidebar to feed    | 273   | 52   |
| Feed width              | 672   | 672  |
| Gap, feed to rail       | 248   | 60   |
| Rail width              | 288   | 288  |
| Space right of the rail | 141.6 | 90   |

The sidebar sits 4% in from the left. The three gaps then share what is left: of each extra pixel of window, about 46% goes before the feed, 39% between feed and rail, and 11% after the rail.

## Sidebar

| Part        | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Container   | padding 16px 12px, transparent background, no border                        |
| Logo row    | logo inset 14px, collapse button 32×32 round, muted                         |
| Nav list    | starts 16px under the logo row, gap 2px                                     |
| Nav item    | 196×48, padding 0 12px 0 14px, gap 16px, fully round                        |
| Active item | inset background                                                            |
| Icon        | 23×23                                                                       |
| Start focus | 196×48, fully round, 14px under the nav, gap 8px, icon 18px, shadow 0 3px 0 |
| User row    | 196×56, padding 8px, gap 12px, fully round, "…" on the right                |

## Feed column

| Part               | Value                                                           |
| ------------------ | --------------------------------------------------------------- |
| Search button      | 32×32, top right of the column                                  |
| Banner or composer | 62 high, padding 12px 14px, radius 20px, 1px border, gap 12px   |
| Banner button      | 36 high, padding 0 16px, fully round                            |
| Tab row            | 20px under the banner, 20px over the first label, space between |
| Tab group          | 360×44, padding 4px, radius 20px, inset background at 60%       |
| Tab                | 36 high, radius 16px, gap 6px, three equal widths               |
| Refresh            | 36×36 round, 1px border, card background                        |
| Section label      | padding 0 4px, 10px over the list                               |
| Gap between posts  | 24px                                                            |

## Post card

| Part            | Value                                                                                   |
| --------------- | --------------------------------------------------------------------------------------- |
| Card            | radius 20px, 1px border, shadow 0 2px 0                                                 |
| Body            | padding 20px 20px 16px                                                                  |
| Header          | avatar 40×40, gap 12px, name and handle on one line, time and streak under it           |
| Media and stats | 12px under the header, columns 3fr / 2fr, gap 12px                                      |
| Media           | 370.8×278.1, a 4:3 box, radius 20px                                                     |
| Stats column    | two equal panels, 134 high, gap 10px                                                    |
| Inset panel     | radius 20px, inset background at 40%, padding 10px 14px, and 6px 14px on the goal panel |
| Post text       | under the media                                                                         |
| Footer          | padding 8px 12px, top border at 60%, gap 4px, 53 high                                   |

## Right rail

| Part            | Value                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| Stack           | cards 284 wide inside the 288 column, gap 10px                                               |
| All cards       | radius 20px, 1px border, shadow 0 2px 0                                                      |
| Streak card     | padding 14px, header gap 10px, 40.8 high                                                     |
| Streak divider  | 1px at 50%, 10px of space under it                                                           |
| Streak day cell | 31×30, radius 12px, gap 6px                                                                  |
| Focusing now    | padding 16px, icon 36px, gap 12px                                                            |
| Leaderboard     | padding 14px, header 32 high with gap 10px and a divider under it                            |
| Leaderboard row | 44 high, padding 6px, radius 16px, gap 10px, avatar 32px, rows run 6px past the card padding |

## Where the brief and the measurements differ

The brief gave some numbers read from a screenshot. Every one is about 1.25 times the real CSS value, which is what a Windows display set to 125% produces.

| Measure         | Brief | Measured |
| --------------- | ----- | -------- |
| Feed width      | 840   | 672      |
| Rail width      | 355   | 288      |
| Nav item height | 56    | 48       |
| Sidebar width   | 240   | 220      |
| Card radius     | 24    | 20       |

Lockin uses the measured values. On a 125% display those show up at the same size as the numbers in the brief. To try other sizes, change the variables at the top of `src/app/globals.css`.
