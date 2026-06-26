import { type Api, complete, type Model } from "@earendil-works/pi-ai";

interface GenerateSessionTitleParams {
  userPrompts: string[];
  maxLength: number;
  model: Model<Api>;
  apiKey?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  previousTitle?: string;
}

export async function generateSessionTitle({
  userPrompts,
  maxLength,
  model,
  signal,
  previousTitle,
}: GenerateSessionTitleParams): Promise<string | undefined> {
  const response = await complete(
    model,
    {
      messages: [
        {
          role: "user" as const,
          timestamp: Date.now(),
          content: [
            {
              type: "text" as const,
              text: [
                `You are naming a conversation session. Based on the user message below, produce a single short title (max ${maxLength} characters, no quotes). Be specific — mention the main topic. Use sentence case.`,
                "",
                "User messages:",
                ...userPrompts.map((userPrompt) => `<message>${userPrompt}</message>`),
                previousTitle
                  ? `\nThe current title is "${previousTitle}" — refine it if you now have better context, otherwise keep it.`
                  : null,
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        },
      ],
    },
    { signal },
  );

  const title = response.content
    .filter((content) => content.type === "text")
    .map((content) => content.text.trim())
    .join("")
    .slice(0, maxLength)
    .replace(/["']/g, "");

  return title || undefined;
}
