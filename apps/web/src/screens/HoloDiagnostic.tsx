import { useState } from 'react';

import { HoloMaterial, Stack } from '@bloomlab/design-system';

import styles from './HoloDiagnostic.module.css';

/**
 * The holographic corner diagnostic (D-086).
 *
 * A real tablet still shows a sharp rectangular flash when a rounded holographic card is tapped,
 * after three causes were found and fixed (D-075) and after an automated tablet probe stopped
 * reporting any. A probe samples what the page says it painted; the remaining fault is in what the
 * device's compositor actually put on the glass, which is why the next step is a real device
 * looking at isolated variants rather than another change made from a desktop.
 *
 * Every card below is the same interactive holographic card as the product's — a button wrapping
 * the material, the same radius, the same ring — with exactly one thing changed. Whichever card
 * stops flashing names the cause. Nothing here is a proposed design: the cards that remove parts
 * of the material are diagnostic instruments, and the answer decides which of them, if any,
 * becomes a fix.
 */

interface Case {
  key: string;
  letter: string;
  title: string;
  what: string;
  why: string;
  /** `split` moves the rounded clip off the transforming element; everything else is CSS. */
  surface?: 'single' | 'split';
}

const CASES: Case[] = [
  {
    key: 'current',
    letter: 'A',
    title: 'The card as it ships',
    what: 'Nothing is changed. This is the card everywhere else in Bloomlab.',
    why: 'The control. If this one does not flash on your tablet either, the fault is somewhere the other cards here do not reach, and we look at the screen it happens on instead.',
  },
  {
    key: 'no-transform',
    letter: 'B',
    title: 'No tilt',
    what: 'The card does not rotate or lift under your finger. Every other layer still moves.',
    why: 'A changing transform is what promotes the card to its own compositor surface. If the flash goes with the tilt, the corner is being lost while that surface is redrawn.',
  },
  {
    key: 'no-shadow',
    letter: 'C',
    title: 'No shadow',
    what: 'The drop shadow and the inner white ring are removed.',
    why: 'A shadow is painted around the card, outside the rounded clip. If the flash goes with it, what you are seeing is the shadow, not the card.',
  },
  {
    key: 'no-overlays',
    letter: 'D',
    title: 'No glare and no grain',
    what: 'The two layers that hang outside the card are not painted at all. The pearl, the bands and the rim stay.',
    why: 'Those two layers are larger than the card and rely entirely on it clipping them. They are the only thing here that can paint a square where a corner should be.',
  },
  {
    key: 'clip-path',
    letter: 'E',
    title: 'Rounded clip-path',
    what: 'The card is cut to its rounded shape by a path as well as by the usual rounded overflow.',
    why: 'A path is a different clipping mechanism and is not the one suspected of being dropped. If this fixes it, the rounded overflow is being ignored during the touch.',
  },
  {
    key: 'split',
    letter: 'F',
    title: 'Tilt outside, rounded clip inside',
    what: 'The tilt and the shadow stay on the outside. A second element inside does the rounded cutting. The card looks and moves the same.',
    surface: 'split',
    why: 'Nothing then asks the device to apply a rounded clip to a surface whose transform is changing. If this fixes it, that combination is the cause and this becomes the fix.',
  },
  {
    key: 'no-will-change',
    letter: 'G',
    title: 'No forced compositor layer',
    what: 'The card still tilts, but it is no longer permanently promoted to its own layer.',
    why: 'The promotion is on all the time, including at rest. If the flash goes with it, the card is being handed to the compositor in a state the browser has not finished rounding.',
  },
  {
    key: 'contained-layers',
    letter: 'H',
    title: 'Layers kept inside the card',
    what: 'The glare and the grain are still painted and still move, but they never extend past the edge of the card.',
    why: 'If no layer hangs outside, losing the clip cannot produce a rectangle. This is D with the light kept rather than removed, and it is the version that could ship.',
  },
  {
    key: 'no-blending',
    letter: 'I',
    title: 'No blending',
    what: 'The glare and the grain are painted normally instead of blended into what is beneath them.',
    why: 'Blending forces the card to be flattened into one image before it is composited. If the flash goes with the blending, that flattening is where the corner is lost.',
  },
];

