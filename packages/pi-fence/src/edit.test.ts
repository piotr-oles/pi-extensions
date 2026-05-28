import { describe, expect, it } from "vitest";
import { applyEdits } from "./edit.js";

describe("applyEdits", () => {
  describe("content", () => {
    it("returns base unchanged when edits array is empty", () => {
      const { content } = applyEdits("hello\nworld\n", []);
      expect(content).toBe("hello\nworld\n");
    });

    it("replaces a single occurrence", () => {
      const { content } = applyEdits("foo bar baz", [{ oldText: "bar", newText: "qux" }]);
      expect(content).toBe("foo qux baz");
    });

    it("replaces across multiple lines", () => {
      const base = "line1\nline2\nline3\n";
      const { content } = applyEdits(base, [{ oldText: "line2\n", newText: "replaced\n" }]);
      expect(content).toBe("line1\nreplaced\nline3\n");
    });

    it("replaces with a newText that has more lines than oldText", () => {
      const base = "a\nb\nc\n";
      const { content } = applyEdits(base, [{ oldText: "b", newText: "b1\nb2\nb3" }]);
      expect(content).toBe("a\nb1\nb2\nb3\nc\n");
    });

    it("replaces with a newText that has fewer lines than oldText", () => {
      const base = "a\nb1\nb2\nb3\nc\n";
      const { content } = applyEdits(base, [{ oldText: "b1\nb2\nb3", newText: "b" }]);
      expect(content).toBe("a\nb\nc\n");
    });

    it("applies two non-overlapping edits in the same pass", () => {
      const base = "foo\nbar\nbaz\n";
      const { content } = applyEdits(base, [
        { oldText: "foo", newText: "FOO" },
        { oldText: "baz", newText: "BAZ" },
      ]);
      expect(content).toBe("FOO\nbar\nBAZ\n");
    });

    it("applies edits regardless of the order they appear in the array", () => {
      const base = "foo\nbar\nbaz\n";
      const { content: c1 } = applyEdits(base, [
        { oldText: "foo", newText: "FOO" },
        { oldText: "baz", newText: "BAZ" },
      ]);
      const { content: c2 } = applyEdits(base, [
        { oldText: "baz", newText: "BAZ" },
        { oldText: "foo", newText: "FOO" },
      ]);
      expect(c1).toBe(c2);
    });

    it("skips an edit whose oldText is not found, leaving content unchanged", () => {
      const base = "hello\n";
      const { content } = applyEdits(base, [{ oldText: "missing", newText: "x" }]);
      expect(content).toBe("hello\n");
    });

    it("applies matched edits even when one edit is unmatched", () => {
      const base = "foo\nbar\n";
      const { content } = applyEdits(base, [
        { oldText: "missing", newText: "x" },
        { oldText: "bar", newText: "BAR" },
      ]);
      expect(content).toBe("foo\nBAR\n");
    });

    it("all edits are matched against the original base, not sequentially", () => {
      // If edits were applied sequentially, the second edit would see "BAR"
      // instead of "bar" and fail to match. Both must match the original.
      const base = "foo\nbar\n";
      const { content } = applyEdits(base, [
        { oldText: "foo", newText: "FOO" },
        { oldText: "bar", newText: "BAR" },
      ]);
      expect(content).toBe("FOO\nBAR\n");
    });
  });

  describe("editRanges", () => {
    it("returns one range per edit, defaulting to { startLine: 0, endLine: 0 } for unmatched", () => {
      const { editRanges } = applyEdits("hello\n", [{ oldText: "missing", newText: "x" }]);
      expect(editRanges).toHaveLength(1);
      expect(editRanges[0]).toEqual({ startLine: 0, endLine: 0 });
    });

    it("sets startLine to the 0-indexed line where the replacement begins", () => {
      const base = "line0\nline1\nline2\n";
      const { editRanges } = applyEdits(base, [{ oldText: "line1", newText: "replaced" }]);
      expect(editRanges[0].startLine).toBe(1);
    });

    it("sets endLine equal to startLine for a single-line replacement", () => {
      const base = "a\nb\nc\n";
      const { editRanges } = applyEdits(base, [{ oldText: "b", newText: "B" }]);
      expect(editRanges[0]).toEqual({ startLine: 1, endLine: 1 });
    });

    it("sets endLine correctly for a multi-line replacement", () => {
      const base = "a\nb\nc\n";
      const { editRanges } = applyEdits(base, [{ oldText: "b", newText: "B1\nB2\nB3" }]);
      expect(editRanges[0]).toEqual({ startLine: 1, endLine: 3 });
    });

    it("accounts for line-count change of earlier edits when computing startLine", () => {
      // "foo" is on line 0. Its replacement adds 2 extra lines, pushing "baz"
      // from line 2 to line 4 in the patched content.
      const base = "foo\nbar\nbaz\n";
      const { editRanges } = applyEdits(base, [
        { oldText: "foo", newText: "f1\nf2\nf3" },
        { oldText: "baz", newText: "BAZ" },
      ]);
      expect(editRanges[0]).toEqual({ startLine: 0, endLine: 2 });
      expect(editRanges[1]).toEqual({ startLine: 4, endLine: 4 });
    });

    it("accounts for line-count shrinkage of earlier edits", () => {
      // "foo\nfoo2" is on lines 0-1 and shrinks to 1 line, moving "baz"
      // from line 2 to line 1 in the patched content.
      const base = "foo\nfoo2\nbaz\n";
      const { editRanges } = applyEdits(base, [
        { oldText: "foo\nfoo2", newText: "FOO" },
        { oldText: "baz", newText: "BAZ" },
      ]);
      expect(editRanges[0]).toEqual({ startLine: 0, endLine: 0 });
      expect(editRanges[1]).toEqual({ startLine: 1, endLine: 1 });
    });

    it("preserves the array index order of editRanges regardless of file position", () => {
      // edits[0] targets "baz" (later in file), edits[1] targets "foo" (earlier).
      // editRanges[0] must correspond to edits[0] and vice versa.
      const base = "foo\nbar\nbaz\n";
      const { editRanges } = applyEdits(base, [
        { oldText: "baz", newText: "BAZ" },
        { oldText: "foo", newText: "FOO" },
      ]);
      expect(editRanges[0]).toEqual({ startLine: 2, endLine: 2 });
      expect(editRanges[1]).toEqual({ startLine: 0, endLine: 0 });
    });
  });
});
