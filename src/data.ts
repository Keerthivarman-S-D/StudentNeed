import { User } from './types';

export const mockUsers: User[] = [
  {
    id: 'u1',
    name: 'Keerthi',
    email: 'keerthi@mit.edu',
    department: 'CSE',
    campus: 'MIT Campus',
    rating: 4.8,
    avatarUrl: 'https://i.pravatar.cc/150?u=u1',
    exchangesCompleted: 12,
    role: 'student',
    isVerified: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'u2',
    name: 'Rahul',
    email: 'rahul@mit.edu',
    department: 'ECE',
    campus: 'MIT Campus',
    rating: 4.5,
    avatarUrl: 'https://i.pravatar.cc/150?u=u2',
    exchangesCompleted: 5,
    role: 'student',
    isVerified: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'u3',
    name: 'Priya',
    email: 'priya@mit.edu',
    department: 'IT',
    campus: 'MIT Campus',
    rating: 4.9,
    avatarUrl: 'https://i.pravatar.cc/150?u=u3',
    exchangesCompleted: 20,
    role: 'student',
    isVerified: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'u4',
    name: 'Siddharth',
    email: 'siddharth@mit.edu',
    department: 'Mechanical',
    campus: 'MIT Campus',
    rating: 4.2,
    avatarUrl: 'https://i.pravatar.cc/150?u=u4',
    exchangesCompleted: 2,
    role: 'student',
    isVerified: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'u5',
    name: 'Ananya',
    email: 'ananya@mit.edu',
    department: 'Aeronautical',
    campus: 'MIT Campus',
    rating: 4.7,
    avatarUrl: 'https://i.pravatar.cc/150?u=u5',
    exchangesCompleted: 8,
    role: 'student',
    isVerified: true,
    createdAt: new Date().toISOString()
  },
];
