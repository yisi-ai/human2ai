"use client";

import { SendOutlined } from "@ant-design/icons";
import { Sender } from "@ant-design/x";
import type {
  ComponentRef,
  CSSProperties,
  FormEvent,
  FormHTMLAttributes,
  KeyboardEvent,
  ReactNode,
} from "react";
import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef } from "react";

import { BasicButton } from "../components/BasicButton";
import { CompositeButton } from "../components/CompositeButton";
import styles from "../../styles/MessageComposer.module.css";

import "../../styles/tokens.css";
import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export type MessageComposerVariant = "single-line" | "multi-line";
export type MessageComposerSurface = "standalone" | "embedded";

export interface MessageComposerHandle {
  focus: () => void;
  blur: () => void;
}

export interface MessageComposerQuickPrompt {
  icon: ReactNode;
  label: string;
  message: string;
}

type SenderRef = ComponentRef<typeof Sender>;

export interface MessageComposerProps
  extends Omit<
    FormHTMLAttributes<HTMLFormElement>,
    "children" | "onChange" | "onKeyDown" | "onSubmit"
  > {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string) => void;
  onCancel?: () => void;
  ariaLabel: string;
  placeholder?: string;
  submitLabel?: string;
  variant?: MessageComposerVariant;
  surface?: MessageComposerSurface;
  quickPrompts?: readonly MessageComposerQuickPrompt[];
  footer?: ReactNode;
  error?: ReactNode;
  autoFocus?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  loading?: boolean;
}

export const MessageComposer = forwardRef<
  MessageComposerHandle,
  MessageComposerProps
>(function MessageComposer(
  {
    value,
    onChange,
    onSubmit,
    onCancel,
    ariaLabel,
    placeholder = "输入消息…",
    submitLabel = "发送消息",
    variant = "single-line",
    surface = "standalone",
    quickPrompts = [],
    footer,
    error,
    autoFocus = false,
    disabled = false,
    readOnly = false,
    loading = false,
    className,
    style,
    "aria-label": formAriaLabel,
    ...formProps
  },
  forwardedRef,
) {
  const senderRef = useRef<SenderRef | null>(null);
  const errorId = useId();
  const submitDisabled = disabled || readOnly || loading || !value.trim();

  const submitMessage = useCallback(
    (candidate = value) => {
      const message = candidate.trim();
      if (!message || disabled || readOnly || loading) return;
      onSubmit(message);
    },
    [disabled, loading, onSubmit, readOnly, value],
  );

  useImperativeHandle(
    forwardedRef,
    () => ({
      focus: () => senderRef.current?.focus(),
      blur: () => senderRef.current?.blur(),
    }),
    [],
  );

  useEffect(() => {
    if (autoFocus && !disabled) senderRef.current?.focus();
  }, [autoFocus, disabled]);

  const handleKeyDown = (event: KeyboardEvent): false | undefined => {
    const composing = event.nativeEvent.isComposing || event.keyCode === 229;
    if (composing) return event.key === "Enter" ? false : undefined;

    if (event.key === "Escape" && onCancel) {
      event.preventDefault();
      onCancel();
      return false;
    }

    if (event.key !== "Enter") return undefined;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      submitMessage();
    }
    return false;
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitMessage();
  };

  const senderStyles = {
    root: {
      width: "100%",
      minWidth: 0,
      border: 0,
      borderRadius: "inherit",
      background: "transparent",
      boxShadow: "none",
    },
    content: {
      minHeight: variant === "single-line" ? 38 : 96,
      alignItems: "flex-end",
      padding: variant === "single-line" ? "6px 12px 2px" : "10px 12px 4px",
    },
    input: {
      minWidth: 0,
      color: "var(--yisiui-color-text-primary)",
      fontSize: "var(--yisiui-font-size-sm)",
      lineHeight: "var(--yisiui-font-line-height-normal)",
    },
    footer: {
      minHeight: 36,
      padding: "0 4px 4px 8px",
      boxSizing: "border-box",
      color: "var(--yisiui-color-text-muted)",
      fontSize: "var(--yisiui-font-size-xs)",
      lineHeight: "var(--yisiui-font-line-height-compact)",
    },
  } satisfies Record<string, CSSProperties>;

  return (
    <form
      {...formProps}
      {...uiAssetAttributes("message-composer", "MessageComposer", "ai-input-pattern")}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={style}
      aria-label={formAriaLabel ?? `${ariaLabel}输入框`}
      aria-busy={loading || undefined}
      data-variant={variant}
      data-surface={surface}
      data-error={error ? "true" : "false"}
      onSubmit={handleFormSubmit}
    >
      <Sender
        ref={senderRef}
        rootClassName={styles.sender}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly || loading}
        loading={loading}
        autoSize={variant === "single-line" ? { minRows: 1, maxRows: 3 } : { minRows: 3, maxRows: 8 }}
        submitType="enter"
        aria-label={ariaLabel}
        aria-describedby={error ? errorId : undefined}
        aria-keyshortcuts="Control+Enter Meta+Enter"
        data-message-composer-input
        prefix={false}
        suffix={false}
        footer={(
          <div className={styles.footerBar} data-message-composer-footer>
            <div className={styles.footerInfo}>
              {quickPrompts.length ? (
                <div className={styles.quickPromptList} aria-label="快捷语言">
                  {quickPrompts.map((prompt, index) => (
                    <div
                      key={`${prompt.label}:${prompt.message}:${index}`}
                      className={styles.quickPromptItem}
                      data-message-composer-quick-prompt={prompt.label}
                    >
                      <CompositeButton
                        className={styles.quickPromptButton}
                        icon={prompt.icon}
                        label={prompt.label}
                        aria-label={`发送快捷消息：${prompt.label}`}
                        title={prompt.message}
                        disabled={disabled || readOnly || loading || !prompt.message.trim()}
                        onClick={() => submitMessage(prompt.message)}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
              {footer ? <span className={styles.footerText}>{footer}</span> : null}
            </div>
            <BasicButton
              className={styles.sendButton}
              htmlType="submit"
              type="text"
              size="small"
              mode="icon-only"
              icon={<SendOutlined />}
              iconLabel={submitLabel}
              loading={loading}
              disabled={submitDisabled}
              data-message-composer-submit
            />
          </div>
        )}
        styles={senderStyles}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        onSubmit={submitMessage}
      />
      {error ? (
        <div id={errorId} className={styles.error} role="alert">
          {error}
        </div>
      ) : null}
    </form>
  );
});

MessageComposer.displayName = "MessageComposer";
