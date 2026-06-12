"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Candidate = Record<string, unknown>;
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "") ?? "";

function buildApiUrl(path: string): string {
  if (!apiBaseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function toDisplayText(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function candidateId(candidate: Candidate, index: number): string {
  const possibleId = candidate.id ?? candidate._id ?? candidate.candidateId ?? candidate.candidate_id;
  return possibleId ? String(possibleId) : String(index);
}

function parseNumericValue(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function getStringField(candidate: Candidate, keys: string[]): string {
  for (const key of keys) {
    const value = candidate[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getCandidateFullName(candidate: Candidate): string {
  const fullName = getStringField(candidate, ["fullName", "name", "full_name", "candidateName"]);
  if (fullName) {
    return fullName;
  }

  const firstName = getStringField(candidate, ["firstName", "first_name"]);
  const lastName = getStringField(candidate, ["lastName", "last_name"]);
  const joined = `${firstName} ${lastName}`.trim();

  return joined || "Unnamed candidate";
}

export default function CandidatesListPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const statusFilter = (searchParams.get("status") ?? "").trim().toLowerCase();
  const stageFilter = (searchParams.get("stage") ?? "").trim().toLowerCase();

  useEffect(() => {
    let active = true;

    async function loadCandidates() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(buildApiUrl("/records"), {
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const json: unknown = await response.json();
        const normalized =
          typeof json === "object" && json !== null && Array.isArray((json as { data?: unknown }).data)
            ? ((json as { data: unknown[] }).data ?? [])
            : [];
        const total =
          typeof json === "object" && json !== null
            ? parseNumericValue((json as { total?: unknown }).total, normalized.length)
            : normalized.length;
        const page =
          typeof json === "object" && json !== null
            ? parseNumericValue((json as { page?: unknown }).page, 1)
            : 1;
        const limit =
          typeof json === "object" && json !== null
            ? parseNumericValue((json as { limit?: unknown }).limit, normalized.length)
            : normalized.length;

        if (active) {
          const objectCandidates = normalized.filter(
            (item): item is Candidate => typeof item === "object" && item !== null,
          );
          setCandidates(objectCandidates);
          setTotalCandidates(total);
          setCurrentPage(page);
          setPageLimit(limit);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load candidates");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadCandidates();

    return () => {
      active = false;
    };
  }, []);

  const totalLabel = useMemo(() => {
    if (isLoading) {
      return "Loading candidates...";
    }

    return `${totalCandidates} total candidates`;
  }, [totalCandidates, isLoading]);

  const normalizedCandidates = useMemo(() => {
    return candidates.map((candidate, index) => {
      const id = candidateId(candidate, index);
      const fullName = getCandidateFullName(candidate);
      const email = toDisplayText(candidate.email ?? candidate.emailAddress ?? candidate.contactEmail);
      const position = toDisplayText(
        candidate.position ?? candidate.appliedPosition ?? candidate.role ?? candidate.jobTitle,
      );
      const status = toDisplayText(candidate.status ?? candidate.currentStatus);
      const stage = toDisplayText(candidate.stage ?? candidate.currentStage ?? candidate.pipelineStage);

      return {
        id,
        fullName,
        email,
        position,
        status,
        stage,
      };
    });
  }, [candidates]);

  const statusOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const candidate of normalizedCandidates) {
      if (candidate.status !== "-") {
        unique.add(candidate.status);
      }
    }

    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [normalizedCandidates]);

  const stageOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const candidate of normalizedCandidates) {
      if (candidate.stage !== "-") {
        unique.add(candidate.stage);
      }
    }

    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [normalizedCandidates]);

  const filteredCandidates = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return normalizedCandidates.filter((candidate) => {
      const matchesSearch =
        !normalizedSearch ||
        candidate.fullName.toLowerCase().includes(normalizedSearch) ||
        candidate.email.toLowerCase().includes(normalizedSearch);
      const matchesStatus = !statusFilter || candidate.status.toLowerCase() === statusFilter;
      const matchesStage = !stageFilter || candidate.stage.toLowerCase() === stageFilter;

      return matchesSearch && matchesStatus && matchesStage;
    });
  }, [normalizedCandidates, searchTerm, statusFilter, stageFilter]);

  const pageLabel = useMemo(() => {
    if (isLoading) {
      return "Loading page info...";
    }

    return `Page ${currentPage} • Limit ${pageLimit} • Showing ${filteredCandidates.length}`;
  }, [currentPage, filteredCandidates.length, isLoading, pageLimit]);

  function updateQueryFilter(key: "status" | "stage", value: string): void {
    const params = new URLSearchParams(searchParams.toString());

    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <header className="mb-6 border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-semibold text-slate-900">Candidate Pipeline</h1>
          <p className="mt-2 text-sm text-slate-600">{totalLabel}</p>
          <p className="mt-1 text-sm text-slate-500">{pageLabel}</p>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by full name or email"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
          />

          <select
            value={searchParams.get("status") ?? ""}
            onChange={(event) => updateQueryFilter("status", event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
          >
            <option value="">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            value={searchParams.get("stage") ?? ""}
            onChange={(event) => updateQueryFilter("stage", event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
          >
            <option value="">All stages</option>
            {stageOptions.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </section>

        {isLoading ? (
          <div className="rounded-lg border border-slate-200 bg-slate-100 p-4 text-sm text-slate-700">
            Loading candidates from {apiBaseUrl ? `${apiBaseUrl}/records` : "NEXT_PUBLIC_API_URL/records"}...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Could not load candidates: {error}
          </div>
        ) : null}

        {!isLoading && !error && normalizedCandidates.length === 0 ? (
          <p className="text-slate-600">
            No candidates were returned by {apiBaseUrl ? `${apiBaseUrl}/records` : "NEXT_PUBLIC_API_URL/records"}.
          </p>
        ) : null}

        {!isLoading && !error && normalizedCandidates.length > 0 && filteredCandidates.length === 0 ? (
          <p className="text-slate-600">No candidates match the current search and filters.</p>
        ) : null}

        {!isLoading && !error && filteredCandidates.length > 0 ? (
          <ul className="space-y-3">
            {filteredCandidates.map((candidate, index) => {
              return (
                <li key={`${candidate.id}-${index}`}>
                  <Link
                    href={`/candidates/${encodeURIComponent(candidate.id)}`}
                    className="block rounded-xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-lg font-medium text-slate-900">{candidate.fullName}</h2>
                        <p className="text-sm text-slate-600">{candidate.email}</p>
                      </div>

                      <div className="text-sm text-slate-700 sm:text-right">
                        <p>
                          <span className="font-medium">Position:</span> {candidate.position}
                        </p>
                        <p>
                          <span className="font-medium">Status:</span> {candidate.status}
                        </p>
                        <p>
                          <span className="font-medium">Stage:</span> {candidate.stage}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </main>
  );
}
