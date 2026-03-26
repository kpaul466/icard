export interface Employee {
  id?: string;
  name: string;
  address?: string;
  designation: string;
  agencyName: string;
  bloodGroup?: string;
  contactNumber?: string;
  photoUrl?: string;
  validUntil?: string;
  validityRanges?: string; // For multiple ranges if needed
  workingArea?: string;
  issueNo?: string;
  issueDate?: string;
  createdAt: any; // Firestore Timestamp
  createdBy: string;
  // Settings snapshot
  officePhone?: string;
  officeEmail?: string;
  issuingAuthority?: string;
  emergencyTag?: string;
  cccName?: string;
}
