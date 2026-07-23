import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("renders one button per page plus prev/next", () => {
    render(<Pagination page={0} pageCount={2} onGo={() => {}} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("‹")).toBeInTheDocument();
    expect(screen.getByText("›")).toBeInTheDocument();
  });

  it("calls onGo with the clicked page index", async () => {
    const onGo = vi.fn();
    render(<Pagination page={0} pageCount={2} onGo={onGo} />);
    await userEvent.click(screen.getByText("2"));
    expect(onGo).toHaveBeenCalledWith(1);
  });

  it("clamps next at the last page and prev at zero", async () => {
    const onGo = vi.fn();
    render(<Pagination page={1} pageCount={2} onGo={onGo} />);
    await userEvent.click(screen.getByText("›"));
    expect(onGo).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByText("‹"));
    expect(onGo).toHaveBeenCalledWith(0);
  });
});
