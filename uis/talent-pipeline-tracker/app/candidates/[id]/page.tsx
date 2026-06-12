"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Candidate = Record<string, unknown>;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

export default function CandidateDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Missing candidate id in route");
      setIsLoading(false);
      return;
    }

    let active = true;

    async function loadCandidate() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/records/${encodeURIComponent(id)}`, {
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data: unknown = await response.json();
        const normalized =
          typeof data === "object" && data !== null
            ? (data as Candidate)
            : { value: data };

        if (active) {
          setCandidate(normalized);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load candidate");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadCandidate();

    return () => {
      active = false;
    };
  }, [id]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <header className="mb-6 border-b border-slate-200 pb-5">
          <Link
            href="/"
            className="mb-4 inline-flex text-sm font-medium text-blue-700 transition hover:text-blue-900"
          >
            <- Back to candidates
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">Candidate Detail</h1>
          <p className="mt-2 text-sm text-slate-600">Candidate ID: {id || "-"}</p>
        </header>

        {isLoading ? <p className="text-slate-600">Fetching record from /records/{id}...</p> : null}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Could not load candidate: {error}
          </div>
        ) : null}

        {!isLoading && !error && candidate ? (
          <section className="space-y-3">
            {Object.entries(candidate).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">
                  {formatValue(value)}
                </p>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
