import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { relativeTime } from "../lib/format";
import { Card, EmptyState, Spinner, cn } from "../components/ui";

export function Notifications() {
  const qc = useQueryClient();
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.listNotifications,
  });
  const { data: meetings } = useQuery({ queryKey: ["meetings"], queryFn: api.listMeetings });

  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const titleFor = (meetingId: string) =>
    meetings?.find((m) => m.id === meetingId)?.title ?? "a meeting";

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Notifications</h1>
      <p className="mt-1 text-sm text-muted">Tasks assigned to you.</p>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-brand-600" />
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <EmptyState
            icon={
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            title="You're all caught up"
            hint="When a task is assigned to you, it'll show up here."
          />
        ) : (
          notifications.map((n) => (
            <Card
              key={n.id}
              className={cn(
                "flex items-center gap-4 p-4 transition-colors",
                !n.read && "border-brand-200 bg-brand-50/40",
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">
                  You were assigned a task in{" "}
                  <Link to={`/meetings/${n.meetingId}`} className="font-semibold text-brand-700 hover:underline">
                    {titleFor(n.meetingId)}
                  </Link>
                </p>
                <p className="mt-0.5 text-xs text-muted">{relativeTime(n.createdAt)}</p>
              </div>
              {!n.read && (
                <button
                  onClick={() => markRead.mutate(n.id)}
                  className="cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100"
                >
                  Mark read
                </button>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
