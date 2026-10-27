"use client";
import Link from "next/link";
import { useRef } from "react";
import * as D from "@radix-ui/react-dialog";
import { X, ArrowRight, WarningCircle } from "@phosphor-icons/react";
import type {
  ButtonHTMLAttributes,
  ReactNode,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "turquoise";
  children: ReactNode;
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function ActionLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={`button ${variant} ${className}`}>
      {children}
    </Link>
  );
}
export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <button className="icon-button" aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
export function Input({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
export function Textarea({
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea {...props} />
    </label>
  );
}
export function Chip({
  children,
  selected,
  onClick,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
}) {
  return onClick ? (
    <button
      className={`chip ${selected ? "selected" : ""}`}
      onClick={onClick}
      aria-pressed={!!selected}
    >
      {children}
    </button>
  ) : (
    <span className={`chip ${selected ? "selected" : ""}`}>{children}</span>
  );
}
export function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  return (
    <span className={`avatar avatar-${index % 4}`} aria-label={name}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
export function Dialog({
  title,
  trigger,
  children,
  open,
  onOpenChange,
}: {
  title: string;
  trigger?: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay className="dialog-overlay" />
        <D.Content
          className="dialog-content"
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            previousFocus.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(e) => {
            if (previousFocus.current?.isConnected) {
              e.preventDefault();
              previousFocus.current.focus();
            }
          }}
        >
          <div className="dialog-heading">
            <D.Title>{title}</D.Title>
            <D.Close asChild>
              <IconButton label="Закрыть">
                <X size={22} />
              </IconButton>
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
export function EmptyState({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-symbol">
        <ArrowRight size={28} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="notice error" role="alert">
      <WarningCircle size={22} />
      <div>
        {message}
        {onRetry && (
          <button className="text-link" onClick={onRetry}>
            Попробовать ещё раз
          </button>
        )}
      </div>
    </div>
  );
}
export function Skeleton() {
  return (
    <div className="skeleton-layout" aria-label="Загружаем поездку">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
export function SectionHeading({
  title,
  text,
  aside,
}: {
  title: string;
  text?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {aside}
    </div>
  );
}
