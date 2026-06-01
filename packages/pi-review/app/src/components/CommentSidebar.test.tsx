import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReviewComment } from "../types";
import { CommentSidebar } from "./CommentSidebar";

function makeComment(id: string, overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id,
    quote: `quote-${id}`,
    comment: `comment-${id}`,
    timestamp: "2024-01-01T00:00:00.000Z",
    sent: false,
    error: false,
    ...overrides,
  };
}

describe("CommentSidebar", () => {
  it("shows empty state when no comments", () => {
    render(
      <CommentSidebar
        comments={[]}
        onSend={vi.fn()}
        onDelete={vi.fn()}
        onRetry={vi.fn()}
        onSendAll={vi.fn()}
      />,
    );
    expect(screen.getByText(/select text/i)).toBeInTheDocument();
  });

  it("shows comment count badge", () => {
    render(
      <CommentSidebar
        comments={[makeComment("1"), makeComment("2")]}
        onSend={vi.fn()}
        onDelete={vi.fn()}
        onRetry={vi.fn()}
        onSendAll={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/2 comments/i)).toBeInTheDocument();
  });

  it("shows Send all button with unsent count", () => {
    render(
      <CommentSidebar
        comments={[makeComment("1"), makeComment("2")]}
        onSend={vi.fn()}
        onDelete={vi.fn()}
        onRetry={vi.fn()}
        onSendAll={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /send all 2 unsent/i })).toBeInTheDocument();
  });

  it("does not show Send all button when all sent", () => {
    render(
      <CommentSidebar
        comments={[makeComment("1", { sent: true }), makeComment("2", { sent: true })]}
        onSend={vi.fn()}
        onDelete={vi.fn()}
        onRetry={vi.fn()}
        onSendAll={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /send all/i })).not.toBeInTheDocument();
  });

  it("calls onSendAll when Send all clicked", async () => {
    const onSendAll = vi.fn();
    render(
      <CommentSidebar
        comments={[makeComment("1")]}
        onSend={vi.fn()}
        onDelete={vi.fn()}
        onRetry={vi.fn()}
        onSendAll={onSendAll}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /send all/i }));
    expect(onSendAll).toHaveBeenCalledOnce();
  });

  it("renders as complementary landmark", () => {
    render(
      <CommentSidebar
        comments={[]}
        onSend={vi.fn()}
        onDelete={vi.fn()}
        onRetry={vi.fn()}
        onSendAll={vi.fn()}
      />,
    );
    expect(screen.getByRole("complementary", { name: /review comments/i })).toBeInTheDocument();
  });
});
