import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Generating weekly report...");

    // Get all active programmes
    const { data: programmes, error: progError } = await supabase
      .from("programmes")
      .select("*")
      .eq("status", "active");

    if (progError) throw progError;

    // Get open risks
    const { data: risks, error: riskError } = await supabase
      .from("risks")
      .select("*")
      .in("status", ["open", "mitigating"]);

    if (riskError) throw riskError;

    // Get open issues
    const { data: issues, error: issueError } = await supabase
      .from("issues")
      .select("*")
      .in("status", ["open", "investigating", "pending"]);

    if (issueError) throw issueError;

    // Get benefits
    const { data: benefits, error: benefitError } = await supabase
      .from("benefits")
      .select("*");

    if (benefitError) throw benefitError;

    // Get stakeholders with emails
    const { data: stakeholders, error: stakeholderError } = await supabase
      .from("stakeholders")
      .select("email, name")
      .not("email", "is", null);

    if (stakeholderError) throw stakeholderError;

    // Calculate summary stats
    const highRisks = risks?.filter(r => r.score >= 15).length || 0;
    const criticalIssues = issues?.filter(i => i.priority === "critical" || i.priority === "high").length || 0;
    const avgRealization = benefits?.length 
      ? Math.round(benefits.reduce((acc, b) => acc + (b.realization || 0), 0) / benefits.length)
      : 0;

    // Generate HTML email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
          .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }
          .metric { display: inline-block; text-align: center; padding: 15px; margin: 10px; background: white; border-radius: 8px; min-width: 120px; }
          .metric-value { font-size: 28px; font-weight: bold; color: #1e40af; }
          .metric-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
          .section { margin: 20px 0; }
          .section-title { font-size: 16px; font-weight: 600; margin-bottom: 10px; color: #1e293b; }
          .risk-high { color: #dc2626; }
          .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Weekly Programme Report</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div class="content">
            <div class="section">
              <h2>Executive Summary</h2>
              <div>
                <div class="metric">
                  <div class="metric-value">${programmes?.length || 0}</div>
                  <div class="metric-label">Active Programmes</div>
                </div>
                <div class="metric">
                  <div class="metric-value">${risks?.length || 0}</div>
                  <div class="metric-label">Open Risks</div>
                </div>
                <div class="metric">
                  <div class="metric-value ${highRisks > 0 ? 'risk-high' : ''}">${highRisks}</div>
                  <div class="metric-label">High Priority Risks</div>
                </div>
                <div class="metric">
                  <div class="metric-value">${avgRealization}%</div>
                  <div class="metric-label">Avg Benefit Realization</div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Programme Status</div>
              ${programmes?.map(p => `<p>• <strong>${p.name}</strong>: ${p.progress}% complete</p>`).join('') || '<p>No active programmes</p>'}
            </div>

            <div class="section">
              <div class="section-title">Top Risks (Score ≥12)</div>
              ${risks?.filter(r => r.score >= 12).slice(0, 5).map(r => 
                `<p>• <strong>${r.title}</strong> (Score: ${r.score}) - ${r.status}</p>`
              ).join('') || '<p>No high-priority risks</p>'}
            </div>

            <div class="section">
              <div class="section-title">Critical Issues</div>
              ${issues?.filter(i => i.priority === "critical" || i.priority === "high").slice(0, 5).map(i => 
                `<p>• <strong>${i.title}</strong> (${i.priority}) - ${i.status}</p>`
              ).join('') || '<p>No critical issues</p>'}
            </div>
          </div>
          <div class="footer">
            <p>This is an automated report from the Programme Information Management Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send emails if Resend is configured
    let emailsSent = 0;
    if (resendApiKey && stakeholders && stakeholders.length > 0) {
      const resend = new Resend(resendApiKey);
      
      for (const stakeholder of stakeholders) {
        if (stakeholder.email) {
          try {
            await resend.emails.send({
              from: "PIMP Reports <onboarding@resend.dev>",
              to: [stakeholder.email],
              subject: `Weekly Programme Report - ${new Date().toLocaleDateString('en-GB')}`,
              html: emailHtml,
            });
            emailsSent++;
            console.log(`Email sent to ${stakeholder.email}`);
          } catch (emailError) {
            console.error(`Failed to send email to ${stakeholder.email}:`, emailError);
          }
        }
      }
    }

    const reportContent = {
      generatedAt: new Date().toISOString(),
      summary: {
        activeProgrammes: programmes?.length || 0,
        openRisks: risks?.length || 0,
        highPriorityRisks: highRisks,
        openIssues: issues?.length || 0,
        criticalIssues: criticalIssues,
        avgBenefitRealization: avgRealization,
      },
      emailsSent,
      stakeholdersCount: stakeholders?.length || 0,
    };

    console.log("Weekly report generated:", JSON.stringify(reportContent, null, 2));

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Weekly report generated. ${emailsSent} emails sent.`,
      report: reportContent 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating weekly report:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
