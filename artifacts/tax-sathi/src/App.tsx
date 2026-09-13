import { type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  useCalculateTax,
  useCreateDocument,
  useDeleteDocument,
  useGenerateItrDraft,
  useGetConsent,
  useGetDashboard,
  useHealthCheck,
  useListDocuments,
  useListItrFilings,
  useUpdateConsent,
  useUpdateDocument,
  getGetConsentQueryKey,
  getGetDashboardQueryKey,
  getListDocumentsQueryKey,
  getListItrFilingsQueryKey,
  DocumentDocumentType,
  DocumentUpdateStatus,
  type Dashboard,
  type Document,
  type Consent,
  type TaxSummary,
  type ItrDraft,
} from '@workspace/api-client-react';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Copy,
  FileCheck2,
  FilePlus2,
  FileText,
  IndianRupee,
  Info,
  Landmark,
  Loader2,
  LockKeyhole,
  Menu,
  PencilLine,
  Plus,
  RefreshCw,
  Scale,
  Settings2,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

const money = (value?: number) =>
  `₹${Math.round(value ?? 0).toLocaleString('en-IN')}`;
const dateLabel = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
    : 'Not yet';
const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const fallbackDashboard: Dashboard = {
  user: { name: 'Aarav Mehta', panMasked: 'ABCDE••••F', filingType: 'Individual · Salaried' },
  assessmentYear: '2025–26',
  documents: [],
  tax: {
    grossIncome: 1248000,
    recommendedRegime: 'new',
    savings: 18400,
    calculatedAt: new Date().toISOString(),
    newRegime: { taxableIncome: 1173000, baseTax: 90000, cess: 3600, totalTax: 93600, effectiveRate: 7.5, deductions: 75000, rebateApplied: false },
    oldRegime: { taxableIncome: 1018000, baseTax: 103600, cess: 4144, totalTax: 107744, effectiveRate: 8.6, deductions: 230000, rebateApplied: false },
  },
  checklist: [
    { id: '1', label: 'Add your Form 16', state: 'current' },
    { id: '2', label: 'Review tax calculation', state: 'upcoming' },
    { id: '3', label: 'Check your ITR-1 draft', state: 'upcoming' },
    { id: '4', label: 'Upload on the income-tax portal', state: 'upcoming' },
  ],
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={OverviewPage} />
        <Route path="/documents" component={DocumentsPage} />
        <Route path="/tax" component={TaxPage} />
        <Route path="/itr" component={ItrPage} />
        <Route path="/guide" component={GuidePage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Shell({ children, eyebrow, title, description }: { children: ReactNode; eyebrow: string; title: string; description?: string }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = [
    { href: '/', label: 'Workspace', icon: ClipboardCheck },
    { href: '/documents', label: 'Documents', icon: FileText },
    { href: '/tax', label: 'Tax comparison', icon: Scale },
    { href: '/itr', label: 'ITR-1 draft', icon: FileCheck2 },
  ];
  return (
    <div className="grain min-h-[100dvh] bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[88px] items-center border-b border-sidebar-border px-7">
          <Link href="/" className="flex items-center gap-3" data-testid="link-brand">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
              <Landmark size={19} strokeWidth={2.2} />
            </span>
            <span>
              <span className="block font-display text-[24px] leading-none tracking-[-0.03em]">Tax Sathi</span>
              <span className="mt-1 block font-mono-ui text-[9px] uppercase tracking-[0.18em] text-sidebar-foreground/55">Filing, made clear</span>
            </span>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-7" aria-label="Main navigation">
          <p className="px-4 pb-3 font-mono-ui text-[9px] uppercase tracking-[0.18em] text-sidebar-foreground/40">Your filing</p>
          <div className="space-y-1">
            {navItems.map((item) => {
              const active = location === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-lg px-4 py-3 text-[13px] font-medium transition-colors ${active ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}>
                  <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                  <span>{item.label}</span>
                  {item.href === '/documents' && <span className="ml-auto rounded-full bg-sidebar-primary/15 px-2 py-0.5 font-mono-ui text-[10px] text-sidebar-primary">4</span>}
                </Link>
              );
            })}
          </div>
          <p className="px-4 pb-3 pt-10 font-mono-ui text-[9px] uppercase tracking-[0.18em] text-sidebar-foreground/40">Help & privacy</p>
          <div className="space-y-1">
            <Link href="/guide" onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-lg px-4 py-3 text-[13px] font-medium transition-colors ${location === '/guide' ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`} data-testid="link-nav-guide"><BookOpen size={17} /> Upload guide</Link>
            <Link href="/settings" onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-lg px-4 py-3 text-[13px] font-medium transition-colors ${location === '/settings' ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`} data-testid="link-nav-settings"><Settings2 size={17} /> Privacy settings</Link>
          </div>
        </nav>
        <div className="m-4 rounded-xl border border-sidebar-border bg-sidebar-accent/45 p-4">
          <div className="flex items-center gap-2 text-sidebar-primary"><ShieldCheck size={15} /><span className="font-mono-ui text-[10px] uppercase tracking-[0.1em]">Private by design</span></div>
          <p className="mt-2 text-[11px] leading-5 text-sidebar-foreground/55">Your documents stay in your workspace and are used only to prepare this return.</p>
        </div>
      </aside>
      {mobileOpen && <button className="fixed inset-0 z-30 bg-sidebar/35 md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation" />}
      <main className="min-h-[100dvh] md:pl-[252px]">
        <header className="flex h-[88px] items-center justify-between border-b border-border/70 px-5 sm:px-8 lg:px-12">
          <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={20} /></button>
          <div className="hidden md:block">
            <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
            <h1 className="mt-1 font-display text-[30px] leading-none tracking-[-0.02em]">{title}</h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/guide" className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground sm:flex" data-testid="link-header-guide"><CircleHelp size={15} /> Need a hand?</Link>
            <div className="flex items-center gap-2 border-l border-border pl-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">AM</span>
              <div className="hidden text-left sm:block"><p className="text-xs font-semibold">Aarav Mehta</p><p className="font-mono-ui text-[9px] text-muted-foreground">AY 2025–26</p></div>
              <ChevronDown size={14} className="text-muted-foreground" />
            </div>
          </div>
        </header>
        <div className="md:hidden border-b border-border/70 px-5 py-5">
          <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
          <h1 className="mt-1 font-display text-[29px] leading-none tracking-[-0.02em]">{title}</h1>
          {description && <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>}
        </div>
        <div className="mx-auto max-w-[1360px] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">{children}</div>
      </main>
    </div>
  );
}

function useWorkspace() {
  const dashboardQuery = useGetDashboard();
  const healthQuery = useHealthCheck();
  const dashboard = dashboardQuery.data ?? fallbackDashboard;
  return { dashboard, dashboardQuery, healthQuery };
}

function LoadingBlock({ label = 'Loading your filing workspace' }: { label?: string }) {
  return <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-border bg-card"><div className="text-center"><div className="mx-auto h-9 w-9 animate-pulse rounded-full bg-accent/45" /><p className="mt-4 text-sm text-muted-foreground">{label}</p></div></div>;
}

function QueryError({ onRetry, message = 'We could not load this section.' }: { onRetry: () => void; message?: string }) {
  return <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center"><div><XCircle className="mx-auto text-destructive" size={25} /><p className="mt-3 text-sm font-semibold">{message}</p><button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground" data-testid="button-retry"><RefreshCw size={14} /> Try again</button></div></div>;
}

function OverviewPage() {
  const { dashboard, dashboardQuery } = useWorkspace();
  const documents = dashboard.documents ?? [];
  const completed = dashboard.checklist.filter((item) => item.state === 'complete').length;
  const current = dashboard.checklist.find((item) => item.state === 'current');
  return (
    <Shell eyebrow={`Assessment year ${dashboard.assessmentYear}`} title="Good morning, Aarav." description="A clear path from documents to a filed return.">
      {dashboardQuery.isLoading ? <LoadingBlock /> : dashboardQuery.isError ? <QueryError onRetry={() => dashboardQuery.refetch()} /> : <div className="space-y-8">
        <section className="animate-rise-in grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
          <div className="relative overflow-hidden rounded-2xl bg-primary p-7 text-primary-foreground sm:p-9">
            <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full border-[28px] border-accent/15" />
            <div className="absolute -bottom-28 right-20 h-72 w-72 rounded-full border border-primary-foreground/10" />
            <div className="relative max-w-[620px]">
              <div className="flex items-center gap-2 text-accent"><span className="h-2 w-2 rounded-full bg-accent" /><span className="font-mono-ui text-[10px] uppercase tracking-[0.17em]">Next best action</span></div>
              <h2 className="mt-5 max-w-lg font-display text-[37px] leading-[1.06] tracking-[-0.025em] sm:text-[46px]">Start with the documents that shape your return.</h2>
              <p className="mt-5 max-w-md text-sm leading-6 text-primary-foreground/65">Add your Form 16 first. We’ll read the key numbers, flag anything worth checking, and keep the rest of your filing in one place.</p>
              <Link href="/documents" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-3 text-xs font-bold text-accent-foreground transition-transform hover:-translate-y-0.5" data-testid="link-next-action">Review documents <ArrowRight size={15} /></Link>
            </div>
          </div>
          <div className="paper-shadow rounded-2xl border border-border bg-card p-7 sm:p-8">
            <div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Filing progress</p><p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{completed}<span className="text-muted-foreground/45">/{dashboard.checklist.length}</span></p></div><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/25 text-accent-foreground"><ClipboardCheck size={20} /></div></div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(8, completed / dashboard.checklist.length * 100)}%` }} /></div>
            <p className="mt-3 text-xs text-muted-foreground">{current ? `Up next: ${current.label}` : 'Your checklist is complete.'}</p>
            <div className="mt-6 space-y-3">{dashboard.checklist.map((item, index) => <div className="flex items-center gap-3" key={item.id} data-testid={`checklist-item-${item.id}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] ${item.state === 'complete' ? 'border-[#2b837a] bg-[#2b837a] text-white' : item.state === 'current' ? 'border-accent bg-accent/25 text-accent-foreground' : 'border-border text-muted-foreground'}`}>{item.state === 'complete' ? <Check size={13} /> : index + 1}</span><span className={`text-xs ${item.state === 'upcoming' ? 'text-muted-foreground' : 'font-medium'}`}>{item.label}</span></div>)}</div>
          </div>
        </section>
        <section className="animate-rise-in animate-rise-in-delay-1 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <div className="rounded-2xl border border-border bg-card p-7">
            <div className="flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Tax snapshot</p><h3 className="mt-2 font-display text-[25px]">A considered estimate</h3></div><Link href="/tax" className="text-xs font-semibold text-[#27766e] hover:underline" data-testid="link-view-tax">View detail <ArrowUpRight className="inline" size={14} /></Link></div>
            <div className="mt-7 flex items-end justify-between"><div><p className="text-xs text-muted-foreground">Gross income</p><p className="mt-1 font-mono-ui text-[25px] font-bold tracking-[-0.05em]">{money(dashboard.tax.grossIncome)}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Recommended</p><p className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-[#27766e]"><span className="h-2 w-2 rounded-full bg-[#2b837a]" /> {dashboard.tax.recommendedRegime === 'new' ? 'New regime' : 'Old regime'}</p></div></div>
            <div className="mt-6 border-t border-border pt-5"><div className="flex justify-between text-xs"><span className="text-muted-foreground">Estimated tax</span><span className="font-semibold">{money(dashboard.tax.recommendedRegime === 'new' ? dashboard.tax.newRegime.totalTax : dashboard.tax.oldRegime.totalTax)}</span></div><div className="mt-3 flex justify-between text-xs"><span className="text-muted-foreground">Potential saving</span><span className="font-semibold text-[#27766e]">{money(dashboard.tax.savings)}</span></div></div>
          </div>
          <div className="rounded-2xl border border-border bg-[#e8f0eb] p-7">
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c5ddd1] text-[#276e62]"><LockKeyhole size={18} /></div><div><p className="font-semibold">Your filing, your call</p><p className="text-xs text-[#45645d]">Nothing is submitted without your review.</p></div></div>
            <div className="mt-7 grid gap-5 sm:grid-cols-3"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[#52736b]">Documents</p><p className="mt-2 text-2xl font-semibold">{documents.length}</p><p className="mt-1 text-[11px] text-[#52736b]">in workspace</p></div><div><p className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[#52736b]">Last calculated</p><p className="mt-2 text-sm font-semibold">{dateLabel(dashboard.tax.calculatedAt)}</p><p className="mt-1 text-[11px] text-[#52736b]">tax estimate</p></div><div><p className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[#52736b]">Status</p><p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#27766e]"><BadgeCheck size={16} /> Private</p><p className="mt-1 text-[11px] text-[#52736b]">secure workspace</p></div></div>
          </div>
        </section>
      </div>}
    </Shell>
  );
}

function DocumentsPage() {
  const { dashboard } = useWorkspace();
  const docsQuery = useListDocuments();
  const create = useCreateDocument();
  const update = useUpdateDocument();
  const remove = useDeleteDocument();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [fileName, setFileName] = useState('');
  const [documentType, setDocumentType] = useState<string>(DocumentDocumentType.form16);
  const [filter, setFilter] = useState('all');
  const docs = docsQuery.data ?? dashboard.documents ?? [];
  const filtered = filter === 'all' ? docs : docs.filter((doc) => doc.status === filter);
  const addDocument = () => {
    if (!fileName.trim()) return;
    create.mutate({ data: { fileName: fileName.trim(), documentType: documentType as typeof DocumentDocumentType[keyof typeof DocumentDocumentType], pageCount: 1 } }, {
      onSuccess: () => { setFileName(''); setShowAdd(false); queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); },
    });
  };
  const changeStatus = (doc: Document) => update.mutate({ documentId: doc.id, data: { status: doc.status === 'verified' ? DocumentUpdateStatus.review : DocumentUpdateStatus.verified } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() }) });
  const deleteDocument = (doc: Document) => { if (window.confirm(`Remove ${doc.fileName} from your workspace?`)) remove.mutate({ documentId: doc.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() }) }); };
  return (
    <Shell eyebrow="Your filing / documents" title="Document review" description="Bring your tax papers together. We’ll show you what was read and what deserves a second look.">
      <div className="space-y-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="hidden max-w-xl text-sm leading-6 text-muted-foreground md:block">Bring your tax papers together. We’ll show you what was read and what deserves a second look.</p></div><button onClick={() => setShowAdd((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-xs font-bold text-primary-foreground hover:bg-primary/90" data-testid="button-add-document"><Plus size={16} /> Add a document</button></div>
        {showAdd && <div className="animate-rise-in rounded-2xl border border-accent/45 bg-accent/10 p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="font-semibold">Add to your workspace</p><p className="mt-1 text-xs text-muted-foreground">For now, add the document name and type. You can review extracted fields once it is processed.</p></div><button onClick={() => setShowAdd(false)} aria-label="Close add document" data-testid="button-close-add-document"><X size={18} /></button></div><div className="mt-5 grid gap-4 md:grid-cols-[1fr_200px_auto]"><label className="block"><span className="mb-2 block font-mono-ui text-[10px] uppercase tracking-[.12em] text-muted-foreground">File name</span><input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="e.g. Form16_Aarav_2024.pdf" className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none ring-accent focus:ring-2" data-testid="input-document-file-name" /></label><label className="block"><span className="mb-2 block font-mono-ui text-[10px] uppercase tracking-[.12em] text-muted-foreground">Document type</span><select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none" data-testid="select-document-type">{Object.values(DocumentDocumentType).map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</select></label><button disabled={create.isPending || !fileName.trim()} onClick={addDocument} className="mt-auto h-11 rounded-lg bg-primary px-5 text-xs font-bold text-primary-foreground disabled:opacity-50" data-testid="button-save-document">{create.isPending ? 'Adding…' : 'Add document'}</button></div></div>}
        <div className="grid gap-4 sm:grid-cols-3"><StatTile label="In workspace" value={String(docs.length)} icon={<FileText size={17} />} /><StatTile label="Need review" value={String(docs.filter((doc) => doc.status === 'review').length)} icon={<PencilLine size={17} />} tone="amber" /><StatTile label="Verified" value={String(docs.filter((doc) => doc.status === 'verified').length)} icon={<BadgeCheck size={17} />} tone="green" /></div>
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">{['all', 'review', 'verified', 'processing'].map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`} data-testid={`button-filter-${item}`}>{item === 'all' ? 'All documents' : titleCase(item)}</button>)}</div>
        {docsQuery.isLoading ? <LoadingBlock label="Loading your documents" /> : docsQuery.isError ? <QueryError onRetry={() => docsQuery.refetch()} /> : filtered.length === 0 ? <EmptyDocuments onAdd={() => setShowAdd(true)} /> : <div className="overflow-hidden rounded-2xl border border-border bg-card"><div className="hidden grid-cols-[1.5fr_1fr_.8fr_.7fr_44px] gap-4 border-b border-border bg-muted/45 px-5 py-3 font-mono-ui text-[9px] uppercase tracking-[.13em] text-muted-foreground md:grid"><span>Document</span><span>Extracted employer</span><span>Confidence</span><span>Status</span><span /></div>{filtered.map((doc) => <DocumentRow key={doc.id} doc={doc} onStatus={() => changeStatus(doc)} onDelete={() => deleteDocument(doc)} pending={update.isPending || remove.isPending} />)}</div>}
      </div>
    </Shell>
  );
}

