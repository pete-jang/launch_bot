/**
 * Types for Lunchlab order automation
 */

export interface MenuSummary {
  가정식: number;
  프레시밀: number;
}

export interface OrderSubmissionResult {
  success: boolean;
  submissionId?: string; // Lunchlab order ID for future updates
  error?: string;
  screenshotPath?: string;
}

export interface SubmissionStatus {
  submitted: boolean;
  submissionId?: string;
  orderDate: string;
}
