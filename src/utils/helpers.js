// Utility helper functions

/**
 * Remove markdown formatting from text
 */
export const cleanMarkdownFormatting = (text) => {
  if (!text || typeof text !== 'string') return text || '';
  
  try {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`(.*?)`/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[\s]*[-*+]\s+/gm, '• ')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  } catch (error) {
    console.error('Error cleaning markdown:', error);
    return text;
  }
};

/**
 * Calculate age from date of birth
 */
export const calculateAge = (dob) => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

/**
 * Format recording duration from seconds to MM:SS
 */
export const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Get patient initials for avatar
 */
export const getPatientInitials = (patient) => {
  try {
    if (!patient) return '??';
    const firstName = patient.firstName || '';
    const lastName = patient.lastName || '';
    
    if (!firstName && !lastName) return '??';
    
    return (firstName[0] || '') + (lastName[0] || '');
  } catch (error) {
    console.error('Error getting patient initials:', error);
    return '??';
  }
};

/**
 * Get avatar color based on patient name
 */
export const getAvatarColor = (patient) => {
  try {
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    
    if (!patient) return colors[0];
    
    const firstName = patient.firstName || '';
    const lastName = patient.lastName || '';
    
    if (!firstName && !lastName) return colors[0];
    
    const charSum = (firstName.charCodeAt(0) || 0) + (lastName.charCodeAt(0) || 0);
    const index = Math.abs(charSum) % colors.length;
    return colors[index];
  } catch (error) {
    console.error('Error getting avatar color:', error);
    return '#3498db';
  }
};

/**
 * Validate patient data before saving
 */
export const validatePatientData = (patientData) => {
  const errors = [];
  
  if (!patientData.firstName?.trim()) {
    errors.push('First name is required');
  }
  
  if (!patientData.lastName?.trim()) {
    errors.push('Last name is required');
  }
  
  if (!patientData.dateOfBirth?.trim()) {
    errors.push('Date of birth is required');
  }
  
  if (patientData.email && !isValidEmail(patientData.email)) {
    errors.push('Invalid email address');
  }
  
  if (patientData.phone && !isValidPhone(patientData.phone)) {
    errors.push('Invalid phone number format');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate email format
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format
 */
export const isValidPhone = (phone) => {
  // Remove all non-digits
  const digitsOnly = phone.replace(/\D/g, '');
  // Check if it's 10 or 11 digits (with or without country code)
  return digitsOnly.length === 10 || digitsOnly.length === 11;
};

/**
 * Format phone number for display
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  
  const digitsOnly = phone.replace(/\D/g, '');
  
  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  } else if (digitsOnly.length === 11 && digitsOnly[0] === '1') {
    return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
  }
  
  return phone;
};

/**
 * Generate unique ID (timestamp-based)
 */
export const generateId = () => {
  return Date.now() + Math.random().toString(36).substr(2, 9);
};

/**
 * Filter patients by search term
 */
export const filterPatients = (patients, searchTerm) => {
  if (!searchTerm?.trim() || !Array.isArray(patients)) return patients;
  
  const term = searchTerm.toLowerCase();
  return patients.filter(patient => {
    if (!patient) return false;
    const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase();
    const dob = patient.dateOfBirth || '';
    const phone = patient.phone || '';
    const email = (patient.email || '').toLowerCase();
    const id = String(patient.id || '');
    
    return fullName.includes(term) || 
           dob.includes(term) || 
           phone.includes(term) || 
           email.includes(term) ||
           id.includes(term);
  });
};

/**
 * Sort patients by name
 */
export const sortPatientsByName = (patients) => {
  if (!Array.isArray(patients)) return [];
  
  return [...patients].sort((a, b) => {
    const nameA = `${a.lastName || ''} ${a.firstName || ''}`.toLowerCase();
    const nameB = `${b.lastName || ''} ${b.firstName || ''}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });
};

/**
 * Get patient display name
 */
export const getPatientDisplayName = (patient) => {
  if (!patient) return 'Unknown Patient';
  return `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unnamed Patient';
};

/**
 * Format date for display
 */
export const formatDate = (date) => {
  if (!date) return '';
  
  try {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return date;
  }
};

/**
 * Format time for display
 */
export const formatTime = (date) => {
  if (!date) return '';
  
  try {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return date;
  }
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text, maxLength = 150) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Debounce function for search inputs
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
