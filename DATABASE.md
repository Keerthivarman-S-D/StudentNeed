# StudentNeed Database Architecture

## Overview
StudentNeed uses **Firebase Firestore** as its primary NoSQL document database, pivoting from the original relational database assumption to provide robust, real-time sync for chat and reservations securely within the serverless environment. 

## Collections

### `users`
Stores student profiles. 
- Authentication is handled via Firebase Auth.
- Documents are keyed by the Firebase Auth `uid`.
- Includes `role` (student/admin) and `isVerified`.

### `listings`
Items offered on the marketplace.
- Supports Sale, Borrow, Donate, and Exchange.
- Tracks `status` (available, reserved, completed, cancelled, expired).

### `requests`
Items that students are actively looking for.
- Tracks `status` (open, matched, completed, cancelled).

### `reservations`
The transactional bridge between two students.
- When a student requests an available listing, a Reservation is created (`status: pending`).
- The owner can accept (`status: accepted`) which reserves the item.
- After meetup, it is marked `completed`.

### `chats` & `messages`
Real-time communication using Firestore subscriptions.
- `chats`: Contains metadata (`participants`, `lastMessage`).
- `chats/{chatId}/messages`: Subcollection of individual chat messages.

### `locations`
Admin-managed pickup locations on the campus.

## Security Rules
All queries strictly enforce authorization via `firestore.rules`.
- Reads are restricted to authenticated college students.
- Writes are scoped strictly to the document owner (seller, requester, sender) or an admin.
