type ComposerKeyEvent = {
  ctrlKey: boolean;
  isComposing?: boolean;
  key: string;
  keyCode?: number;
  metaKey: boolean;
  shiftKey?: boolean;
};

export function shouldSubmitMessage(event: ComposerKeyEvent) {
  return (
    event.key === "Enter" &&
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    !event.isComposing &&
    event.keyCode !== 229
  );
}
