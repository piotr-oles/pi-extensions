import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReviewComment } from "../types";
import { CommentCard } from "./CommentCard";

function makeComment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: "c1",
    quote: "selected text",
    comment: "my review comment",
    timestamp: "2024-01-01T00:00:00.000Z",
    sent: false,
    error: false,
    ...overrides,
  };
}

describe("CommentCard", () => {
  it("renders quote and comment text", () => {
    render(
      <CommentCard comment={makeComment()} onSend={vi.fn()} onDelete={vi.fn()} onRetry={vi.fn()} />,
    );
    expect(screen.getByText(/selected text/)).toBeInTheDocument();
    expect(screen.getByText("my review comment")).toBeInTheDocument();
  });

  it("shows Send button for unsent comment", () => {
    render(
      <CommentCard comment={makeComment()} onSend={vi.fn()} onDelete={vi.fn()} onRetry={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /send comment to agent/i })).toBeInTheDocument();
  });

  it("calls onSend when Send button clicked", async () => {
    const onSend = vi.fn();
    render(
      <CommentCard comment={makeComment()} onSend={onSend} onDelete={vi.fn()} onRetry={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /send comment to agent/i }));
    expect(onSend).toHaveBeenCalledWith("c1");
  });

  it("calls onDelete when Delete button clicked", async () => {
    const onDelete = vi.fn();
    render(
      <CommentCard
        comment={makeComment()}
        onSend={vi.fn()}
        onDelete={onDelete}
        onRetry={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /delete comment/i }));
    expect(onDelete).toHaveBeenCalledWith("c1");
  });

  it("shows sent state", () => {
    render(
      <CommentCard
        comment={makeComment({ sent: true })}
        onSend={vi.fn()}
        onDelete={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/✓ sent to agent/i)).toBeInTheDocument();
  });

  it("shows retry badge on error state", () => {
    render(
      <CommentCard
        comment={makeComment({ error: true })}
        onSend={vi.fn()}
        onDelete={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("calls onRetry when retry button clicked", async () => {
    const onRetry = vi.fn();
    render(
      <CommentCard
        comment={makeComment({ error: true })}
        onSend={vi.fn()}
        onDelete={vi.fn()}
        onRetry={onRetry}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledWith("c1");
  });

  it("has accessible aria-labels on buttons", () => {
    render(
      <CommentCard comment={makeComment()} onSend={vi.fn()} onDelete={vi.fn()} onRetry={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /send comment to agent/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete comment/i })).toBeInTheDocument();
  });
});