export default function HoloDiagnostic() {
  const [held, setHeld] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [taps, setTaps] = useState<Record<string, number>>({});

  // A tap counts the tap and nothing else. Selection is its own control, because the ring a
  // selected card wears is one of the things being tested and must not ride along on every tap.
  const tapped = (key: string) =>
    setTaps((previous) => ({ ...previous, [key]: (previous[key] ?? 0) + 1 }));

  return (
    <Stack as="section" gap={4} className={styles.screen} aria-labelledby="holo-diagnostic-title">
      <Stack gap={2}>
        <h1 id="holo-diagnostic-title">Holographic corners</h1>
        <p className={styles.lede}>
          Nine cards, each the same as a real Bloomlab card with one thing changed. Tap and hold
          each one on the tablet where the sharp corner appears, then tell us which letters flash
          and which do not. A tap does nothing but count itself, so what you see is the card
          responding to your finger and nothing else.
        </p>
        <p className={styles.lede}>
          Watch the four corners at the moment your finger lands, and again the moment it lifts. A
          card counts as flashing if a straight edge or a pointed corner appears for even one frame.
          Then use “Keep selected” under any card that flashed and tap it again: the ring a selected
          card wears is drawn by the button around the material, so it is worth telling apart from
          the material itself.
        </p>
      </Stack>

      <ol className={styles.cases}>
        {CASES.map((item) => {
          const count = taps[item.key] ?? 0;
          return (
            <li key={item.key} className={styles.case}>
              <Stack gap={2}>
                <h2 className={styles.title}>
                  {item.letter}. {item.title}
                </h2>
                <button
                  type="button"
                  className={styles.card}
                  data-case={item.key}
                  data-holo-case={item.letter}
                  aria-pressed={selected === item.key}
                  onClick={() => tapped(item.key)}
                  onPointerDown={() => setHeld(item.key)}
                  onPointerUp={() => setHeld(null)}
                  onPointerCancel={() => setHeld(null)}
                  onPointerLeave={() =>
                    setHeld((previous) => (previous === item.key ? null : previous))
                  }
                >
                  <HoloMaterial
                    as="span"
                    variant="collectible"
                    radius="xl"
                    surface={item.surface ?? 'single'}
                    className={styles.material}
                  >
                    <span className={styles.face}>
                      <span className={styles.letter}>{item.letter}</span>
                      <span className={styles.faceTitle}>{item.title}</span>
                      <span className={styles.faceState}>
                        {held === item.key
                          ? 'Held'
                          : selected === item.key
                            ? 'Selected'
                            : count > 0
                              ? `Tapped ${count} ${count === 1 ? 'time' : 'times'}`
                              : 'Not tapped yet'}
                      </span>
                    </span>
                  </HoloMaterial>
                </button>
                <button
                  type="button"
                  className={styles.toggle}
                  aria-pressed={selected === item.key}
                  onClick={() =>
                    setSelected((previous) => (previous === item.key ? null : item.key))
                  }
                >
                  {selected === item.key ? 'Selected — tap to clear' : 'Keep selected'}
                </button>
                <p className={styles.what}>{item.what}</p>
                <p className={styles.why}>{item.why}</p>
              </Stack>
            </li>
          );
        })}
      </ol>

      <Stack gap={2} className={styles.footnote}>
        <h2 className={styles.title}>What to send back</h2>
        <p className={styles.what}>
          The letters that still flash, the letters that do not, and which tablet and browser you
          used. If every card flashes, say so — that rules out the whole material and points at the
          screen the card sits on instead.
        </p>
      </Stack>
    </Stack>
  );
}
