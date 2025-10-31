export interface Event {
  _id?: string;
  title: string;
  description: string;
  date: Date;
  location: string;
  clubId: string;
  attendees: Array<{
    userId: string;
    status: 'registered' | 'attended' | 'cancelled';
  }>;
  createdAt: Date;
  updatedAt: Date;
}