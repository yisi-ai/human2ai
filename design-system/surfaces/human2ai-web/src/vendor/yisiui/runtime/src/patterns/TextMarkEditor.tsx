"use client";

import { DeleteOutlined } from "@ant-design/icons";
import { Button, Input, Modal } from "antd";
import {
  cloneElement,
  forwardRef,
  useId,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type ReactElement,
  type ReactNode,
} from "react";

import "../../styles/tokens.css";
import "../../styles/text-mark-editor.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";
import { ConfirmAction } from "./ConfirmAction";

const TEXTAREA_AUTO_SIZE = Object.freeze({ minRows: 3, maxRows: 6 });

type AntTextAreaProps = ComponentPropsWithoutRef<typeof Input.TextArea>;

export type TextMarkEditorTextAreaProps = Omit<
  AntTextAreaProps,
  "autoSize" | "rows"
>;

export type TextMarkEditorTextAreaRef = ComponentRef<typeof Input.TextArea>;

/**
 * Multiline field control for TextMarkEditor. Height follows content from
 * three through six rows; callers cannot opt back into manual row sizing.
 */
export const TextMarkEditorTextArea = forwardRef<
  TextMarkEditorTextAreaRef,
  TextMarkEditorTextAreaProps
>(function TextMarkEditorTextArea(props, ref) {
  const {
    autoSize: _ignoredAutoSize,
    rows: _ignoredRows,
    className,
    ...textAreaProps
  } = props as AntTextAreaProps;

  return (
    <Input.TextArea
      {...textAreaProps}
      ref={ref}
      className={["yisi-text-mark-editor-textarea", className]
        .filter(Boolean)
        .join(" ")}
      autoSize={TEXTAREA_AUTO_SIZE}
      data-yisiui-auto-size="content"
      data-yisiui-min-rows="3"
      data-yisiui-max-rows="6"
    />
  );
});

export interface TextMarkEditorDeleteAction {
  label: string;
  confirmTitle: ReactNode;
  confirmDescription?: ReactNode;
  confirmLabel?: string;
  confirmCancelLabel: string;
  scopeLabel?: ReactNode;
  onConfirm: () => void | Promise<void>;
}

export interface TextMarkEditorProps {
  open: boolean;
  title: ReactNode;
  selectedText: ReactNode;
  selectedTextLabel: string;
  children: ReactNode;
  onCancel: () => void;
  onSave: () => void | Promise<void>;
  saveLabel: string;
  cancelLabel: string;
  saveLoading?: boolean;
  saveDisabled?: boolean;
  deleteAction?: TextMarkEditorDeleteAction;
  error?: ReactNode;
}

interface TextMarkEditorControlProps {
  id?: string;
  "aria-describedby"?: string;
}

export interface TextMarkEditorFieldProps {
  label: ReactNode;
  /** Preferred explicit control id. A stable id is generated when omitted. */
  controlId?: string;
  /** Compatibility alias for candidate consumers. */
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactElement<TextMarkEditorControlProps>;
}

export function TextMarkEditorField({
  label,
  controlId,
  htmlFor,
  hint,
  children,
}: TextMarkEditorFieldProps) {
  const generatedId = useId();
  const resolvedControlId = controlId ?? htmlFor ?? children.props.id ?? generatedId;
  const hintId = hint ? `${resolvedControlId}-hint` : undefined;
  const describedBy = [children.props["aria-describedby"], hintId]
    .filter(Boolean)
    .join(" ") || undefined;
  const control = cloneElement(children, {
    id: resolvedControlId,
    "aria-describedby": describedBy,
  });

  return (
    <div className="yisi-text-mark-editor-field">
      <div className="yisi-text-mark-editor-field-heading">
        <label className="yisi-text-mark-editor-field-label" htmlFor={resolvedControlId}>
          {label}
        </label>
        {hint ? (
          <span id={hintId} className="yisi-text-mark-editor-field-hint">
            {hint}
          </span>
        ) : null}
      </div>
      {control}
    </div>
  );
}

export function TextMarkEditor({
  open,
  title,
  selectedText,
  selectedTextLabel,
  children,
  onCancel,
  onSave,
  saveLabel,
  cancelLabel,
  saveLoading = false,
  saveDisabled = false,
  deleteAction,
  error,
}: TextMarkEditorProps) {
  const contextLabelId = useId();

  return (
    <Modal
      open={open}
      title={title}
      width={520}
      destroyOnHidden
      footer={null}
      closable={!saveLoading}
      keyboard={!saveLoading}
      mask={{ closable: !saveLoading }}
      focusable={{ focusTriggerAfterClose: true }}
      rootClassName="yisi-text-mark-editor-modal"
      onCancel={onCancel}
    >
      <div
        {...uiAssetAttributes("text-mark-editor", "TextMarkEditor")}
        className="yisi-text-mark-editor"
        data-has-delete={deleteAction ? "true" : "false"}
        aria-busy={saveLoading || undefined}
      >
        <section
          className="yisi-text-mark-editor-context"
          aria-labelledby={contextLabelId}
        >
          <span id={contextLabelId} className="yisi-text-mark-editor-context-label">
            {selectedTextLabel}
          </span>
          <blockquote className="yisi-text-mark-editor-quote">{selectedText}</blockquote>
        </section>

        <div className="yisi-text-mark-editor-fields">{children}</div>

        {error ? (
          <div className="yisi-text-mark-editor-error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="yisi-text-mark-editor-actions">
          {deleteAction ? (
            <ConfirmAction
              className="yisi-text-mark-editor-delete-action"
              type="text"
              size="small"
              icon={<DeleteOutlined aria-hidden="true" />}
              title={deleteAction.confirmTitle}
              description={deleteAction.confirmDescription}
              scopeLabel={deleteAction.scopeLabel}
              confirmLabel={deleteAction.confirmLabel ?? deleteAction.label}
              cancelLabel={deleteAction.confirmCancelLabel}
              disabled={saveLoading}
              onConfirm={deleteAction.onConfirm}
            >
              {deleteAction.label}
            </ConfirmAction>
          ) : null}
          <Button disabled={saveLoading} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="primary"
            loading={saveLoading}
            disabled={saveDisabled}
            onClick={() => void onSave()}
          >
            {saveLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
