"use client";

import { Children, type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  children: ReactNode;
  direction?: "horizontal" | "vertical";
  storageKey?: string;
  defaultRatio?: number;
  minPrimaryPx?: number;
  minSecondaryPx?: number;
  minRatio?: number;
  maxRatio?: number;
  desktopMediaQuery?: string;
  dividerAriaLabel?: string;
  className?: string;
  primaryPaneClassName?: string;
  secondaryPaneClassName?: string;
};

const HORIZONTAL_STORAGE_KEY = "leetcodepro-problem-layout-left-ratio";
const HORIZONTAL_DEFAULT_RATIO = 0.4;
const HORIZONTAL_MIN_PRIMARY_PX = 340;
const HORIZONTAL_MIN_SECONDARY_PX = 520;
const HORIZONTAL_MIN_RATIO = 0.28;
const HORIZONTAL_MAX_RATIO = 0.72;
const DEFAULT_DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";
const SPLITTER_GAP_PX = 12;

function cx(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function clampRatio(
  nextRatio: number,
  containerSize: number,
  defaultRatio: number,
  minPrimaryPx: number,
  minSecondaryPx: number,
  minRatio: number,
  maxRatio: number
): number {
  const safeRatio = Number.isFinite(nextRatio) ? nextRatio : defaultRatio;
  if (!Number.isFinite(containerSize) || containerSize <= 0) {
    return Math.min(maxRatio, Math.max(minRatio, safeRatio));
  }

  const minBySize = minPrimaryPx / containerSize;
  const maxBySize = 1 - minSecondaryPx / containerSize;
  const lowerBound = Math.max(minRatio, minBySize);
  const upperBound = Math.min(maxRatio, maxBySize);

  if (lowerBound > upperBound) {
    return Math.min(maxRatio, Math.max(minRatio, safeRatio));
  }

  return Math.min(upperBound, Math.max(lowerBound, safeRatio));
}

export default function ProblemResizableLayout({
  children,
  direction = "horizontal",
  storageKey,
  defaultRatio,
  minPrimaryPx,
  minSecondaryPx,
  minRatio,
  maxRatio,
  desktopMediaQuery = DEFAULT_DESKTOP_MEDIA_QUERY,
  dividerAriaLabel,
  className,
  primaryPaneClassName,
  secondaryPaneClassName
}: Props) {
  const resolvedStorageKey = storageKey ?? (direction === "horizontal" ? HORIZONTAL_STORAGE_KEY : "leetcodepro-problem-layout-top-ratio");
  const resolvedDefaultRatio = defaultRatio ?? (direction === "horizontal" ? HORIZONTAL_DEFAULT_RATIO : 0.5);
  const resolvedMinPrimaryPx = minPrimaryPx ?? (direction === "horizontal" ? HORIZONTAL_MIN_PRIMARY_PX : 220);
  const resolvedMinSecondaryPx = minSecondaryPx ?? (direction === "horizontal" ? HORIZONTAL_MIN_SECONDARY_PX : 220);
  const resolvedMinRatio = minRatio ?? (direction === "horizontal" ? HORIZONTAL_MIN_RATIO : 0.2);
  const resolvedMaxRatio = maxRatio ?? (direction === "horizontal" ? HORIZONTAL_MAX_RATIO : 0.8);
  const panels = Children.toArray(children);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [primaryRatio, setPrimaryRatio] = useState(resolvedDefaultRatio);

  const resolveContainerSize = useCallback((): number => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return 0;
    }
    return direction === "horizontal" ? rect.width : rect.height;
  }, [direction]);

  const applyRatio = useCallback((nextRatio: number) => {
    const containerSize = resolveContainerSize();
    const clamped = clampRatio(
      nextRatio,
      containerSize,
      resolvedDefaultRatio,
      resolvedMinPrimaryPx,
      resolvedMinSecondaryPx,
      resolvedMinRatio,
      resolvedMaxRatio
    );
    setPrimaryRatio(clamped);
  }, [resolveContainerSize, resolvedDefaultRatio, resolvedMaxRatio, resolvedMinPrimaryPx, resolvedMinRatio, resolvedMinSecondaryPx]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(resolvedStorageKey);
      if (!raw) {
        return;
      }

      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        applyRatio(parsed);
      }
    } catch {
      // Ignore read failures.
    }
  }, [applyRatio, resolvedStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(resolvedStorageKey, String(primaryRatio));
    } catch {
      // Ignore write failures.
    }
  }, [primaryRatio, resolvedStorageKey]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(desktopMediaQuery);
    const sync = () => {
      const nextDesktop = mediaQuery.matches;
      setIsDesktop(nextDesktop);
      if (nextDesktop) {
        const containerSize = resolveContainerSize();
        setPrimaryRatio((previous) =>
          clampRatio(
            previous,
            containerSize,
            resolvedDefaultRatio,
            resolvedMinPrimaryPx,
            resolvedMinSecondaryPx,
            resolvedMinRatio,
            resolvedMaxRatio
          )
        );
      }
    };

    sync();
    mediaQuery.addEventListener("change", sync);
    return () => {
      mediaQuery.removeEventListener("change", sync);
    };
  }, [
    desktopMediaQuery,
    resolveContainerSize,
    resolvedDefaultRatio,
    resolvedMaxRatio,
    resolvedMinPrimaryPx,
    resolvedMinRatio,
    resolvedMinSecondaryPx
  ]);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }

    const handleResize = () => {
      const containerSize = resolveContainerSize();
      setPrimaryRatio((previous) =>
        clampRatio(
          previous,
          containerSize,
          resolvedDefaultRatio,
          resolvedMinPrimaryPx,
          resolvedMinSecondaryPx,
          resolvedMinRatio,
          resolvedMaxRatio
        )
      );
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isDesktop, resolveContainerSize, resolvedDefaultRatio, resolvedMaxRatio, resolvedMinPrimaryPx, resolvedMinRatio, resolvedMinSecondaryPx]);

  const handleDragStart = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!isDesktop) {
        return;
      }

      // Mouse requires left click; touch/pen should be allowed directly.
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      event.preventDefault();
      setIsDragging(true);

      const previousUserSelect = document.body.style.userSelect;
      const previousCursor = document.body.style.cursor;
      document.body.style.userSelect = "none";
      document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";

      const handleMove = (moveEvent: PointerEvent) => {
        const container = containerRef.current;
        if (!container) {
          return;
        }

        const rect = container.getBoundingClientRect();
        const containerSize = direction === "horizontal" ? rect.width : rect.height;
        if (containerSize <= 0) {
          return;
        }

        const offset = direction === "horizontal" ? moveEvent.clientX - rect.left : moveEvent.clientY - rect.top;
        const rawRatio = offset / containerSize;
        setPrimaryRatio(
          clampRatio(
            rawRatio,
            containerSize,
            resolvedDefaultRatio,
            resolvedMinPrimaryPx,
            resolvedMinSecondaryPx,
            resolvedMinRatio,
            resolvedMaxRatio
          )
        );
      };

      const handleStop = () => {
        setIsDragging(false);
        document.body.style.userSelect = previousUserSelect;
        document.body.style.cursor = previousCursor;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleStop);
        window.removeEventListener("pointercancel", handleStop);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleStop);
      window.addEventListener("pointercancel", handleStop);
    },
    [direction, isDesktop, resolvedDefaultRatio, resolvedMaxRatio, resolvedMinPrimaryPx, resolvedMinRatio, resolvedMinSecondaryPx]
  );

  const primaryPaneStyle = useMemo<CSSProperties | undefined>(() => {
    if (!isDesktop) {
      return undefined;
    }

    const ratioPercent = `${(primaryRatio * 100).toFixed(2)}%`;
    if (direction === "horizontal") {
      return {
        flex: `0 0 ${ratioPercent}`,
        minWidth: `${resolvedMinPrimaryPx}px`,
        maxWidth: `calc(100% - ${resolvedMinSecondaryPx}px - ${SPLITTER_GAP_PX}px)`
      };
    }

    return {
      flex: `0 0 ${ratioPercent}`,
      minHeight: `${resolvedMinPrimaryPx}px`,
      maxHeight: `calc(100% - ${resolvedMinSecondaryPx}px - ${SPLITTER_GAP_PX}px)`
    };
  }, [direction, isDesktop, primaryRatio, resolvedMinPrimaryPx, resolvedMinSecondaryPx]);

  const secondaryPaneStyle = useMemo<CSSProperties | undefined>(() => {
    if (!isDesktop) {
      return undefined;
    }

    if (direction === "horizontal") {
      return {
        minWidth: `${resolvedMinSecondaryPx}px`
      };
    }

    return {
      minHeight: `${resolvedMinSecondaryPx}px`
    };
  }, [direction, isDesktop, resolvedMinSecondaryPx]);

  if (panels.length !== 2) {
    return <div className="space-y-4">{children}</div>;
  }

  const resolvedDividerAriaLabel =
    dividerAriaLabel ?? (direction === "horizontal" ? "拖拽调整左右区域宽度" : "拖拽调整上下区域高度");
  const containerClassName =
    direction === "horizontal"
      ? "flex h-full min-h-0 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-3"
      : "flex min-h-0 flex-col gap-3 lg:h-full";

  return (
    <div ref={containerRef} className={cx(containerClassName, className)}>
      <div
        className={cx(
          direction === "horizontal" ? "min-w-0 lg:h-full lg:min-h-0" : "min-h-0 min-w-0 lg:h-full",
          primaryPaneClassName
        )}
        style={primaryPaneStyle}
      >
        {panels[0]}
      </div>

      {isDesktop ? (
        <div className={direction === "horizontal" ? "flex shrink-0 items-stretch" : "flex shrink-0 items-stretch"}>
          <button
            type="button"
            aria-label={resolvedDividerAriaLabel}
            className={cx(
              "group relative border bg-[var(--lc-surface-soft)] transition hover:bg-[var(--lc-accent-soft)] focus:outline-none",
              direction === "horizontal" ? "w-2 cursor-col-resize rounded-full" : "h-2 w-full cursor-row-resize rounded-full",
              isDragging && direction === "vertical" ? "border-[var(--lc-accent)] bg-[var(--lc-accent-soft)]" : undefined
            )}
            onPointerDown={handleDragStart}
            onDoubleClick={() => applyRatio(resolvedDefaultRatio)}
            style={{ touchAction: "none" }}
          >
            <span
              className={cx(
                "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition",
                direction === "horizontal" ? "h-20 w-[2px]" : "h-[2px] w-10",
                isDragging ? "bg-[var(--lc-accent)]" : "bg-[var(--lc-border-soft)] group-hover:bg-[var(--lc-accent)]"
              )}
            />
          </button>
        </div>
      ) : null}

      <div
        className={cx(
          direction === "horizontal" ? "min-w-0 flex-1 lg:h-full lg:min-h-0" : "min-h-0 min-w-0 flex-1 lg:h-full",
          secondaryPaneClassName
        )}
        style={secondaryPaneStyle}
      >
        {panels[1]}
      </div>
    </div>
  );
}
