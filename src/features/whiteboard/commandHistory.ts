export interface WhiteboardCommand {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

/** Session-only, object-operation history. No pointer samples enter this stack. */
export class WhiteboardCommandHistory {
  readonly limit: number;
  private undoStack: WhiteboardCommand[] = [];
  private redoStack: WhiteboardCommand[] = [];

  constructor(limit = 200) {
    this.limit = limit;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  push(command: WhiteboardCommand): void {
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  async undo(): Promise<string | null> {
    const command = this.undoStack.at(-1);
    if (!command) return null;
    await command.undo();
    this.undoStack.pop();
    this.redoStack.push(command);
    return command.label;
  }

  async redo(): Promise<string | null> {
    const command = this.redoStack.at(-1);
    if (!command) return null;
    await command.redo();
    this.redoStack.pop();
    this.undoStack.push(command);
    return command.label;
  }
}
