import { describe, expect, it, vi } from "vitest";

vi.mock("~/components/ui/toast", () => ({
  showToast: vi.fn(),
}));

import { showToast } from "~/components/ui/toast";
import { toast } from "../toast";

describe("toast helper", () => {
  it("toast.success calls showToast with variant='success' and duration=3000", () => {
    toast.success("成功しました");
    expect(showToast).toHaveBeenCalledWith({
      title: "成功しました",
      variant: "success",
      duration: 3000,
    });
  });

  it("toast.error calls showToast with variant='error' and duration=5000", () => {
    toast.error("エラーが発生しました");
    expect(showToast).toHaveBeenCalledWith({
      title: "エラーが発生しました",
      variant: "error",
      duration: 5000,
    });
  });

  it("toast.info calls showToast with variant='info' and duration=3000", () => {
    toast.info("処理を開始しました");
    expect(showToast).toHaveBeenCalledWith({
      title: "処理を開始しました",
      variant: "info",
      duration: 3000,
    });
  });

  it("toast.warning calls showToast with variant='warning' and duration=5000", () => {
    toast.warning("注意してください");
    expect(showToast).toHaveBeenCalledWith({
      title: "注意してください",
      variant: "warning",
      duration: 5000,
    });
  });

  it("forwards description when provided", () => {
    toast.success("送信しました", { description: "成功" });
    expect(showToast).toHaveBeenCalledWith({
      title: "送信しました",
      variant: "success",
      duration: 3000,
      description: "成功",
    });
  });

  it("forwards actions when provided", () => {
    const onClick = vi.fn();
    const actions = [{ label: "開く", onClick }];
    toast.success("送信しました", { actions });
    expect(showToast).toHaveBeenCalledWith({
      title: "送信しました",
      variant: "success",
      duration: 3000,
      actions,
    });
  });

  it("override duration replaces the variant default", () => {
    toast.warning("ゆっくり読んで", { duration: 8000 });
    expect(showToast).toHaveBeenCalledWith({
      title: "ゆっくり読んで",
      variant: "warning",
      duration: 8000,
    });
  });

  it("omits description and actions keys when undefined (exactOptionalPropertyTypes)", () => {
    toast.error("失敗", {});
    expect(showToast).toHaveBeenCalledWith({
      title: "失敗",
      variant: "error",
      duration: 5000,
    });
  });
});