function StatTile({ label, value, icon, tone = 'navy' }: { label: string; value: string; icon: ReactNode; tone?: 'navy' | 'amber' | 'green' }) {
  const colors = { navy: 'bg-primary/8 text-primary', amber: 'bg-accent/20 text-accent-foreground', green: 'bg-[#dcebe4] text-[#27766e]' };
  return <div className="flex items-center justify-between rounded-xl border border-border bg-card p-5"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tracking-[-.04em]">{value}</p></div><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors[tone]}`}>{icon}</span></div>;
}

function EmptyDocuments({ onAdd }: { onAdd: () => void }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 text-accent-foreground"><UploadCloud size={22} /></span><h3 className="mt-5 font-display text-2xl">Your document shelf is ready.</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Start with Form 16, then add Form 26AS or your investment proofs if they apply to you.</p><button onClick={onAdd} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-xs font-bold text-primary-foreground" data-testid="button-empty-add-document"><Plus size={15} /> Add your first document</button></div>;
}

function DocumentRow({ doc, onStatus, onDelete, pending }: { doc: Document; onStatus: () => void; onDelete: () => void; pending: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const statusStyle = doc.status === 'verified' ? 'bg-[#dcebe4] text-[#27766e]' : doc.status === 'review' ? 'bg-accent/20 text-accent-foreground' : 'bg-muted text-muted-foreground';
  return <div className="border-b border-border last:border-0"><div className="grid items-center gap-3 px-5 py-4 md:grid-cols-[1.5fr_1fr_.8fr_.7fr_44px] md:gap-4"><button className="flex min-w-0 items-center gap-3 text-left" onClick={() => setExpanded((value) => !value)} data-testid={`button-expand-document-${doc.id}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eef1e8] text-[#56755e]"><FileText size={17} /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{doc.fileName}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{titleCase(doc.documentType)} · {dateLabel(doc.uploadedAt)}</span></span></button><div className="hidden text-sm text-muted-foreground md:block">{doc.extracted?.employer || 'Pending extraction'}</div><div className="flex items-center gap-2 text-xs font-semibold"><span className="h-2 w-2 rounded-full bg-[#2b837a]" />{Math.round((doc.confidence ?? 0) * 100)}%</div><span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${statusStyle}`}>{titleCase(doc.status)}</span><div className="flex justify-end"><button onClick={onDelete} disabled={pending} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${doc.fileName}`} data-testid={`button-delete-document-${doc.id}`}><Trash2 size={15} /></button></div></div>{expanded && <div className="mx-5 mb-5 rounded-xl bg-muted/55 p-4 text-xs"><div className="grid gap-4 sm:grid-cols-4"><div><p className="text-muted-foreground">Employer</p><p className="mt-1 font-semibold">{doc.extracted?.employer || 'Not extracted'}</p></div><div><p className="text-muted-foreground">Gross salary</p><p className="mt-1 font-semibold">{money(doc.extracted?.grossSalary)}</p></div><div><p className="text-muted-foreground">TDS deducted</p><p className="mt-1 font-semibold">{money(doc.extracted?.tdsDeducted)}</p></div><div><p className="text-muted-foreground">PAN / year</p><p className="mt-1 font-semibold">{doc.extracted?.pan || '—'} · {doc.extracted?.assessmentYear || '—'}</p></div></div>{doc.extracted?.confidenceNote && <p className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-muted-foreground"><Info size={14} className="mt-0.5 shrink-0" /> {doc.extracted.confidenceNote}</p>}<button onClick={onStatus} disabled={pending || doc.status === 'processing'} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[11px] font-bold hover:border-primary/40 disabled:opacity-50" data-testid={`button-toggle-document-status-${doc.id}`}>{doc.status === 'verified' ? 'Send back to review' : 'Mark as verified'} <CheckCircle2 size={14} /></button></div>}</div>;
}

function TaxPage() {
  const { dashboard } = useWorkspace();
  const calculate = useCalculateTax();
  const [form, setForm] = useState({ grossSalary: String(dashboard.tax.grossIncome), otherIncome: '0', deductions80c: '150000', deductions80d: '25000', deductions80g: '0', homeLoanInterest: '0', hraReceived: '0', rentPaid: '0', basicSalary: '600000', age: '31', isMetro: true });
  const [result, setResult] = useState<TaxSummary | null>(null);
  const tax = result ?? dashboard.tax;
  const setField = (name: string, value: string | boolean) => setForm((current) => ({ ...current, [name]: value }));
  const runCalculation = () => calculate.mutate({ data: { grossSalary: Number(form.grossSalary) || 0, otherIncome: Number(form.otherIncome) || 0, deductions80c: Number(form.deductions80c) || 0, deductions80d: Number(form.deductions80d) || 0, deductions80g: Number(form.deductions80g) || 0, homeLoanInterest: Number(form.homeLoanInterest) || 0, hraReceived: Number(form.hraReceived) || 0, rentPaid: Number(form.rentPaid) || 0, basicSalary: Number(form.basicSalary) || 0, age: Number(form.age) || 0, isMetro: form.isMetro } }, { onSuccess: (data) => setResult(data) });
  return <Shell eyebrow="Your filing / tax" title="Tax comparison" description="Edit the numbers that matter, then compare both regimes side by side."><div className="space-y-7">
    <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-7"><div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">Inputs</p><h2 className="mt-2 font-display text-[27px]">Your tax picture</h2></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent-foreground"><IndianRupee size={18} /></div></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Use annual figures. You can adjust these as you review your documents.</p><div className="mt-6 space-y-4">{[['grossSalary','Gross salary'],['otherIncome','Other income'],['deductions80c','Section 80C'],['deductions80d','Section 80D'],['deductions80g','Section 80G'],['homeLoanInterest','Home loan interest'],['hraReceived','HRA received'],['rentPaid','Rent paid']].map(([name, label]) => <label className="block" key={name}><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono-ui text-xs text-muted-foreground">₹</span><input type="number" value={form[name as keyof typeof form] as string} onChange={(event) => setField(name, event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background pl-7 pr-3 font-mono-ui text-sm outline-none focus:ring-2 focus:ring-accent" data-testid={`input-tax-${name}`} /></div></label>)}<div className="grid grid-cols-2 gap-3"><label><span className="mb-1.5 block text-xs font-medium text-muted-foreground">Basic salary</span><input type="number" value={form.basicSalary} onChange={(event) => setField('basicSalary', event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 font-mono-ui text-sm outline-none focus:ring-2 focus:ring-accent" data-testid="input-tax-basicSalary" /></label><label><span className="mb-1.5 block text-xs font-medium text-muted-foreground">Age</span><input type="number" value={form.age} onChange={(event) => setField('age', event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 font-mono-ui text-sm outline-none focus:ring-2 focus:ring-accent" data-testid="input-tax-age" /></label></div><label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={form.isMetro} onChange={(event) => setField('isMetro', event.target.checked)} data-testid="input-tax-metro" /> Metro city for HRA calculation</label><button onClick={runCalculation} disabled={calculate.isPending} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-xs font-bold text-primary-foreground disabled:opacity-60" data-testid="button-calculate-tax">{calculate.isPending ? <><Loader2 size={15} className="animate-spin" /> Calculating…</> : <><BarChart3 size={15} /> Recalculate both regimes</>}</button>{calculate.isError && <p className="text-xs text-destructive">The calculation could not be updated. Check your figures and try again.</p>}</div></section>
      <section className="space-y-5"><div className="rounded-2xl bg-primary p-7 text-primary-foreground"><div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-primary-foreground/55">Recommendation</p><h2 className="mt-2 font-display text-[30px]">{tax.recommendedRegime === 'new' ? 'The new regime looks lighter.' : 'The old regime looks lighter.'}</h2><p className="mt-2 max-w-lg text-xs leading-5 text-primary-foreground/60">Based on the figures in this workspace. You can still choose the regime that fits your situation when you file.</p></div><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Check size={20} /></span></div><div className="mt-7 flex items-end justify-between border-t border-primary-foreground/15 pt-5"><div><p className="text-xs text-primary-foreground/55">Estimated saving</p><p className="mt-1 font-mono-ui text-2xl font-bold text-accent">{money(tax.savings)}</p></div><p className="text-right text-[11px] text-primary-foreground/45">Calculated {dateLabel(tax.calculatedAt)}</p></div></div><div className="grid gap-5 md:grid-cols-2"><RegimeCard label="New regime" regime={tax.newRegime} recommended={tax.recommendedRegime === 'new'} /><RegimeCard label="Old regime" regime={tax.oldRegime} recommended={tax.recommendedRegime === 'old'} /></div><div className="rounded-2xl border border-border bg-card p-5"><div className="flex gap-3"><Info size={17} className="mt-0.5 text-[#27766e]" /><p className="text-xs leading-5 text-muted-foreground">The comparison is an estimate for planning. It does not include income or exemptions not entered here. Review your Form 16 and AIS before generating the draft.</p></div></div></section>
    </div>
  </div></Shell>;
}

function RegimeCard({ label, regime, recommended }: { label: string; regime: TaxSummary['newRegime']; recommended: boolean }) {
  return <div className={`rounded-2xl border bg-card p-6 ${recommended ? 'border-[#70a99b] ring-1 ring-[#70a99b]/35' : 'border-border'}`}><div className="flex items-center justify-between"><p className="font-semibold">{label}</p>{recommended && <span className="rounded-full bg-[#dcebe4] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] text-[#27766e]">Recommended</span>}</div><p className="mt-6 font-mono-ui text-[26px] font-bold tracking-[-.06em]">{money(regime.totalTax)}</p><p className="mt-1 text-xs text-muted-foreground">estimated total tax</p><div className="mt-6 space-y-3 border-t border-border pt-4 text-xs"><div className="flex justify-between"><span className="text-muted-foreground">Taxable income</span><span className="font-semibold">{money(regime.taxableIncome)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Base tax</span><span className="font-semibold">{money(regime.baseTax)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Cess</span><span className="font-semibold">{money(regime.cess)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Effective rate</span><span className="font-semibold">{regime.effectiveRate.toFixed(1)}%</span></div></div></div>;
}

function ItrPage() {
  const { dashboard } = useWorkspace();
  const filingsQuery = useListItrFilings();
  const generate = useGenerateItrDraft();
  const [selected, setSelected] = useState<ItrDraft | null>(null);
  const [name, setName] = useState(dashboard.user.name);
  const [pan, setPan] = useState('ABCDE1234F');
  const [regime, setRegime] = useState<'new' | 'old'>(dashboard.tax.recommendedRegime);
  const queryClient = useQueryClient();
  const filings = filingsQuery.data ?? [];
  const current = selected ?? filings[0];
  const form16 = dashboard.documents.find((doc) => doc.documentType === 'form16');
  const generateDraft = () => generate.mutate({ data: { pan: pan.toUpperCase(), name, grossSalary: form16?.extracted.grossSalary ?? dashboard.tax.grossIncome, tdsDeducted: form16?.extracted.tdsDeducted ?? dashboard.tax.newRegime.totalTax, regime } }, { onSuccess: (draft) => { setSelected(draft); queryClient.invalidateQueries({ queryKey: getListItrFilingsQueryKey() }); } });
  return <Shell eyebrow="Your filing / ITR-1" title="Review your ITR-1" description="A draft is a review tool, not a submission. Read the warnings before you take it to the portal."><div className="space-y-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="hidden max-w-xl text-sm leading-6 text-muted-foreground md:block">A draft is a review tool, not a submission. Read the warnings before you take it to the portal.</p></div><button onClick={generateDraft} disabled={generate.isPending || !name || pan.length !== 10} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-xs font-bold text-primary-foreground disabled:opacity-50" data-testid="button-generate-itr">{generate.isPending ? <><Loader2 size={15} className="animate-spin" /> Generating…</> : <><FilePlus2 size={16} /> Generate fresh draft</>}</button></div>
    {generate.isError && <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-xs text-destructive">We could not generate this draft. Check the PAN and try again.</div>}
    {current ? <div className="grid gap-5 xl:grid-cols-[1fr_.7fr]"><section className="rounded-2xl border border-border bg-card p-6 sm:p-8"><div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><span className="rounded-md bg-primary px-2 py-1 font-mono-ui text-[10px] font-bold text-primary-foreground">ITR-1</span><span className="rounded-full bg-accent/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] text-accent-foreground">{titleCase(current.status)}</span></div><h2 className="mt-4 font-display text-[30px]">Draft return · AY {current.assessmentYear}</h2><p className="mt-2 text-xs text-muted-foreground">Generated {dateLabel(current.generatedAt)} · ID {current.id}</p></div><button onClick={() => setSelected(null)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted" data-testid="button-edit-itr-inputs"><PencilLine size={14} /> Edit inputs</button></div><div className="grid gap-4 py-7 sm:grid-cols-3"><MiniValue label="Name" value={String(current.payload.name ?? dashboard.user.name)} /><MiniValue label="Gross salary" value={money(Number(current.payload.grossSalary ?? dashboard.tax.grossIncome))} /><MiniValue label="TDS deducted" value={money(Number(current.payload.tdsDeducted ?? 0))} /></div><div className="rounded-xl bg-[#eef3eb] p-5"><div className="flex gap-3"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#27766e]" /><div><p className="text-sm font-semibold text-[#275f56]">No submission has happened</p><p className="mt-1 text-xs leading-5 text-[#52736b]">This draft only prepares values for your review. You will upload it yourself on the official income-tax portal.</p></div></div></div></section><section className="rounded-2xl border border-border bg-card p-6 sm:p-7"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">Before you upload</p><h3 className="mt-2 font-display text-[26px]">Warnings to resolve</h3><div className="mt-6 space-y-3">{current.warnings.length ? current.warnings.map((warning, index) => <div key={`${warning}-${index}`} className="flex items-start gap-3 rounded-xl border border-accent/35 bg-accent/10 p-4 text-xs leading-5"><Info size={15} className="mt-0.5 shrink-0 text-accent-foreground" />{warning}</div>) : <div className="rounded-xl bg-[#eef3eb] p-4 text-xs text-[#27766e]"><CheckCircle2 className="mb-2" size={17} /> No warnings in this draft.</div>}</div><Link href="/guide" className="mt-6 flex items-center justify-between border-t border-border pt-5 text-xs font-bold text-[#27766e]" data-testid="link-itr-guide">See upload walkthrough <ArrowRight size={15} /></Link></section></div> : <GenerateItrEmpty name={name} setName={setName} pan={pan} setPan={setPan} regime={regime} setRegime={setRegime} onGenerate={generateDraft} pending={generate.isPending} />}
    {filings.length > 1 && <div><p className="mb-3 font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">Previous drafts</p><div className="flex gap-3 overflow-x-auto pb-2">{filings.map((filing) => <button key={filing.id} onClick={() => setSelected(filing)} className="min-w-[210px] rounded-xl border border-border bg-card p-4 text-left hover:border-primary/35" data-testid={`button-select-filing-${filing.id}`}><div className="flex justify-between"><span className="font-mono-ui text-[10px] font-bold">ITR-1</span><span className="text-[10px] text-muted-foreground">{titleCase(filing.status)}</span></div><p className="mt-3 text-xs font-semibold">AY {filing.assessmentYear}</p><p className="mt-1 text-[11px] text-muted-foreground">{dateLabel(filing.generatedAt)}</p></button>)}</div></div>}
    {!filingsQuery.isLoading && filingsQuery.isError && <p className="text-xs text-muted-foreground">Draft history is temporarily unavailable, but you can still generate a fresh draft.</p>}
  </div></Shell>;
}

function GenerateItrEmpty({ name, setName, pan, setPan, regime, setRegime, onGenerate, pending }: { name: string; setName: (value: string) => void; pan: string; setPan: (value: string) => void; regime: 'new' | 'old'; setRegime: (value: 'new' | 'old') => void; onGenerate: () => void; pending: boolean }) {
  return <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]"><div className="rounded-2xl border border-dashed border-border bg-card px-7 py-12 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 text-accent-foreground"><FileCheck2 size={22} /></span><h2 className="mt-5 font-display text-2xl">Your first draft is one review away.</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">We’ll use your document values and the regime you choose to prepare an ITR-1 draft.</p></div><div className="rounded-2xl border border-border bg-card p-6 sm:p-7"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">Confirm draft details</p><div className="mt-5 space-y-4"><label className="block text-xs font-medium">Full name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-accent" data-testid="input-itr-name" /></label><label className="block text-xs font-medium">PAN<input value={pan} onChange={(event) => setPan(event.target.value.toUpperCase())} maxLength={10} className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 font-mono-ui text-sm uppercase outline-none focus:ring-2 focus:ring-accent" data-testid="input-itr-pan" /></label><label className="block text-xs font-medium">Regime<select value={regime} onChange={(event) => setRegime(event.target.value as 'new' | 'old')} className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none" data-testid="select-itr-regime"><option value="new">New regime</option><option value="old">Old regime</option></select></label><button onClick={onGenerate} disabled={pending || pan.length !== 10 || !name} className="mt-2 h-11 w-full rounded-lg bg-primary text-xs font-bold text-primary-foreground disabled:opacity-50" data-testid="button-generate-first-itr">{pending ? 'Generating draft…' : 'Generate ITR-1 draft'}</button></div></div></div>;
}

function MiniValue({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 truncate text-sm font-semibold">{value}</p></div>; }

function GuidePage() {
  const steps = [{ number: '01', title: 'Sign in to incometax.gov.in', body: 'Use the same PAN-linked account you normally use to access your income-tax return. Tax Sathi never asks for these credentials.' }, { number: '02', title: 'Choose File Income Tax Return', body: 'Open e-File → Income Tax Returns → File Income Tax Return. Select AY 2025–26 and your filing type.' }, { number: '03', title: 'Select ITR-1 and your regime', body: 'Choose ITR-1, then select the regime you reviewed in Tax Sathi. Work through the prefilled sections carefully.' }, { number: '04', title: 'Upload, validate, e-Verify', body: 'Upload your prepared JSON, validate the return, then e-Verify with an OTP or your bank account. Save the acknowledgement.' }];
  const [copied, setCopied] = useState(false);
  const copyUrl = () => { navigator.clipboard?.writeText('https://www.incometax.gov.in/iec/foportal'); setCopied(true); setTimeout(() => setCopied(false), 1600); };
  return <Shell eyebrow="Help & privacy / upload guide" title="The official upload, step by step." description="Tax Sathi prepares the review. You stay in control of the final upload and verification."><div className="space-y-8">
    <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><div className="rounded-2xl bg-primary p-7 text-primary-foreground sm:p-9"><p className="font-mono-ui text-[10px] uppercase tracking-[.17em] text-accent">A calm handoff</p><h2 className="mt-4 max-w-xl font-display text-[38px] leading-[1.06]">Take your reviewed return to the official portal.</h2><p className="mt-5 max-w-lg text-sm leading-6 text-primary-foreground/65">There is no automatic submission here. That is deliberate: you see each value, choose when to upload, and keep the acknowledgement for your records.</p><button onClick={copyUrl} className="mt-7 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-3 text-xs font-bold text-accent-foreground" data-testid="button-copy-portal-link">{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Portal link copied' : 'Copy portal link'}</button></div><div className="rounded-2xl border border-border bg-card p-7"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dcebe4] text-[#27766e]"><ShieldCheck size={20} /></div><h3 className="mt-5 font-display text-[27px]">What Tax Sathi does not do</h3><ul className="mt-5 space-y-4 text-xs leading-5 text-muted-foreground"><li className="flex gap-3"><X size={15} className="shrink-0 text-destructive" /> Never stores your portal password</li><li className="flex gap-3"><X size={15} className="shrink-0 text-destructive" /> Never submits without your action</li><li className="flex gap-3"><Check size={15} className="shrink-0 text-[#27766e]" /> Keeps a reviewable draft in your workspace</li></ul></div></div>
    <section><div className="mb-5 flex items-end justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">Portal walkthrough</p><h2 className="mt-2 font-display text-[29px]">Four considered steps</h2></div><a href="https://www.incometax.gov.in/iec/foportal" target="_blank" rel="noreferrer" className="hidden items-center gap-1 text-xs font-semibold text-[#27766e] sm:flex" data-testid="link-official-portal">Open official portal <ArrowUpRight size={14} /></a></div><div className="grid gap-3 md:grid-cols-2">{steps.map((step) => <div key={step.number} className="rounded-2xl border border-border bg-card p-6"><div className="flex items-start justify-between"><span className="font-mono-ui text-xs font-bold text-accent-foreground">{step.number}</span><ChevronRight size={17} className="text-muted-foreground" /></div><h3 className="mt-7 text-sm font-bold">{step.title}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{step.body}</p></div>)}</div></section>
    <div className="rounded-2xl border border-border bg-[#f3eee4] p-6"><div className="flex gap-3"><Info size={17} className="mt-0.5 shrink-0 text-[#7a6548]" /><p className="text-xs leading-5 text-[#6b5c48]"><strong className="text-[#514331]">Keep the acknowledgement.</strong> Once you e-Verify, download the ITR-V or acknowledgement and store it with your tax records. The official portal’s instructions are the source of truth if anything changes.</p></div></div>
  </div></Shell>;
}

function SettingsPage() {
  const consentQuery = useGetConsent();
  const update = useUpdateConsent();
  const queryClient = useQueryClient();
  const fallbackConsent: Consent = { ocrProcessing: true, dataStorage: true, taxCalculation: true, updatedAt: new Date().toISOString() };
  const consent = consentQuery.data ?? fallbackConsent;
  const [local, setLocal] = useState<Consent | null>(null);
  const values = local ?? consent;
  const setConsent = (key: keyof Pick<Consent, 'ocrProcessing' | 'dataStorage' | 'taxCalculation'>) => {
    const next = { ...values, [key]: !values[key] };
    setLocal(next);
    update.mutate({ data: { ocrProcessing: next.ocrProcessing, dataStorage: next.dataStorage, taxCalculation: next.taxCalculation } }, { onSuccess: (data) => { setLocal(data); queryClient.setQueryData(getGetConsentQueryKey(), data); } });
  };
  return <Shell eyebrow="Help & privacy / settings" title="Privacy, on your terms." description="Choose how Tax Sathi can use your information. You can change these controls at any time."><div className="mx-auto max-w-[900px] space-y-7">
    <div className="rounded-2xl border border-border bg-card p-7 sm:p-9"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#dcebe4] text-[#27766e]"><LockKeyhole size={20} /></span><div><h2 className="font-display text-[29px]">Consent controls</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">These choices determine which workspace features are active. Turning a control off can limit extraction or calculations, but never deletes your documents by itself.</p></div></div><div className="mt-8 divide-y divide-border">{[{ key: 'ocrProcessing' as const, title: 'Document reading', body: 'Allow OCR and extraction of useful fields from documents you add.', icon: FileText }, { key: 'dataStorage' as const, title: 'Workspace storage', body: 'Keep documents and reviewed values in your private Tax Sathi workspace.', icon: LockKeyhole }, { key: 'taxCalculation' as const, title: 'Tax calculations', body: 'Use your entered income and deductions to compare old and new regimes.', icon: BarChart3 }].map((item) => { const Icon = item.icon; return <div key={item.key} className="flex items-center justify-between gap-5 py-5"><div className="flex gap-4"><span className="mt-0.5 hidden h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:flex"><Icon size={17} /></span><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">{item.body}</p></div></div><button role="switch" aria-checked={values[item.key]} onClick={() => setConsent(item.key)} disabled={update.isPending} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${values[item.key] ? 'bg-[#2b837a]' : 'bg-border'}`} data-testid={`button-toggle-consent-${item.key}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-card shadow-sm transition-transform ${values[item.key] ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>; })}</div><div className="mt-5 flex items-center gap-2 border-t border-border pt-5 text-[11px] text-muted-foreground"><Clock3 size={13} /> Last updated {dateLabel(values.updatedAt)} {update.isPending && '· Saving…'}</div></div>
    <div className="rounded-2xl border border-border bg-card p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">Your rights</p><div className="mt-5 grid gap-4 text-xs sm:grid-cols-3"><div><p className="font-semibold">Review</p><p className="mt-1 leading-5 text-muted-foreground">See extracted fields before they influence a calculation.</p></div><div><p className="font-semibold">Correct</p><p className="mt-1 leading-5 text-muted-foreground">Edit a value when your document or situation needs context.</p></div><div><p className="font-semibold">Control</p><p className="mt-1 leading-5 text-muted-foreground">Switch off a feature whenever you choose.</p></div></div></div>
    {consentQuery.isError && <p className="text-xs text-muted-foreground">We could not load saved preferences, so the workspace is showing safe defaults. Try refreshing to reconnect.</p>}
  </div></Shell>;
}

function NotFound() {
  return <Shell eyebrow="Tax Sathi" title="This page moved." description="The route you followed is not part of this filing workspace."><div className="rounded-2xl border border-border bg-card px-6 py-20 text-center"><h2 className="font-display text-3xl">Let’s get you back to the checklist.</h2><Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-xs font-bold text-primary-foreground" data-testid="link-back-workspace">Back to workspace <ArrowRight size={15} /></Link></div></Shell>;
}

export default App;