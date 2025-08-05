"use client";

import { ArrowRight, Building2, Lightbulb, MessageSquare, Plus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { StatusCard } from "@/components/dashboard/StatusCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useJobStore } from "@/stores/jobStore";

export default function DashboardPage() {
  const router = useRouter();
  const { jobs, getActiveJobsCount } = useJobStore();

  const activeJobs = getActiveJobsCount();
  const recentJobs = jobs.slice(0, 3);

  const quickActions = [
    {
      title: "Upload Data",
      description: "Upload and process new account data files",
      icon: Upload,
      href: "/upload",
      color: "bg-primary text-primary-foreground hover:bg-primary/90",
    },
    {
      title: "Explore Accounts",
      description: "Browse and analyze account information",
      icon: Building2,
      href: "/accounts",
      color: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
    },
    {
      title: "View Insights",
      description: "Review AI-generated insights and recommendations",
      icon: Lightbulb,
      href: "/insights",
      color: "bg-warning-500 text-white hover:bg-warning-600",
    },
    {
      title: "AI Assistant",
      description: "Chat with AI about specific accounts",
      icon: MessageSquare,
      href: "/chat",
      color: "bg-success-500 text-white hover:bg-success-600",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-h1 text-foreground mb-2">Sales Intelligence Dashboard</h1>
        <p className="text-body text-muted-foreground">
          Monitor your account analysis, insights generation, and processing jobs in real-time.
        </p>
      </div>

      {/* Key Stats */}
      <DashboardStats />

      {/* Quick Actions */}
      <div>
        <h2 className="text-h3 text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card
                key={action.title}
                className="relative overflow-hidden group hover:shadow-md transition-all duration-200 cursor-pointer"
                onClick={() => router.push(action.href)}
              >
                <div className="p-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className={`p-2 rounded-lg ${action.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="text-h4 text-foreground mb-2">{action.title}</h3>
                  <p className="text-body-small text-muted-foreground">{action.description}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Jobs */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-h3 text-foreground">Active Jobs</h2>
            <Button variant="outline" size="sm" onClick={() => router.push("/jobs")}>
              View All
            </Button>
          </div>

          <div className="space-y-4">
            {recentJobs.length > 0 ? (
              recentJobs.map((job) => (
                <StatusCard
                  key={job.id}
                  title={job.title}
                  value=""
                  status={job.status}
                  progress={job.progress}
                  showProgress={job.status === "running" || job.status === "pending"}
                  lastUpdated={job.updatedAt}
                  onClick={() => router.push(`/jobs/${job.id}`)}
                  subtitle={`${job.type.replace("_", " ")}`.toUpperCase()}
                />
              ))
            ) : (
              <Card className="p-8 text-center">
                <div className="text-muted-foreground mb-4">
                  <Plus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                </div>
                <h3 className="text-h4 text-foreground mb-2">No active jobs</h3>
                <p className="text-body-small text-muted-foreground mb-4">
                  Upload data files to start processing jobs
                </p>
                <Button onClick={() => router.push("/upload")} className="">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Data
                </Button>
              </Card>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <RecentActivity maxItems={6} onViewAll={() => router.push("/jobs")} />
      </div>

      {/* System Status */}
      <Card>
        <div className="p-6">
          <h3 className="text-h3 text-foreground mb-4">System Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-success-500 rounded-full animate-pulse" />
              <div>
                <p className="text-body-small font-medium text-foreground">API Status</p>
                <p className="text-caption text-muted-foreground">All systems operational</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-success-500 rounded-full animate-pulse" />
              <div>
                <p className="text-body-small font-medium text-foreground">Processing Queue</p>
                <p className="text-caption text-muted-foreground">{activeJobs} jobs active</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-success-500 rounded-full animate-pulse" />
              <div>
                <p className="text-body-small font-medium text-foreground">AI Services</p>
                <p className="text-caption text-muted-foreground">Online and ready</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
