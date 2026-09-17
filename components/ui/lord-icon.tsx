"use client";

import { createElement, useCallback, useEffect, useRef, useState, type CSSProperties, type HTMLAttributes } from "react";
import type { Player } from "@lordicon/react";
import { cn } from "@/lib/utils";
import { LORDICON_ASSETS, type LordIconName } from "./lordicon-assets";
import { useUIMotionEnabled } from "./ui-performance-controller";

export type { LordIconName } from "./lordicon-assets";

export type IconProps = HTMLAttributes<HTMLSpanElement> & {
  size?: number | string;
  /** Kept for existing icon callers; Lordicon defines its own path weights. */
  strokeWidth?: number | string;
  active?: boolean;
  label?: string;
  targetId?: string;
};

type Playback = { Player: typeof Player; icon: object; state?: string };
const animations = new Map<string, Promise<Playback>>();

function loadAnimation(asset: string): Promise<Playback> {
  const cached = animations.get(asset);
  if (cached) return cached;
  const loading = Promise.all([
    import("@lordicon/react"),
    fetch(`/lordicon/${asset}.json`).then(async (response) => {
      if (!response.ok) throw new Error(`Unable to load icon: ${asset}`);
      return response.json();
    }),
  ]).then(([module, icon]) => {
    const states: string[] = (icon.markers ?? []).map((marker: { cm: string }) => marker.cm.split(":").at(-1));
    // Entrance states can begin with an empty frame. Prefer an interaction state.
    const state = states.find((name) => name.startsWith("hover-")) ?? states.find((name) => name.startsWith("loop-"));
    // The official player uses a div host. Icons also appear inside paragraphs,
    // so retain its ref/shadow renderer with a valid inline host element.
    class InlinePlayer extends module.Player {
      render() {
        return createElement("span", super.render().props);
      }
    }
    return { Player: InlinePlayer, icon, state };
  }).catch((error) => {
    animations.delete(asset);
    throw error;
  });
  animations.set(asset, loading);
  return loading;
}

export function LordIcon(props: IconProps & { name: LordIconName }) {
  return <LordIconPlayer key={props.name} {...props} />;
}

function LordIconPlayer({ name, size, className, active = false, label, targetId, style, strokeWidth, ...props }: IconProps & { name: LordIconName }) {
  void strokeWidth;
  const definition = LORDICON_ASSETS[name];
  const asset = definition.asset;
  const rotation = "rotation" in definition ? definition.rotation : 0;
  const loop = name === "Loader2" || name === "LoaderCircle";
  const motionEnabled = useUIMotionEnabled();
  const rootRef = useRef<HTMLSpanElement>(null);
  const playerRef = useRef<Player>(null);
  const requestedRef = useRef(false);
  const reducedRef = useRef(false);
  const mountedRef = useRef(false);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playerSize, setPlayerSize] = useState(20);

  const play = useCallback(() => {
    if (reducedRef.current || document.hidden || requestedRef.current) return;
    requestedRef.current = true;
    setPlayerSize(rootRef.current?.getBoundingClientRect().width || 20);
    if (playerRef.current) {
      setPlaying(true);
      playerRef.current.playFromBeginning();
      return;
    }
    void loadAnimation(asset).then((data) => {
      if (mountedRef.current && requestedRef.current && !reducedRef.current) setPlayback(data);
    }).catch(() => {
      // The same locally served Lordicon SVG remains visible if animation fails.
      requestedRef.current = false;
    });
  }, [asset]);

  useEffect(() => {
    mountedRef.current = true;
    const syncMotion = () => {
      reducedRef.current = !motionEnabled;
      if (!motionEnabled) {
        requestedRef.current = false;
        playerRef.current?.pause();
        setPlaying(false);
        setPlayback(null);
      } else if (loop || active) play();
    };
    syncMotion();
    return () => {
      mountedRef.current = false;
      requestedRef.current = false;
    };
  }, [active, loop, motionEnabled, play]);

  useEffect(() => {
    const root = rootRef.current;
    if (!playing || !root) return;
    const observer = new ResizeObserver(() => setPlayerSize(root.getBoundingClientRect().width || 20));
    observer.observe(root);
    return () => observer.disconnect();
  }, [playing]);

  useEffect(() => {
    const root = rootRef.current;
    const target = (targetId ? document.getElementById(targetId) : null)
      ?? root?.closest("button, a[href], [role='button'], [role='tab'], [role='menuitem'], summary, [data-lordicon-trigger]")
      ?? root;
    if (!target) return;
    const enter = (event: Event) => {
      if ((event as PointerEvent).pointerType !== "touch") play();
    };
    const down = (event: Event) => {
      if ((event as PointerEvent).pointerType !== "mouse") play();
    };
    target.addEventListener("pointerenter", enter);
    target.addEventListener("pointerdown", down);
    target.addEventListener("focusin", play);
    return () => {
      target.removeEventListener("pointerenter", enter);
      target.removeEventListener("pointerdown", down);
      target.removeEventListener("focusin", play);
    };
  }, [play, targetId]);

  const title = label ?? props["aria-label"];
  const iconStyle = {
    ...(size === undefined ? {} : { width: size, height: size }),
    ...style,
    "--lordicon-asset": `url("/lordicon/${asset}.svg")`,
    "--lordicon-rotation": `${rotation}deg`,
  } as CSSProperties;

  return (
    <span
      {...props}
      ref={rootRef}
      className={cn("lordicon-icon relative inline-flex size-5 shrink-0 align-middle", className, loop && "lordicon-loader")}
      style={iconStyle}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-lordicon-name={name}
      data-lordicon-animating={playing ? "true" : "false"}
    >
      <span className="lordicon-artwork" aria-hidden="true">
        <span className="lordicon-static" style={{ visibility: playing ? "hidden" : "visible" }} />
        {playback ? <span className="lordicon-player" style={{ visibility: playing ? "visible" : "hidden" }}>
          <playback.Player
            ref={playerRef}
            icon={playback.icon}
            state={playback.state}
            size={playerSize}
            colorize="currentColor"
            onReady={() => {
              // The class ref is attached after the player's mount callback.
              queueMicrotask(() => {
                if (mountedRef.current && requestedRef.current && !reducedRef.current) {
                  setPlaying(true);
                  playerRef.current?.playFromBeginning();
                }
              });
            }}
            onComplete={() => {
              if (loop && !reducedRef.current && !document.hidden) playerRef.current?.playFromBeginning();
              else {
                requestedRef.current = false;
                setPlaying(false);
                setPlayback(null);
              }
            }}
          />
        </span> : null}
      </span>
    </span>
  );
}
