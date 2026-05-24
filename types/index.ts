export type Patient = {
  id: string;
  full_name: string;
  age: number;
  gender: string;
  total_sketches: number;
  status: string;
  guardian_id: string;
  therapist_id: string | null;
};

export type Sketch = {
  id: string;
  patient_id: string;
  emotion: 'happy' | 'sad' | 'angry' | 'anxious';
  notes: string | null;
  therapist_notes: string | null;
  image_url: string | null;
  created_at: string;
  scores: Record<string, number> | null;
  therapist_message: string | null;
  pre_mood: string | null;
  status: 'submitted' | 'reviewing' | 'verified';
  reviewed_at: string | null;
  verified_at: string | null;
};

export type Profile = {
  id: string;
  full_name: string;
  role: string;
};

export type ChildEventType =
  | 'appointment'
  | 'homework_prompt'
  | 'check_in'
  | 'drawing_schedule';

export type ParentStatus = 'pending' | 'accepted' | 'rejected';

export type ChildEvent = {
  id: string;
  child_id: string;
  therapist_id: string;
  title: string;
  description: string | null;
  event_type: ChildEventType;
  scheduled_at: string;
  is_notified: boolean;
  parent_status: ParentStatus;
  created_at: string;
};
