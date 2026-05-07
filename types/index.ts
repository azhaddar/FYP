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
};

export type Profile = {
  id: string;
  full_name: string;
  role: string;
};
