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
  MessageSquare,
  Calendar,
  MapPin,
  Tag,
  X,
  Check,
  Edit3,
  Layers,
  Bookmark,
  HelpCircle,
  Send,
  Share2,
  IndianRupee,
  ShieldCheck,
  ArrowRight,
  Filter
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { ADMIN_ENDPOINTS } from '../config/api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Report, AdminAuditLog, ActivityLog, Category, Condition, ListingType } from '../types';

type Tab = 'overview' | 'listings' | 'requests' | 'users' | 'reservations' | 'reports' | 'activity';

const CATEGORIES: Category[] = [
  'Textbooks',
  'Electronics',
  'Stationery',
  'Lab Essentials',
  'Hostel Essentials',
  'Sports',
  'College Wear',
  'Other',
];

const CONDITIONS: Condition[] = ['New', 'Like New', 'Good', 'Fair', 'Poor'];

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
    removedListings: number;
    totalRequests: number;
    activeRequests: number;
    removedRequests: number;
    totalReservations: number;
    activeReservations: number;
    pendingReports: number;
    removedListingsAndRequests: number;
    recentActivity: any[];
  } | null>(null);

  const [listings, setListings] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Filter states
  // Listings
  const [listingSearch, setListingSearch] = useState('');
  const [listingCategoryFilter, setListingCategoryFilter] = useState<string>('all');
  const [listingTypeFilter, setListingTypeFilter] = useState<string>('all');
  const [listingStatusFilter, setListingStatusFilter] = useState<string>('all');
  const [listingSortOrder, setListingSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Requests
  const [requestSearch, setRequestSearch] = useState('');
  const [requestCategoryFilter, setRequestCategoryFilter] = useState<string>('all');
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('all');
  const [requestSortOrder, setRequestSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Users
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'suspended' | 'banned'>('all');

  // Reservations
  const [reservationSearch, setReservationSearch] = useState('');
  const [reservationStatusFilter, setReservationStatusFilter] = useState<string>('all');

  // Reports
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('all');

  // Activity / Audit
  const [activityMode, setActivityMode] = useState<'audit' | 'activity'>('audit');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditDateFilter, setAuditDateFilter] = useState<string>('all');
  const [auditSearch, setAuditSearch] = useState('');

  // Modals
  // 1. Generic confirmation action modal
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionType:
      | 'warn_user'
      | 'suspend_user'
      | 'ban_user'
      | 'restore_user'
      | 'hide_listing'
      | 'remove_listing'
      | 'restore_listing'
      | 'remove_request'
      | 'restore_request'
      | 'resolve_report'
      | 'review_report'
      | 'dismiss_report';
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

  // 2. Inspection modals
  const [selectedListingDetail, setSelectedListingDetail] = useState<any | null>(null);
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<any | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedReservationDetail, setSelectedReservationDetail] = useState<any | null>(null);
  const [selectedReportDetail, setSelectedReportDetail] = useState<Report | null>(null);

  // 3. Edit Modals
  const [editingListing, setEditingListing] = useState<any | null>(null);
  const [editingRequest, setEditingRequest] = useState<any | null>(null);
  const [editListingForm, setEditListingForm] = useState<{
    title: string;
    description: string;
    category: Category;
    condition: Condition;
    type: ListingType;
    price: string;
    wantedItem: string;
    location: string;
    reason: string;
  }>({
    title: '',
    description: '',
    category: 'Other',
    condition: 'Good',
    type: 'Sale',
    price: '',
    wantedItem: '',
    location: '',
    reason: '',
  });
  const [editRequestForm, setEditRequestForm] = useState<{
    title: string;
    description: string;
    category: Category;
    budget: string;
    neededBy: string;
    location: string;
    reason: string;
  }>({
    title: '',
    description: '',
    category: 'Other',
    budget: '',
    neededBy: '',
    location: '',
    reason: '',
  });

  // Fetch all admin data
  const fetchData = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const idToken = await currentUser.getIdToken();
      const headers = { Authorization: `Bearer ${idToken}` };

      const [ovRes, repRes, listRes, usersRes, reqRes, resvRes, auditRes, actRes] = await Promise.all([
        fetch(ADMIN_ENDPOINTS.overview, { headers }),
        fetch(ADMIN_ENDPOINTS.reports, { headers }),
        fetch(ADMIN_ENDPOINTS.listings, { headers }),
        fetch(ADMIN_ENDPOINTS.users, { headers }),
        fetch(ADMIN_ENDPOINTS.requests, { headers }),
        fetch(ADMIN_ENDPOINTS.reservations, { headers }),
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
      if (reqRes.ok) {
        const data = await reqRes.json();
        setRequests(data.requests || []);
      }
      if (resvRes.ok) {
        const data = await resvRes.json();
        setReservations(data.reservations || []);
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
    }, 4500);
  };

  // Open Edit Listing modal
  const openEditListingModal = (item: any) => {
    setEditingListing(item);
    setEditListingForm({
      title: item.title || '',
      description: item.description || '',
      category: item.category || 'Other',
      condition: item.condition || 'Good',
      type: item.type || 'Sale',
      price: item.price !== undefined ? String(item.price) : '',
      wantedItem: item.wantedItem || '',
      location: item.location || '',
      reason: '',
    });
  };

  // Submit Edit Listing
  const handleSaveListingEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingListing) return;

    if (!editListingForm.title.trim()) {
      showToast('error', 'Listing title is required.');
      return;
    }
    if (!editListingForm.description.trim()) {
      showToast('error', 'Listing description is required.');
      return;
    }
    if (!editListingForm.location.trim()) {
      showToast('error', 'Campus location is required.');
      return;
    }
    if (editListingForm.type === 'Exchange' && !editListingForm.wantedItem.trim()) {
      showToast('error', 'Wanted item description is required for exchange listings.');
      return;
    }
    if (!editListingForm.reason.trim()) {
      showToast('error', 'Please provide an admin reason for this edit.');
      return;
    }

    setIsPerformingAction(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');
      const idToken = await currentUser.getIdToken();

      const res = await fetch(ADMIN_ENDPOINTS.editListing, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          listingId: editingListing.id,
          title: editListingForm.title.trim(),
          description: editListingForm.description.trim(),
          category: editListingForm.category,
          condition: editListingForm.condition,
          type: editListingForm.type,
          price: editListingForm.price ? Number(editListingForm.price) : undefined,
          wantedItem: editListingForm.wantedItem.trim() || undefined,
          location: editListingForm.location.trim(),
          reason: editListingForm.reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update listing.');
      }

      showToast('success', 'Listing updated successfully.');
      setEditingListing(null);
      fetchData();
    } catch (err: any) {
      console.error('Failed to edit listing:', err);
      showToast('error', err.message || 'Could not update listing.');
    } finally {
      setIsPerformingAction(false);
    }
  };

  // Open Edit Request modal
  const openEditRequestModal = (item: any) => {
    setEditingRequest(item);
    setEditRequestForm({
      title: item.title || '',
      description: item.description || '',
      category: item.category || 'Other',
      budget: item.budget !== undefined ? String(item.budget) : '',
      neededBy: item.neededBy || '',
      location: item.location || '',
      reason: '',
    });
  };

  // Submit Edit Request
  const handleSaveRequestEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequest) return;

    if (!editRequestForm.title.trim()) {
      showToast('error', 'Request title is required.');
      return;
    }
    if (!editRequestForm.description.trim()) {
      showToast('error', 'Request description is required.');
      return;
    }
    if (!editRequestForm.neededBy.trim()) {
      showToast('error', 'Needed by timeframe is required.');
      return;
    }
    if (!editRequestForm.location.trim()) {
      showToast('error', 'Campus meetup location is required.');
      return;
    }
    if (!editRequestForm.reason.trim()) {
      showToast('error', 'Please provide an admin reason for this edit.');
      return;
    }

    setIsPerformingAction(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');
      const idToken = await currentUser.getIdToken();

      const res = await fetch(ADMIN_ENDPOINTS.editRequest, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          requestId: editingRequest.id,
          title: editRequestForm.title.trim(),
          description: editRequestForm.description.trim(),
          category: editRequestForm.category,
          neededBy: editRequestForm.neededBy.trim(),
          location: editRequestForm.location.trim(),
          budget: editRequestForm.budget ? Number(editRequestForm.budget) : undefined,
          reason: editRequestForm.reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update request.');
      }

      showToast('success', 'Request updated successfully.');
      setEditingRequest(null);
      fetchData();
    } catch (err: any) {
      console.error('Failed to edit request:', err);
      showToast('error', err.message || 'Could not update request.');
    } finally {
      setIsPerformingAction(false);
    }
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
        case 'remove_request':
          res = await fetch(ADMIN_ENDPOINTS.moderateRequest, {
            method: 'POST',
            headers,
            body: JSON.stringify({ requestId: actionModal.targetId, action: 'remove', reason: actionReason.trim() }),
          });
          break;
        case 'restore_request':
          res = await fetch(ADMIN_ENDPOINTS.moderateRequest, {
            method: 'POST',
            headers,
            body: JSON.stringify({ requestId: actionModal.targetId, action: 'restore', reason: actionReason.trim() }),
          });
          break;
        case 'review_report':
          res = await fetch(ADMIN_ENDPOINTS.resolveReport, {
            method: 'POST',
            headers,
            body: JSON.stringify({ reportId: actionModal.targetId, resolution: actionReason.trim(), actionTaken: 'review' }),
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
      setActionModal((prev) => ({ ...prev, isOpen: false }));
      setActionReason('');
      fetchData();
    } catch (err: any) {
      console.error('Moderation action failed:', err);
      showToast('error', err.message || 'Action failed. Please try again.');
    } finally {
      setIsPerformingAction(false);
    }
  };

  // Filtered Listings
  const filteredListings = useMemo(() => {
    let list = listings;

    if (listingCategoryFilter !== 'all') {
      list = list.filter((l) => l.category === listingCategoryFilter);
    }
    if (listingTypeFilter !== 'all') {
      list = list.filter((l) => l.type === listingTypeFilter);
    }
    if (listingStatusFilter === 'available') {
      list = list.filter((l) => l.status === 'available' || l.status === 'active');
    } else if (listingStatusFilter === 'reserved') {
      list = list.filter((l) => l.status === 'reserved');
    } else if (listingStatusFilter === 'removed') {
      list = list.filter((l) => l.status === 'removed');
    } else if (listingStatusFilter === 'hidden') {
      list = list.filter((l) => l.status === 'hidden');
    }

    if (listingSearch.trim()) {
      const q = listingSearch.toLowerCase().trim();
      list = list.filter(
        (l) =>
          (l.title && l.title.toLowerCase().includes(q)) ||
          (l.sellerName && l.sellerName.toLowerCase().includes(q)) ||
          (l.sellerEmail && l.sellerEmail.toLowerCase().includes(q)) ||
          (l.id && l.id.toLowerCase().includes(q))
      );
    }

    list = [...list].sort((a, b) => {
      const tA = new Date(a.createdAt || 0).getTime();
      const tB = new Date(b.createdAt || 0).getTime();
      return listingSortOrder === 'newest' ? tB - tA : tA - tB;
    });

    return list;
  }, [listings, listingCategoryFilter, listingTypeFilter, listingStatusFilter, listingSearch, listingSortOrder]);

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    let list = requests;

    if (requestCategoryFilter !== 'all') {
      list = list.filter((r) => r.category === requestCategoryFilter);
    }
    if (requestStatusFilter === 'active') {
      list = list.filter((r) => r.status === 'open' || r.status === 'active');
    } else if (requestStatusFilter === 'fulfilled') {
      list = list.filter((r) => r.status === 'completed' || r.status === 'matched' || r.status === 'accepted');
    } else if (requestStatusFilter === 'cancelled') {
      list = list.filter((r) => r.status === 'cancelled');
    } else if (requestStatusFilter === 'removed') {
      list = list.filter((r) => r.status === 'removed');
    }

    if (requestSearch.trim()) {
      const q = requestSearch.toLowerCase().trim();
      list = list.filter(
        (r) =>
          (r.title && r.title.toLowerCase().includes(q)) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          (r.requesterName && r.requesterName.toLowerCase().includes(q)) ||
          (r.requesterEmail && r.requesterEmail.toLowerCase().includes(q)) ||
          (r.id && r.id.toLowerCase().includes(q))
      );
    }

    list = [...list].sort((a, b) => {
      const tA = new Date(a.createdAt || 0).getTime();
      const tB = new Date(b.createdAt || 0).getTime();
      return requestSortOrder === 'newest' ? tB - tA : tA - tB;
    });

    return list;
  }, [requests, requestCategoryFilter, requestStatusFilter, requestSearch, requestSortOrder]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    let list = users;
    if (userStatusFilter !== 'all') {
      list = list.filter((u) => u.status === userStatusFilter);
    }

    if (userSearch.trim()) {
      const q = userSearch.toLowerCase().trim();
      list = list.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.department && u.department.toLowerCase().includes(q)) ||
          (u.id && u.id.toLowerCase().includes(q))
      );
    }
    return list;
  }, [users, userStatusFilter, userSearch]);

  // Filtered Reservations
  const filteredReservations = useMemo(() => {
    let list = reservations;
    if (reservationStatusFilter === 'active') {
      list = list.filter((r) => r.status === 'pending' || r.status === 'accepted');
    } else if (reservationStatusFilter !== 'all') {
      list = list.filter((r) => r.status === reservationStatusFilter);
    }

    if (reservationSearch.trim()) {
      const q = reservationSearch.toLowerCase().trim();
      list = list.filter(
        (r) =>
          (r.listingTitle && r.listingTitle.toLowerCase().includes(q)) ||
          (r.buyerName && r.buyerName.toLowerCase().includes(q)) ||
          (r.buyerEmail && r.buyerEmail.toLowerCase().includes(q)) ||
          (r.sellerName && r.sellerName.toLowerCase().includes(q)) ||
          (r.sellerEmail && r.sellerEmail.toLowerCase().includes(q)) ||
          (r.id && r.id.toLowerCase().includes(q))
      );
    }
    return list;
  }, [reservations, reservationStatusFilter, reservationSearch]);

  // Filtered Reports
  const filteredReports = useMemo(() => {
    let list = reports;
    if (reportStatusFilter !== 'all') {
      list = list.filter((r) => r.status === reportStatusFilter);
    }
    return list;
  }, [reports, reportStatusFilter]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    let list = auditLogs;
    if (auditActionFilter !== 'all') {
      list = list.filter((a) => a.action === auditActionFilter);
    }
    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase().trim();
      list = list.filter(
        (a) =>
          (a.adminEmail && a.adminEmail.toLowerCase().includes(q)) ||
          (a.action && a.action.toLowerCase().includes(q)) ||
          (a.targetId && a.targetId.toLowerCase().includes(q)) ||
          (a.reason && a.reason.toLowerCase().includes(q))
      );
    }
    if (auditDateFilter !== 'all') {
      const now = Date.now();
      const cutoff =
        auditDateFilter === 'today'
          ? 24 * 60 * 60 * 1000
          : auditDateFilter === '7days'
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;
      list = list.filter((a) => now - new Date(a.timestamp || 0).getTime() <= cutoff);
    }
    return list;
  }, [auditLogs, auditActionFilter, auditSearch, auditDateFilter]);

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-brand-teal" />
        <p className="text-sm font-medium text-brand-muted">Loading Campus Moderation Console...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-3xl border border-brand-border bg-white p-6 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-brand-charcoal">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-teal" />
            Campus Moderation
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-brand-charcoal sm:text-3xl">
            Campus Moderation Console
          </h1>
          <p className="text-sm text-brand-muted">
            Anna University / MIT student community oversight & peer-to-peer trust safety.
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
          { id: 'listings', label: `Listings (${listings.length})`, icon: Package },
          { id: 'requests', label: `Requests (${requests.length})`, icon: HelpCircle },
          { id: 'users', label: `Students (${users.length})`, icon: Users },
          { id: 'reservations', label: `Reservations (${reservations.length})`, icon: Bookmark },
          {
            id: 'reports',
            label: `Reports (${reports.filter((r) => r.status === 'pending' || r.status === 'reviewing').length})`,
            icon: Flag,
          },
          { id: 'activity', label: 'Audit Log', icon: Activity },
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

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-8">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Students</span>
              <p className="mt-2 text-3xl font-extrabold text-zinc-900">{overview.totalUsers}</p>
              <span className="text-[11px] text-zinc-400 mt-1 block">Registered peers</span>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Active Listings</span>
              <p className="mt-2 text-3xl font-extrabold text-emerald-600">{overview.activeListings}</p>
              <span className="text-[11px] text-zinc-400 mt-1 block">Available items</span>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Active Requests</span>
              <p className="mt-2 text-3xl font-extrabold text-blue-600">{overview.activeRequests}</p>
              <span className="text-[11px] text-zinc-400 mt-1 block">Student requests</span>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Active Reservations</span>
              <p className="mt-2 text-3xl font-extrabold text-amber-600">{overview.activeReservations}</p>
              <span className="text-[11px] text-zinc-400 mt-1 block">Ongoing trades</span>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pending Reports</span>
              <p className="mt-2 text-3xl font-extrabold text-rose-600">{overview.pendingReports}</p>
              <span className="text-[11px] text-zinc-400 mt-1 block">Needs attention</span>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Removed Items</span>
              <p className="mt-2 text-3xl font-extrabold text-zinc-700">{overview.removedListingsAndRequests}</p>
              <span className="text-[11px] text-zinc-400 mt-1 block">Listings & Requests</span>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => setActiveTab('listings')}
              className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-5 hover:border-brand-teal transition-all hover:shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900">Moderate Listings</h2>
                  <p className="text-xs text-zinc-500">{overview.totalListings} total items in system</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            </div>

            <div
              onClick={() => setActiveTab('requests')}
              className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-5 hover:border-brand-teal transition-all hover:shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900">Student Requests</h2>
                  <p className="text-xs text-zinc-500">{overview.totalRequests} campus requests posted</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            </div>

            <div
              onClick={() => setActiveTab('reports')}
              className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-5 hover:border-brand-teal transition-all hover:shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
                  <Flag className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900">Reports Queue</h2>
                  <p className="text-xs text-zinc-500">{overview.pendingReports} open moderation tickets</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            </div>
          </div>

          {/* Recent Activity Section */}
          <div className="rounded-2xl border border-brand-border bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand-teal" />
                <h2 className="text-base font-bold text-brand-charcoal">Recent Moderation & System Activity</h2>
              </div>
              <span className="text-xs text-brand-muted">Real-time system audit feed</span>
            </div>

            {overview.recentActivity && overview.recentActivity.length > 0 ? (
              <div className="divide-y divide-zinc-100">
                {overview.recentActivity.map((event: any, idx: number) => (
                  <div key={event.id || idx} className="py-3 flex items-start justify-between gap-4 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-1.5 rounded-lg bg-zinc-100 text-zinc-600 shrink-0">
                        {event.action?.includes('LISTING') ? (
                          <Package className="h-3.5 w-3.5" />
                        ) : event.action?.includes('REQUEST') ? (
                          <HelpCircle className="h-3.5 w-3.5" />
                        ) : event.action?.includes('USER') ? (
                          <Users className="h-3.5 w-3.5" />
                        ) : event.action?.includes('REPORT') ? (
                          <Flag className="h-3.5 w-3.5" />
                        ) : (
                          <Activity className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-900">{event.action}</span>
                          <span className="text-zinc-400">•</span>
                          <span className="text-zinc-600">{event.actorEmail}</span>
                        </div>
                        <p className="text-zinc-500">
                          Target: <span className="font-mono text-zinc-700">{event.targetType} #{event.targetId}</span>
                          {event.details?.reason && <span> — "{event.details.reason}"</span>}
                        </p>
                      </div>
                    </div>
                    <span className="text-zinc-400 shrink-0 whitespace-nowrap">
                      {event.timestamp ? new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-brand-muted">
                No recent activity recorded yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LISTINGS MODERATION */}
      {/* ========================================================================= */}
      {activeTab === 'listings' && (
        <div className="space-y-6">
          {/* Listings Controls */}
          <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  placeholder="Search listings by title, seller name, or ID..."
                  value={listingSearch}
                  onChange={(e) => setListingSearch(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <select
                  value={listingCategoryFilter}
                  onChange={(e) => setListingCategoryFilter(e.target.value)}
                  className="h-9 rounded-lg border border-brand-border bg-white px-3 text-xs text-zinc-700"
                >
                  <option value="all">All Categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={listingTypeFilter}
                  onChange={(e) => setListingTypeFilter(e.target.value)}
                  className="h-9 rounded-lg border border-brand-border bg-white px-3 text-xs text-zinc-700"
                >
                  <option value="all">All Types</option>
                  <option value="Sale">Sale</option>
                  <option value="Exchange">Exchange</option>
                  <option value="Donate">Donate</option>
                </select>

                <select
                  value={listingStatusFilter}
                  onChange={(e) => setListingStatusFilter(e.target.value)}
                  className="h-9 rounded-lg border border-brand-border bg-white px-3 text-xs text-zinc-700"
                >
                  <option value="all">All Statuses</option>
                  <option value="available">Available / Active</option>
                  <option value="reserved">Reserved</option>
                  <option value="hidden">Hidden</option>
                  <option value="removed">Removed</option>
                </select>

                <select
                  value={listingSortOrder}
                  onChange={(e) => setListingSortOrder(e.target.value as any)}
                  className="h-9 rounded-lg border border-brand-border bg-white px-3 text-xs text-zinc-700"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
            </div>
          </div>

          {/* Listings List */}
          {filteredListings.length === 0 ? (
            <div className="rounded-2xl border border-brand-border bg-white p-12 text-center text-sm text-brand-muted">
              No listings match the current filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredListings.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs flex flex-col justify-between space-y-3 hover:border-zinc-300 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline">{item.category || 'Other'}</Badge>
                        <Badge
                          variant={
                            item.type === 'Exchange'
                              ? 'warning'
                              : item.type === 'Donate'
                              ? 'teal'
                              : 'default'
                          }
                        >
                          {item.type}
                        </Badge>
                        <Badge
                          variant={
                            item.status === 'available' || item.status === 'active'
                              ? 'success'
                              : item.status === 'removed' || item.status === 'hidden'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {item.status}
                        </Badge>
                      </div>
                      {typeof item.reportCount === 'number' && item.reportCount > 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <Flag className="h-3 w-3" />
                          {item.reportCount}
                        </Badge>
                      )}
                    </div>

                    <h2 className="font-bold text-sm text-zinc-900 line-clamp-1">{item.title}</h2>
                    <p className="text-xs text-zinc-500 line-clamp-2">{item.description}</p>

                    {item.type === 'Exchange' && item.wantedItem && (
                      <p className="text-xs text-amber-800 bg-amber-50 p-2 rounded-lg line-clamp-1">
                        Wanted: <span className="font-medium">{item.wantedItem}</span>
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1 text-xs text-zinc-500">
                      <span>{item.type === 'Sale' ? (item.price ? `₹${item.price}` : 'Free') : item.type}</span>
                      <span>By: {item.sellerName || 'Student'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-zinc-100">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8 px-2"
                      onClick={() => setSelectedListingDetail(item)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Details
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8 px-2"
                      onClick={() => openEditListingModal(item)}
                    >
                      <Edit3 className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>

                    {item.status === 'removed' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 px-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        onClick={() => {
                          setActionModal({
                            isOpen: true,
                            title: 'Restore Listing',
                            description: `Restore "${item.title}" back to active campus availability?`,
                            actionType: 'restore_listing',
                            targetId: item.id,
                            targetName: item.title,
                          });
                          setActionReason('Approved compliance after review');
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Restore
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 px-2 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => {
                          setActionModal({
                            isOpen: true,
                            title: 'Remove Listing',
                            description: `Soft-delete "${item.title}" from public marketplace?`,
                            actionType: 'remove_listing',
                            targetId: item.id,
                            targetName: item.title,
                          });
                          setActionReason('');
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REQUESTS MODERATION (NEW FEATURE) */}
      {/* ========================================================================= */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* Requests Controls */}
          <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  placeholder="Search requests by title, requester, or ID..."
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <select
                  value={requestCategoryFilter}
                  onChange={(e) => setRequestCategoryFilter(e.target.value)}
                  className="h-9 rounded-lg border border-brand-border bg-white px-3 text-xs text-zinc-700"
                >
                  <option value="all">All Categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={requestStatusFilter}
                  onChange={(e) => setRequestStatusFilter(e.target.value)}
                  className="h-9 rounded-lg border border-brand-border bg-white px-3 text-xs text-zinc-700"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active (Open)</option>
                  <option value="fulfilled">Fulfilled / Matched</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="removed">Removed</option>
                </select>

                <select
                  value={requestSortOrder}
                  onChange={(e) => setRequestSortOrder(e.target.value as any)}
                  className="h-9 rounded-lg border border-brand-border bg-white px-3 text-xs text-zinc-700"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
            </div>
          </div>

          {/* Requests List */}
          {filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-brand-border bg-white p-12 text-center text-sm text-brand-muted">
              No campus requests match the current filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRequests.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs flex flex-col justify-between space-y-3 hover:border-zinc-300 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline">{item.category || 'Other'}</Badge>
                        <Badge
                          variant={
                            item.status === 'open' || item.status === 'active'
                              ? 'teal'
                              : item.status === 'completed' || item.status === 'matched'
                              ? 'success'
                              : item.status === 'removed'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {item.status}
                        </Badge>
                      </div>
                      {item.budget !== undefined && (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          Budget: ₹{item.budget}
                        </span>
                      )}
                    </div>

                    <h2 className="font-bold text-sm text-zinc-900 line-clamp-1">{item.title}</h2>
                    <p className="text-xs text-zinc-500 line-clamp-2">{item.description}</p>

                    <div className="space-y-1 text-xs text-zinc-500 pt-1">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-zinc-400" />
                        <span>Needed by: {item.neededBy}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-zinc-400" />
                        <span>Location: {item.location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-zinc-400" />
                        <span>Requester: {item.requesterName || 'Student'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-zinc-100">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8 px-2"
                      onClick={() => setSelectedRequestDetail(item)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Details
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8 px-2"
                      onClick={() => openEditRequestModal(item)}
                    >
                      <Edit3 className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>

                    {item.status === 'removed' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 px-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        onClick={() => {
                          setActionModal({
                            isOpen: true,
                            title: 'Restore Request',
                            description: `Restore request "${item.title}" back to active status?`,
                            actionType: 'restore_request',
                            targetId: item.id,
                            targetName: item.title,
                          });
                          setActionReason('Restored by admin after review');
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Restore
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 px-2 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => {
                          setActionModal({
                            isOpen: true,
                            title: 'Remove Request',
                            description: `Soft-delete request "${item.title}"?`,
                            actionType: 'remove_request',
                            targetId: item.id,
                            targetName: item.title,
                          });
                          setActionReason('');
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: STUDENTS / USER MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search students by name, email, department, or UID..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <select
              value={userStatusFilter}
              onChange={(e) => setUserStatusFilter(e.target.value as any)}
              className="h-9 rounded-lg border border-brand-border bg-white px-3 text-xs text-zinc-700 w-full md:w-auto"
            >
              <option value="all">All Standing</option>
              <option value="active">Active (Good Standing)</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>
          </div>

          <div className="rounded-2xl border border-brand-border bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-600">
                <thead className="bg-slate-50 border-b border-brand-border text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">Student</th>
                    <th className="px-4 py-3.5">College Email</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-center">Listings</th>
                    <th className="px-4 py-3.5 text-center">Requests</th>
                    <th className="px-4 py-3.5 text-center">Reservations</th>
                    <th className="px-4 py-3.5 text-center">Warnings</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-medium text-zinc-900 flex items-center gap-2">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover border" />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-zinc-200 text-zinc-700 text-[10px] font-bold flex items-center justify-center">
                            {u.name?.charAt(0) || 'U'}
                          </div>
                        )}
                        <span>{u.name || 'Student'}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-700">{u.email}</td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 text-center font-medium">{u.listingsCount || 0}</td>
                      <td className="px-4 py-3 text-center font-medium">{u.requestsCount || 0}</td>
                      <td className="px-4 py-3 text-center font-medium">{u.reservationsCount || 0}</td>
                      <td className="px-4 py-3 text-center font-medium">
                        {u.warningCount > 0 ? (
                          <span className="text-amber-600 font-bold">{u.warningCount}</span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2"
                            onClick={() => setSelectedUser(u)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Profile
                          </Button>

                          {u.status === 'suspended' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => {
                                setActionModal({
                                  isOpen: true,
                                  title: 'Unsuspend Student',
                                  description: `Restore student ${u.name} (${u.email}) back to active good standing?`,
                                  actionType: 'restore_user',
                                  targetId: u.id,
                                  targetName: u.name,
                                });
                                setActionReason('Reinstated by admin');
                              }}
                            >
                              <UserCheck className="h-3 w-3 mr-1" />
                              Unsuspend
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2 text-amber-600 border-amber-200 hover:bg-amber-50"
                              onClick={() => {
                                setActionModal({
                                  isOpen: true,
                                  title: 'Suspend Student',
                                  description: `Suspend student ${u.name} (${u.email}) from posting and exchanging on campus?`,
                                  actionType: 'suspend_user',
                                  targetId: u.id,
                                  targetName: u.name,
                                });
                                setActionReason('');
                              }}
                            >
                              <UserX className="h-3 w-3 mr-1" />
                              Suspend
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: RESERVATIONS (ADMIN VIEW - STRICTLY READ-ONLY) */}
      {/* ========================================================================= */}
      {activeTab === 'reservations' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search reservations by buyer, seller, listing title, or ID..."
                value={reservationSearch}
                onChange={(e) => setReservationSearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <select
              value={reservationStatusFilter}
              onChange={(e) => setReservationStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-brand-border bg-white px-3 text-xs text-zinc-700 w-full md:w-auto"
            >
              <option value="all">All Reservation Statuses</option>
              <option value="active">Active (Pending/Accepted)</option>
              <option value="accepted">Accepted</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0" />
            <span>
              <strong>Read-Only Governance:</strong> Reservations represent private peer-to-peer student transactions. Admins cannot arbitrarily force state transitions, protecting student agreement integrity.
            </span>
          </div>

          {filteredReservations.length === 0 ? (
            <div className="rounded-2xl border border-brand-border bg-white p-12 text-center text-sm text-brand-muted">
              No campus reservations match the current filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReservations.map((resItem) => (
                <div
                  key={resItem.id}
                  className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-zinc-400">#{resItem.id}</span>
                      <Badge
                        variant={
                          resItem.status === 'accepted'
                            ? 'success'
                            : resItem.status === 'pending'
                            ? 'warning'
                            : resItem.status === 'completed'
                            ? 'teal'
                            : 'secondary'
                        }
                      >
                        {resItem.status}
                      </Badge>
                    </div>

                    <h2 className="font-bold text-sm text-zinc-900 line-clamp-1">{resItem.listingTitle}</h2>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-50 p-2.5 rounded-xl border border-zinc-100">
                      <div>
                        <span className="text-[10px] text-zinc-400 block">Buyer</span>
                        <span className="font-medium text-zinc-800 line-clamp-1">{resItem.buyerName}</span>
                        <span className="text-[10px] text-zinc-500 font-mono line-clamp-1">{resItem.buyerEmail}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block">Seller</span>
                        <span className="font-medium text-zinc-800 line-clamp-1">{resItem.sellerName}</span>
                        <span className="text-[10px] text-zinc-500 font-mono line-clamp-1">{resItem.sellerEmail}</span>
                      </div>
                    </div>

                    {resItem.meetup && resItem.meetup.location && (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-600 bg-slate-50 p-2 rounded-lg">
                        <MapPin className="h-3.5 w-3.5 text-brand-teal shrink-0" />
                        <span>
                          Meetup: <strong>{resItem.meetup.location}</strong> ({resItem.meetup.status})
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs text-zinc-400">
                    <span>{resItem.createdAt ? new Date(resItem.createdAt).toLocaleDateString() : '—'}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-2"
                      onClick={() => setSelectedReservationDetail(resItem)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: REPORTS & MODERATION QUEUE */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-rose-600" />
              <h2 className="text-sm font-bold text-zinc-900">Campus Moderation Reports Queue</h2>
            </div>
            <select
              value={reportStatusFilter}
              onChange={(e) => setReportStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-brand-border bg-white px-3 text-xs text-zinc-700 w-full md:w-auto"
            >
              <option value="all">All Report Tickets</option>
              <option value="pending">Pending Review</option>
              <option value="reviewing">Under Review</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          {filteredReports.length === 0 ? (
            <div className="rounded-2xl border border-brand-border bg-white p-12 text-center text-sm text-brand-muted">
              No reports found for this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          r.status === 'pending'
                            ? 'destructive'
                            : r.status === 'reviewing'
                            ? 'warning'
                            : r.status === 'resolved'
                            ? 'success'
                            : 'secondary'
                        }
                      >
                        {r.status === 'reviewing' ? 'Under Review' : r.status}
                      </Badge>
                      <span className="font-bold text-sm text-zinc-900">{r.reason}</span>
                    </div>

                    <p className="text-xs text-zinc-600">
                      Target: <span className="font-semibold text-zinc-900">{r.listingTitle || `Item #${r.listingId}`}</span> • Reported by <span className="font-mono">{r.reporterEmail}</span>
                    </p>

                    {r.description && (
                      <p className="text-xs text-zinc-500 italic bg-zinc-50 p-2 rounded-lg mt-1">
                        "{r.description}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs px-2.5"
                      onClick={() => setSelectedReportDetail(r)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Review
                    </Button>

                    {r.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs px-2.5 text-amber-700 border-amber-200 hover:bg-amber-50"
                        onClick={() => {
                          setActionModal({
                            isOpen: true,
                            title: 'Mark Under Review',
                            description: `Mark report #${r.id} as under active moderation investigation?`,
                            actionType: 'review_report',
                            targetId: r.id,
                          });
                          setActionReason('Admin investigating report claims');
                        }}
                      >
                        Under Review
                      </Button>
                    )}

                    {r.status !== 'resolved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs px-2.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                        onClick={() => {
                          setActionModal({
                            isOpen: true,
                            title: 'Resolve Report',
                            description: `Resolve ticket #${r.id} and take appropriate moderation action?`,
                            actionType: 'resolve_report',
                            targetId: r.id,
                          });
                          setActionReason('Violation verified and moderated');
                        }}
                      >
                        Resolve
                      </Button>
                    )}

                    {r.status !== 'dismissed' && r.status !== 'resolved' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs px-2.5 text-zinc-500 hover:text-zinc-700"
                        onClick={() => {
                          setActionModal({
                            isOpen: true,
                            title: 'Dismiss Report',
                            description: `Dismiss report #${r.id} as unfounded or non-violating?`,
                            actionType: 'dismiss_report',
                            targetId: r.id,
                          });
                          setActionReason('No violation detected');
                        }}
                      >
                        Dismiss
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: AUDIT LOG */}
      {/* ========================================================================= */}
      {activeTab === 'activity' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="flex space-x-1 rounded-xl bg-slate-100 p-1 w-fit border border-brand-border">
                <button
                  onClick={() => setActivityMode('audit')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    activityMode === 'audit'
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Admin Audit Logs ({auditLogs.length})
                </button>
                <button
                  onClick={() => setActivityMode('activity')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    activityMode === 'activity'
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  System Activity ({activityLogs.length})
                </button>
              </div>

              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  placeholder="Search logs by admin email, action, ID, or reason..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              <select
                value={auditDateFilter}
                onChange={(e) => setAuditDateFilter(e.target.value)}
                className="h-9 rounded-lg border border-brand-border bg-white px-3 text-xs text-zinc-700 w-full md:w-auto"
              >
                <option value="all">All Time</option>
                <option value="today">Past 24 Hours</option>
                <option value="7days">Past 7 Days</option>
                <option value="30days">Past 30 Days</option>
              </select>
            </div>
          </div>

          {activityMode === 'audit' ? (
            <div className="rounded-2xl border border-brand-border bg-white overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-600">
                  <thead className="bg-slate-50 border-b border-brand-border text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5">Timestamp</th>
                      <th className="px-4 py-3.5">Admin</th>
                      <th className="px-4 py-3.5">Action</th>
                      <th className="px-4 py-3.5">Target</th>
                      <th className="px-4 py-3.5">Reason / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-zinc-400 font-mono text-[11px]">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-900">{log.adminEmail}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {log.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="capitalize font-semibold text-zinc-800">{log.targetType}</span>{' '}
                          <span className="font-mono text-[11px] text-zinc-400">#{log.targetId}</span>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 max-w-xs truncate">{log.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-brand-border bg-white overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-600">
                  <thead className="bg-slate-50 border-b border-brand-border text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5">Timestamp</th>
                      <th className="px-4 py-3.5">User</th>
                      <th className="px-4 py-3.5">Action</th>
                      <th className="px-4 py-3.5">Target</th>
                      <th className="px-4 py-3.5">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {activityLogs.map((act) => (
                      <tr key={act.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-zinc-400 font-mono text-[11px]">
                          {act.timestamp ? new Date(act.timestamp).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-900">{act.userEmail || act.userId}</td>
                        <td className="px-4 py-3 font-mono text-[10px]">{act.action}</td>
                        <td className="px-4 py-3">
                          {act.targetType} #{act.targetId}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 max-w-xs truncate">
                          {act.details ? JSON.stringify(act.details) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CONFIRM ACTION MODAL */}
      {/* ========================================================================= */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h3 className="font-bold text-base text-zinc-900">{actionModal.title}</h3>
              <button
                onClick={() => setActionModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">{actionModal.description}</p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 block">
                Reason for Moderation Action <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="Explain the campus guideline rationale (recorded into audit log)..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-xs text-zinc-900 focus:border-brand-teal focus:outline-none focus:ring-1 focus:ring-brand-teal"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setActionModal((prev) => ({ ...prev, isOpen: false }))}
                disabled={isPerformingAction}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant={actionModal.actionType.includes('remove') || actionModal.actionType.includes('suspend') ? 'destructive' : 'default'}
                onClick={handleConfirmAction}
                disabled={isPerformingAction}
              >
                {isPerformingAction ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Executing...
                  </>
                ) : (
                  'Confirm & Record Audit'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT LISTING MODAL */}
      {/* ========================================================================= */}
      {editingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div>
                <h3 className="font-bold text-base text-zinc-900">Edit Listing</h3>
                <p className="text-xs text-zinc-500">Updating #{editingListing.id} (Seller: {editingListing.sellerName})</p>
              </div>
              <button onClick={() => setEditingListing(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveListingEdit} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-zinc-700 block mb-1">Title</label>
                <Input
                  required
                  value={editListingForm.title}
                  onChange={(e) => setEditListingForm({ ...editListingForm, title: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-zinc-700 block mb-1">Category</label>
                  <select
                    value={editListingForm.category}
                    onChange={(e) => setEditListingForm({ ...editListingForm, category: e.target.value as Category })}
                    className="w-full h-9 rounded-lg border border-brand-border bg-white px-2 text-xs text-zinc-700"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-medium text-zinc-700 block mb-1">Type</label>
                  <select
                    value={editListingForm.type}
                    onChange={(e) => setEditListingForm({ ...editListingForm, type: e.target.value as ListingType })}
                    className="w-full h-9 rounded-lg border border-brand-border bg-white px-2 text-xs text-zinc-700"
                  >
                    <option value="Sale">Sale</option>
                    <option value="Exchange">Exchange</option>
                    <option value="Donate">Donate</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-zinc-700 block mb-1">Condition</label>
                  <select
                    value={editListingForm.condition}
                    onChange={(e) => setEditListingForm({ ...editListingForm, condition: e.target.value as Condition })}
                    className="w-full h-9 rounded-lg border border-brand-border bg-white px-2 text-xs text-zinc-700"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-medium text-zinc-700 block mb-1">Price (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0 for free / donate"
                    value={editListingForm.price}
                    onChange={(e) => setEditListingForm({ ...editListingForm, price: e.target.value })}
                    className="text-xs"
                    disabled={editListingForm.type === 'Donate'}
                  />
                </div>
              </div>

              {editListingForm.type === 'Exchange' && (
                <div>
                  <label className="font-medium text-amber-800 block mb-1">Wanted in Exchange *</label>
                  <Input
                    required
                    placeholder="Item desired in exchange..."
                    value={editListingForm.wantedItem}
                    onChange={(e) => setEditListingForm({ ...editListingForm, wantedItem: e.target.value })}
                    className="text-xs border-amber-300"
                  />
                </div>
              )}

              <div>
                <label className="font-medium text-zinc-700 block mb-1">Campus Meetup Location</label>
                <Input
                  required
                  placeholder="e.g. Central Library, Main Gate..."
                  value={editListingForm.location}
                  onChange={(e) => setEditListingForm({ ...editListingForm, location: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-zinc-700 block mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  value={editListingForm.description}
                  onChange={(e) => setEditListingForm({ ...editListingForm, description: e.target.value })}
                  className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-xs text-zinc-900"
                />
              </div>

              <div className="pt-2 border-t border-zinc-100">
                <label className="font-semibold text-zinc-800 block mb-1">
                  Admin Action Reason (for Audit Log) *
                </label>
                <Input
                  required
                  placeholder="e.g. Corrected prohibited keyword false positive..."
                  value={editListingForm.reason}
                  onChange={(e) => setEditListingForm({ ...editListingForm, reason: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingListing(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isPerformingAction}>
                  {isPerformingAction ? 'Saving...' : 'Save & Audit'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT REQUEST MODAL */}
      {/* ========================================================================= */}
      {editingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div>
                <h3 className="font-bold text-base text-zinc-900">Edit Student Request</h3>
                <p className="text-xs text-zinc-500">Updating #{editingRequest.id} (Requester: {editingRequest.requesterName})</p>
              </div>
              <button onClick={() => setEditingRequest(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRequestEdit} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-zinc-700 block mb-1">Title</label>
                <Input
                  required
                  value={editRequestForm.title}
                  onChange={(e) => setEditRequestForm({ ...editRequestForm, title: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-zinc-700 block mb-1">Category</label>
                  <select
                    value={editRequestForm.category}
                    onChange={(e) => setEditRequestForm({ ...editRequestForm, category: e.target.value as Category })}
                    className="w-full h-9 rounded-lg border border-brand-border bg-white px-2 text-xs text-zinc-700"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-medium text-zinc-700 block mb-1">Budget (₹) - Optional</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Optional budget"
                    value={editRequestForm.budget}
                    onChange={(e) => setEditRequestForm({ ...editRequestForm, budget: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-zinc-700 block mb-1">Needed By</label>
                  <Input
                    required
                    placeholder="e.g. Tomorrow, End of week..."
                    value={editRequestForm.neededBy}
                    onChange={(e) => setEditRequestForm({ ...editRequestForm, neededBy: e.target.value })}
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="font-medium text-zinc-700 block mb-1">Location</label>
                  <Input
                    required
                    placeholder="e.g. Central Library, Hostel..."
                    value={editRequestForm.location}
                    onChange={(e) => setEditRequestForm({ ...editRequestForm, location: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-zinc-700 block mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  value={editRequestForm.description}
                  onChange={(e) => setEditRequestForm({ ...editRequestForm, description: e.target.value })}
                  className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-xs text-zinc-900"
                />
              </div>

              <div className="pt-2 border-t border-zinc-100">
                <label className="font-semibold text-zinc-800 block mb-1">
                  Admin Action Reason (for Audit Log) *
                </label>
                <Input
                  required
                  placeholder="e.g. Standardized campus request title..."
                  value={editRequestForm.reason}
                  onChange={(e) => setEditRequestForm({ ...editRequestForm, reason: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingRequest(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isPerformingAction}>
                  {isPerformingAction ? 'Saving...' : 'Save & Audit'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: LISTING DETAIL MODAL */}
      {/* ========================================================================= */}
      {selectedListingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedListingDetail.category}</Badge>
                <Badge variant="success">{selectedListingDetail.status}</Badge>
              </div>
              <button onClick={() => setSelectedListingDetail(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-lg text-zinc-900">{selectedListingDetail.title}</h3>
              <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-wrap">
                {selectedListingDetail.description}
              </p>
            </div>

            {selectedListingDetail.images && selectedListingDetail.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto py-2">
                {selectedListingDetail.images.map((imgUrl: string, idx: number) => (
                  <img
                    key={idx}
                    src={imgUrl}
                    alt=""
                    className="h-24 w-24 object-cover rounded-xl border border-zinc-200 shrink-0"
                  />
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 p-3.5 rounded-xl border border-zinc-100">
              <div>
                <span className="text-zinc-400 block">Offer Type</span>
                <span className="font-semibold text-zinc-800">{selectedListingDetail.type}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Price</span>
                <span className="font-semibold text-zinc-800">
                  {selectedListingDetail.type === 'Sale'
                    ? selectedListingDetail.price
                      ? `₹${selectedListingDetail.price}`
                      : 'Free'
                    : selectedListingDetail.type}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block">Condition</span>
                <span className="font-semibold text-zinc-800">{selectedListingDetail.condition || '—'}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Location</span>
                <span className="font-semibold text-zinc-800">{selectedListingDetail.location || '—'}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Seller Name</span>
                <span className="font-semibold text-zinc-800">{selectedListingDetail.sellerName || 'Student'}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Seller Email</span>
                <span className="font-mono text-zinc-700">{selectedListingDetail.sellerEmail || '—'}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Listing ID</span>
                <span className="font-mono text-zinc-700">{selectedListingDetail.id}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Posted Date</span>
                <span className="font-medium text-zinc-700">
                  {selectedListingDetail.createdAt ? new Date(selectedListingDetail.createdAt).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>

            {selectedListingDetail.type === 'Exchange' && selectedListingDetail.wantedItem && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs">
                <span className="font-bold text-amber-900 block mb-0.5">Wanted in Exchange:</span>
                <p className="text-amber-800">{selectedListingDetail.wantedItem}</p>
              </div>
            )}

            {selectedListingDetail.moderationReason && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs">
                <span className="font-bold text-red-900 block mb-0.5">Moderation Note:</span>
                <p className="text-red-800">{selectedListingDetail.moderationReason}</p>
                <p className="text-[10px] text-red-600 mt-1">
                  By {selectedListingDetail.moderatedBy} • {selectedListingDetail.moderatedAt}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedListingDetail(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: REQUEST DETAIL MODAL */}
      {/* ========================================================================= */}
      {selectedRequestDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedRequestDetail.category}</Badge>
                <Badge variant="teal">{selectedRequestDetail.status}</Badge>
              </div>
              <button onClick={() => setSelectedRequestDetail(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-lg text-zinc-900">{selectedRequestDetail.title}</h3>
              <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-wrap">
                {selectedRequestDetail.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 p-3.5 rounded-xl border border-zinc-100">
              <div>
                <span className="text-zinc-400 block">Category</span>
                <span className="font-semibold text-zinc-800">{selectedRequestDetail.category}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Budget</span>
                <span className="font-semibold text-zinc-800">
                  {selectedRequestDetail.budget !== undefined ? `₹${selectedRequestDetail.budget}` : 'Flexible'}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block">Needed By</span>
                <span className="font-semibold text-zinc-800">{selectedRequestDetail.neededBy}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Meetup Location</span>
                <span className="font-semibold text-zinc-800">{selectedRequestDetail.location}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Requester Name</span>
                <span className="font-semibold text-zinc-800">{selectedRequestDetail.requesterName || 'Student'}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Requester Email</span>
                <span className="font-mono text-zinc-700">{selectedRequestDetail.requesterEmail || '—'}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Request ID</span>
                <span className="font-mono text-zinc-700">{selectedRequestDetail.id}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Date Posted</span>
                <span className="font-medium text-zinc-700">
                  {selectedRequestDetail.createdAt ? new Date(selectedRequestDetail.createdAt).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedRequestDetail(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: USER DETAIL MODAL */}
      {/* ========================================================================= */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                {selectedUser.avatarUrl ? (
                  <img src={selectedUser.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover border" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-zinc-900 text-white font-bold flex items-center justify-center">
                    {selectedUser.name?.charAt(0) || 'U'}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-base text-zinc-900">{selectedUser.name}</h3>
                  <p className="text-xs text-zinc-500">{selectedUser.department} • {selectedUser.campus || 'MIT Campus'}</p>
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
                <span className="text-zinc-400 block">Listings Posted</span>
                <span className="font-bold text-zinc-900">{selectedUser.listingsCount || 0}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Requests Posted</span>
                <span className="font-bold text-zinc-900">{selectedUser.requestsCount || 0}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Reservations Participated</span>
                <span className="font-bold text-zinc-900">{selectedUser.reservationsCount || 0}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Reports Received</span>
                <span className="font-bold text-zinc-900">{selectedUser.reportsReceivedCount || 0}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Warning Count</span>
                <span className="font-bold text-zinc-900">{selectedUser.warningCount || 0}</span>
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
                      <p className="text-[10px] text-zinc-400">
                        {new Date(w.date).toLocaleString()} • Issued by {w.adminEmail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedUser(null)}>
                Close Profile
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: RESERVATION DETAIL MODAL */}
      {/* ========================================================================= */}
      {selectedReservationDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-brand-teal" />
                <h3 className="font-bold text-base text-zinc-900">Reservation #{selectedReservationDetail.id}</h3>
              </div>
              <button onClick={() => setSelectedReservationDetail(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-sm text-zinc-900">{selectedReservationDetail.listingTitle}</h4>
              <Badge variant="outline">Status: {selectedReservationDetail.status}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 p-4 rounded-xl border border-zinc-100">
              <div>
                <span className="text-zinc-400 block">Buyer Name</span>
                <span className="font-semibold text-zinc-900">{selectedReservationDetail.buyerName}</span>
                <span className="font-mono text-[11px] text-zinc-600 block">{selectedReservationDetail.buyerEmail}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Seller Name</span>
                <span className="font-semibold text-zinc-900">{selectedReservationDetail.sellerName}</span>
                <span className="font-mono text-[11px] text-zinc-600 block">{selectedReservationDetail.sellerEmail}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Listing Price</span>
                <span className="font-semibold text-zinc-900">
                  {selectedReservationDetail.listingPrice ? `₹${selectedReservationDetail.listingPrice}` : 'Free / Exchange'}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block">Created Date</span>
                <span className="font-medium text-zinc-800">
                  {selectedReservationDetail.createdAt ? new Date(selectedReservationDetail.createdAt).toLocaleString() : '—'}
                </span>
              </div>
            </div>

            {selectedReservationDetail.meetup && (
              <div className="p-3 bg-slate-50 rounded-xl border border-zinc-200 text-xs space-y-1">
                <span className="font-bold text-zinc-800 block">Campus Meetup Information:</span>
                <p className="text-zinc-600">
                  Location: <strong>{selectedReservationDetail.meetup.location || 'Not set'}</strong>
                </p>
                <p className="text-zinc-600">
                  Status: <strong>{selectedReservationDetail.meetup.status}</strong>
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedReservationDetail(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: REPORT DETAIL MODAL */}
      {/* ========================================================================= */}
      {selectedReportDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-rose-600" />
                <h3 className="font-bold text-base text-zinc-900">Report #{selectedReportDetail.id}</h3>
              </div>
              <button onClick={() => setSelectedReportDetail(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">{selectedReportDetail.reason}</Badge>
                <Badge variant="outline">{selectedReportDetail.status}</Badge>
              </div>
              <h4 className="font-bold text-sm text-zinc-900 mt-2">
                Target: {selectedReportDetail.listingTitle || `Item #${selectedReportDetail.listingId}`}
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 p-4 rounded-xl border border-zinc-100">
              <div>
                <span className="text-zinc-400 block">Reporter</span>
                <span className="font-mono text-zinc-800">{selectedReportDetail.reporterEmail}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Reported User ID</span>
                <span className="font-mono text-zinc-800">{selectedReportDetail.reportedUserId}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Filed Date</span>
                <span className="font-medium text-zinc-800">
                  {selectedReportDetail.createdAt ? new Date(selectedReportDetail.createdAt).toLocaleString() : '—'}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block">Reviewed Status</span>
                <span className="font-medium text-zinc-800">{selectedReportDetail.status}</span>
              </div>
            </div>

            {selectedReportDetail.description && (
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs">
                <span className="font-bold text-zinc-800 block mb-1">Student Evidence / Narrative:</span>
                <p className="text-zinc-600 whitespace-pre-wrap">{selectedReportDetail.description}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedReportDetail(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
