import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Package,
  Flag,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  RotateCcw,
  UserX,
  UserCheck,
  AlertCircle,
  FileText,
  Activity,
  SlidersHorizontal,
  ChevronRight,
  Loader2,
  Lock,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { ADMIN_ENDPOINTS } from '../config/api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Report, AdminAuditLog, ActivityLog } from '../types';

type Tab = 'overview' | 'queue' | 'reports' | 'listings' | 'users' | 'activity';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Data states
  const [overview, setOverview] = useState<{
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    bannedUsers: number;
    totalListings: number;
    activeListings: number;
    reportedListings: number;
    pendingReports: number;
  } | null>(null);

  const [reports, setReports] = useState<Report[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Filter states
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('pending');
  const [listingFilter, setListingFilter] = useState<'all' | 'reported' | 'hidden' | 'removed'>('all');
  const [listingSearch, setListingSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'suspended' | 'banned'>('all');
  const [activityActionFilter, setActivityActionFilter] = useState<string>('all');
  const [activityDateFilter, setActivityDateFilter] = useState<string>('all');

  // Confirmation Modal state
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionType: 'warn_user' | 'suspend_user' | 'ban_user' | 'restore_user' | 'hide_listing' | 'remove_listing' | 'restore_listing' | 'resolve_report' | 'dismiss_report';
    targetId: string;
    targetName?: string;
    presetReason?: string;
  }>({
    isOpen: false,
    title: '',
    description: '',
    actionType: 'warn_user',
    targetId: '',
  });

  const [actionReason, setActionReason] = useState('');
  const [isPerformingAction, setIsPerformingAction] = useState(false);

  // User detail inspection modal
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // Fetch all admin data
  const fetchData = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const idToken = await currentUser.getIdToken();
      const headers = { Authorization: `Bearer ${idToken}` };

      const [ovRes, repRes, listRes, usersRes, auditRes, actRes] = await Promise.all([
        fetch(ADMIN_ENDPOINTS.overview, { headers }),
        fetch(ADMIN_ENDPOINTS.reports, { headers }),
        fetch(ADMIN_ENDPOINTS.listings, { headers }),
        fetch(ADMIN_ENDPOINTS.users, { headers }),
        fetch(ADMIN_ENDPOINTS.auditLogs, { headers }),
        fetch(ADMIN_ENDPOINTS.activityLogs, { headers }),
      ]);

      if (ovRes.ok) setOverview(await ovRes.json());
      if (repRes.ok) {
        const data = await repRes.json();
        setReports(data.reports || []);
      }
      if (listRes.ok) {
        const data = await listRes.json();
        setListings(data.listings || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }
      if (auditRes.ok) {
        const data = await auditRes.json();
        setAuditLogs(data.logs || []);
      }
      if (actRes.ok) {
        const data = await actRes.json();
        setActivityLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
      setFeedbackMsg({ type: 'error', text: 'Failed to load moderation data. Check server connectivity.' });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setFeedbackMsg(null);
    fetchData();
  };

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 4000);
  };

  // Execute confirmed moderation action
  const handleConfirmAction = async () => {
    if (!actionReason.trim()) {
      showToast('error', 'Please provide an action reason.');
      return;
    }

    setIsPerformingAction(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');
      const idToken = await currentUser.getIdToken();
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      };

      let res: Response;

      switch (actionModal.actionType) {
        case 'warn_user':
          res = await fetch(ADMIN_ENDPOINTS.warnUser, {
            method: 'POST',
            headers,
            body: JSON.stringify({ userId: actionModal.targetId, reason: actionReason.trim() }),
          });
          break;
        case 'suspend_user':
          res = await fetch(ADMIN_ENDPOINTS.suspendUser, {
            method: 'POST',
            headers,
            body: JSON.stringify({ userId: actionModal.targetId, reason: actionReason.trim() }),
          });
          break;
        case 'ban_user':
          res = await fetch(ADMIN_ENDPOINTS.banUser, {
            method: 'POST',
            headers,
            body: JSON.stringify({ userId: actionModal.targetId, reason: actionReason.trim() }),
          });
          break;
        case 'restore_user':
          res = await fetch(ADMIN_ENDPOINTS.restoreUser, {
            method: 'POST',
            headers,
            body: JSON.stringify({ userId: actionModal.targetId, reason: actionReason.trim() }),
          });
          break;
        case 'hide_listing':
          res = await fetch(ADMIN_ENDPOINTS.moderateListing, {
            method: 'POST',
            headers,
            body: JSON.stringify({ listingId: actionModal.targetId, action: 'hide', reason: actionReason.trim() }),
          });
          break;
        case 'remove_listing':
          res = await fetch(ADMIN_ENDPOINTS.moderateListing, {
            method: 'POST',
            headers,
            body: JSON.stringify({ listingId: actionModal.targetId, action: 'remove', reason: actionReason.trim() }),
          });
          break;
        case 'restore_listing':
          res = await fetch(ADMIN_ENDPOINTS.moderateListing, {
            method: 'POST',
            headers,
            body: JSON.stringify({ listingId: actionModal.targetId, action: 'restore', reason: actionReason.trim() }),
          });
          break;
        case 'dismiss_report':
          res = await fetch(ADMIN_ENDPOINTS.resolveReport, {
            method: 'POST',
            headers,
            body: JSON.stringify({ reportId: actionModal.targetId, resolution: actionReason.trim(), actionTaken: 'dismiss' }),
          });
          break;
        case 'resolve_report':
          res = await fetch(ADMIN_ENDPOINTS.resolveReport, {
            method: 'POST',
            headers,
            body: JSON.stringify({ reportId: actionModal.targetId, resolution: actionReason.trim(), actionTaken: 'hide_listing' }),
          });
          break;
        default:
          throw new Error('Unknown action type');
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Action failed');
      }

      showToast('success', data.message || 'Action executed successfully.');
      setActionModal(prev => ({ ...prev, isOpen: false }));
      setActionReason('');
      fetchData();
    } catch (err: any) {
      console.error('Moderation action failed:', err);
      showToast('error', err.message || 'Action failed. Please try again.');
    } finally {
      setIsPerformingAction(false);
    }
  };

  // Filtered reports
  const filteredReports = useMemo(() => {
    if (reportStatusFilter === 'all') return reports;
    return reports.filter(r => r.status === reportStatusFilter);
  }, [reports, reportStatusFilter]);

  // Pending queue
  const pendingQueue = useMemo(() => {
    return reports.filter(r => r.status === 'pending');
  }, [reports]);

  // Filtered listings
  const filteredListings = useMemo(() => {
    let list = listings;
    if (listingFilter === 'reported') {
      list = list.filter(l => (l.reportCount || 0) > 0);
    } else if (listingFilter === 'hidden') {
      list = list.filter(l => l.status === 'hidden');
    } else if (listingFilter === 'removed') {
      list = list.filter(l => l.status === 'removed');
    }

    if (listingSearch.trim()) {
      const q = listingSearch.toLowerCase().trim();
      list = list.filter(l =>
        (l.title && l.title.toLowerCase().includes(q)) ||
        (l.sellerName && l.sellerName.toLowerCase().includes(q)) ||
        (l.id && l.id.toLowerCase().includes(q))
      );
    }
    return list;
  }, [listings, listingFilter, listingSearch]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    let list = users;
    if (userStatusFilter !== 'all') {
      list = list.filter(u => u.status === userStatusFilter);
    }

    if (userSearch.trim()) {
      const q = userSearch.toLowerCase().trim();
      list = list.filter(u =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q)) ||
        (u.id && u.id.toLowerCase().includes(q))
      );
    }
    return list;
  }, [users, userStatusFilter, userSearch]);

  // Filtered activity logs
  const filteredActivityLogs = useMemo(() => {
    let list = activityLogs;
    if (activityActionFilter !== 'all') {
      list = list.filter(a => a.action === activityActionFilter);
    }
    if (activityDateFilter !== 'all') {
      const now = Date.now();
      if (activityDateFilter === 'today') {
        list = list.filter(a => now - new Date(a.timestamp || 0).getTime() <= 24 * 60 * 60 * 1000);
      } else if (activityDateFilter === '7days') {
        list = list.filter(a => now - new Date(a.timestamp || 0).getTime() <= 7 * 24 * 60 * 60 * 1000);
      } else if (activityDateFilter === '30days') {
        list = list.filter(a => now - new Date(a.timestamp || 0).getTime() <= 30 * 24 * 60 * 60 * 1000);
      }
    }
    return list;
  }, [activityLogs, activityActionFilter, activityDateFilter]);

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-brand-teal" />
        <p className="text-sm font-medium text-brand-muted">Loading StudentNeed Moderation Console...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-3xl border border-brand-border bg-white p-6 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-brand-charcoal">
            <Lock className="h-3.5 w-3.5 text-brand-teal" />
            Admin Moderation v1
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-brand-charcoal sm:text-3xl">
            Campus Moderation Console
          </h1>
          <p className="text-sm text-brand-muted">
            Enforcing Anna University campus community safety & verified peer-to-peer trust.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedbackMsg && (
        <div
          className={`flex items-center justify-between rounded-2xl p-4 text-sm font-medium border shadow-xs animate-in fade-in duration-200 ${
            feedbackMsg.type === 'success'
              ? 'bg-brand-teal-light text-brand-teal-hover border-brand-teal-border'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-brand-teal" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-xs font-semibold underline ml-4 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-brand-border gap-2 pb-px no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: SlidersHorizontal },
          { id: 'queue', label: `Moderation Queue (${pendingQueue.length})`, icon: Flag },
          { id: 'reports', label: 'Reports', icon: FileText },
          { id: 'listings', label: 'Listings', icon: Package },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'activity', label: 'Activity Logs', icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-brand-teal text-brand-teal-hover font-semibold'
                  : 'border-transparent text-brand-muted hover:border-zinc-300 hover:text-brand-charcoal'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Users</span>
              <p className="mt-2 text-3xl font-extrabold text-zinc-900">{overview.totalUsers}</p>
              <span className="text-[11px] text-zinc-400 mt-1 block">Registered students</span>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Active Users</span>
              <p className="mt-2 text-3xl font-extrabold text-emerald-600">{overview.activeUsers}</p>
              <span className="text-[11px] text-zinc-400 mt-1 block">Good standing</span>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Active Listings</span>
              <p className="mt-2 text-3xl font-extrabold text-blue-600">{overview.activeListings}</p>
              <span className="text-[11px] text-zinc-400 mt-1 block">Public items</span>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Reported Listings</span>
              <p className="mt-2 text-3xl font-extrabold text-amber-600">{overview.reportedListings}</p>
              <span className="text-[11px] text-zinc-400 mt-1 block">Flagged items</span>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pending Reports</span>
              <p className="mt-2 text-3xl font-extrabold text-red-600">{overview.pendingReports}</p>
              <span className="text-[11px] text-zinc-400 mt-1 block">Needs review</span>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Suspended</span>
              <p className="mt-2 text-3xl font-extrabold text-zinc-700">{overview.suspendedUsers + overview.bannedUsers}</p>
              <span className="text-[11px] text-zinc-400 mt-1 block">Restricted accounts</span>
            </div>
          </div>

          {/* Quick Queue Summary */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Immediate Attention Queue</h3>
                <p className="text-xs text-zinc-500">Unreviewed student reports requiring administrative action.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveTab('queue')}
                className="gap-1 text-xs"
              >
                Go to Queue
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {pendingQueue.length === 0 ? (
              <div className="rounded-2xl bg-zinc-50 p-8 text-center border border-zinc-100">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-sm font-semibold text-zinc-700">Moderation queue is clean!</p>
                <p className="text-xs text-zinc-400 mt-0.5">There are no pending reports requiring review.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {pendingQueue.slice(0, 3).map((r) => (
                  <div key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="warning">Pending Report</Badge>
                        <span className="text-xs font-bold text-zinc-900">{r.listingTitle}</span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
                        Reported for: <strong className="text-zinc-700">{r.reason}</strong> by {r.reporterEmail} • {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8"
                        onClick={() => {
                          setActionModal({
                            isOpen: true,
                            title: 'Review & Hide Listing',
                            description: `Are you sure you want to hide "${r.listingTitle}" from campus marketplace?`,
                            actionType: 'hide_listing',
                            targetId: r.listingId,
                            targetName: r.listingTitle,
                          });
                          setActionReason(r.reason);
                        }}
                      >
                        Hide Listing
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="text-xs h-8"
                        onClick={() => {
                          setActionModal({
                            isOpen: true,
                            title: 'Remove Listing',
                            description: `Permanently remove listing "${r.listingTitle}" for violation?`,
                            actionType: 'remove_listing',
                            targetId: r.listingId,
                            targetName: r.listingTitle,
                          });
                          setActionReason(r.reason);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MODERATION QUEUE */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-zinc-900">
              Pending Moderation Queue ({pendingQueue.length})
            </h3>
            <span className="text-xs text-zinc-500">Review pending user reports and take immediate action.</span>
          </div>

          {pendingQueue.length === 0 ? (
            <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center shadow-xs">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-3" />
              <h4 className="text-base font-bold text-zinc-900">Queue is Clear</h4>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                No active complaints or pending violation reports require moderation attention right now.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingQueue.map((report) => (
                <div
                  key={report.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="destructive" className="gap-1">
                        <Flag className="h-3 w-3" />
                        {report.reason}
                      </Badge>
                      <span className="text-xs text-zinc-400">
                        Report ID: <span className="font-mono">{report.id}</span>
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-zinc-900">
                      {report.listingTitle}
                    </h4>

                    {report.description && (
                      <p className="text-xs text-zinc-600 bg-zinc-50 p-2.5 rounded-xl border border-zinc-100 max-w-2xl">
                        "{report.description}"
                      </p>
                    )}

                    <div className="text-xs text-zinc-500 flex items-center gap-4 flex-wrap">
                      <span>Reported by: <strong className="text-zinc-700">{report.reporterEmail}</strong></span>
                      <span>Target user ID: <span className="font-mono text-zinc-600">{report.reportedUserId}</span></span>
                      <span>Date: {new Date(report.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center">
                    <a
                      href={`/listing/${report.listingId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex"
                    >
                      <Button size="sm" variant="outline" className="text-xs gap-1 h-8">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Inspect Post
                      </Button>
                    </a>

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-amber-700 border-amber-200 hover:bg-amber-50 h-8"
                      onClick={() => {
                        setActionModal({
                          isOpen: true,
                          title: 'Hide Listing',
                          description: `Hide listing "${report.listingTitle}" from active campus marketplace search?`,
                          actionType: 'hide_listing',
                          targetId: report.listingId,
                          targetName: report.listingTitle,
                        });
                        setActionReason(report.reason);
                      }}
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                      Hide
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      className="text-xs h-8"
                      onClick={() => {
                        setActionModal({
                          isOpen: true,
                          title: 'Remove Listing & Resolve Report',
                          description: `Permanently remove listing "${report.listingTitle}" from public marketplace?`,
                          actionType: 'remove_listing',
                          targetId: report.listingId,
                          targetName: report.listingTitle,
                        });
                        setActionReason(report.reason);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-zinc-500 hover:text-zinc-800 h-8"
                      onClick={() => {
                        setActionModal({
                          isOpen: true,
                          title: 'Dismiss Report',
                          description: `Dismiss report for "${report.listingTitle}" if no community guidelines were breached?`,
                          actionType: 'dismiss_report',
                          targetId: report.id,
                          targetName: report.listingTitle,
                        });
                        setActionReason('No violation found after review.');
                      }}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ALL REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-zinc-900">User Violation Reports</h3>
              <p className="text-xs text-zinc-500">Historical archive and status of all reported items.</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-500">Status:</span>
              <select
                value={reportStatusFilter}
                onChange={(e) => setReportStatusFilter(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 outline-none focus:border-zinc-400"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="reviewing">Reviewing</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500 font-semibold border-b border-zinc-200 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Listing</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Reporter</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Resolution</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-400">
                        No reports matching current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-zinc-900">
                          <a
                            href={`/listing/${r.listingId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline text-zinc-900 inline-flex items-center gap-1"
                          >
                            {r.listingTitle}
                            <ExternalLink className="h-3 w-3 text-zinc-400" />
                          </a>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="font-normal text-[11px]">
                            {r.reason}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-zinc-600 font-mono text-[11px]">
                          {r.reporterEmail}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              r.status === 'pending'
                                ? 'destructive'
                                : r.status === 'resolved'
                                ? 'success'
                                : r.status === 'dismissed'
                                ? 'secondary'
                                : 'warning'
                            }
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-zinc-500">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-zinc-500 max-w-xs truncate">
                          {r.resolution || (r.status === 'pending' ? 'Awaiting review' : 'None')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {r.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => {
                                setActionModal({
                                  isOpen: true,
                                  title: 'Dismiss Report',
                                  description: `Dismiss report for "${r.listingTitle}"?`,
                                  actionType: 'dismiss_report',
                                  targetId: r.id,
                                  targetName: r.listingTitle,
                                });
                                setActionReason('Reviewed; listing conforms to community guidelines.');
                              }}
                            >
                              Dismiss
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LISTINGS MODERATION */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  value={listingSearch}
                  onChange={(e) => setListingSearch(e.target.value)}
                  placeholder="Search listings by title, seller, ID..."
                  className="pl-9 text-xs h-9 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-500">Filter:</span>
              <select
                value={listingFilter}
                onChange={(e) => setListingFilter(e.target.value as any)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 outline-none focus:border-zinc-400"
              >
                <option value="all">All Listings</option>
                <option value="reported">Reported Only</option>
                <option value="hidden">Hidden Only</option>
                <option value="removed">Removed Only</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500 font-semibold border-b border-zinc-200 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Seller</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Reports</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Moderation Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredListings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-zinc-400">
                        No listings matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredListings.map((listing) => (
                      <tr key={listing.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-zinc-900 max-w-xs truncate">
                          <a
                            href={`/listing/${listing.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline flex items-center gap-1"
                          >
                            {listing.title}
                            <ExternalLink className="h-3 w-3 text-zinc-400" />
                          </a>
                        </td>
                        <td className="py-3 px-4 text-zinc-600">
                          {listing.sellerName || 'Student'}
                        </td>
                        <td className="py-3 px-4 text-zinc-600">{listing.category}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-[10px]">
                            {listing.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-bold text-zinc-900">
                          {listing.price !== undefined ? `₹${listing.price}` : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              listing.status === 'active' || listing.status === 'available'
                                ? 'success'
                                : listing.status === 'hidden'
                                ? 'warning'
                                : listing.status === 'removed'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {listing.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {listing.reportCount > 0 ? (
                            <Badge variant="destructive" className="text-[10px]">
                              {listing.reportCount} reports
                            </Badge>
                          ) : (
                            <span className="text-zinc-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-zinc-500">
                          {new Date(listing.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {listing.status === 'hidden' || listing.status === 'removed' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => {
                                  setActionModal({
                                    isOpen: true,
                                    title: 'Restore Listing',
                                    description: `Restore "${listing.title}" back to active status on campus marketplace?`,
                                    actionType: 'restore_listing',
                                    targetId: listing.id,
                                    targetName: listing.title,
                                  });
                                  setActionReason('Listing verified and cleared for publication.');
                                }}
                              >
                                <RotateCcw className="h-3 w-3" />
                                Restore
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 gap-1 text-amber-700 border-amber-200 hover:bg-amber-50"
                                  onClick={() => {
                                    setActionModal({
                                      isOpen: true,
                                      title: 'Hide Listing',
                                      description: `Hide listing "${listing.title}"?`,
                                      actionType: 'hide_listing',
                                      targetId: listing.id,
                                      targetName: listing.title,
                                    });
                                    setActionReason('Temporarily hidden for review.');
                                  }}
                                >
                                  <EyeOff className="h-3 w-3" />
                                  Hide
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="text-xs h-7 gap-1"
                                  onClick={() => {
                                    setActionModal({
                                      isOpen: true,
                                      title: 'Remove Listing',
                                      description: `Remove listing "${listing.title}" from marketplace?`,
                                      actionType: 'remove_listing',
                                      targetId: listing.id,
                                      targetName: listing.title,
                                    });
                                    setActionReason('Prohibited item / Guideline breach.');
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Remove
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users by name, email, department..."
                  className="pl-9 text-xs h-9 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-500">Status:</span>
              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value as any)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 outline-none focus:border-zinc-400"
              >
                <option value="all">All Users</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
                <option value="banned">Banned Only</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500 font-semibold border-b border-zinc-200 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Verified Email</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Warnings</th>
                    <th className="py-3 px-4">Listings</th>
                    <th className="py-3 px-4">Reports Recv</th>
                    <th className="py-3 px-4">Joined</th>
                    <th className="py-3 px-4 text-right">Moderation Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-zinc-400">
                        No users matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt={u.name} className="h-7 w-7 rounded-full object-cover border border-zinc-200" />
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-xs">
                                {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-zinc-900">{u.name || 'Student'}</p>
                              <p className="text-[10px] text-zinc-400">{u.department || 'Anna Univ'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-zinc-600">
                          {u.email || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              u.status === 'active' || !u.status
                                ? 'success'
                                : u.status === 'suspended'
                                ? 'warning'
                                : 'destructive'
                            }
                          >
                            {u.status || 'active'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {u.warningCount > 0 ? (
                            <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              {u.warningCount} warning{u.warningCount > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-zinc-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-zinc-700 font-medium">
                          {u.listingsCount || 0}
                        </td>
                        <td className="py-3 px-4">
                          {u.reportsReceivedCount > 0 ? (
                            <Badge variant="destructive">
                              {u.reportsReceivedCount}
                            </Badge>
                          ) : (
                            <span className="text-zinc-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-zinc-500">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-2"
                              onClick={() => setSelectedUser(u)}
                            >
                              View
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-2 text-amber-700 border-amber-200 hover:bg-amber-50"
                              onClick={() => {
                                setActionModal({
                                  isOpen: true,
                                  title: `Warn User: ${u.name}`,
                                  description: `Issue a formal campus conduct warning to student ${u.name} (${u.email || u.id}).`,
                                  actionType: 'warn_user',
                                  targetId: u.id,
                                  targetName: u.name,
                                });
                                setActionReason('');
                              }}
                            >
                              Warn
                            </Button>

                            {u.status === 'suspended' || u.status === 'banned' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => {
                                  setActionModal({
                                    isOpen: true,
                                    title: `Restore User: ${u.name}`,
                                    description: `Restore student ${u.name} back to active standing?`,
                                    actionType: 'restore_user',
                                    targetId: u.id,
                                    targetName: u.name,
                                  });
                                  setActionReason('User satisfied verification terms or appeal.');
                                }}
                              >
                                Restore
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 px-2 text-zinc-700 border-zinc-300 hover:bg-zinc-100"
                                  onClick={() => {
                                    setActionModal({
                                      isOpen: true,
                                      title: `Suspend User: ${u.name}`,
                                      description: `Suspend student ${u.name} from publishing listings and messaging?`,
                                      actionType: 'suspend_user',
                                      targetId: u.id,
                                      targetName: u.name,
                                    });
                                    setActionReason('');
                                  }}
                                >
                                  Suspend
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="text-xs h-7 px-2"
                                  onClick={() => {
                                    setActionModal({
                                      isOpen: true,
                                      title: `Ban User: ${u.name}`,
                                      description: `Permanently ban account of student ${u.name}?`,
                                      actionType: 'ban_user',
                                      targetId: u.id,
                                      targetName: u.name,
                                    });
                                    setActionReason('');
                                  }}
                                >
                                  Ban
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: ACTIVITY LOGS */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-zinc-900">Moderation Activity & Audit Logs</h3>
              <p className="text-xs text-zinc-500">Immutable chronological record of campus moderation-relevant actions.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={activityActionFilter}
                onChange={(e) => setActivityActionFilter(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 outline-none focus:border-zinc-400"
              >
                <option value="all">All Actions</option>
                <option value="report_submitted">report_submitted</option>
                <option value="moderation_action">moderation_action</option>
                <option value="listing_created">listing_created</option>
                <option value="listing_removed">listing_removed</option>
                <option value="reservation_created">reservation_created</option>
                <option value="suspicious_rate_limit">suspicious_rate_limit</option>
              </select>

              <select
                value={activityDateFilter}
                onChange={(e) => setActivityDateFilter(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 outline-none focus:border-zinc-400"
              >
                <option value="all">All Time</option>
                <option value="today">Past 24 Hours</option>
                <option value="7days">Past 7 Days</option>
                <option value="30days">Past 30 Days</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500 font-semibold border-b border-zinc-200 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Target Type</th>
                    <th className="py-3 px-4">Target ID</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredActivityLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-400">
                        No activity records found matching filter.
                      </td>
                    </tr>
                  ) : (
                    filteredActivityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              log.action === 'moderation_action'
                                ? 'default'
                                : log.action === 'report_submitted'
                                ? 'destructive'
                                : log.action === 'suspicious_rate_limit'
                                ? 'warning'
                                : 'outline'
                            }
                            className="font-mono text-[10px]"
                          >
                            {log.action}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-600">
                          {log.userEmail || log.userId}
                        </td>
                        <td className="py-3 px-4 text-zinc-500 uppercase text-[10px] font-semibold">
                          {log.targetType}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-zinc-700">
                          {log.targetId}
                        </td>
                        <td className="py-3 px-4 text-zinc-500 max-w-sm truncate">
                          {log.details ? JSON.stringify(log.details) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION ACTION MODAL */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-zinc-900">{actionModal.title}</h3>
                <p className="text-xs text-zinc-500">Administrator Confirmation Required</p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              {actionModal.description}
            </p>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                Action Reason (Required for Audit Trail)
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                rows={3}
                placeholder="Explain the specific violation or moderation rationale..."
                className="w-full rounded-xl border border-zinc-200 p-3 text-xs outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isPerformingAction}
                onClick={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={actionModal.actionType.includes('ban') || actionModal.actionType.includes('remove') ? 'destructive' : 'default'}
                className="flex-1"
                disabled={isPerformingAction || !actionReason.trim()}
                onClick={handleConfirmAction}
              >
                {isPerformingAction ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Processing...
                  </>
                ) : (
                  'Confirm & Log'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* USER DETAIL MODAL */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                {selectedUser.avatarUrl ? (
                  <img src={selectedUser.avatarUrl} alt={selectedUser.name} className="h-10 w-10 rounded-full object-cover border" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-zinc-900 text-white font-bold flex items-center justify-center">
                    {selectedUser.name?.charAt(0) || 'U'}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-base text-zinc-900">{selectedUser.name}</h3>
                  <p className="text-xs text-zinc-500">{selectedUser.department} • {selectedUser.campus}</p>
                </div>
              </div>
              <Badge variant={selectedUser.status === 'active' || !selectedUser.status ? 'success' : 'destructive'}>
                {selectedUser.status || 'active'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 p-4 rounded-xl border border-zinc-100">
              <div>
                <span className="text-zinc-400 block">Verified College Email</span>
                <span className="font-mono font-medium text-zinc-800">{selectedUser.email || '—'}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">User UID</span>
                <span className="font-mono font-medium text-zinc-800">{selectedUser.id}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Warning Count</span>
                <span className="font-bold text-zinc-900">{selectedUser.warningCount || 0}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Reports Received</span>
                <span className="font-bold text-zinc-900">{selectedUser.reportsReceivedCount || 0}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Total Postings</span>
                <span className="font-bold text-zinc-900">{selectedUser.listingsCount || 0}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Account Created</span>
                <span className="font-medium text-zinc-800">
                  {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>

            {selectedUser.warnings && selectedUser.warnings.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                  Warning History ({selectedUser.warnings.length})
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1.5 divide-y divide-zinc-100">
                  {selectedUser.warnings.map((w: any, idx: number) => (
                    <div key={idx} className="pt-1.5 text-xs">
                      <p className="font-medium text-amber-800">"{w.reason}"</p>
                      <p className="text-[10px] text-zinc-400">{new Date(w.date).toLocaleString()} • Issued by {w.adminEmail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedUser(null)}
              >
                Close Profile
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
