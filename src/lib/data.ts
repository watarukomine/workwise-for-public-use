
// This file is deprecated. Data is now seeded into Firestore from src/firebase/seed.ts
// and consumed via React hooks in the components.

import type { Staff, Customer, ScheduleEvent, StaffStatus, Order } from './types';
import { PlaceHolderImages } from './placeholder-images';

const getAvatarUrl = (avatarId: string) => {
  return PlaceHolderImages.find(img => img.id === avatarId)?.imageUrl || '';
};

export const staffData: Staff[] = [];
export const customerData: Customer[] = [];
export const scheduleData: ScheduleEvent[] = [];
export const staffStatusData: StaffStatus[] = [];
export const unassignedOrdersData: Order[] = [];
