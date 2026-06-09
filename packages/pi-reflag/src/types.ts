export interface Command {
  name: string;
  args: string[];
}

export interface CommandRewrite {
  isMatching(command: Command): boolean;
  rewrite(command: Command): Command | undefined;
}
