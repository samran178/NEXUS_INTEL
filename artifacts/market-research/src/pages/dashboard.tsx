import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useListResearch, 
  useCreateResearch, 
  useGetResearchStats,
  getListResearchQueryKey,
  getGetResearchStatsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Terminal, 
  Search, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight,
  Database,
  BarChart2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";

export function Dashboard() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useGetResearchStats();
  const { data: reports, isLoading: reportsLoading } = useListResearch();

  const createResearch = useCreateResearch();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    createResearch.mutate(
      { data: { query } },
      {
        onSuccess: (report) => {
          queryClient.invalidateQueries({ queryKey: getListResearchQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetResearchStatsQueryKey() });
          setLocation(`/research/${report.id}`);
        }
      }
    );
  };

  const statusData = [
    { name: "Completed", value: stats?.completed || 0, color: "hsl(160 100% 40%)" },
    { name: "Running", value: stats?.running || 0, color: "hsl(200 100% 50%)" },
    { name: "Failed", value: stats?.failed || 0, color: "hsl(0 84% 60%)" },
    { name: "Pending", value: (stats?.total || 0) - (stats?.completed || 0) - (stats?.running || 0) - (stats?.failed || 0), color: "hsl(45 100% 50%)" }
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-mono">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <Terminal className="h-5 w-5" />
            <span>NEXUS_INTEL</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              SYSTEM ONLINE
            </div>
            <div>{new Date().toISOString().split('T')[0]}</div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col gap-8 max-w-6xl">
        
        {/* Command Input */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold uppercase tracking-wider">Execute Protocol</h1>
            <p className="text-sm text-muted-foreground">Deploy autonomous agents to analyze markets and competitors.</p>
          </div>
          
          <Card className="border-primary/20 bg-card/30">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="flex gap-4">
                <div className="relative flex-1">
                  <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter market research query (e.g., 'EV charging market in EU')"
                    className="pl-10 font-mono bg-background border-border h-12 text-base"
                    disabled={createResearch.isPending}
                  />
                </div>
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={!query.trim() || createResearch.isPending}
                  className="font-bold tracking-widest min-w-[140px]"
                >
                  {createResearch.isPending ? "DEPLOYING..." : "EXECUTE"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/30 border-border">
            <CardContent className="p-6 flex flex-col gap-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Database className="h-4 w-4" /> TOTAL QUERIES
              </div>
              <div className="text-4xl font-bold">{statsLoading ? <Skeleton className="h-10 w-16" /> : stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/30 border-border">
            <CardContent className="p-6 flex flex-col gap-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> COMPLETED
              </div>
              <div className="text-4xl font-bold text-primary">{statsLoading ? <Skeleton className="h-10 w-16" /> : stats?.completed || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/30 border-border">
            <CardContent className="p-6 flex flex-col gap-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" /> ACTIVE
              </div>
              <div className="text-4xl font-bold text-blue-500">{statsLoading ? <Skeleton className="h-10 w-16" /> : stats?.running || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/30 border-border">
            <CardContent className="p-6 flex flex-col gap-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" /> FAILED
              </div>
              <div className="text-4xl font-bold text-destructive">{statsLoading ? <Skeleton className="h-10 w-16" /> : stats?.failed || 0}</div>
            </CardContent>
          </Card>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Reports List */}
          <section className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2">
                <Search className="h-5 w-5" /> Recent Intelligence
              </h2>
            </div>
            
            <Card className="bg-card/30 border-border">
              <div className="divide-y divide-border">
                {reportsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-4 flex items-center justify-between">
                      <div className="flex flex-col gap-2 w-full">
                        <Skeleton className="h-5 w-2/3" />
                        <Skeleton className="h-4 w-1/3" />
                      </div>
                    </div>
                  ))
                ) : reports?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No intelligence operations found. Deploy an agent to begin.
                  </div>
                ) : (
                  reports?.slice(0, 10).map((report) => (
                    <div key={report.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors group">
                      <div className="flex flex-col gap-1">
                        <div className="font-medium text-base group-hover:text-primary transition-colors">
                          {report.query}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(report.createdAt).toLocaleString()}
                          </span>
                          <span>ID: {report.id.toString().padStart(4, '0')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <StatusBadge status={report.status} />
                        <Link href={`/research/${report.id}`} className="text-muted-foreground hover:text-primary">
                          <ArrowRight className="h-5 w-5" />
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </section>

          {/* Visualizations */}
          <section className="flex flex-col gap-4">
             <h2 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2">
                <BarChart2 className="h-5 w-5" /> Status Distribution
              </h2>
              <Card className="bg-card/30 border-border h-[300px] flex items-center justify-center">
                {statsLoading ? (
                  <Skeleton className="h-[200px] w-full m-4" />
                ) : statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusData} margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '4px', fontFamily: 'monospace' }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-muted-foreground text-sm">No data available</div>
                )}
              </Card>
          </section>
        </div>

      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <Badge className="bg-primary/20 text-primary border-primary/50 font-mono rounded-sm">COMPLETED</Badge>;
    case 'running':
      return (
        <Badge variant="outline" className="text-blue-400 border-blue-500/50 bg-blue-500/10 font-mono rounded-sm flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          RUNNING
        </Badge>
      );
    case 'failed':
      return <Badge variant="destructive" className="font-mono rounded-sm">FAILED</Badge>;
    default:
      return <Badge variant="secondary" className="font-mono rounded-sm">PENDING</Badge>;
  }
}
