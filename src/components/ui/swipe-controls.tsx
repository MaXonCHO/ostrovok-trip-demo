"use client";
import {
  ArrowCounterClockwise,
  ArrowUpRight,
  Heart,
  X,
} from "@phosphor-icons/react";
export function SwipeControls({
  onReject,
  onLike,
  onUndo,
  onDetails,
  disabled = false,
  canUndo = false,
}: {
  onReject: () => void;
  onLike: () => void;
  onUndo?: () => void;
  onDetails?: () => void;
  disabled?: boolean;
  canUndo?: boolean;
}) {
  return (
    <div className="deck-controls">
      <button
        className="deck-small-action"
        onClick={onUndo}
        disabled={disabled || !canUndo}
        aria-label="Отменить последнее решение"
      >
        <ArrowCounterClockwise size={22} />
      </button>
      <button
        className="deck-reject"
        disabled={disabled}
        onClick={onReject}
        aria-label="Не подходит"
      >
        <X size={28} />
      </button>
      <span className="deck-control-hint">
        Смахните
        <br />
        влево или вправо
      </span>
      <button
        className="deck-like"
        disabled={disabled}
        onClick={onLike}
        aria-label="Подходит"
      >
        <Heart size={28} weight="fill" />
      </button>
      <button
        className="deck-small-action"
        onClick={onDetails}
        disabled={!onDetails}
        aria-label="Открыть подробности"
      >
        <ArrowUpRight size={24} />
      </button>
    </div>
  );
}
