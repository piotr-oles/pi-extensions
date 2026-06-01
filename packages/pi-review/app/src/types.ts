export interface ReviewComment {
  id: string;
  quote: string;
  comment: string;
  timestamp: string;
  sent: boolean;
  error: boolean;
}

export interface SelectionInfo {
  quote: string;
  rect: DOMRect;
}
