/** About view: developer, contact, GitHub link, and the disclaimer are present. */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithApp } from "./renderWithApp";
import { AboutView } from "../views/AboutView";
import { CONTACT_EMAIL, GITHUB_URL } from "../appMeta";

const emptyStore = new Map();

describe("AboutView", () => {
  it("shows developer, contact email, GitHub link and the disclaimer", () => {
    renderWithApp(<AboutView />, { store: emptyStore, view: "about" });
    expect(screen.getByText(/Dave Armstrong/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: CONTACT_EMAIL })).toHaveAttribute(
      "href",
      `mailto:${CONTACT_EMAIL}`,
    );
    expect(screen.getByRole("link", { name: GITHUB_URL })).toHaveAttribute("href", GITHUB_URL);
    expect(screen.getByText(/checked carefully by an experienced staff member/i)).toBeInTheDocument();
  });
});
