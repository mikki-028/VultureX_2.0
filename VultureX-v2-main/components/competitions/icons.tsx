"use client";

/**
 * Icons re-exported through a client boundary.
 *
 * `Trophy` is passed as a prop to the client `EmptyState` component from server
 * pages. Imported directly from lucide-react it is a forwardRef object and
 * cannot cross the RSC boundary ("Functions cannot be passed directly to
 * Client Components"); exported from this client module it becomes a
 * serialisable client reference.
 */
export { Trophy } from "lucide-react";
