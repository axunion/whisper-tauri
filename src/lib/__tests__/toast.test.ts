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
});
