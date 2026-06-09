export interface Command {
  name: string;
  args: string[];
}

export type CommandRewrite = (command: Command) => Command | undefined;
