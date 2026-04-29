import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, MessageSquare, AlertCircle, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, subDays } from "date-fns";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";
import { cn } from "@/lib/utils";

export default function CSATDashboard() {
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<any[]>([]);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    (async () => {
      setLoading(true);
      const since = subDays(new Date(), 90).toISOString();
      const [{ data: r }, { data: s }] = await Promise.all([
        (supabase as any)
          .from("helpdesk_csat_responses")
          .select("*, helpdesk_tickets(reference_number, subject)")
          .eq("organization_id", currentOrganization?.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("helpdesk_csat_surveys")
          .select("id, status, created_at")
          .eq("organization_id", currentOrganization?.id)
          .gte("created_at", since),
      ]);
      setResponses(r || []);
      setSurveys(s || []);
      setLoading(false);
    })();
  }, [currentOrganization?.id]);

  const stats = useMemo(() => {
    if (!responses.length) {
      return { avg: 0, csat: 0, count: 0, responseRate: 0, followUps: 0, distribution: [] as any[], trend: [] as any[] };
    }
    const sum = responses.reduce((a, r) => a + r.rating, 0);
    const avg = sum / responses.length;
    const positive = responses.filter((r) => r.rating >= 4).length;
    const csat = (positive / responses.length) * 100;
    const responseRate = surveys.length ? (responses.length / surveys.length) * 100 : 0;
    const followUps = responses.filter((r) => r.follow_up_needed && !r.follow_up_resolved).length;

    const distribution = [1, 2, 3, 4, 5].map((n) => ({
      rating: `${n}★`,
      count: responses.filter((r) => r.rating === n).length,
    }));

    const byDay: Record<string, { date: string; total: number; sum: number }> = {};
    responses.forEach((r) => {
      const d = format(new Date(r.created_at), "MMM dd");
      if (!byDay[d]) byDay[d] = { date: d, total: 0, sum: 0 };
      byDay[d].total += 1;
      byDay[d].sum += r.rating;
    });
    const trend = Object.values(byDay).map((d) => ({ date: d.date, avg: +(d.sum / d.total).toFixed(2) })).reverse();

    return { avg, csat, count: responses.length, responseRate, followUps, distribution, trend };
  }, [responses, surveys]);

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Customer Satisfaction</h1>
          <p className="text-muted-foreground">CSAT scores, sentiment and feedback (last 90 days)</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">CSAT Score</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.csat.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground mt-1">% rated 4–5 stars</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Average Rating</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold flex items-center gap-2">
                    {stats.avg.toFixed(2)}
                    <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{stats.count} responses</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Response Rate</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.responseRate.toFixed(0)}%</div>
                  <p className="text-xs text-muted-foreground mt-1">{stats.count}/{surveys.length} surveys</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Follow-ups</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold flex items-center gap-2">
                    {stats.followUps}
                    {stats.followUps > 0 && <AlertCircle className="h-5 w-5 text-destructive" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Open negative feedback</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="responses">Responses</TabsTrigger>
                <TabsTrigger value="followups">Follow-ups ({stats.followUps})</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Rating Distribution</CardTitle></CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.distribution}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="rating" className="text-xs" />
                          <YAxis className="text-xs" allowDecimals={false} />
                          <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Average Rating Trend</CardTitle></CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stats.trend}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis domain={[0, 5]} className="text-xs" />
                          <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                          <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="responses">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ticket</TableHead>
                          <TableHead>Rating</TableHead>
                          <TableHead>Sentiment</TableHead>
                          <TableHead>Comment</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {responses.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <Link to={`/support/tickets/${r.ticket_id}`} className="text-primary hover:underline">
                                {r.helpdesk_tickets?.reference_number || "—"}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <div className="flex">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <Star key={n} className={cn("h-4 w-4", r.rating >= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30")} />
                                ))}
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="secondary" className="capitalize">{r.sentiment?.replace(/_/g, " ") || "—"}</Badge></TableCell>
                            <TableCell className="max-w-md truncate text-muted-foreground">{r.comment || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), "PP")}</TableCell>
                          </TableRow>
                        ))}
                        {!responses.length && (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No responses yet</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="followups">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ticket</TableHead>
                          <TableHead>Rating</TableHead>
                          <TableHead>Comment</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {responses.filter((r) => r.follow_up_needed && !r.follow_up_resolved).map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <Link to={`/support/tickets/${r.ticket_id}`} className="text-primary hover:underline">
                                {r.helpdesk_tickets?.reference_number || "—"}
                              </Link>
                            </TableCell>
                            <TableCell><Badge variant="destructive">{r.rating}★</Badge></TableCell>
                            <TableCell className="text-muted-foreground italic">"{r.comment || "No comment"}"</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={async () => {
                                await (supabase as any).from("helpdesk_csat_responses").update({ follow_up_resolved: true }).eq("id", r.id);
                                setResponses((prev) => prev.map((x) => x.id === r.id ? { ...x, follow_up_resolved: true } : x));
                              }}>Mark resolved</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!stats.followUps && (
                          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No open follow-ups 🎉</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
}
