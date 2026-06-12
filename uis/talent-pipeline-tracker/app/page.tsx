"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Candidate = Record<string, unknown>;

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

export default function CandidatesListPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCandidates() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/records", {
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data: unknown = await response.json();
        const normalized = Array.isArray(data)
          ? data
          : typeof data === "object" && data !== null && Array.isArray((data as { records?: unknown }).records)
            ? ((data as { records: unknown[] }).records ?? [])
            : [];

        if (active) {
          const objectCandidates = normalized.filter(
            (item): item is Candidate => typeof item === "object" && item !== null,
          );
          setCandidates(objectCandidates);
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

    return `${candidates.length} candidates`;
  }, [candidates.length, isLoading]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <header className="mb-6 border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-semibold text-slate-900">Candidate Pipeline</h1>
          <p className="mt-2 text-sm text-slate-600">{totalLabel}</p>
        </header>

        {isLoading ? <p className="text-slate-600">Fetching records from /records...</p> : null}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Could not load candidates: {error}
          </div>
        ) : null}

        {!isLoading && !error && candidates.length === 0 ? (
          <p className="text-slate-600">No candidates were returned by /records.</p>
        ) : null}

        {!isLoading && !error && candidates.length > 0 ? (
          <ul className="space-y-3">
            {candidates.map((candidate, index) => {
              const id = candidateId(candidate, index);
              const name =
                toDisplayText(candidate.name) !== "-"
                  ? toDisplayText(candidate.name)
                  : toDisplayText(candidate.fullName) !== "-"
                    ? toDisplayText(candidate.fullName)
                    : `Candidate ${index + 1}`;
              const email = toDisplayText(candidate.email);
              const position = toDisplayText(candidate.position ?? candidate.role ?? candidate.jobTitle);
              const status = toDisplayText(candidate.status);

              return (
                <li key={`${id}-${index}`}>
                  <Link
                    href={`/candidates/${encodeURIComponent(id)}`}
                    className="block rounded-xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-lg font-medium text-slate-900">{name}</h2>
                        <p className="text-sm text-slate-600">{email}</p>
                      </div>

                      <div className="text-sm text-slate-700 sm:text-right">
                        <p>
                          <span className="font-medium">Position:</span> {position}
                        </p>
                        <p>
                          <span className="font-medium">Status:</span> {status}
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
