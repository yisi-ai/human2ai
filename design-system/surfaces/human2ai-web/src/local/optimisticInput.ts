import { createElement, startTransition, useOptimistic, type ChangeEventHandler, type ComponentType } from "react";

type TextInputProps = {
  value?: string | number | bigint | readonly string[];
  onChange?: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
};

// Keep the existing input's DOM, sizing and focus behavior. Only draft rendering
// is deferred; the caller still receives every edit synchronously in the action.
export function withOptimisticInput<Props extends TextInputProps>(Input: ComponentType<Props>) {
  return function OptimisticInput(props: Props) {
    const [value, setValue] = useOptimistic<TextInputProps["value"]>(props.value);
    const onChange: TextInputProps["onChange"] = event => {
      const next = event.target.value;
      startTransition(() => {
        setValue(next);
        props.onChange?.(event);
      });
    };
    return createElement(Input, { ...props, value, onChange });
  };
}
