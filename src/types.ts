export type Role = 'student' | 'admin';
export type ListingStatus = 'available' | 'active' | 'reserved' | 'completed' | 'cancelled' | 'expired';
export type RequestStatus = 'open' | 'active' | 'matched' | 'accepted' | 'completed' | 'cancelled';
export type ReservationStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

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
};

export type ListingType = 'Sale' | 'Borrow' | 'Donate' | 'Exchange';

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
  condition: Condition;
  category: Category;
  location: string;
  sellerId: string;
  images: string[];
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
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
