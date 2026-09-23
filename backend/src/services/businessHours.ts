/** A department, or nothing when a conversation has none. */
import type { Doc } from '../db/model';
import type { DepartmentDoc } from '../models/Department';
import type { Weekday } from '../domain';

type MaybeDepartment = Doc<DepartmentDoc> | DepartmentDoc | null | undefined;

const DAY_NAMES: Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
];

function isWithinBusinessHours(department: MaybeDepartment): boolean {
  if (!department || !department.businessHours || !department.businessHours.enabled) {
    return true;
  }
  const now = new Date();
  const dayName = DAY_NAMES[now.getDay()];
  const daySchedule = department.businessHours.schedule[dayName];
  if (!daySchedule || !daySchedule.enabled) {
    return false;
  }
  const currentTime = now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  const startTime = daySchedule.start || '09:00';
  const endTime = daySchedule.end || '18:00';
  return currentTime >= startTime && currentTime <= endTime;
}
function getBusinessHoursMessage(department: MaybeDepartment): string | null {
  if (!department || !department.businessHours) {
    return null;
  }
  const now = new Date();
  const dayName = DAY_NAMES[now.getDay()];
  const daySchedule = department.businessHours.schedule[dayName];
  if (daySchedule && daySchedule.enabled) {
    return `Thank you for contacting us. Our business hours are ${daySchedule.start} - ${daySchedule.end} on ${dayName}. We'll respond during business hours.`;
  }
  return "Thank you for contacting us. We're currently outside business hours. We'll respond as soon as possible during business hours.";
}
function shouldCalculateSLA(department: MaybeDepartment): boolean {
  if (!department || !department.sla) {
    return true;
  }
  if (!department.sla.onlyBusinessHours) {
    return true;
  }
  return isWithinBusinessHours(department);
}
export { isWithinBusinessHours, getBusinessHoursMessage, shouldCalculateSLA };
