import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { 
  useGetResearch, 
  useGetResearchStatus,
  useDownloadReport,
  getGetResearchQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Terminal, 
  ArrowLeft,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  Database,
  LineChart,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const AGENTS = [
  { id: "The Researcher", icon: Search, desc: "Data gathering" },
  { id: "The Data Analyst", icon: Database, desc: "Competitor extraction" },
  { id: "The Business Strategist", icon: LineChart, desc: "SWOT analysis" },
  { id: "The Report Writer", icon: FileText, desc: "Report generation" }
];

export function Report() {
  const [, params] = useRoute("/research/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const queryClient = useQueryClient();

  // Polling for status
  const { data: statusUpdate } = useGetResearchStatus(id, {
    query: {
      enabled: !!id,
      refetchInterval: (query) => {
        const currentStatus = query.state.data?.status;
        return currentStatus === 'running' || currentStatus === 'pending' ? 2000 : false;
      }
    }
  });

  // Fetch full report once completed or initially to get static data
  const { data: report, isLoading, refetch: refetchReport } = useGetResearch(id, {
    query: { enabled: !!id }
  });

  // Refetch full report when status changes to completed
  useEffect(() => {
    if (statusUpdate?.status === 'completed' && report?.status !== 'completed') {
      refetchReport();
    }
  }, [statusUpdate?.status, report?.status, refetchReport]);

  const { refetch: downloadRawReport, isFetching: isDownloading } = useDownloadReport(id, {
    query: { enabled: false }
  });

  const handleDownload = async () => {
    try {
      const { data } = await downloadRawReport();
      if (!data) return;
      
      const blob = new Blob([data], { type: 'text/markdown' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Market_Research_${id}_${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to download report", error);
    }
  };

  const currentStatus = statusUpdate?.status || report?.status || 'pending';
  const currentAgent = statusUpdate?.currentAgent || report?.currentAgent;
  const agentProgress = statusUpdate?.agentProgress || report?.agentProgress;
  const errorMessage = statusUpdate?.errorMessage || report?.errorMessage;

  if (isLoading && !report) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col font-mono items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div>Initializing intelligence feed...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col font-mono items-center justify-center gap-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <div>Intelligence record not found.</div>
        <Button asChild variant="outline"><Link href="/">Return to Base</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-mono pb-20">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              BACK
            </Link>
            <div className="h-4 w-px bg-border"></div>
            <div className="font-bold text-sm truncate max-w-md" title={report.query}>
              OP: {report.query}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentStatus === 'completed' && (
              <Button size="sm" onClick={handleDownload} disabled={isDownloading} className="gap-2">
                <Download className="h-4 w-4" />
                {isDownloading ? "DOWNLOADING..." : "EXPORT .MD"}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col gap-8 max-w-6xl">
        
        {/* Progress Pipeline */}
        <section className="bg-card/30 border border-border p-6 rounded-lg">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
            <div>
              <h2 className="text-lg font-bold tracking-wider">OPERATION STATUS</h2>
              <p className="text-sm text-muted-foreground font-mono mt-1">ID: {report.id.toString().padStart(4, '0')} | Started: {new Date(report.createdAt).toLocaleString()}</p>
            </div>
            <div>
              {currentStatus === 'completed' ? (
                <Badge className="bg-primary/20 text-primary border-primary/50 text-sm py-1 px-3">OPERATION COMPLETE</Badge>
              ) : currentStatus === 'failed' ? (
                <Badge variant="destructive" className="text-sm py-1 px-3">OPERATION FAILED</Badge>
              ) : (
                <Badge variant="outline" className="text-blue-400 border-blue-500/50 bg-blue-500/10 text-sm py-1 px-3 flex items-center gap-2">
                  <RefreshCw className="h-3 w-3 animate-spin" /> OPERATION IN PROGRESS
                </Badge>
              )}
            </div>
          </div>

          <div className="relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2 hidden md:block"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
              {AGENTS.map((agent, index) => {
                const AgentIcon = agent.icon;
                
                // Determine state
                let state = "pending"; // pending, active, completed
                if (currentStatus === 'completed') {
                  state = "completed";
                } else if (currentStatus === 'failed') {
                  // if failed, current and all after are failed/pending. We'll just mark current as failed.
                  if (currentAgent === agent.id) state = "failed";
                  else {
                     // Check if this agent is before the current agent
                    const currentIndex = AGENTS.findIndex(a => a.id === currentAgent);
                    if (index < currentIndex) state = "completed";
                  }
                } else {
                  const currentIndex = AGENTS.findIndex(a => a.id === currentAgent);
                  if (index < currentIndex) state = "completed";
                  else if (index === currentIndex) state = "active";
                }

                return (
                  <div key={agent.id} className="flex flex-row md:flex-col items-center gap-4 md:gap-2">
                    <div className={`
                      h-12 w-12 rounded-full flex items-center justify-center border-2 transition-all duration-500
                      ${state === 'completed' ? 'bg-primary/20 border-primary text-primary' : ''}
                      ${state === 'active' ? 'bg-blue-500/20 border-blue-500 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : ''}
                      ${state === 'failed' ? 'bg-destructive/20 border-destructive text-destructive' : ''}
                      ${state === 'pending' ? 'bg-card border-border text-muted-foreground' : ''}
                    `}>
                      {state === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : 
                       state === 'failed' ? <AlertCircle className="h-5 w-5" /> : 
                       <AgentIcon className={`h-5 w-5 ${state === 'active' ? 'animate-pulse' : ''}`} />}
                    </div>
                    <div className="text-left md:text-center">
                      <div className={`font-bold text-sm ${state === 'active' ? 'text-blue-400' : state === 'completed' ? 'text-primary' : 'text-muted-foreground'}`}>
                        {agent.id}
                      </div>
                      <div className="text-xs text-muted-foreground">{agent.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {(currentStatus === 'running' || currentStatus === 'pending') && agentProgress && (
            <div className="mt-8 bg-black/40 border border-border rounded p-4 font-mono text-sm text-green-400 flex flex-col gap-2">
              <div className="text-muted-foreground text-xs uppercase">Live Feed</div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500">{">"}</span> 
                <span className="animate-pulse">{agentProgress}</span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mt-8 bg-destructive/10 border border-destructive/50 rounded p-4 font-mono text-sm text-destructive flex flex-col gap-2">
              <div className="text-destructive/70 text-xs uppercase">System Error</div>
              <div className="flex items-start gap-2">
                <span>{">"}</span> 
                <span>{errorMessage}</span>
              </div>
            </div>
          )}
        </section>

        {/* Data Sections (Only show if we have data) */}
        {report.swotAnalysis && (
          <section className="flex flex-col gap-4">
            <h3 className="text-xl font-bold border-b border-border pb-2">SWOT ANALYSIS</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border bg-card/30 border-t-4 border-t-blue-500">
                <CardHeader className="py-3 px-4 bg-black/20">
                  <CardTitle className="text-base text-blue-500">STRENGTHS</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ul className="list-disc list-inside text-sm space-y-2 text-muted-foreground ml-4">
                    {report.swotAnalysis.strengths?.map((s, i) => <li key={i}>{s}</li>) || <li>No data</li>}
                  </ul>
                </CardContent>
              </Card>
              <Card className="border-border bg-card/30 border-t-4 border-t-amber-500">
                <CardHeader className="py-3 px-4 bg-black/20">
                  <CardTitle className="text-base text-amber-500">WEAKNESSES</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ul className="list-disc list-inside text-sm space-y-2 text-muted-foreground ml-4">
                    {report.swotAnalysis.weaknesses?.map((s, i) => <li key={i}>{s}</li>) || <li>No data</li>}
                  </ul>
                </CardContent>
              </Card>
              <Card className="border-border bg-card/30 border-t-4 border-t-primary">
                <CardHeader className="py-3 px-4 bg-black/20">
                  <CardTitle className="text-base text-primary">OPPORTUNITIES</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ul className="list-disc list-inside text-sm space-y-2 text-muted-foreground ml-4">
                    {report.swotAnalysis.opportunities?.map((s, i) => <li key={i}>{s}</li>) || <li>No data</li>}
                  </ul>
                </CardContent>
              </Card>
              <Card className="border-border bg-card/30 border-t-4 border-t-destructive">
                <CardHeader className="py-3 px-4 bg-black/20">
                  <CardTitle className="text-base text-destructive">THREATS</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ul className="list-disc list-inside text-sm space-y-2 text-muted-foreground ml-4">
                    {report.swotAnalysis.threats?.map((s, i) => <li key={i}>{s}</li>) || <li>No data</li>}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {report.competitors && report.competitors.length > 0 && (
          <section className="flex flex-col gap-4">
            <h3 className="text-xl font-bold border-b border-border pb-2">COMPETITOR MATRIX</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-black/40 text-muted-foreground border-y border-border">
                  <tr>
                    <th className="px-4 py-3">Competitor</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Market Share</th>
                    <th className="px-4 py-3">Pricing</th>
                    <th className="px-4 py-3">Key Strengths</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {report.competitors.map((comp, i) => (
                    <tr key={i} className="bg-card/10 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-primary whitespace-nowrap">{comp.name}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate" title={comp.description || ''}>{comp.description || '-'}</td>
                      <td className="px-4 py-3 font-mono">{comp.marketShare || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{comp.pricing || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{comp.strengths || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {report.keyTrends && report.keyTrends.length > 0 && (
          <section className="flex flex-col gap-4">
            <h3 className="text-xl font-bold border-b border-border pb-2">KEY MARKET TRENDS</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.keyTrends.map((trend, i) => (
                <div key={i} className="bg-card/30 border border-border p-4 rounded flex items-start gap-3">
                  <div className="text-primary mt-1">
                    <LineChart className="h-4 w-4" />
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    {trend}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Full Report Markdown */}
        {report.report && (
          <section className="flex flex-col gap-4 mt-8">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-xl font-bold">FULL SYNTHESIS REPORT</h3>
            </div>
            <div className="bg-black/20 border border-border rounded-lg p-6 md:p-8">
              <article className="prose prose-invert prose-emerald max-w-none prose-pre:bg-black/50 prose-pre:border prose-pre:border-border font-sans">
                {/* 
                  A real app would use react-markdown here:
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.report}</ReactMarkdown>
                  But since we cannot guarantee dependencies, we will render it natively if simple, or just use a pre tag fallback if needed.
                  Since we used the packager tool to install react-markdown, we can import it. Let's add it. 
                */}
                <MarkdownRenderer content={report.report} />
              </article>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}

// Fallback markdown renderer in case react-markdown failed to install
function MarkdownRenderer({ content }: { content: string }) {
  // Try to use react-markdown if available
  try {
    const ReactMarkdown = require('react-markdown').default;
    const remarkGfm = require('remark-gfm').default;
    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
  } catch (e) {
    // Fallback: very basic regex rendering for the most critical markdown
    const renderBasicMarkdown = (text: string) => {
      let html = text
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        .replace(/`(.*?)`/gim, '<code>$1</code>')
        .replace(/\n\n/gim, '<br/><br/>');
      return <div dangerouslySetInnerHTML={{ __html: html }} />;
    };
    return <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-muted-foreground">{content}</div>;
  }
}
