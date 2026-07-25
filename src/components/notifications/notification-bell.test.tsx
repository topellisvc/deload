// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "./notification-bell";
import type { AppNotification } from "@/lib/supabase/types";

const { routerMock, authMock, channelMock, supabaseMock } = vi.hoisted(() => {
  const channel = { on: vi.fn(function (this: unknown) { return this; }), subscribe: vi.fn(function (this: unknown) { return this; }) };
  return {
    routerMock: { push: vi.fn() },
    authMock: { user: { id: "user-1" } as { id: string } | null, loading: false },
    channelMock: channel,
    supabaseMock: { channel: vi.fn(() => channel), removeChannel: vi.fn() },
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => authMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => supabaseMock }));
vi.mock("@/lib/notifications/queries", () => ({
  getRecentNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
}));
vi.mock("@/lib/notifications/mutations", () => ({
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

import { getRecentNotifications, getUnreadNotificationCount } from "@/lib/notifications/queries";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/mutations";

function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "notif-1",
    recipient_id: "user-1",
    actor_id: "coach-1",
    type: "program_assigned",
    title: "New program from your coach",
    body: '"5K Base Builder" was just added to your programs.',
    link: "/programs/prog-1",
    read_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("NotificationBell", () => {
  beforeEach(() => {
    routerMock.push.mockClear();
    authMock.user = { id: "user-1" };
    vi.mocked(getRecentNotifications).mockReset().mockResolvedValue([]);
    vi.mocked(getUnreadNotificationCount).mockReset().mockResolvedValue(0);
    vi.mocked(markNotificationRead).mockReset();
    vi.mocked(markAllNotificationsRead).mockReset();
    channelMock.on.mockClear();
    channelMock.subscribe.mockClear();
  });

  it("renders nothing while signed out", () => {
    authMock.user = null;
    const { container } = render(<NotificationBell />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the unread count as a badge", async () => {
    vi.mocked(getUnreadNotificationCount).mockResolvedValue(3);
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Notifications (3 unread)" })).toBeInTheDocument();
  });

  it("shows an empty state when there are no notifications", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);
    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByText("No notifications yet.")).toBeInTheDocument();
  });

  it("lists notifications, and clicking one marks it read and navigates to its link", async () => {
    vi.mocked(getRecentNotifications).mockResolvedValue([makeNotification()]);
    vi.mocked(getUnreadNotificationCount).mockResolvedValue(1);
    vi.mocked(markNotificationRead).mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<NotificationBell />);
    await user.click(await screen.findByRole("button", { name: "Notifications (1 unread)" }));

    const item = await screen.findByText("New program from your coach");
    await user.click(item);

    expect(markNotificationRead).toHaveBeenCalledWith(supabaseMock, "notif-1");
    expect(routerMock.push).toHaveBeenCalledWith("/programs/prog-1");
  });

  it("mark all read clears the badge and calls the bulk mutation", async () => {
    vi.mocked(getRecentNotifications).mockResolvedValue([makeNotification(), makeNotification({ id: "notif-2" })]);
    vi.mocked(getUnreadNotificationCount).mockResolvedValue(2);
    vi.mocked(markAllNotificationsRead).mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<NotificationBell />);
    await user.click(await screen.findByRole("button", { name: "Notifications (2 unread)" }));
    await user.click(await screen.findByRole("button", { name: "Mark all read" }));

    expect(markAllNotificationsRead).toHaveBeenCalledWith(supabaseMock, "user-1");
    await waitFor(() => expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument());
  });
});
