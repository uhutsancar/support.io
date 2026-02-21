/**
 * Business Hours Management
 * Check if current time is within business hours for a department
 */

function isWithinBusinessHours(department) {
  if (!department || !department.businessHours || !department.businessHours.enabled) {
    return true; // No business hours restriction
  }
  
  const now = new Date();
  const timezone = department.businessHours.timezone || 'Europe/Istanbul';
  
  // Convert to department timezone (simplified - in production use proper timezone library)
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[now.getDay()];
  
  const daySchedule = department.businessHours.schedule[dayName];
  
  if (!daySchedule || !daySchedule.enabled) {
    return false; // Outside business hours
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

/**
 * Get auto-response message for outside business hours
 */
function getBusinessHoursMessage(department) {
  if (!department || !department.businessHours) {
    return null;
  }
  
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const now = new Date();
  const dayName = dayNames[now.getDay()];
  const daySchedule = department.businessHours.schedule[dayName];
  
  if (daySchedule && daySchedule.enabled) {
    return `Thank you for contacting us. Our business hours are ${daySchedule.start} - ${daySchedule.end} on ${dayName}. We'll respond during business hours.`;
  }
  
  return "Thank you for contacting us. We're currently outside business hours. We'll respond as soon as possible during business hours.";
}

/**
 * Check if SLA should be calculated only during business hours
 */
function shouldCalculateSLA(department) {
  if (!department || !department.sla) {
    return true; // Default: always calculate
  }
  
  if (!department.sla.onlyBusinessHours) {
    return true; // SLA runs 24/7
  }
  
  return isWithinBusinessHours(department);
}

module.exports = {
  isWithinBusinessHours,
  getBusinessHoursMessage,
  shouldCalculateSLA
};
