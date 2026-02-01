import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import "@testing-library/jest-dom";
import LandingPage from "../lib/LandingPage.svelte";

describe("LandingPage component", () => {
  it("should render the page title", () => {
    render(LandingPage);

    const heading = screen.getByRole("heading", { name: /gSnake Level Editor/i });
    expect(heading).toBeInTheDocument();
  });

  it("should render the description text", () => {
    render(LandingPage);

    const description = screen.getByText(/Create and edit levels for gSnake/i);
    expect(description).toBeInTheDocument();
  });

  it("should render the Create New Level button", () => {
    render(LandingPage);

    const createButton = screen.getByRole("button", { name: /Create New Level/i });
    expect(createButton).toBeInTheDocument();
  });

  it("should render the Load Existing Level button", () => {
    render(LandingPage);

    const loadButton = screen.getByRole("button", { name: /Load Existing Level/i });
    expect(loadButton).toBeInTheDocument();
  });
});
