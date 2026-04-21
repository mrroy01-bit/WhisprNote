import { lazy, Suspense, useEffect } from 'react';
import { useAuthStore } from './store/auth';
import { useTheme } from './hooks/useTheme';
import { WorkspaceSkeleton } from './components/Skeleton';

const AuthPage = lazy(() =>
  import('./pages/AuthPage').then((module) => ({ default: module.AuthPage }))
);

const WorkspacePage = lazy(() =>
  import('./pages/WorkspacePage').then((module) => ({ default: module.WorkspacePage }))
);

function FullScreenLoader() {
  return <WorkspaceSkeleton />;
}

function SchemaSetupScreen({ onRetry }: { onRetry: () => void }) {
  const projectUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-2xl rounded-3xl border border-amber-200 bg-white shadow-2xl shadow-amber-100/60 p-8">
        <div className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold tracking-wide text-amber-800">
          Database Setup Required
        </div>

        <h1 className="mt-5 text-3xl font-bold text-slate-900">
          The frontend is working, but your Supabase tables are missing.
        </h1>
        <p className="mt-3 text-slate-600">
          Run the SQL from
          {' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-slate-800">
            supabase/migrations/20260420063128_01_create_initial_schema.sql
          </code>
          {' '}
          in the SQL Editor for this project, then retry.
        </p>

        {projectUrl && (
          <p className="mt-3 text-sm text-slate-500">
            Connected project:
            {' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
              {projectUrl}
            </code>
          </p>
        )}

        <div className="mt-6 rounded-2xl bg-slate-950 p-4 text-sm text-slate-100">
          <p>1. Open Supabase Dashboard.</p>
          <p>2. Go to SQL Editor.</p>
          <p>3. Run the initial migration file.</p>
          <p>4. Return here and press Retry.</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={onRetry}
            className="rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-blue-700"
          >
            Retry
          </button>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-300 px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Open Supabase
          </a>
        </div>
      </div>
    </div>
  );
}

function isSchemaSetupError(error: string | null) {
  return (error ?? '').toLowerCase().includes('schema is not installed');
}

function App() {
  const { user, loading, error, hydrate } = useAuthStore();
  useTheme();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (loading) {
    return <FullScreenLoader />;
  }

  if (isSchemaSetupError(error)) {
    return <SchemaSetupScreen onRetry={() => void hydrate()} />;
  }

  return (
    <Suspense fallback={<FullScreenLoader />}>
      {user ? <WorkspacePage /> : <AuthPage />}
    </Suspense>
  );
}

export default App;
