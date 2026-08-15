export function isDealComposerTrigger(value: string) {
  return value.trim().toLocaleLowerCase() === "@deal";
}
