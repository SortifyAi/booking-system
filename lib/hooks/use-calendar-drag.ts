'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Pointer-based drag-to-move for calendar bookings. Works with both mouse and
 * touch via the unified Pointer Events API:
 *  - Mouse: a drag starts as soon as the pointer moves past a small threshold.
 *    A plain click (no movement) is reported via `onClick` instead.
 *  - Touch/Pen: a drag only starts after a short long-press, so an accidental
 *    swipe doesn't move appointments. A quick tap is reported via `onClick`.
 *
 * The grid geometry differs per view (week = day columns, day = staff columns),
 * so the consuming component supplies `resolvePoint`, which maps a viewport
 * coordinate to a target column + the minutes offset from `startHour`. The hook
 * handles the pointer lifecycle, snapping and clamping.
 */

export interface DropTarget {
  /** Column the pointer is currently over (day ISO date or staff id). */
  columnKey: string;
  /** Snapped booking start, in minutes after `startHour`. */
  minutesFromStart: number;
}

export interface DragMeta {
  id: string;
  durationMinutes: number;
  /** Current booking start, in minutes after `startHour`. */
  startMinutes: number;
  title: string;
}

export interface CalendarDragState {
  bookingId: string;
  pointerX: number;
  pointerY: number;
  target: DropTarget | null;
  title: string;
  durationMinutes: number;
}

interface UseCalendarDragOptions {
  /** Total minutes shown in the grid: (endHour - startHour) * 60. */
  dayMinutes: number;
  snapMinutes?: number;
  longPressMs?: number;
  mouseThresholdPx?: number;
  touchThresholdPx?: number;
  resolvePoint: (
    clientX: number,
    clientY: number,
  ) => { columnKey: string; pointerMinutes: number } | null;
  onCommit: (bookingId: string, target: DropTarget) => void;
  onClick?: (bookingId: string) => void;
}

export function useCalendarDrag(options: UseCalendarDragOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [dragState, setDragState] = useState<CalendarDragState | null>(null);

  const sessionRef = useRef<{
    meta: DragMeta;
    grabOffsetMinutes: number;
    startX: number;
    startY: number;
    pointerType: string;
    activated: boolean;
    longPressTimer: number | null;
    teardown: () => void;
  } | null>(null);

  const computeTarget = useCallback(
    (clientX: number, clientY: number): DropTarget | null => {
      const session = sessionRef.current;
      if (!session) return null;
      const { resolvePoint, dayMinutes, snapMinutes = 15 } = optionsRef.current;
      const resolved = resolvePoint(clientX, clientY);
      if (!resolved) return null;
      let newStart = resolved.pointerMinutes - session.grabOffsetMinutes;
      newStart = Math.round(newStart / snapMinutes) * snapMinutes;
      const maxStart = Math.max(0, dayMinutes - session.meta.durationMinutes);
      newStart = Math.min(Math.max(0, newStart), maxStart);
      return { columnKey: resolved.columnKey, minutesFromStart: newStart };
    },
    [],
  );

  const startDrag = useCallback((event: React.PointerEvent, meta: DragMeta) => {
    // Ignore secondary mouse buttons.
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const initialResolved = optionsRef.current.resolvePoint(event.clientX, event.clientY);
    const grabOffsetMinutes = initialResolved
      ? initialResolved.pointerMinutes - meta.startMinutes
      : 0;

    const updateGhost = (clientX: number, clientY: number) => {
      const session = sessionRef.current;
      if (!session) return;
      setDragState({
        bookingId: session.meta.id,
        pointerX: clientX,
        pointerY: clientY,
        target: computeTarget(clientX, clientY),
        title: session.meta.title,
        durationMinutes: session.meta.durationMinutes,
      });
    };

    const activate = (clientX: number, clientY: number) => {
      const session = sessionRef.current;
      if (!session || session.activated) return;
      session.activated = true;
      if (session.longPressTimer != null) {
        window.clearTimeout(session.longPressTimer);
        session.longPressTimer = null;
      }
      updateGhost(clientX, clientY);
    };

    const handleMove = (moveEvent: PointerEvent) => {
      const session = sessionRef.current;
      if (!session) return;
      const distance = Math.hypot(
        moveEvent.clientX - session.startX,
        moveEvent.clientY - session.startY,
      );

      if (!session.activated) {
        if (session.pointerType === 'mouse') {
          if (distance > (optionsRef.current.mouseThresholdPx ?? 6)) {
            activate(moveEvent.clientX, moveEvent.clientY);
          }
        } else if (distance > (optionsRef.current.touchThresholdPx ?? 12)) {
          // Touch moved before the long-press fired → treat as a scroll/tap
          // intent and abandon (no drag, no click).
          teardown();
        }
        if (!session.activated) return;
      }

      moveEvent.preventDefault();
      updateGhost(moveEvent.clientX, moveEvent.clientY);
    };

    const handleUp = (upEvent: PointerEvent) => {
      const session = sessionRef.current;
      if (!session) return;
      const wasActivated = session.activated;
      const target = wasActivated ? computeTarget(upEvent.clientX, upEvent.clientY) : null;
      const bookingId = session.meta.id;
      teardown();
      if (wasActivated) {
        if (target) optionsRef.current.onCommit(bookingId, target);
      } else {
        optionsRef.current.onClick?.(bookingId);
      }
    };

    const handleCancel = () => teardown();
    const handleKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') teardown();
    };

    const teardown = () => {
      const session = sessionRef.current;
      if (!session) return;
      if (session.longPressTimer != null) window.clearTimeout(session.longPressTimer);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      window.removeEventListener('keydown', handleKey);
      sessionRef.current = null;
      setDragState(null);
    };

    sessionRef.current = {
      meta,
      grabOffsetMinutes,
      startX: event.clientX,
      startY: event.clientY,
      pointerType: event.pointerType,
      activated: false,
      longPressTimer: null,
      teardown,
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    window.addEventListener('keydown', handleKey);

    if (event.pointerType !== 'mouse') {
      sessionRef.current.longPressTimer = window.setTimeout(() => {
        const session = sessionRef.current;
        if (session) activate(session.startX, session.startY);
      }, optionsRef.current.longPressMs ?? 220);
    }
  }, [computeTarget]);

  useEffect(() => () => sessionRef.current?.teardown(), []);

  return {
    dragState,
    startDrag,
    draggingId: dragState?.bookingId ?? null,
  };
}
