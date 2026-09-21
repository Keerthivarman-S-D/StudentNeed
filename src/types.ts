export type Role = 'student' | 'admin';
export type ListingStatus = 'available' | 'active' | 'reserved' | 'completed' | 'cancelled' | 'expired' | 'hidden' | 'removed';
export type RequestStatus = 'open' | 'active' | 'matched' | 'accepted' | 'completed' | 'cancelled' | 'removed';
export type ReservationStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

export type UserStatus = 'active' | 'suspended' | 'banned';

export type UserWarning = {
  reason: string;
  date: string;
  adminEmail: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  department: string;
  campus: string;
  rating: number;
  avatarUrl?: string;
  exchangesCompleted: number;
  role: Role;
  isVerified: boolean;
  createdAt: string;
  status?: UserStatus;
  warningCount?: number;
  warnings?: UserWarning[];
  statusReason?: string;
  statusUpdatedAt?: string;
  suspendedAt?: string;
  bannedAt?: string;
  lastActivityAt?: string;
};

export type ListingType = 'Sale' | 'Borrow' | 'Donate' | 'Exchange';
export type ActiveListingType = 'Sale' | 'Donate' | 'Exchange';

export type Condition = 'New' | 'Like New' | 'Good' | 'Fair' | 'Poor';

export type Category =
  | 'Stationery'
  | 'Textbooks'
  | 'Electronics'
  | 'Lab Essentials'
  | 'Hostel Essentials'
  | 'Sports'
  | 'College Wear'
  | 'Other';

export type Listing = {
  id: string;
  title: string;
  description: string;
  price?: number;
  type: ListingType;
  condition?: Condition;
  category: Category;
  location: string;
  sellerId: string;
  images: string[];
  status: ListingStatus;
  expirationDays?: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  reportCount?: number;
  moderationReason?: string;
  moderatedAt?: string;
  moderatedBy?: string;
  flaggedForReview?: boolean;
  wantedItem?: string;
};

export type UpdateListingInput = {
  title?: string;
  description?: string;
  price?: number;
  type?: ListingType;
  category?: Category;
  condition?: Condition;
  location?: string;
  images?: string[];
  wantedItem?: string;
};

export type ItemRequest = {
  id: string;
  title: string;
  category: Category;
  description: string;
  budget?: number;
  neededBy: string;
  location: string;
  status: RequestStatus;
  requesterId: string;
  createdAt: string;
  updatedAt: string;
  moderationReason?: string;
  moderatedAt?: string;
  moderatedBy?: string;
};

export const CAMPUS_MEETUP_LOCATIONS = [
  'Main Gate',
  'Central Library',
  'Food Court',
  'Hostel',
  'CSE Block',
  'ECE Block',
] as const;

export type CampusMeetupLocation = typeof CAMPUS_MEETUP_LOCATIONS[number];

export type MeetupStatus = 'not_set' | 'proposed' | 'confirmed' | 'cancelled';

export type MeetupInfo = {
  location: string;
  status: MeetupStatus;
  proposedBy?: string;
  updatedAt?: any;
};

export type Reservation = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  chatId: string;
  status: ReservationStatus;
  meetup?: MeetupInfo;
  createdAt: any;
  updatedAt: any;
};

export type Chat = {
  id: string;
  participants: string[];
  listingId?: string;
  requestId?: string;
  reservationId?: string;
  createdAt: any;
  updatedAt: any;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
};

export type ReportReason =
  | 'Prohibited item'
  | 'Scam/fraud'
  | 'Fake/misleading listing'
  | 'Unsafe item'
  | 'Other';

export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

export type Report = {
  id: string;
  reporterId: string;
  reporterEmail: string;
  reportedUserId: string;
  listingId: string;
  listingTitle: string;
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  resolution?: string;
  actionTaken?: string;
};

export type AdminAuditAction =
  | 'EDIT_LISTING'
  | 'REMOVE_LISTING'
  | 'RESTORE_LISTING'
  | 'LISTING_HIDDEN'
  | 'LISTING_REMOVED'
  | 'LISTING_RESTORED'
  | 'EDIT_REQUEST'
  | 'REMOVE_REQUEST'
  | 'RESTORE_REQUEST'
  | 'USER_WARNED'
  | 'USER_SUSPENDED'
  | 'USER_BANNED'
  | 'USER_RESTORED'
  | 'SUSPEND_USER'
  | 'UNSUSPEND_USER'
  | 'REPORT_RESOLVED'
  | 'REPORT_DISMISSED'
  | 'RESOLVE_REPORT'
  | 'DISMISS_REPORT';

export type AdminAuditLog = {
  id: string;
  adminId: string;
  adminEmail: string;
  action: AdminAuditAction;
  targetType: 'listing' | 'user' | 'report' | 'request';
  targetId: string;
  targetUserId?: string;
  reason: string;
  timestamp: string;
  metadata?: Record<string, any>;
};

export type ActivityLogAction =
  | 'account_created'
  | 'listing_created'
  | 'listing_removed'
  | 'request_created'
  | 'report_submitted'
  | 'reservation_created'
  | 'reservation_cancelled'
  | 'moderation_action'
  | 'suspicious_rate_limit';

export type ActivityLog = {
  id: string;
  userId: string;
  userEmail?: string;
  action: ActivityLogAction;
  targetType: string;
  targetId: string;
  timestamp: string;
  details?: Record<string, any>;
};

export type NotificationType = 'chat' | 'reservation' | 'request' | 'system';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link: string;
  chatId?: string;
  reservationId?: string;
  listingId?: string;
};
