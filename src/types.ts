export interface Employee {
  id?: string;
  name: string;
  address?: string;
  designation: string;
  agencyName: string;
  employeeId: string;
  bloodGroup?: string;
  contactNumber?: string;
  photoUrl?: string;
  validUntil?: string;
  validityRanges?: string; // For multiple ranges if needed
  cccName: string;
  workingArea?: string;
  issueNo?: string;
  issueDate?: string;
  createdAt: any; // Firestore Timestamp
  createdBy: string;
}
